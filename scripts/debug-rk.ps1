
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRKPayments() {
    const rkUser = await prisma.user.findFirst({
        where: { name: { contains: 'rk' } },
        include: {
            bookings: {
                include: { payments: true }
            }
        }
    });
    
    if (rkUser) {
        console.log('RK User:', rkUser.name);
        rkUser.bookings.forEach(b => {
            console.log('Booking:', b.displayId, 'Status:', b.status);
            console.log('Payments:', b.payments.map(p => ({ amount: p.amount, status: p.status, method: p.method })));
        });
    } else {
        console.log('RK User not found');
    }
}

checkRKPayments().catch(console.error).finally(() => prisma.$disconnect());
