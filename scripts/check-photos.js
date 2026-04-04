const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPhotos() {
    const searchId = 'RP-REG-0004';
    const prop = await prisma.property.findFirst({
        where: { displayId: searchId }
    });

    if (!prop) {
        console.log('Property not found');
        return;
    }

    console.log(`Property: ${prop.name}`);
    console.log(`Building Photos: ${prop.buildingPhotos}`);
    console.log(`Verified Docs: ${prop.verifiedDocs}`);
    
    const buildingPhotos = JSON.parse(prop.buildingPhotos || '[]');
    const verifiedDocs = JSON.parse(prop.verifiedDocs || '[]');

    const verifiedBuildingPhotos = buildingPhotos.filter((url, i) => {
        return verifiedDocs.includes(`buildingPhotos-${i}`);
    });

    console.log(`\nVerified Building Photos: ${verifiedBuildingPhotos.length}`);
    if (verifiedBuildingPhotos.length === 0) {
        console.log('⚠️ ALERT: This property has NO verified building photos. It might be hidden by UI logic.');
    }

    await prisma.$disconnect();
}

checkPhotos().catch(async e => {
    console.error(e);
    await prisma.$disconnect();
});
