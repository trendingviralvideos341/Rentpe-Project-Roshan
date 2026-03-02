const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ select: { email: true, role: true } });
  console.log("USERS:");
  for (const u of users) {
    console.log(`- ${u.email} (${u.role})`);
  }
}
main().finally(() => prisma.$disconnect());
