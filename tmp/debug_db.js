const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { 
      OR: [
        { name: { contains: 'Amit' } },
        { email: { contains: 'amit' } }
      ]
    }
  });

  console.log('--- User Debug ---');
  console.log(JSON.stringify(user, null, 2));

  if (user) {
    const effectiveOwnerId = user.parentOwnerId || user.id;
    const properties = await prisma.property.findMany({
      where: { ownerId: effectiveOwnerId }
    });

    console.log('\n--- Properties Debug ---');
    console.log(JSON.stringify(properties, null, 2));
  } else {
    console.log('User Amit not found');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
