import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const counts = await prisma.booking.groupBy({
        by: ['status'],
        _count: true
    });
    console.log('Booking counts by status:', counts);

    const latest = await prisma.booking.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, guestName: true, status: true, propertyName: true, createdAt: true }
    });
    console.log('Latest 5 bookings:', JSON.stringify(latest, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
