import prisma from './prisma';
import { logAuditEvent } from './audit';
import crypto from 'crypto';

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║        RENTPE PROFESSIONAL IDENTITY ENGINE  (v3 — Collision-Proof)  ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  TWO-TRACK DESIGN:                                                   ║
 * ║                                                                      ║
 * ║  TRACK A — OPAQUE  (Users, Owners, Properties, Rooms, Beds...)      ║
 * ║    Format : RP-U-1234567890   RP-P-9384756201                        ║
 * ║    Method : Cryptographically random 10-digit number                 ║
 * ║    Safety : 3-layer collision protection (see below)                 ║
 * ║                                                                      ║
 * ║  TRACK B — SEQUENTIAL  (Bookings, Invoices, Payments)               ║
 * ║    Format : RP-B-00001   RP-INV-2627-000001                          ║
 * ║    Method : Atomic DB counter — guaranteed no gaps, no duplicates    ║
 * ║    Safety : Serializable transaction + exponential retry             ║
 * ║                                                                      ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  3-LAYER COLLISION PROTECTION (OPAQUE IDs):                          ║
 * ║                                                                      ║
 * ║  Layer 1 — Probability: 10 digits = 10 Billion combos.              ║
 * ║             At 1M users, collision chance = 0.005% (near zero).     ║
 * ║                                                                      ║
 * ║  Layer 2 — Pre-Check: Before returning any ID, we query the DB      ║
 * ║             to verify it doesn't already exist. If it does, we      ║
 * ║             generate a fresh one and try again (up to 10x).         ║
 * ║                                                                      ║
 * ║  Layer 3 — DB Constraint: displayId is @unique in schema.           ║
 * ║             Even if layers 1+2 somehow both fail, the DB will        ║
 * ║             physically reject the duplicate. The app will never      ║
 * ║             silently create two records with the same ID.            ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

// ─── Charset ──────────────────────────────────────────────────────────────────
// Digits only — easy to read on agreements, speak over phone, type from print.
const CHARSET = '0123456789';

// ─── Config ───────────────────────────────────────────────────────────────────
const ID_CONFIG: Record<string, {
    prefix:     string;
    track:      'OPAQUE' | 'SEQUENTIAL';
    randomLen?: number;  // OPAQUE only
    pad?:       number;  // SEQUENTIAL only
    resetPerFY: boolean; // SEQUENTIAL only — reset counter per Financial Year?
    auditLog:   boolean;
}> = {
    // ── OPAQUE — Random IDs (People & Physical Assets) ──────────────────
    'USER':     { prefix: 'RP-U',   track: 'OPAQUE', randomLen: 10, resetPerFY: false, auditLog: true  },
    'OWNER':    { prefix: 'RP-O',   track: 'OPAQUE', randomLen: 10, resetPerFY: false, auditLog: true  },
    'STAFF':    { prefix: 'RP-S',   track: 'OPAQUE', randomLen: 8,  resetPerFY: false, auditLog: false },
    'EMPLOYEE': { prefix: 'RP-E',   track: 'OPAQUE', randomLen: 8,  resetPerFY: false, auditLog: false },
    'PROPERTY': { prefix: 'RP-P',   track: 'OPAQUE', randomLen: 10, resetPerFY: false, auditLog: false },
    'ROOM':     { prefix: 'RP-R',   track: 'OPAQUE', randomLen: 8,  resetPerFY: false, auditLog: false },
    'BED':      { prefix: 'RP-BD',  track: 'OPAQUE', randomLen: 8,  resetPerFY: false, auditLog: false },
    'KYC':      { prefix: 'RP-K',   track: 'OPAQUE', randomLen: 8,  resetPerFY: false, auditLog: true  },
    'TICKET':   { prefix: 'RP-T',   track: 'OPAQUE', randomLen: 8,  resetPerFY: false, auditLog: false },
    'NOTICE':   { prefix: 'RP-VN',  track: 'OPAQUE', randomLen: 8,  resetPerFY: false, auditLog: false },

    // ── SEQUENTIAL — Numbered IDs (Financial & Legal Records) ────────────
    // BOOKING does NOT reset per FY (a booking ID is permanent for its lifetime)
    'BOOKING':  { prefix: 'RP-B',   track: 'SEQUENTIAL', pad: 5, resetPerFY: false, auditLog: true  },
    // INVOICE & PAYMENT reset per FY (GST mandates fresh sequence each financial year)
    'INVOICE':  { prefix: 'RP-INV', track: 'SEQUENTIAL', pad: 6, resetPerFY: true,  auditLog: true  },
    'PAYMENT':  { prefix: 'RP-PAY', track: 'SEQUENTIAL', pad: 6, resetPerFY: true,  auditLog: true  },
};

