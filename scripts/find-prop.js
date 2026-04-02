const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findProperty() {
    const searchId = 'RP-REG-0004';
    console.log(`🔍 Searching for Property with ID: ${searchId}...\n`);
    
    // Search across multiple ID-like fields
    const prop = await prisma.property.findFirst({
        where: {
            OR: [
                { displayId: searchId },
                { id: searchId },
                { applicationId: searchId }
            ]
        },
        include: {
            owner: { select: { id: true, name: true, email: true } }
        }
    });

    if (!prop) {
        console.log(`❌ No property found with ID "${searchId}" in the database.`);
    } else {
        console.log('✅ Property Found:');
        console.log('-----------------------------------');
        console.log(`ID: ${prop.id}`);
        console.log(`Display ID: ${prop.displayId}`);
        console.log(`Name: ${prop.name}`);
        console.log(`City: ${prop.city}`);
        console.log(`Status: ${prop.status}`);
        console.log(`Verified: ${prop.isVerified}`);
        console.log(`Owner: ${prop.owner?.name} (${prop.owner?.email})`);
        console.log(`Application ID: ${prop.applicationId}`);
        console.log('-----------------------------------');
        
        // Check if it should be visible based on status
        if (prop.status !== 'APPROVED') {
            console.log(`💡 Potential Reason: Status is "${prop.status}". Usually only "APPROVED" properties show in search.`);
        }
        if (!prop.isVerified) {
            console.log(`💡 Potential Reason: property.isVerified is false.`);
        }
    }
    
    await prisma.$disconnect();
}

findProperty().catch(async e => {
    console.error(e);
    await prisma.$disconnect();
});
