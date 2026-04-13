import prisma from './prisma';
import { logAuditEvent } from './audit';

// ─── Indian Financial Year (April to March) ───────────────────────────────────
export function getFinancialYear(): string {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const year = now.getFullYear();
    // Jan-March → previous year to current year
    // April-Dec → current year to next year
    if (month <= 3) {
        return `FY${(year - 1).toString().slice(2)}-${year.toString().slice(2)}`;
    }
    return `FY${year.toString().slice(2)}-${(year + 1).toString().slice(2)}`;
}

// ─── ID Format Configuration ──────────────────────────────────────────────────
// KEEP EXISTING formats for User/Owner/Property/Room/Bed — unchanged
// ADD year/FY only for financial and booking records
const ID_CONFIG: Record<string, {
    prefix: string;
    pad: number;
    useYear: boolean;
    useFY: boolean;
    resetPerFY: boolean;
    auditLog: boolean;
}> = {
    // People — existing formats UNCHANGED
    'USER':     { prefix: 'REN-USER',  pad: 4, useYear: false, useFY: false, resetPerFY: false, auditLog: false },
    'OWNER':    { prefix: 'REN-OWN',   pad: 4, useYear: false, useFY: false, resetPerFY: false, auditLog: false },
    'STAFF':    { prefix: 'OWN-STAFF', pad: 4, useYear: false, useFY: false, resetPerFY: false, auditLog: false },
    'EMPLOYEE': { prefix: 'REN-EMP',   pad: 4, useYear: false, useFY: false, resetPerFY: false, auditLog: false },

    // Physical assets — existing formats UNCHANGED
    'PROPERTY': { prefix: 'APP-RP',    pad: 4, useYear: false, useFY: false, resetPerFY: false, auditLog: false },
    'ROOM':     { prefix: 'REN-ROOM',  pad: 4, useYear: false, useFY: false, resetPerFY: false, auditLog: false },
    'BED':      { prefix: 'REN-BED',   pad: 4, useYear: false, useFY: false, resetPerFY: false, auditLog: false },

    // Transactions — add year/FY
    'BOOKING':  { prefix: 'REN-BOOK',  pad: 4, useYear: true,  useFY: false, resetPerFY: false, auditLog: false },
    'INVOICE':  { prefix: 'INV',       pad: 5, useYear: false, useFY: true,  resetPerFY: true,  auditLog: true  },
    'PAYMENT':  { prefix: 'PAY',       pad: 5, useYear: false, useFY: true,  resetPerFY: true,  auditLog: true  },

    // Support
    'TICKET':   { prefix: 'TKT',       pad: 5, useYear: true,  useFY: false, resetPerFY: false, auditLog: false },
    'KYC':      { prefix: 'KYC',       pad: 5, useYear: true,  useFY: false, resetPerFY: false, auditLog: false },
};

// ─── Core ID Generator — Atomic + Race-condition-safe ─────────────────────────
export async function generateSequentialId(type: string): Promise<string> {
    const config = ID_CONFIG[type];
    if (!config) throw new Error(`Unknown ID type: ${type}`);

    const fy = getFinancialYear();
    const year = new Date().getFullYear();

    // fyKey is NEVER null — "GLOBAL" for non-FY types
    const fyKey = config.resetPerFY ? fy : "GLOBAL";

    // ATOMIC upsert with ReadCommitted isolation (sufficient for counter increments)
    // Retry up to 5x on P2034 deadlock/write-conflict with exponential backoff
    const MAX_RETRIES = 5;
    let counter: any;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            counter = await prisma.$transaction(async (tx) => {
                return await (tx as any).idCounter.upsert({
                    where: {
                        type_fyKey: { type, fyKey }
                    },
                    update: {
                        sequence: { increment: 1 }
                    },
                    create: {
                        type,
                        fyKey,
                        sequence: 1
                    }
                });
            }, {
                isolationLevel: 'ReadCommitted', // Less strict — no deadlocks on upsert increments
                timeout: 10000,
                maxWait: 5000,
            });
            break; // Success — exit retry loop
        } catch (e: any) {
            // P2034 = write conflict or deadlock — retry with exponential backoff
            if (e.code === 'P2034' && attempt < MAX_RETRIES - 1) {
                await new Promise(r => setTimeout(r, 50 * Math.pow(2, attempt))); // 50, 100, 200, 400ms
                continue;
            }
            throw e; // Non-retriable error or max retries exceeded
        }
    }

    const padded = counter.sequence.toString().padStart(config.pad, '0');

    // Build display ID
    let displayId: string;
    if (config.useFY) {
        displayId = `${config.prefix}-${fy}-${padded}`;    // INV-FY26-27-00001
    } else if (config.useYear) {
        displayId = `${config.prefix}-${year}-${padded}`;  // REN-BOOK-2026-0001
    } else {
        displayId = `${config.prefix}-${padded}`;          // REN-USER-0001
    }

    // Audit log for financial IDs only (GST compliance)
    if (config.auditLog) {
        logAuditEvent({
            actorId: 'SYSTEM',
            actorRole: 'SYSTEM',
            actorName: 'ID Generator',
            actionType: 'CREATE',
            entityType: 'ID_COUNTER',
            entityId: `${type}-${fyKey}`,
            description: `Generated ${type} ID: ${displayId} | sequence=${counter.sequence} | fyKey=${fyKey}`,
            newValue: { type, fyKey, sequence: counter.sequence, displayId, timestamp: new Date().toISOString() }
        }).catch(err => console.error('Audit log failed for ID generation:', err));
    }

    return displayId;
}

// ─── Backward-compatible alias ─────────────────────────────────────────────────
// All existing callers have been migrated to generateSequentialId.
// This alias is kept only as a safety net — do not use for new code.
export async function generateMasterId(type: string): Promise<string> {
    // Map legacy EntityType keys to new ID_CONFIG keys
    const legacyMap: Record<string, string> = {
        'OWNER_STAFF':  'STAFF',
        'ADMIN_STAFF':  'EMPLOYEE',
        'TENANT':       'USER',
        'TENANCY':      'BOOKING',
        'ONBOARDER':    'EMPLOYEE',
        'VERIFIER':     'EMPLOYEE',
        'ADMIN':        'EMPLOYEE',
    };
    const resolved = legacyMap[type] ?? type;
    return generateSequentialId(resolved);
}
