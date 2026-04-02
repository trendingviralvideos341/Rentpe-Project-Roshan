const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function finalVerify() {
    const amitEmail = 'owner@rentpe.in';
    console.log(`📡 Final Verification for: ${amitEmail}`);
    
    const amit = await prisma.user.findUnique({ where: { email: amitEmail } });
    if (!amit) {
        console.log('❌ Amit not found.');
        return;
    }

    const statsPropsCount = await prisma.property.count({ where: { ownerId: amit.id } });
    const addedByPropsCount = await prisma.property.count({ where: { addedBy: amit.id } });
    const totalProps = await prisma.property.findMany({
        where: { OR: [{ ownerId: amit.id }, { addedBy: amit.id }] }
    });

    console.log(`ID: ${amit.id}`);
    console.log(`- Role: ${amit.role}`);
    console.log(`- Roles: ${JSON.stringify(amit.roles)}`);
    console.log('- Properties linked via ownerId: ', statsPropsCount);
    console.log('- Properties linked via addedBy (legacy?): ', addedByPropsCount);
    console.log('- Total Unique Properties: ', totalProps.length);

    if (totalProps.length > statsPropsCount) {
        console.log('\n⚠️ WARNING: Some properties are missing from the OwnerId count!');
        console.log('Repairing missing ownership links...');
        
        const res = await prisma.property.updateMany({
            where: { addedBy: amit.id, ownerId: { not: amit.id } },
            data: { ownerId: amit.id }
        });
        console.log(`✅ Repaired ${res.count} property ownership links.`);
    } else {
        console.log('\n✅ Ownership links are healthy. Stats will match.');
    }

    await prisma.$disconnect();
}

finalVerify().catch(async e => {
    console.error(e);
    await prisma.$disconnect();
});
