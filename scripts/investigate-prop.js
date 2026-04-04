const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deepInvestigate() {
    const searchId = 'RP-REG-0004';
    console.log(`🔍 Deep Investigation for Property: ${searchId}\n`);
    
    const prop = await prisma.property.findFirst({
        where: { displayId: searchId },
        include: {
            rooms: true,
            _count: { select: { reviews: true } }
        }
    });

    if (!prop) {
        console.log('❌ Property not found.');
        return;
    }

    console.log(`Name: ${prop.name}`);
    console.log(`Status: ${prop.status}`);
    console.log(`isVerified: ${prop.isVerified}`);
    
    console.log(`\n--- Rooms (${prop.rooms.length}) ---`);
    if (prop.rooms.length === 0) {
        console.log('⚠️ WARNING: This property has ZERO rooms listed.');
    } else {
        let totalAvailability = 0;
        prop.rooms.forEach(r => {
            console.log(` - Room ${r.roomNumber}: Type=${r.type}, Price=${r.price}, Availability=${r.availability}`);
            totalAvailability += (r.availability || 0);
        });
        console.log(`\nTotal Available Beds: ${totalAvailability}`);
        
        if (totalAvailability === 0) {
            console.log('⚠️ WARNING: Total availability is 0. This property will be HIDDEN from search results.');
        }
    }

    await prisma.$disconnect();
}

deepInvestigate().catch(async e => {
    console.error(e);
    await prisma.$disconnect();
});
