
import { generateSequentialId } from "../src/lib/ids";
import prisma from "../src/lib/prisma";

async function verify() {
    console.log("=== ID BATCH VERIFICATION ===");
    try {
        const batch = await generateSequentialId('BED', 3);
        console.log("Generated IDs:", JSON.stringify(batch));
        if (Array.isArray(batch) && batch.length === 3) {
             console.log("RESULT: SUCCESS");
        } else {
             console.log("RESULT: FAILURE");
        }
    } catch (e) {
        console.log("ERROR:", e);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
