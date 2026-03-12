import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("🛠 Fixing test data for kumar@gmail.com...");

    // 1. Ensure User exists
    let user = await prisma.user.findUnique({ where: { email: 'kumar@gmail.com' } });
    if (!user) {
        console.log("User not found. Manual intervention needed or login first.");
        return;
    }

    // 2. Find a property and room
    const property = await prisma.property.findFirst();
    const room = await prisma.room.findFirst({ where: { propertyId: property.id } });

    if (!property || !room) {
        console.error("No property or room found to link!");
        return;
    }

    // 3. Update Existing Bookings for this user to have the correct roomId/propertyId
    const bookings = await prisma.booking.findMany({ where: { userId: user.id } });
    for (const b of bookings) {
        await prisma.booking.update({
            where: { id: b.id },
            data: {
                status: 'PAID',
                paymentStatus: 'PAID',
                propertyId: property.id,
                roomId: room.id
            }
        });
    }

    // 4. Create/Update Tenant record
    const tenant = await prisma.tenant.upsert({
        where: { displayId: 'TNT-KUMAR-FIX' },
        update: {
            propertyId: property.id,
            roomId: room.id,
            email: user.email,
            status: 'ACTIVE'
        },
        create: {
            displayId: 'TNT-KUMAR-FIX',
            name: user.name,
            email: user.email,
            phone: user.phone || '9999999999',
            propertyId: property.id,
            roomId: room.id,
            roomNumber: room.roomNumber,
            roomType: room.type,
            rent: '15000',
            startDate: '2024-03-01',
            status: 'ACTIVE'
        }
    });

    console.log("✅ Data fixed. Kumar is now a Tenant of " + property.name + " (" + property.id + ")");
    console.log("Tenant ID: " + tenant.id);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