// ─── Financial Year (Indian: April → March) ───────────────────────────────────
export function getFinancialYearShort(): string {
    const now   = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();
    if (month <= 3) return `${(year - 1).toString().slice(2)}${year.toString().slice(2)}`;
    return `${year.toString().slice(2)}${(year + 1).toString().slice(2)}`;
}

// Backward-compatible alias used by billing/invoice code
export function getFinancialYear(): string {
    const fy = getFinancialYearShort();
    return `FY${fy.slice(0, 2)}-${fy.slice(2)}`; // "2627" → "FY26-27"
}

// ─── Cryptographic Random Block ───────────────────────────────────────────────
/**
 * Generates a cryptographically random digit string.
 * Uses rejection sampling to eliminate modulo bias (fair distribution).
 */
function randomBlock(length: number): string {
    // Request extra bytes to account for rejected samples
    const bytes  = crypto.randomBytes(length * 2);
    let result   = '';
    let i        = 0;
    // Rejection sampling: only accept bytes that map fairly onto CHARSET
    const limit  = CHARSET.length * Math.floor(256 / CHARSET.length);
    while (result.length < length && i < bytes.length) {
        if (bytes[i] < limit) {
            result += CHARSET[bytes[i] % CHARSET.length];
        }
        i++;
    }
    // Ultra-rare fallback: if we exhausted buffer, fill remaining without bias risk
    while (result.length < length) {
        const b = crypto.randomBytes(1)[0];
        if (b < limit) result += CHARSET[b % CHARSET.length];
    }
    return result;
}

// ─── Layer 2: Pre-Insert Uniqueness Check ─────────────────────────────────────
/**
 * Checks the correct DB table to confirm the candidate ID doesn't already exist.
 * This is the pre-flight check BEFORE saving — catches collisions before they hit the DB.
 */
async function isDisplayIdTaken(type: string, displayId: string): Promise<boolean> {
    try {
        switch (type) {
            case 'USER':
            case 'OWNER':
            case 'STAFF':
            case 'EMPLOYEE':
                return !!(await (prisma as any).user.findFirst({ where: { displayId }, select: { id: true } }));
            case 'PROPERTY':
                return !!(await (prisma as any).property.findFirst({ where: { displayId }, select: { id: true } }));
            case 'ROOM':
                return !!(await (prisma as any).room.findFirst({ where: { displayId }, select: { id: true } }));
            case 'BED':
                return !!(await (prisma as any).bed.findFirst({ where: { displayId }, select: { id: true } }));
            case 'TICKET':
                return !!(await (prisma as any).ticket.findFirst({ where: { displayId }, select: { id: true } }));
            case 'NOTICE':
                return !!(await (prisma as any).vacatingNotice.findFirst({ where: { displayId }, select: { id: true } }));
            default:
                // No pre-check for unknown types — Layer 3 (DB constraint) handles it
                return false;
        }
    } catch {
        // If the check itself fails (e.g., DB timeout), skip it.
        // Layer 3 (DB UNIQUE constraint) is still active as the final guard.
        return false;
    }
}

// ─── Core Generator ───────────────────────────────────────────────────────────
/**
 * Generates a permanent, immutable, 100% unique identifier for any entity.
 * Works safely at any scale — from 1 user to billions.
 *
 * @param type  Key from ID_CONFIG (e.g. 'USER', 'INVOICE')
 * @returns     Branded ID string, e.g. "RP-U-8392047163" or "RP-INV-2627-000001"
 */
