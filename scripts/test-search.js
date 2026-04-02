const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSearch() {
    console.log('🧪 Testing Search Logic Simulation...\n');
    
    // Test 1: Query = "RP-REG-0004"
    const query1 = 'RP-REG-0004';
    const where1 = {
        status: 'APPROVED',
        OR: [
            { name: { contains: query1, mode: 'insensitive' } },
            { city: { contains: query1, mode: 'insensitive' } },
            { address: { contains: query1, mode: 'insensitive' } },
            { description: { contains: query1, mode: 'insensitive' } },
        ]
    };
    const res1 = await prisma.property.findMany({ where: where1 });
    console.log(`Test 1: Search for "${query1}" -> Found ${res1.length} properties.`);

    // Test 2: Query = "guest house"
    const query2 = 'guest house';
    const where2 = {
        status: 'APPROVED',
        OR: [
            { name: { contains: query2, mode: 'insensitive' } },
            { city: { contains: query2, mode: 'insensitive' } },
            { address: { contains: query2, mode: 'insensitive' } },
            { description: { contains: query2, mode: 'insensitive' } },
        ]
    };
    const res2 = await prisma.property.findMany({ where: where2 });
    console.log(`Test 2: Search for "${query2}" -> Found ${res2.length} properties.`);
    if (res2.length > 0) {
        console.log(` - Matches: ${res2.map(p => p.name).join(', ')}`);
    }

    await prisma.$disconnect();
}

testSearch().catch(async e => {
    console.error(e);
    await prisma.$disconnect();
});
