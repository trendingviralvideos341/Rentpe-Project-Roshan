
/**
 * Backfill: Create BillingProfile + SecurityDeposit (PAID) + RentInvoice (PAID)
 * for existing active tenants who have a verified payment but no billing records.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
    const tenants = await prisma.tenant.findMany({
        where: { status: { in: ['ACTIVE', 'Active'] } },
        include: {
            booking: { include: { payments: true } }
        }
    });

    console.log(`Found ${tenants.length} active tenants to check.`);

    for (const tenant of tenants) {
        const booking = tenant.booking;
        if (!booking) { console.log(`[SKIP] ${tenant.name} — no booking`); continue; }

        const verifiedPayment = booking.payments.find(p => p.status === 'VERIFIED');
        if (!verifiedPayment) { console.log(`[SKIP] ${tenant.name} — no verified payment`); continue; }

        const now = new Date();
        const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
        const rentAmt = Number(tenant.rent || booking.amount);
        const depositAmt = Number(booking.depositAmount || rentAmt);
        const anchorDay = now.getUTCDate();

        // 1. BillingProfile
        let profile = await prisma.billingProfile.findUnique({ where: { tenantId: tenant.id } }).catch(() => null);
        if (!profile) {
            profile = await prisma.billingProfile.create({
                data: {
                    tenantId: tenant.id,
                    propertyId: tenant.propertyId,
                    roomId: tenant.roomId,
                    bedId: tenant.bedId || null,
                    monthlyRent: rentAmt,
                    securityDeposit: depositAmt,
                    billingDay: anchorDay,
                    billingAnchorDay: anchorDay,
                    status: 'ACTIVE',
                }
            });
            console.log(`[CREATED] BillingProfile for ${tenant.name}`);
        } else {
            console.log(`[EXISTS] BillingProfile for ${tenant.name}`);
        }

        // 2. SecurityDeposit
        const existingDeposit = await prisma.securityDeposit.findUnique({ where: { billingProfileId: profile.id } }).catch(() => null);
        if (!existingDeposit) {
            await prisma.securityDeposit.create({
                data: { billingProfileId: profile.id, tenantId: tenant.id, amount: depositAmt, status: 'PAID', paidAt: verifiedPayment.date || now }
            });
            console.log(`[CREATED] SecurityDeposit ₹${depositAmt} PAID for ${tenant.name}`);
        } else {
            console.log(`[EXISTS] SecurityDeposit for ${tenant.name} — status: ${existingDeposit.status}`);
        }

        // 3. RentInvoice for this month marked PAID
        const existingInvoice = await prisma.rentInvoice.findFirst({ where: { tenantId: tenant.id, billingMonth } }).catch(() => null);
        if (!existingInvoice) {
            const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 5);
            const invDisplayId = `INV-${Math.floor(Math.random() * 900000) + 100000}`;
            await prisma.rentInvoice.create({
                data: {
                    displayId: invDisplayId,
                    billingProfileId: profile.id,
                    tenantId: tenant.id,
                    propertyId: tenant.propertyId,
                    bookingId: booking.id,
                    month: monthLabel,
                    billingMonth,
                    rentAmount: rentAmt,
                    foodAmount: 0,
                    amount: rentAmt,
                    dueDate,
                    status: 'PAID',
                    paidAmount: rentAmt,
                    paidRentAmount: rentAmt,
                    paidAt: verifiedPayment.date || now,
                    paymentMethod: 'ONLINE',
                    confirmedBy: 'SYSTEM',
                    confirmedByName: 'Auto — Joining Payment Backfill',
                    lockedAt: now,
                }
            });
            console.log(`[CREATED] RentInvoice ${invDisplayId} — ${billingMonth} PAID ₹${rentAmt} for ${tenant.name}`);
        } else {
            console.log(`[EXISTS] RentInvoice for ${tenant.name} — ${billingMonth} — status: ${existingInvoice.status}`);
        }
    }

    console.log('\n✅ Backfill complete.');
}

backfill().catch(console.error).finally(() => prisma.$disconnect());
