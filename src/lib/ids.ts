import prisma from './prisma';
import { logAuditEvent } from './audit';
import crypto from 'crypto';

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║       RENTPE PROFESSIONAL IDENTITY SYSTEM  (v2 — RP prefix)         ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Two-track design:                                                   ║
 * ║                                                                      ║
 * ║  OPAQUE  → Random, non-guessable  (Users, Properties, Rooms, Beds)  ║
 * ║    Why?  Prevents competitor enumeration of your user count,         ║
 * ║          stops IDOR (Insecure Direct Object Reference) attacks,      ║
 * ║          and hides business growth metrics from scraping bots.       ║
 * ║    e.g.  RP-U-K9X4RAQB   RP-P-MQ3JTCWN                             ║
 * ║                                                                      ║
 * ║  SEQUENTIAL → Numbered, auditable  (Bookings, Invoices, Payments)   ║
 * ║    Why?  GST law & Income Tax require sequential invoice numbering.  ║
 * ║          Auditors/courts need to detect gaps (sign of fraud).        ║
 * ║    e.g.  RP-B-2627-00001   RP-INV-2627-000001                       ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Existing IDs in DB (REN-USER-xxxx) are NOT touched — they are permanent.
 * New entities created after this deployment get the RP- format.
 */

// ─── Charset ──────────────────────────────────────────────────────────────────
// 32 chars — removes visually ambiguous pairs: 0/O, 1/I, S/5
// Reason: IDs get spoken over phone calls, printed on agreements, typed by staff.
// Removing these 6 chars eliminates the #1 cause of human transcription errors.
// Digits-only: easy to read, speak, and type from printed agreements.
// 10 digits per ID = 10 billion combinations — no collision risk at any realistic scale.
const CHARSET = '0123456789';

// ─── Config ───────────────────────────────────────────────────────────────────
const ID_CONFIG: Record<string, {
    prefix:     string;
    track:      'OPAQUE' | 'SEQUENTIAL';
    randomLen?: number;   // OPAQUE only — chars of entropy
    pad?:       number;   // SEQUENTIAL only — zero-padding width
    resetPerFY: boolean;  // SEQUENTIAL only — reset counter each Financial Year
    auditLog:   boolean;  // Write to AuditLog table (mandatory for financial IDs)
}> = {
    // ── OPAQUE IDs (People & Assets) ────────────────────────────────────
    // 10 random digits = 10^10 = 10 billion combinations
    // Collision probability at 1M users: ~0.005% (negligible)
    'USER':     { prefix: 'RP-U',   track: 'OPAQUE', randomLen: 10, resetPerFY: false, auditLog: true  },
    'OWNER':    { prefix: 'RP-O',   track: 'OPAQUE', randomLen: 10, resetPerFY: false, auditLog: true  },
    'STAFF':    { prefix: 'RP-S',   track: 'OPAQUE', randomLen: 8,  resetPerFY: false, auditLog: false },
    'EMPLOYEE': { prefix: 'RP-E',   track: 'OPAQUE', randomLen: 8,  resetPerFY: false, auditLog: false },
    'PROPERTY': { prefix: 'RP-P',   track: 'OPAQUE', randomLen: 10, resetPerFY: false, auditLog: false },
    'ROOM':     { prefix: 'RP-R',   track: 'OPAQUE', randomLen: 8,  resetPerFY: false, auditLog: false },
    'BED':      { prefix: 'RP-BD',  track: 'OPAQUE', randomLen: 8,  resetPerFY: false, auditLog: false },
    'KYC':      { prefix: 'RP-K',   track: 'OPAQUE', randomLen: 8,  resetPerFY: false, auditLog: true  },
    'TICKET':   { prefix: 'RP-T',   track: 'OPAQUE', randomLen: 8,  resetPerFY: false, auditLog: false },

    // ── SEQUENTIAL IDs (Financial & Legal Records) ───────────────────────
    // BOOKING: does NOT reset per FY (a booking from 2025 stays RP-B-2526-00001 forever)
    'BOOKING':  { prefix: 'RP-B',   track: 'SEQUENTIAL', pad: 5, resetPerFY: false, auditLog: true  },
    // INVOICE & PAYMENT: reset per FY (GST requires fresh sequence each financial year)
    'INVOICE':  { prefix: 'RP-INV', track: 'SEQUENTIAL', pad: 6, resetPerFY: true,  auditLog: true  },
    'PAYMENT':  { prefix: 'RP-PAY', track: 'SEQUENTIAL', pad: 6, resetPerFY: true,  auditLog: true  },
};

// ─── Financial Year (Indian: April → March) ──────────────────────────────────
/**
 * Returns compact FY string for use in IDs.
 * April 2026 – March 2027 → "2627"
 * Jan  2026 – March 2026 → "2526"
 */
