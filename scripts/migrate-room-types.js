import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const rooms = await prisma.room.findMany();
    let updatedCount = 0;

    for (const room of rooms) {
        let newType = room.type;

        // Handle old types and normalize them to "Sharing" language
        if (room.type === 'Single') newType = 'Single Sharing';
        else if (room.type === 'Double') newType = 'Double Sharing';
        else if (room.type === 'Triple') newType = 'Three Sharing';
        else if (room.type === 'Four') newType = 'Four Sharing';
        else if (room.type === 'Five') newType = 'Five Sharing';
        else if (room.type === 'Six') newType = 'Six Sharing';

        // Update if the type has changed
        if (newType !== room.type) {
            await prisma.room.update({
                where: { id: room.id },
                data: { type: newType }
            });
            updatedCount++;
        }
    }

    console.log(`Successfully updated ${updatedCount} rooms to new Sharing terminology.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
