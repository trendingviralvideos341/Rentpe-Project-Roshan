import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const profiles = await prisma.billingProfile.findMany({
        where: { status: 'ACTIVE' },
        include: { tenant: true }
    });

    let created = 0;
    for (const profile of profiles) {
        const exists = await prisma.rentInvoice.findFirst({
            where: { tenantId: profile.tenantId, billingMonth: month }
        });
        if (!exists && (profile.tenant as any)?.status === 'ACTIVE_TENANT') {
            await prisma.rentInvoice.create({
                data: {
                    billingProfileId: profile.id,
                    tenantId: profile.tenantId,
                    propertyId: profile.propertyId,
                    month: now.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
                    billingMonth: month,
                    rentAmount: profile.monthlyRent,
                    amount: profile.monthlyRent,
                    foodAmount: 0,
                    dueDate: new Date(`${month}-05`),
                    status: 'PENDING',
                } as any
            });
            created++;
        }
    }

    return NextResponse.json({ success: true, created, month });
}
