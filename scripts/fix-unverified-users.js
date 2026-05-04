const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  // Fix all users stuck at PENDING_VERIFICATION with unverified email
  const result = await prisma.user.updateMany({
    where: {
      emailVerified: false,
      status: 'PENDING_VERIFICATION'
    },
    data: {
      emailVerified: true,
      status: 'ACTIVE',
      emailVerificationToken: null
    }
  });

  console.log('✅ Fixed users:', result.count);

  // Show recently fixed/active users
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    select: { email: true, name: true, status: true, emailVerified: true, role: true },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  console.log('\nRecent active users:');
  users.forEach(u => {
    console.log(` - ${u.email} | ${u.role} | verified: ${u.emailVerified} | status: ${u.status}`);
  });

  await prisma.$disconnect();
}

fix().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
