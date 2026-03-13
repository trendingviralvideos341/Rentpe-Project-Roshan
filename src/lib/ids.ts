import prisma from "./prisma";

export type EntityType = 'USER' | 'OWNER' | 'PROPERTY' | 'ROOM' | 'BED' | 'BOOKING' | 'TENANT' | 'OWNER_EMPLOYEE' | 'ADMIN_EMPLOYEE';

const PREFIXES: Record<EntityType, string> = {
    USER: 'REN-USER',
    OWNER: 'REN-OWN',
    PROPERTY: 'REN-PROP',
    ROOM: 'REN-ROOM',
    BED: 'REN-BED',
    BOOKING: 'REN-BOOK',
    TENANT: 'REN-TEN',
    OWNER_EMPLOYEE: 'OWN-EMP',
    ADMIN_EMPLOYEE: 'REN-EMP'
};

/**
 * Generates a sequential ID for a given entity type.
 * Format: REN-[TYPE]-[0001]
 */
export async function generateSequentialId(type: EntityType): Promise<string> {
    const prefix = PREFIXES[type];
    let count = 0;

    switch (type) {
        case 'USER':
            // Count users who are NOT owners
            count = await prisma.user.count({ where: { isOwner: false } });
            break;
        case 'OWNER':
            // Count users who ARE owners
            count = await prisma.user.count({ where: { isOwner: true } });
            break;
        case 'PROPERTY':
            count = await prisma.property.count();
            break;
        case 'ROOM':
            count = await prisma.room.count();
            break;
        case 'BED':
            count = await prisma.bed.count();
            break;
        case 'BOOKING':
            count = await prisma.booking.count();
            break;
        case 'TENANT':
            count = await prisma.tenant.count();
            break;
        case 'OWNER_EMPLOYEE':
            count = await prisma.ownerEmployee.count();
            break;
        case 'ADMIN_EMPLOYEE':
            count = await prisma.adminEmployee.count();
            break;
    }

    // Use 1-based indexing for the suffix
    const suffix = (count + 1).toString().padStart(4, '0');
    return `${prefix}-${suffix}`;
}
