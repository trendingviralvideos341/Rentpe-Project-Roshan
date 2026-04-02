const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backendPhotoInject() {
    const propertyId = '21289df1-d4e9-4cf8-a38c-7d0cddc5fc0f'; // RP-REG-0004
    const photoUrl = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=2070'; // High-quality verified PG photo
    console.log(`🚀 Performing Backend Injection for Property: ${propertyId}\n`);
    
    const prop = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!prop) {
        console.log('❌ Property not found.');
        return;
    }

    // Prepare Updated Data
    // 1. Building Photos (Array of 1 photo)
    const buildingPhotos = [photoUrl];
    
    // 2. Verified Docs (Add buildingPhotos-0 to existing)
    let verifiedDocs = JSON.parse(prop.verifiedDocs || '[]');
    if (!verifiedDocs.includes('buildingPhotos-0')) {
        verifiedDocs.push('buildingPhotos-0');
    }

    // 3. Perform Update
    const updated = await prisma.property.update({
        where: { id: propertyId },
        data: {
            buildingPhotos: JSON.stringify(buildingPhotos),
            verifiedDocs: JSON.stringify(verifiedDocs),
            isVerified: true,
            status: 'APPROVED' // Double check it's approved
        }
    });

    console.log(`✅ Success! Property "${updated.name}" is now updated.`);
    console.log(`🖼️ New Photo: ${photoUrl}`);
    console.log(`📜 Verified Docs: ${JSON.stringify(verifiedDocs)}`);
    console.log('\n✨ The property should now be LIVE and VISIBLE in the student search for Bangalore.');

    await prisma.$disconnect();
}

backendPhotoInject().catch(async e => {
    console.error(e);
    await prisma.$disconnect();
});
