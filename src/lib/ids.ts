import prisma from "./prisma";

export type EntityType = 
    | 'USER' 
    | 'OWNER' 
    | 'PROPERTY' 
    | 'ROOM' 
    | 'BED' 
    | 'BOOKING' 
    | 'TENANT' 
    | 'OWNER_STAFF' 
    | 'ADMIN_STAFF' 
    | 'TENANCY' 
    | 'INVOICE'
    | 'ONBOARDER'
    | 'VERIFIER';

const PREFIXES: Record<EntityType, string> = {
    USER: 'USER',
    OWNER: 'OWN',
    PROPERTY: 'PROP',
    ROOM: 'ROOM',
    BED: 'BED',
    BOOKING: 'BOOK',
    TENANT: 'TNT',
    OWNER_STAFF: 'OWN-STAFF',
    ADMIN_STAFF: 'ADM-STAFF',
    TENANCY: 'TNC',
    INVOICE: 'INV',
    ONBOARDER: 'ONB',
    VERIFIER: 'VER'
};

/**
 * PRODUCTION-GRADE ID GENERATOR
 * Uses IdCounter model for race-condition-safe sequential numbers.
 */
export async function generateMasterId(type: EntityType, fyKey: string = 'GLOBAL'): Promise<string> {
    const prefix = PREFIXES[type];
    
    // Atomic increment using a transaction to prevent race conditions
    const counter = await prisma.$transaction(async (tx: any) => {
        // 1. Get current counter or create if missing
        let c = await tx.idCounter.findUnique({
            where: { type_fyKey: { type, fyKey } }
        });

        if (!c) {
            // INITIALIZATION LOGIC (Legacy Safety)
            // To prevent collisions with existing manual IDs, we find the current max.
            const startSeq = await getInitialSequence(type);
            c = await tx.idCounter.create({
                data: { type, fyKey, sequence: startSeq }
            });
        }

        // 2. Increment and return
        return await tx.idCounter.update({
            where: { id: c.id },
            data: { sequence: { increment: 1 } }
        });
    });

    // Format: PREFIX-YY-XXXX (if FY) or PREFIX-XXXX (if GLOBAL)
    const seqStr = counter.sequence.toString().padStart(4, '0');
    if (fyKey === 'GLOBAL') {
        return `${prefix}-${seqStr}`;
    }
    return `${prefix}-${fyKey}-${seqStr}`;
}

/**
 * Legacy Support: Finds the highest existing sequence number in the DB 
 * to ensure the new IdCounter starts after the last used ID.
 */
async function getInitialSequence(type: EntityType): Promise<number> {
    function extractNum(id: string | null | undefined): number {
        if (!id) return 0;
        const parts = id.split('-');
        return parseInt(parts[parts.length - 1]) || 0;
    }

    let maxNum = 0;

    switch (type) {
        case 'USER':
        case 'OWNER':
            const lastUser = await prisma.user.findFirst({
                orderBy: { displayId: 'desc' },
                select: { displayId: true }
            });
            maxNum = extractNum(lastUser?.displayId);
            break;
        case 'PROPERTY':
            const lastProp = await prisma.property.findFirst({
                orderBy: { displayId: 'desc' },
                select: { displayId: true }
            });
            maxNum = extractNum(lastProp?.displayId);
            break;
        case 'ROOM':
            const lastRoom = await prisma.room.findFirst({
                orderBy: { displayId: 'desc' },
                select: { displayId: true }
            });
            maxNum = extractNum(lastRoom?.displayId);
            break;
        case 'BED':
            const lastBed = await prisma.bed.findFirst({
                orderBy: { displayId: 'desc' },
                select: { displayId: true }
            });
            maxNum = extractNum(lastBed?.displayId);
            break;
        case 'BOOKING':
            const lastBooking = await prisma.booking.findFirst({
                orderBy: { displayId: 'desc' },
                select: { displayId: true }
            });
            maxNum = extractNum(lastBooking?.displayId);
            break;
        case 'OWNER_STAFF':
            // Check legacy OwnerEmployee table if it exists or use OwnerStaff
            const lastStaff = await prisma.ownerStaff.findFirst({
                orderBy: { displayId: 'desc' },
                select: { displayId: true }
            });
            maxNum = extractNum(lastStaff?.displayId);
            break;
        case 'TENANCY':
            const lastTenancy = await (prisma as any).tenancy.findFirst({
                orderBy: { displayId: 'desc' },
                select: { displayId: true }
            });
            maxNum = extractNum(lastTenancy?.displayId);
            break;
    }

    return maxNum;
}

/**
 * Compatibility wrapper for existing code that still calls generateSequentialId
 */
export async function generateSequentialId(type: EntityType, count?: number): Promise<string | string[]> {
    if (count && count > 1) {
        const ids: string[] = [];
        for (let i = 0; i < count; i++) {
            ids.push(await generateMasterId(type));
        }
        return ids;
    }
    return await generateMasterId(type);
}
