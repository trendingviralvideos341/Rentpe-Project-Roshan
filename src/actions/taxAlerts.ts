'use server';

import prisma from "@/lib/prisma";

/**
 * Checks if the owner's cumulative annual turnover on RentPe (rent + tokens, excluding deposits)
 * approaches or exceeds the ₹20 Lakhs GST registration threshold.
 * 
 * If the owner does not have a GSTIN registered on any property:
 * - Tier 1: ₹18 Lakhs
 * - Tier 2: ₹19 Lakhs
 * - Tier 3: ₹19.5 Lakhs
 * - Tier 4: ₹20 Lakhs (Exceeded)
 * 
 * Triggers in-app notifications for the Owner and all property managers (Staff).
 */
export async function checkOwnerTurnoverAndAlert(ownerId: string) {
    try {
        // 1. Check if the owner already has a GST number registered on ANY of their properties.
        // If they do, they are already registered/compliant. We immediately stop sending alerts.
        const properties = await prisma.property.findMany({
            where: { ownerId },
            select: { gstNumber: true }
        });
        
        const hasAnyGst = properties.some(p => p.gstNumber && p.gstNumber.trim().length > 0);
        if (hasAnyGst) {
            return { status: "COMPLIANT", msg: "GSTIN already registered" };
        }

        // 2. Determine the current financial year (April 1st to March 31st)
        const now = new Date();
        const currentYear = now.getFullYear();
        const startYear = now.getMonth() >= 3 ? currentYear : currentYear - 1;
        const fyStart = new Date(startYear, 3, 1); // April 1st
        const fyEnd = new Date(startYear + 1, 2, 31, 23, 59, 59); // March 31st

        // 3. Sum up all verified payments where depositId is null (excludes deposits) in the current FY
        const payments = await prisma.payment.findMany({
            where: {
                status: { in: ["VERIFIED", "SUCCESS"] },
                depositId: null,
                date: { gte: fyStart, lte: fyEnd },
                booking: {
                    OR: [
                        { room: { property: { ownerId } } },
                        { propertyId: { not: null }, property: { ownerId } }
                    ]
                }
            },
            select: { amount: true }
        });

        const totalTurnover = payments.reduce((sum, p) => sum + p.amount, 0);

        // 4. Evaluate Tiers
        let activeTier: "18_LAKHS" | "19_LAKHS" | "19_5_LAKHS" | "EXCEEDED" | null = null;
        let alertMessage = "";

        if (totalTurnover >= 2000000) {
            activeTier = "EXCEEDED";
            alertMessage = `CRITICAL: Your annual aggregate turnover on RentPe has crossed the ₹20 Lakhs statutory limit (Current: ₹${totalTurnover.toLocaleString("en-IN")}). Under Section 9(5) of the CGST Act, GST registration is now mandatory. Please update your GSTIN in Property Settings or send your GST certificate to support@rentpe.in immediately to prevent payout disruptions.`;
        } else if (totalTurnover >= 1950000) {
            activeTier = "19_5_LAKHS";
            alertMessage = `Final Warning: Your annual aggregate turnover on RentPe has crossed ₹19.5 Lakhs (Current: ₹${totalTurnover.toLocaleString("en-IN")}). You are extremely close to the ₹20 Lakhs statutory threshold. Please update your GSTIN in Property Settings or email your GST certificate to support@rentpe.in immediately.`;
        } else if (totalTurnover >= 1900000) {
            activeTier = "19_LAKHS";
            alertMessage = `Strong Warning: Your annual aggregate turnover on RentPe has crossed ₹19 Lakhs (Current: ₹${totalTurnover.toLocaleString("en-IN")}). Please register for GST and update your GSTIN in Property Settings or contact the RentPe support team (support@rentpe.in) to remain compliant.`;
        } else if (totalTurnover >= 1800000) {
            activeTier = "18_LAKHS";
            alertMessage = `Alert: Your annual aggregate turnover on RentPe has crossed ₹18 Lakhs (Current: ₹${totalTurnover.toLocaleString("en-IN")}). You are approaching the ₹20 Lakhs GST registration threshold. Please prepare to register your GSTIN. You can update it in Property Settings or send your certificate to support@rentpe.in.`;
        }

        if (!activeTier) {
            return { status: "BELOW_LIMIT", turnover: totalTurnover };
        }

        // 5. Get all Staff members (managers) assigned to any of the owner's properties
        const staffAssignments = await prisma.staffPropertyAssignment.findMany({
            where: {
                property: { ownerId }
            },
            include: {
                staffMember: {
                    select: { userId: true }
                }
            }
        });
        const staffUserIds = staffAssignments
            .map(a => a.staffMember.userId)
            .filter((id): id is string => id !== null);
            
        // Combine owner and staff for notification dispatch
        const recipientIds = Array.from(new Set([ownerId, ...staffUserIds]));

        const typeTag = `GST_LIMIT_${activeTier}`;

        // 6. Create notifications (ensuring only once per tier per FY)
        await prisma.$transaction(async (tx) => {
            for (const userId of recipientIds) {
                const existing = await tx.notification.findFirst({
                    where: {
                        userId,
                        type: typeTag,
                        createdAt: { gte: fyStart, lte: fyEnd }
                    }
                });

                if (!existing) {
                    await tx.notification.create({
                        data: {
                            userId,
                            type: typeTag,
                            category: "COMPLIANCE",
                            message: alertMessage,
                            targetRole: userId === ownerId ? "OWNER" : "STAFF",
                            isPersistent: true
                        }
                    });
                }
            }
        });

        return { status: "ALERT_TRIGGERED", tier: activeTier, turnover: totalTurnover };
    } catch (err) {
        console.error("[GST TURNOVER CHECKER] Error:", err);
        return { status: "ERROR", error: err };
    }
}
