/**
 * RentPe — Owner Monthly Commission & TDS Statement
 * Route: GET /api/receipts/owner/[month]?format=pdf|csv
 *
 * ─── SECURITY ────────────────────────────────────────────────────────────────
 * • Owners can only download statements for their OWN properties
 * • Admin can download statements for ANY owner via ?ownerId=xxx
 * • Session verified for every request
 *
 * ─── WHAT'S INCLUDED ────────────────────────────────────────────────────────
 * • All rent payments collected for the owner's properties in the given month
 * • Per-booking breakdown: Gross Rent | Platform Commission | GST | TDS deducted
 * • TDS Certificate reference (Section 194-O — e-commerce aggregator)
 * • Net payout to owner's bank
 * • SAC Code: 997312
 *
 * Month format: YYYY-MM (e.g. 2026-06)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { jsPDF } from "jspdf";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";

function inr(amount: number): string {
    return `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ month: string }> }
) {
    try {
        const session = await getSession();
        if (!session) return new NextResponse("Unauthorized", { status: 401 });

        const { month } = await params;
        const outputFormat = req.nextUrl.searchParams.get("format") || "pdf";
        const queryOwnerId = req.nextUrl.searchParams.get("ownerId");

        const sessionRole   = (session as any).role;
        const sessionUserId = (session as any).userId;

        // Determine which owner's data to fetch
        let ownerId: string;
        if (sessionRole === "ADMIN" || sessionRole === "ADMIN_STAFF") {
            if (!queryOwnerId) return new NextResponse("ownerId query param required for admin", { status: 400 });
            ownerId = queryOwnerId;
        } else if (sessionRole === "OWNER" || sessionRole === "OWNER_STAFF") {
            ownerId = sessionUserId;
        } else {
            return new NextResponse("Unauthorized", { status: 403 });
        }

        // Parse month range
        let monthStart: Date, monthEnd: Date;
        try {
            const parsed = parseISO(`${month}-01`);
            monthStart = startOfMonth(parsed);
            monthEnd   = endOfMonth(parsed);
        } catch {
            return new NextResponse("Invalid month format. Use YYYY-MM", { status: 400 });
        }

        // Fetch owner info
        const owner = await prisma.user.findUnique({
            where: { id: ownerId },
            select: { id: true, name: true, email: true, phone: true, displayId: true }
        });
        if (!owner) return new NextResponse("Owner not found", { status: 404 });

        // Fetch all paid bookings for this owner in the given month
        const payments = await (prisma as any).payment.findMany({
            where: {
                status: "VERIFIED",
                createdAt: { gte: monthStart, lte: monthEnd },
                booking: {
                    room: {
                        property: { ownerId }
                    }
                }
            },
            include: {
                booking: {
                    include: {
                        user: { select: { name: true, email: true, displayId: true } },
                        room: {
                            include: {
                                property: { select: { name: true, city: true } }
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: "asc" }
        });

        // Fetch platform fee records for all bookings
        const bookingIds = payments.map((p: any) => p.bookingId).filter(Boolean);
        const platformFees = await (prisma as any).platformFee.findMany({
            where: { bookingId: { in: bookingIds } }
        });
        const feeMap = new Map(platformFees.map((f: any) => [f.bookingId, f]));

        // ── Aggregate totals ──────────────────────────────────────────────────
        let totalGross        = 0;
        let totalOwnerFee     = 0;
        let totalGstOnOwner   = 0;
        let totalTds          = 0;
        let totalNetPayout    = 0;

        const rows = payments.map((p: any) => {
            const fee          = feeMap.get(p.bookingId) as any;
            const gross        = Number(p.amount);
            const ownerFee     = fee ? Number(fee.ownerFee)       : 0;
            const gstOnOwner   = fee ? Number(fee.gstOnOwnerFee)  : 0;
            const tds          = fee ? Number(fee.tdsAmount)       : 0;
            const netPayout    = gross - ownerFee - gstOnOwner - tds;

            totalGross      += gross;
            totalOwnerFee   += ownerFee;
            totalGstOnOwner += gstOnOwner;
            totalTds        += tds;
            totalNetPayout  += netPayout;

            return {
                date:        format(new Date(p.createdAt), "dd MMM yyyy"),
                tenant:      p.booking?.user?.name || "—",
                tenantId:    p.booking?.user?.displayId || "—",
                property:    p.booking?.room?.property?.name || p.booking?.propertyName || "—",
                gross,
                ownerFee,
                gstOnOwner,
                tds,
                netPayout,
                paymentRef:  (p as any).razorpayId || p.id.slice(0, 8).toUpperCase(),
            };
        });

        const monthLabel     = format(monthStart, "MMMM yyyy");
        const generatedOn    = format(new Date(), "dd MMM yyyy, HH:mm");
        const statementNo    = `OWN-${ownerId.slice(0, 6).toUpperCase()}-${month.replace("-", "")}`;

        // ── CSV Export ────────────────────────────────────────────────────────
        if (outputFormat === "csv") {
            const csvLines = [
                `RentPe Owner Commission Statement — ${monthLabel}`,
                `Owner: ${owner.name} | ID: ${owner.displayId} | Generated: ${generatedOn}`,
                `Statement No: ${statementNo}`,
                `TDS deducted under Section 194-O (e-commerce aggregator). Use this for ITR filing.`,
                "",
                "Date,Tenant,Tenant ID,Property,Gross Rent (Rs.),Platform Commission (Rs.),GST on Commission (Rs.),TDS @ 1% (Rs.),Net Payout (Rs.),Payment Ref",
                ...rows.map((r: any) =>
                    `"${r.date}","${r.tenant}","${r.tenantId}","${r.property}",${r.gross.toFixed(2)},${r.ownerFee.toFixed(2)},${r.gstOnOwner.toFixed(2)},${r.tds.toFixed(2)},${r.netPayout.toFixed(2)},"${r.paymentRef}"`
                ),
                "",
                `TOTALS,,,,${totalGross.toFixed(2)},${totalOwnerFee.toFixed(2)},${totalGstOnOwner.toFixed(2)},${totalTds.toFixed(2)},${totalNetPayout.toFixed(2)},`,
                "",
                `NOTE: TDS Certificate (Form 16C equivalent) reference — Section 194-O. Deductor: RentPe (Antigravity Project). GSTIN: PENDING REGISTRATION.`,
            ];

            return new NextResponse(csvLines.join("\n"), {
                status: 200,
                headers: {
                    "Content-Type": "text/csv; charset=utf-8",
                    "Content-Disposition": `attachment; filename="RentPe-Owner-Statement-${month}.csv"`,
                    "Cache-Control": "no-store",
                }
            });
        }

        // ── PDF Export ────────────────────────────────────────────────────────
        const doc  = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const pageW = doc.internal.pageSize.getWidth();  // 297
        const pageH = doc.internal.pageSize.getHeight(); // 210
        const L = 14, R = pageW - 14;

        // Header
        doc.setFillColor(55, 48, 163);
        doc.rect(0, 0, pageW, 40, "F");
        doc.setFillColor(109, 40, 217);
        doc.rect(0, 33, pageW, 7, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("RentPe", L, 18);

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(199, 210, 254);
        doc.text("Verified PGs & Hostels — Owner Commission & TDS Statement", L, 25);

        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(`${monthLabel}`, R, 16, { align: "right" });

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(199, 210, 254);
        doc.text(`Statement No: ${statementNo}`, R, 23, { align: "right" });
        doc.text(`Generated: ${generatedOn}`, R, 29, { align: "right" });

        // Owner info card
        let y = 48;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(L, y, 130, 22, 2, 2, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(L, y, 130, 22, 2, 2);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text("OWNER DETAILS", L + 4, y + 7);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(owner.name || "—", L + 4, y + 14);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`ID: ${owner.displayId || "—"}  |  ${owner.email || "—"}`, L + 4, y + 20);

        // TDS notice card
        doc.setFillColor(255, 247, 237);
        doc.roundedRect(150, y, pageW - 164, 22, 2, 2, "F");
        doc.setDrawColor(251, 191, 36);
        doc.roundedRect(150, y, pageW - 164, 22, 2, 2);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(146, 64, 14);
        doc.text("TDS DEDUCTION NOTICE — SECTION 194-O", 154, y + 7);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(92, 64, 14);
        doc.text("RentPe deducts 1% TDS on gross rent as an e-commerce aggregator.", 154, y + 13);
        doc.text("Please use this statement as your TDS certificate for ITR filing.", 154, y + 19);

        // Table
        y += 30;

        // Table header
        doc.setFillColor(55, 48, 163);
        doc.rect(L, y, pageW - 28, 9, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);

        const cols = [
            { label: "Date",                x: L + 2,   w: 22  },
            { label: "Tenant",              x: L + 24,  w: 35  },
            { label: "Property",            x: L + 59,  w: 38  },
            { label: "Gross Rent",          x: L + 97,  w: 28  },
            { label: "Comm.",               x: L + 125, w: 22  },
            { label: "GST on Comm.",        x: L + 147, w: 26  },
            { label: "TDS 1%",              x: L + 173, w: 22  },
            { label: "Net Payout",          x: L + 195, w: 28  },
            { label: "Ref",                 x: L + 223, w: 32  },
        ];

        cols.forEach(c => doc.text(c.label, c.x, y + 6));
        y += 10;

        // Table rows
        const ROW_H = 8;
        rows.forEach((row: any, i: number) => {
            const isEven = i % 2 === 0;
            doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
            doc.rect(L, y, pageW - 28, ROW_H, "F");
            doc.setDrawColor(226, 232, 240);
            doc.line(L, y, R, y);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(30, 30, 30);

            const truncate = (str: string, n: number) => str.length > n ? str.slice(0, n) + "…" : str;
            doc.text(row.date,                                          cols[0].x, y + 5.5);
            doc.text(truncate(row.tenant, 18),                          cols[1].x, y + 5.5);
            doc.text(truncate(row.property, 20),                        cols[2].x, y + 5.5);
            doc.text(row.gross.toFixed(2),                              cols[3].x + cols[3].w, y + 5.5, { align: "right" });
            doc.text(row.ownerFee.toFixed(2),                           cols[4].x + cols[4].w, y + 5.5, { align: "right" });
            doc.text(row.gstOnOwner.toFixed(2),                         cols[5].x + cols[5].w, y + 5.5, { align: "right" });
            doc.setTextColor(220, 38, 38);
            doc.text(row.tds.toFixed(2),                                cols[6].x + cols[6].w, y + 5.5, { align: "right" });
            doc.setTextColor(16, 185, 129);
            doc.text(row.netPayout.toFixed(2),                          cols[7].x + cols[7].w, y + 5.5, { align: "right" });
            doc.setTextColor(100, 116, 139);
            doc.text(truncate(row.paymentRef, 16),                      cols[8].x, y + 5.5);
            doc.setTextColor(30, 30, 30);

            y += ROW_H;
        });

        // Totals row
        doc.setFillColor(238, 242, 255);
        doc.rect(L, y, pageW - 28, ROW_H + 1, "F");
        doc.setDrawColor(199, 210, 254);
        doc.rect(L, y, pageW - 28, ROW_H + 1);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(55, 48, 163);
        doc.text("TOTALS", L + 2, y + 6);
        doc.setTextColor(15, 23, 42);
        doc.text(totalGross.toFixed(2),      cols[3].x + cols[3].w, y + 6, { align: "right" });
        doc.text(totalOwnerFee.toFixed(2),   cols[4].x + cols[4].w, y + 6, { align: "right" });
        doc.text(totalGstOnOwner.toFixed(2), cols[5].x + cols[5].w, y + 6, { align: "right" });
        doc.setTextColor(220, 38, 38);
        doc.text(totalTds.toFixed(2),        cols[6].x + cols[6].w, y + 6, { align: "right" });
        doc.setTextColor(16, 185, 129);
        doc.text(totalNetPayout.toFixed(2),  cols[7].x + cols[7].w, y + 6, { align: "right" });

        y += ROW_H + 8;

        // Footer disclaimer
        doc.setFont("helvetica", "italic");
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(
            `Deductor: RentPe (Antigravity Project) | GSTIN: PENDING REGISTRATION | SAC Code: 997312 | TDS: Sec 194-O @ 1% | GST: 18% (CGST 9% + SGST 9%)`,
            pageW / 2, pageH - 10, { align: "center" }
        );
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(55, 48, 163);
        doc.text("rentpe.in", pageW / 2, pageH - 5, { align: "center" });

        const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="RentPe-Owner-Statement-${month}.pdf"`,
                "Cache-Control": "no-store",
            }
        });

    } catch (err: any) {
        console.error("Owner statement generation error:", err);
        return new NextResponse("Failed to generate statement", { status: 500 });
    }
}