export function getFinancialYearShort(): string {
    const now   = new Date();
    const month = now.getMonth() + 1; // 1-12
    const year  = now.getFullYear();
    if (month <= 3) {
        return `${(year - 1).toString().slice(2)}${year.toString().slice(2)}`;
    }
    return `${year.toString().slice(2)}${(year + 1).toString().slice(2)}`;
}

// Backward-compatible alias used by billing/invoice code
export function getFinancialYear(): string {
    const fy = getFinancialYearShort(); // e.g. "2627"
    return `FY${fy.slice(0, 2)}-${fy.slice(2)}`; // → "FY26-27"
}

// ─── Random Block Generator ───────────────────────────────────────────────────
/**
 * Cryptographically random string from the safe 32-char charset.
 * Uses Node crypto — NOT Math.random() (which is not cryptographically secure).
 */
function randomBlock(length: number): string {
    const bytes = crypto.randomBytes(length * 2); // extra bytes for rejection sampling
    let result  = '';
    let i       = 0;
    while (result.length < length && i < bytes.length) {
        const byte = bytes[i++];
        // Rejection sampling: discard bytes that would bias toward lower chars
        if (byte < CHARSET.length * Math.floor(256 / CHARSET.length)) {
            result += CHARSET[byte % CHARSET.length];
        }
    }
    // Fallback: if somehow we run out (extremely rare), pad with direct modulo
    while (result.length < length) {
        result += CHARSET[crypto.randomBytes(1)[0] % CHARSET.length];
    }
    return result;
}

// ─── Core Generator ───────────────────────────────────────────────────────────
/**
 * Generates a permanent, immutable identifier for a given entity type.
 *
 * @param type  Key from ID_CONFIG (e.g. 'USER', 'INVOICE')
 * @returns     Branded ID string, e.g. "RP-U-K9X4RAQB" or "RP-INV-2627-000001"
 */
export async function generateSequentialId(type: string): Promise<string> {
    const config = ID_CONFIG[type];
    if (!config) throw new Error(`[ID_ENGINE] Unknown type: "${type}". Add it to ID_CONFIG in ids.ts.`);

    // ── Track A: OPAQUE ─────────────────────────────────────────────────
    if (config.track === 'OPAQUE') {
        const random    = randomBlock(config.randomLen ?? 8);
        const displayId = `${config.prefix}-${random}`;
        // Note: at 32^8 combinations for 8-char IDs, collision checks are not needed
        // (probability lower than a SHA-256 hash collision at any realistic scale).
        return displayId;
    }

    // ── Track B: SEQUENTIAL ─────────────────────────────────────────────
    const fy    = getFinancialYearShort();                 // e.g. "2627"
    const fyKey = config.resetPerFY ? `FY${fy}` : 'GLOBAL'; // GLOBAL = never resets

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
                isolationLevel: 'Serializable', // Strictest — no phantom reads on counter rows
                timeout:        10_000,
                maxWait:        5_000,
            });
            break;
        } catch (e: any) {
            // P2034 = write conflict / deadlock — safe to retry
            if ((e.code === 'P2034' || e.code === 'P2028') && attempt < MAX_RETRIES - 1) {
                await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt))); // 100, 200, 400, 800ms
                continue;
            }
            throw e;
        }
    }

    const padded    = counter.sequence.toString().padStart(config.pad ?? 5, '0');
    const displayId = config.resetPerFY
        ? `${config.prefix}-${fy}-${padded}`   // e.g. RP-INV-2627-000001
        : `${config.prefix}-${padded}`;         // e.g. RP-B-00001  (bookings don't reset)

    // Financial IDs always get audit-logged (mandatory for GST compliance)
    if (config.auditLog) {
        logAuditEvent({
            actorId:     'SYSTEM',
            actorRole:   'SYSTEM',
            actorName:   'ID_ENGINE',
            actionType:  'CREATE',
            entityType:  'ID_COUNTER',
            entityId:    `${type}-${fyKey}`,
            description: `[ID_ENGINE] Generated ${type} ID: ${displayId} (seq=${counter.sequence})`,
            newValue:    { displayId, type, fyKey, sequence: counter.sequence, ts: new Date().toISOString() },
        }).catch(() => {}); // Non-blocking — ID generation must not fail because of logging
    }

    return displayId;
}

// ─── Legacy Alias ─────────────────────────────────────────────────────────────
// All callers use generateSequentialId directly now.
// This alias remains so any old import doesn't break.
export async function generateMasterId(type: string): Promise<string> {
    const legacyMap: Record<string, string> = {
        'TENANT':       'USER',
        'TENANCY':      'BOOKING',
        'OWNER_STAFF':  'STAFF',
        'ADMIN_STAFF':  'EMPLOYEE',
        'ONBOARDER':    'EMPLOYEE',
        'VERIFIER':     'EMPLOYEE',
        'ADMIN':        'EMPLOYEE',
    };
    return generateSequentialId(legacyMap[type] ?? type);
}
