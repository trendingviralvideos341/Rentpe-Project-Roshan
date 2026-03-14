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

export async function generateSequentialId(type: EntityType): Promise<string> {
    const prefix = PREFIXES[type];
    let lastId: string | null = null;

    // Use indexed findFirst (O(1)) instead of count (O(N)) for high-speed ID generation
    switch (type) {
        case 'USER':
            const lastUser = await prisma.user.findFirst({ 
                where: { isOwner: false }, 
                orderBy: { createdAt: 'desc' }, 
                select: { displayId: true } 
            });
            lastId = lastUser?.displayId || null;
            break;
        case 'OWNER':
            const lastOwner = await prisma.user.findFirst({ 
                where: { isOwner: true }, 
                orderBy: { createdAt: 'desc' }, 
                select: { displayId: true } 
            });
            lastId = lastOwner?.displayId || null;
            break;
        case 'PROPERTY':
            const lastProp = await prisma.property.findFirst({ 
                orderBy: { createdAt: 'desc' }, 
                select: { displayId: true } 
            });
            lastId = lastProp?.displayId || null;
            break;
        case 'ROOM':
            const lastRoom = await prisma.room.findFirst({ 
                orderBy: { createdAt: 'desc' }, 
                select: { displayId: true } 
            });
            lastId = lastRoom?.displayId || null;
            break;
        case 'BED':
            const lastBed = await prisma.bed.findFirst({ 
                orderBy: { createdAt: 'desc' }, 
                select: { displayId: true } 
            });
            lastId = lastBed?.displayId || null;
            break;
        case 'BOOKING':
            const lastBooking = await prisma.booking.findFirst({ 
                orderBy: { createdAt: 'desc' }, 
                select: { displayId: true } 
            });
            lastId = lastBooking?.displayId || null;
            break;
        case 'TENANT':
            const lastTenant = await prisma.tenant.findFirst({ 
                orderBy: { createdAt: 'desc' }, 
                select: { displayId: true } 
            });
            lastId = lastTenant?.displayId || null;
            break;
        case 'OWNER_EMPLOYEE':
            const lastOwnerEmp = await prisma.ownerEmployee.findFirst({ 
                orderBy: { createdAt: 'desc' }, 
                select: { displayId: true } 
            });
            lastId = lastOwnerEmp?.displayId || null;
            break;
        case 'ADMIN_EMPLOYEE':
            const lastAdminEmp = await prisma.adminEmployee.findFirst({ 
                orderBy: { createdAt: 'desc' }, 
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

    return `${prefix}-${nextNum.toString().padStart(4, '0')}`;
}
