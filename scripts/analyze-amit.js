const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeAmit() {
    console.log('🔍 Deep Analysis: Amit Kumar (owner@rentpe.in)...\n');
    
    // 1. Check User Data
    const amit = await prisma.user.findUnique({
        where: { email: 'owner@rentpe.in' },
        include: { properties: true }
    });

    if (!amit) {
        console.log('❌ User not found.');
        await prisma.$disconnect();
        return;
    }

    console.log('--- USER DATA ---');
    console.log(`ID: ${amit.id}`);
    console.log(`Email: ${amit.email}`);
    console.log(`Role: ${amit.role}`);
    console.log(`Roles[]: ${JSON.stringify(amit.roles)}`);
    console.log(`Primary Role: ${amit.primaryRole}`);
    
    // 2. Check "properties" field (Relationship: User.properties)
    console.log('\n--- ATTACHED PROPERTIES (Relation) ---');
    if (amit.properties && amit.properties.length > 0) {
        console.log(`Found ${amit.properties.length} properties.`);
        amit.properties.forEach(p => console.log(` - ID: ${p.id}, Title: ${p.title}, Status: ${p.status}`));
    } else {
        console.log('No properties found via User.properties relation.');
    }

    // 3. Search Property Table explicitly
    console.log('\n--- GLOBAL SEARCH (Property Table) ---');
    const globalProps = await prisma.property.findMany({
        where: {
            OR: [
                { ownerId: amit.id },
                { addedBy: amit.id },
                { ownerEmail: amit.email }
            ]
        }
    });

    if (globalProps.length > 0) {
        console.log(`Found ${globalProps.length} properties associated with his ID/Email:`);
        globalProps.forEach(p => {
            console.log(` - Title: ${p.title}`);
            console.log(`   ID: ${p.id}`);
            console.log(`   OwnerId in Prop: ${p.ownerId}`);
            console.log(`   AddedBy in Prop: ${p.addedBy}`);
            console.log(`   Status: ${p.status}`);
        });
    } else {
        console.log('No properties found in global search.');
    }

    await prisma.$disconnect();
}

analyzeAmit().catch(async e => {
    console.error('❌ Error analyzing Amit:', e);
    await prisma.$disconnect();
});