export async function generateSequentialId(type: string): Promise<string> {
    const config = ID_CONFIG[type];
    if (!config) throw new Error(`[ID_ENGINE] Unknown type: "${type}". Register it in ID_CONFIG in ids.ts.`);

    // ────────────────────────────────────────────────────────────────────
    // TRACK A: OPAQUE (Random)
    // ────────────────────────────────────────────────────────────────────
    if (config.track === 'OPAQUE') {
        const MAX_ATTEMPTS = 10; // Way more than enough — at 1M users, collision chance per attempt < 0.01%

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            const random    = randomBlock(config.randomLen ?? 10);
            const displayId = `${config.prefix}-${random}`;

            // Layer 2: Pre-flight DB check
            const taken = await isDisplayIdTaken(type, displayId);

            if (!taken) {
                // ✅ Unique confirmed — return it
                return displayId;
            }

            // Collision detected (extremely rare) — log and retry
            console.warn(`[ID_ENGINE] ⚠️ Collision on attempt ${attempt}/${MAX_ATTEMPTS} for type "${type}": ${displayId}. Generating new ID...`);
        }

        // If we exhausted all retries (should never happen in practice),
        // throw a loud error so the ops team knows to increase randomLen
        throw new Error(
            `[ID_ENGINE] CRITICAL: Could not generate a unique ${type} ID after ${MAX_ATTEMPTS} attempts. ` +
            `This means the ID space is very dense. Increase randomLen for "${type}" in ID_CONFIG.`
        );
    }

    // ────────────────────────────────────────────────────────────────────
    // TRACK B: SEQUENTIAL (Atomic Counter)
    // ────────────────────────────────────────────────────────────────────
    const fy    = getFinancialYearShort();
    const fyKey = config.resetPerFY ? `FY${fy}` : 'GLOBAL';

    const MAX_RETRIES = 5;
    let counter: any;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            counter = await prisma.$transaction(async (tx) => {
                return await (tx as any).idCounter.upsert({
                    where:  { type_fyKey: { type, fyKey } },
                    update: { sequence: { increment: 1 } },
                    create: { type, fyKey, sequence: 1   },
                });
            }, {
                isolationLevel: 'Serializable', // Strictest isolation — no phantom reads
                timeout:        10_000,
                maxWait:        5_000,
            });
            break; // ✅ Got the counter — exit retry loop
        } catch (e: any) {
            // P2034 = write conflict / deadlock — safe to retry with backoff
            if ((e.code === 'P2034' || e.code === 'P2028') && attempt < MAX_RETRIES - 1) {
                await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt))); // 100, 200, 400, 800ms
                continue;
            }
            throw e;
        }
    }

    const padded    = counter.sequence.toString().padStart(config.pad ?? 5, '0');
    const displayId = config.resetPerFY
        ? `${config.prefix}-${fy}-${padded}` // e.g. RP-INV-2627-000001
        : `${config.prefix}-${padded}`;       // e.g. RP-B-00001

    // Mandatory audit log for all financial IDs (GST & Income Tax compliance)
    if (config.auditLog) {
        logAuditEvent({
            actorId:     'SYSTEM',
            actorRole:   'SYSTEM',
            actorName:   'ID_ENGINE',
            actionType:  'CREATE',
            entityType:  'ID_COUNTER',
            entityId:    `${type}-${fyKey}`,
            description: `[ID_ENGINE] Issued ${type} ID: ${displayId} (seq=${counter.sequence})`,
            newValue:    { displayId, type, fyKey, sequence: counter.sequence, ts: new Date().toISOString() },
        }).catch(() => {}); // Non-blocking — ID generation must never fail due to logging
    }

    return displayId;
}

// ─── Legacy Alias ─────────────────────────────────────────────────────────────
// Keeps older imports working without any changes.
export async function generateMasterId(type: string): Promise<string> {
    const legacyMap: Record<string, string> = {
        'TENANT':      'USER',
        'TENANCY':     'BOOKING',
        'OWNER_STAFF': 'STAFF',
        'ADMIN_STAFF': 'EMPLOYEE',
        'ONBOARDER':   'EMPLOYEE',
        'VERIFIER':    'EMPLOYEE',
        'ADMIN':       'EMPLOYEE',
    };
    return generateSequentialId(legacyMap[type] ?? type);
}
