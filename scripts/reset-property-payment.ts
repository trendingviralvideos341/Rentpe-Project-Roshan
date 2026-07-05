import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Find the dummy test property
    const property = await prisma.property.findFirst({
        where: {
            name: { contains: 'Dummy' }
        },
        select: { id: true, name: true, displayId: true, status: true }
    });

    if (!property) {
        console.log('❌ No dummy property found.');
        return;
    }

    console.log(`Found: ${property.name} (${property.displayId}) — Current status: ${property.status}`);

    // Reset back to BANK_DETAILS_VERIFIED and clear all payment data
    const updated = await (prisma.property as any).update({
        where: { id: property.id },
        data: {
            status: 'BANK_DETAILS_VERIFIED',
            onboardingPaidAt: null,
            onboardingPaymentMethod: null,
            onboardingRazorpayId: null,
            onboardingRazorpayOrderId: null,
        }
    });

    console.log(`✅ Reset complete! Property "${updated.name}" is now back to: ${updated.status}`);
    console.log('➡ Admin can now click "Request Payment" → Owner will see Razorpay modal.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
