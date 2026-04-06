import prisma from "./prisma";

export type EntityType = 'USER' | 'OWNER' | 'PROPERTY' | 'ROOM' | 'BED' | 'BOOKING' | 'TENANT' | 'OWNER_EMPLOYEE' | 'ADMIN_EMPLOYEE';

const PREFIXES: Record<EntityType, string> = {
    USER: 'REN-USER',
    OWNER: 'REN-OWN',
    PROPERTY: 'APP-RP',
    ROOM: 'REN-ROOM',
    BED: 'REN-BED',
    BOOKING: 'REN-BOOK',
    TENANT: 'APP-TEN',
    OWNER_EMPLOYEE: 'OWN-STAFF',
    ADMIN_EMPLOYEE: 'REN-EMP'
};

function extractNum(id: string | null | undefined): number {
    if (!id) return 0;
    const parts = id.split('-');
    return parseInt(parts[parts.length - 1]) || 0;
}

export async function generateSequentialId(type: EntityType): Promise<string>;
export async function generateSequentialId(type: EntityType, count: number): Promise<string[]>;
export async function generateSequentialId(type: EntityType, count?: number): Promise<string | string[]> {
    const prefix = PREFIXES[type];
    let lastId: string | null = null;
    const numToGenerate = count ?? 1;

    // Use indexed findFirst (O(1)) with stable sorting for high-speed ID generation
    switch (type) {
        // ... (rest of switch stays same)
        case 'USER':
            const lastUser = await prisma.user.findFirst({ 
                where: { isOwner: false, displayId: { startsWith: 'REN-USER-' } }, 
                orderBy: { displayId: 'desc' }, 
                select: { displayId: true } 
            });
            lastId = lastUser?.displayId || null;
            break;
        case 'OWNER':
            // Current format: REN-OWN-XXXX
            const lastOwner = await prisma.user.findFirst({ 
                where: { isOwner: true, displayId: { startsWith: 'REN-OWN-' } }, 
                orderBy: { displayId: 'desc' }, 
                select: { displayId: true } 
            });
            // Legacy Gen 2: APP-OWN-XXXX
            const lastAppOwner = await prisma.user.findFirst({ 
                where: { isOwner: true, displayId: { startsWith: 'APP-OWN-' } }, 
                orderBy: { displayId: 'desc' }, 
                select: { displayId: true } 
            });
            // Legacy Gen 1: REG-OWN-XXXX
            const lastRegOwner = await prisma.user.findFirst({
                where: { isOwner: true, displayId: { startsWith: 'REG-OWN-' } },
                orderBy: { displayId: 'desc' },
                select: { displayId: true }
            });

            const ownerNum = Math.max(
                extractNum(lastOwner?.displayId), 
                extractNum(lastAppOwner?.displayId), 
                extractNum(lastRegOwner?.displayId)
            );
            lastId = ownerNum > 0 ? `REN-OWN-${ownerNum.toString().padStart(4, '0')}` : null;
            break;
        case 'PROPERTY':
            // Gen 3 (current): APP-RP-XXXX
            const lastProp = await prisma.property.findFirst({ 
                where: { displayId: { startsWith: 'APP-RP-' } },
                orderBy: { displayId: 'desc' }, 
                select: { displayId: true } 
            });
            // Gen 1 (legacy): RP-REG-XXXX
            const lastRegProp = await prisma.property.findFirst({
                where: { displayId: { startsWith: 'RP-REG-' } },
                orderBy: { displayId: 'desc' },
                select: { displayId: true }
            });
            // Gen 2 (intermediate): REN-PROP-XXXX — must also be covered
            const lastRenProp = await prisma.property.findFirst({
                where: { displayId: { startsWith: 'REN-PROP-' } },
                orderBy: { displayId: 'desc' },
                select: { displayId: true }
            });
            
            // Take the MAX across all 3 generations to ensure no future collisions
            const propNum = Math.max(
                extractNum(lastProp?.displayId),
                extractNum(lastRegProp?.displayId),
                extractNum(lastRenProp?.displayId)
            );
            lastId = propNum > 0 ? `APP-RP-${propNum.toString().padStart(4, '0')}` : null;
            break;
        case 'ROOM':
            const lastRoom = await prisma.room.findFirst({ 
                where: { displayId: { startsWith: 'REN-ROOM-' } },
                orderBy: { displayId: 'desc' }, 
                select: { displayId: true } 
            });
            lastId = lastRoom?.displayId || null;
            break;
        case 'BED':
            const lastBed = await prisma.bed.findFirst({ 
                where: { displayId: { startsWith: 'REN-BED-' } },
                orderBy: { displayId: 'desc' }, 
                select: { displayId: true } 
            });
            lastId = lastBed?.displayId || null;
            break;
        case 'BOOKING':
            const lastBooking = await prisma.booking.findFirst({ 
                where: { displayId: { startsWith: 'REN-BOOK-' } },
                orderBy: { displayId: 'desc' }, 
                select: { displayId: true } 
            });
            lastId = lastBooking?.displayId || null;
            break;
        case 'TENANT':
            // ⚠️ RETIRED: Tenant IDs are no longer independently generated.
            // As of the Unified Identity Architecture (Apr 2026), a Tenant record
            // inherits the student's existing REN-USER-XXXX displayId.
            // This case is kept as a tombstone to prevent future regression.
            // See: src/actions/bookings.ts → checkInBooking()
            //      src/actions/tenants.ts  → createTenantFromBooking()
            lastId = null;
            break;
        case 'OWNER_EMPLOYEE':
            // Current format: OWN-STAFF-XXXX
            const lastOwnerStaff = await prisma.ownerEmployee.findFirst({ 
                where: { displayId: { startsWith: 'OWN-STAFF-' } },
                orderBy: { displayId: 'desc' }, 
                select: { displayId: true } 
            });
            // Legacy Gen 1: OWN-EMP-XXXX
            const lastOwnerEmp = await prisma.ownerEmployee.findFirst({ 
                where: { displayId: { startsWith: 'OWN-EMP-' } },
                orderBy: { displayId: 'desc' }, 
                select: { displayId: true } 
            });
            // Legacy Gen 2 (from image): OWNER-EMP-XXXX
            const lastOwnerEmpLong = await prisma.ownerEmployee.findFirst({
                where: { displayId: { startsWith: 'OWNER-EMP-' } },
                orderBy: { displayId: 'desc' },
                select: { displayId: true }
            });

            const staffNum = Math.max(
                extractNum(lastOwnerStaff?.displayId),
                extractNum(lastOwnerEmp?.displayId),
                extractNum(lastOwnerEmpLong?.displayId)
            );
            lastId = staffNum > 0 ? `OWN-STAFF-${staffNum.toString().padStart(4, '0')}` : null;
            break;
        case 'ADMIN_EMPLOYEE':
            const lastAdminEmp = await prisma.adminEmployee.findFirst({ 
                where: { displayId: { startsWith: 'REN-EMP-' } },
                orderBy: { displayId: 'desc' }, 
                select: { displayId: true } 
            });
            lastId = lastAdminEmp?.displayId || null;
            break;
    }

    let nextNum = 1;
    if (lastId) {
        const parts = lastId.split('-');
        const lastNum = parseInt(parts[parts.length - 1]);
        if (!isNaN(lastNum)) {
            nextNum = lastNum + 1;
        }
    }

    if (count === undefined) {
        return `${prefix}-${nextNum.toString().padStart(4, '0')}`;
    }

    const ids: string[] = [];
    for (let i = 0; i < numToGenerate; i++) {
        ids.push(`${prefix}-${(nextNum + i).toString().padStart(4, '0')}`);
    }
    return ids;
}
