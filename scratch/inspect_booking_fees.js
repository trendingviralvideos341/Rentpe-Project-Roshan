const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const booking = await prisma.booking.findFirst({
    where: { displayId: 'RP-B-00010' },
    include: {
      user: true,
      payments: true,
      platformFee: true
    }
  });

  console.log('--- BOOKING ---');
  console.log(JSON.stringify(booking, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
