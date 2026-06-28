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
 * • Page 1:    Consolidated landscape summary table (all transactions)
 * • Page 2+:   Individual GST Tax Invoice per transaction (RP/FYXX-YY/XXXXXX)
 *              SAC 997312 | CGST 9% + SGST 9% | Payout reconciliation
 *              Allows owner's CA to claim Input Tax Credit
 * • CSV:       All columns including Razorpay IDs, GST, TDS
 * • TDS:       Section 194-O @ 1% on RENT ONLY (never on deposit)
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

function getFY(date: Date): string {
    const y = date.getFullYear();
    const m = date.getMonth();
    const startYear = m >= 3 ? y : y - 1;
    return `${String(startYear).slice(2)}-${String(startYear + 1).slice(2)}`;
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

        // Check if there is any active TDS exemption for this owner's properties
        const ownerProperties = await prisma.property.findMany({
            where: { ownerId },
            select: { name: true }
        });
        const propertyNames = ownerProperties.map(p => p.name);
        const tdsExemptions = await (prisma as any).feeExemption.findMany({
            where: {
                propertyName: { in: propertyNames },
                exemptTds: true,
                status: 'ACTIVE'
            }
        });
        const hasTdsExemption = tdsExemptions.length > 0;

        // Fetch paid onboarding fees for this owner in the month
        const onboardingPaid = await prisma.property.findMany({
            where: {
                ownerId,
                onboardingPaidAt: { gte: monthStart, lte: monthEnd }
            },
            select: {
                id: true,
                displayId: true,
                name: true,
                onboardingPaidAt: true,
                onboardingRazorpayOrderId: true,
                onboardingRazorpayId: true,
            }
        });

        // ── Aggregate totals ──────────────────────────────────────────────────
        let totalGross        = 0;
        let totalOwnerFee     = 0;
        let totalGstOnOwner   = 0;
        let totalTds          = 0;
        let totalNetPayout    = 0;

        const rentalRows = payments.map((p: any) => {
            const fee          = feeMap.get(p.bookingId) as any;
            const gross        = Number(p.amount);
            const ownerFee     = fee ? Number(fee.ownerFee)       : 0;
            const gstOnOwner   = fee ? Number(fee.gstOnOwnerFee)  : 0;
            const tds          = fee ? Number(fee.tdsAmount)       : 0;
            const netPayout    = gross - ownerFee - gstOnOwner - tds;

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
                type:        'RENT_COLLECTION',
            };
        });

        const onboardingRows = onboardingPaid.map((p: any) => {
            const cgst = 7.55;
            const sgst = 7.55;
            const baseAmount = 83.90;
            const onboardingFeeAmount = 99;
            return {
                date:        format(new Date(p.onboardingPaidAt!), "dd MMM yyyy"),
                tenant:      "RentPe Platform",
                tenantId:    "B2B-SVC",
                property:    p.name || "—",
                gross:       0,
                ownerFee:    baseAmount,
                gstOnOwner:  cgst + sgst,
                tds:         0,
                netPayout:   -onboardingFeeAmount,
                paymentRef:  p.onboardingRazorpayId || "—",
                type:        'PROPERTY_ONBOARDING',
            };
        });

        const rows = [...rentalRows, ...onboardingRows].sort((a: any, b: any) => {
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });

        rows.forEach((r: any) => {
            totalGross      += r.gross;
            totalOwnerFee   += r.ownerFee;
            totalGstOnOwner += r.gstOnOwner;
            totalTds        += r.tds;
            totalNetPayout  += r.netPayout;
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
                hasTdsExemption 
                    ? `TDS EXEMPTION ACTIVE under Section 194-O (Nil/Lower TDS Certificate on record). Security deposit excluded from TDS in all cases.` 
                    : `TDS deducted @ 1% on RENT ONLY under Section 194-O. Security deposit is NOT subject to TDS (refundable capital). Use this for ITR filing.`,
                "",
                "Date,Tenant,Tenant ID,Property,Rent Received (excl. Deposit) (Rs.),Platform Commission (Rs.),GST on Commission (Rs.),TDS @ 1% on Rent (Rs.),Net Payout (Rs.),Payment Ref",
                ...rows.map((r: any) =>
                    `"${r.date}","${r.tenant}","${r.tenantId}","${r.property}",${r.gross.toFixed(2)},${r.ownerFee.toFixed(2)},${r.gstOnOwner.toFixed(2)},${r.tds.toFixed(2)},${r.netPayout.toFixed(2)},"${r.paymentRef}"`
                ),
                "",
                `TOTALS,,,,${totalGross.toFixed(2)},${totalOwnerFee.toFixed(2)},${totalGstOnOwner.toFixed(2)},${totalTds.toFixed(2)},${totalNetPayout.toFixed(2)},`,
                "",
                hasTdsExemption
                    ? `NOTE: TDS Certificate reference — Section 194-O. TDS exempted based on Lower/Nil certificate on record. Deductor: RentPe (Antigravity Project). GSTIN: PENDING REGISTRATION.`
                    : `NOTE: TDS Certificate (Form 16C equivalent) reference — Section 194-O. Deductor: RentPe (Antigravity Project). GSTIN: PENDING REGISTRATION.`,
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
        if (hasTdsExemption) {
            doc.setFillColor(254, 242, 242);
            doc.roundedRect(150, y, pageW - 164, 22, 2, 2, "F");
            doc.setDrawColor(239, 68, 68);
            doc.roundedRect(150, y, pageW - 164, 22, 2, 2);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.setTextColor(153, 27, 27);
            doc.text("TDS EXEMPTION ACTIVE — SECTION 194-O", 154, y + 7);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(127, 29, 29);
            doc.text("TDS has been waived for exempted properties based on Nil/Lower TDS Certificate.", 154, y + 13);
            doc.text("Verified certificate copy and explanation notes are kept on record.", 154, y + 19);
        } else {
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
            doc.text("RentPe deducts 1% TDS on RENT ONLY (Section 194-O). Security deposit is excluded — it is", 154, y + 13);
            doc.text("refundable capital and not taxable income. Use this statement for ITR filing.", 154, y + 19);
        }

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
            { label: "Rent (excl. Dep.)",  x: L + 97,  w: 28  },
            { label: "Comm.",               x: L + 125, w: 22  },
            { label: "GST on Comm.",        x: L + 147, w: 26  },
            { label: "TDS 1% (Rent)",       x: L + 173, w: 22  },
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
            `Deductor: RentPe (Antigravity Project) | GSTIN: PENDING REGISTRATION | SAC Code: 997312 | TDS: Sec 194-O @ 1% on RENT ONLY (NOT on security deposit) | GST: 18% (CGST 9% + SGST 9%)`,
            pageW / 2, pageH - 10, { align: "center" }
        );
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(55, 48, 163);
        doc.text("rentpe.in", pageW / 2, pageH - 5, { align: "center" });

        // ═══════════════════════════════════════════════════════════════════════
        // PAGES 2+: Individual GST Tax Invoice per transaction (GST Rule 46)
        // Owner's CA uses these to claim Input Tax Credit on platform fees.
        // ═══════════════════════════════════════════════════════════════════════
        if (rows.length > 0) {
            const GST_RATE = 0.18;
            const generatedOnStr = format(new Date(), "dd MMM yyyy, HH:mm");
            const fy = getFY(monthStart);

            rows.forEach((row: any, idx: number) => {
                // Only generate a tax invoice if platform commission was charged
                if (row.ownerFee <= 0) return;

                doc.addPage("a4", "portrait");
                const pw = doc.internal.pageSize.getWidth();
                const ph = doc.internal.pageSize.getHeight();
                const PL = 14; const PR = 196;

                // Page border
                doc.setDrawColor(199, 210, 254);
                doc.setLineWidth(0.4);
                doc.rect(6, 6, pw - 12, ph - 12);

                // Invoice sequence number per GST Rule 46
                const seqNo = String(idx + 1).padStart(6, "0");
                const taxInvoiceNo = `RP/FY${fy}/${seqNo}`;

                // ── Formal navy header ──────────────────────────────────────
                doc.setFillColor(30, 27, 75);
                doc.rect(0, 0, pw, 42, "F");
                doc.setFillColor(49, 46, 129);
                doc.rect(0, 36, pw, 6, "F");

                doc.setTextColor(255, 255, 255);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(22);
                doc.text("RentPe", PL, 19);
                doc.setFontSize(8);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(199, 210, 254);
                doc.text("E-Commerce Operator under Section 52 CGST Act", PL, 26);

                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(255, 255, 255);
                doc.text("TAX INVOICE", PR, 17, { align: "right" });
                doc.setFontSize(8.5);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(199, 210, 254);
                doc.text(`#${taxInvoiceNo}`, PR, 24, { align: "right" });

                doc.setFillColor(99, 102, 241);
                doc.roundedRect(PR - 30, 27, 30, 8, 2, 2, "F");
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(7.5);
                doc.setFont("helvetica", "bold");
                doc.text("ORIGINAL", PR - 15, 32.5, { align: "center" });

                // ── Billing Cards ───────────────────────────────────────────
                let iy = 50;

                doc.setFillColor(238, 242, 255);
                doc.roundedRect(PL, iy, 88, 48, 2, 2, "F");
                doc.setDrawColor(199, 210, 254);
                doc.roundedRect(PL, iy, 88, 48, 2, 2);

                doc.setFillColor(248, 250, 252);
                doc.roundedRect(108, iy, 88, 48, 2, 2, "F");
                doc.setDrawColor(226, 232, 240);
                doc.roundedRect(108, iy, 88, 48, 2, 2);

                const drawBillingBlock = (lines: string[], xStart: number, title: string) => {
                    doc.setFontSize(6.5);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(100, 116, 139);
                    doc.text(title, xStart + 4, iy + 7);
                    lines.forEach((line, li) => {
                        doc.setFontSize(li === 0 ? 9.5 : 7.5);
                        doc.setFont("helvetica", li === 0 ? "bold" : "normal");
                        doc.setTextColor(li === 0 ? 15 : 71, li === 0 ? 23 : 85, li === 0 ? 42 : 105);
                        const txt = line.length > 30 ? line.substring(0, 30) + "…" : line;
                        doc.text(txt, xStart + 4, iy + 14 + (li * 8));
                    });
                };

                const isOnboarding = row.type === 'PROPERTY_ONBOARDING';
                const currentSac = isOnboarding ? "998314" : "997312";
                const serviceDesc = isOnboarding ? "Property Onboarding Platform Services" : "Platform Commission";

                drawBillingBlock([
                    "RentPe (Antigravity Project)",
                    "Platform Service Provider",
                    "GSTIN: PENDING REGISTRATION",
                    `SAC: ${currentSac}`,
                ], PL, "BILLED BY (SUPPLIER)");

                drawBillingBlock([
                    owner.name || "—",
                    row.property || "—",
                    `Owner ID: ${owner.displayId || "—"}`,
                    owner.email || "—",
                ], 108, "BILLED TO (RECIPIENT / OWNER)");

                iy += 56;

                // ── Invoice Meta Table ──────────────────────────────────────
                const metaRows = [
                    { label: "Invoice Number",        value: taxInvoiceNo },
                    { label: "Invoice Date",          value: row.date },
                    { label: "For Month",             value: monthLabel },
                    { label: "Billed Item",           value: isOnboarding ? "Property Onboarding" : `Tenant: ${row.tenant}` },
                    { label: "Payment Reference",     value: row.paymentRef },
                    { label: "Place of Supply",       value: (row.property || "India").substring(0, 28) },
                ];

                doc.setFillColor(55, 48, 163);
                doc.roundedRect(PL, iy, 182, 9, 1, 1, "F");
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(8.5);
                doc.setFont("helvetica", "bold");
                doc.text("INVOICE DETAILS", PL + 4, iy + 6);
                iy += 11;

                metaRows.forEach((mr, mi) => {
                    const isEven = mi % 2 === 0;
                    doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
                    doc.rect(PL, iy, 182, 9, "F");
                    doc.setDrawColor(226, 232, 240);
                    doc.line(PL, iy, PR, iy);
                    doc.line(130, iy, 130, iy + 9);
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(8);
                    doc.setTextColor(100, 116, 139);
                    doc.text(mr.label, PL + 4, iy + 6);
                    doc.setTextColor(15, 23, 42);
                    doc.text(mr.value.substring(0, 36), PR - 4, iy + 6, { align: "right" });
                    iy += 9;
                });
                doc.setDrawColor(199, 210, 254);
                doc.rect(PL, iy - (metaRows.length * 9), 182, metaRows.length * 9);
                iy += 8;

                // ── GST Charge Table ────────────────────────────────────────
                // GST-inclusive decomposition
                const feeBase = Math.round((row.ownerFee / (1 + GST_RATE)) * 100) / 100;
                const gstTotal = Math.round((row.ownerFee - feeBase) * 100) / 100;
                const cgst = Math.round((gstTotal / 2) * 100) / 100;
                const sgst = Math.round((gstTotal - cgst) * 100) / 100;

                doc.setFillColor(30, 27, 75);
                doc.roundedRect(PL, iy, 182, 9, 1, 1, "F");
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(8);
                doc.setFont("helvetica", "bold");
                doc.text("DESCRIPTION OF SERVICES", PL + 4, iy + 6);
                iy += 10;

                // Column headers
                const gcols = { desc: PL + 4, sac: 100, base: 128, cgst: 148, sgst: 168, total: 192 };
                doc.setFillColor(238, 242, 255);
                doc.rect(PL, iy, 182, 9, "F");
                doc.setDrawColor(199, 210, 254);
                doc.line(PL, iy, PR, iy);
                ["Description", "SAC", "Taxable Value", "CGST 9%", "SGST 9%", "Total"].forEach((h, hi) => {
                    const x = [gcols.desc, gcols.sac, gcols.base, gcols.cgst, gcols.sgst, gcols.total][hi];
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(7.5);
                    doc.setTextColor(55, 48, 163);
                    if (hi === 0) doc.text(h, x, iy + 6);
                    else doc.text(h, x, iy + 6, { align: "right" });
                });
                iy += 10;

                // Data row
                doc.setFillColor(248, 250, 252);
                doc.rect(PL, iy, 182, 10, "F");
                doc.setDrawColor(226, 232, 240);
                doc.line(PL, iy, PR, iy);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(7.5);
                doc.setTextColor(15, 23, 42);
                doc.text(serviceDesc, gcols.desc, iy + 6.5);
                doc.text(currentSac, gcols.sac, iy + 6.5, { align: "right" });
                doc.text(inr(feeBase), gcols.base, iy + 6.5, { align: "right" });
                doc.text(inr(cgst), gcols.cgst, iy + 6.5, { align: "right" });
                doc.text(inr(sgst), gcols.sgst, iy + 6.5, { align: "right" });
                doc.setFont("helvetica", "bold");
                doc.text(inr(row.ownerFee), gcols.total, iy + 6.5, { align: "right" });
                iy += 11;

                // Total row
                doc.setFillColor(238, 242, 255);
                doc.rect(PL, iy, 182, 10, "F");
                doc.setDrawColor(199, 210, 254);
                doc.line(PL, iy, PR, iy);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(8.5);
                doc.setTextColor(55, 48, 163);
                doc.text("TOTAL INVOICE VALUE", gcols.desc, iy + 6.5);
                doc.setTextColor(15, 23, 42);
                doc.text(inr(row.ownerFee), gcols.total, iy + 6.5, { align: "right" });
                iy += 12;
                doc.setDrawColor(199, 210, 254);
                doc.rect(PL, iy - 31, 182, 31);

                // ── Payout Reconciliation ───────────────────────────────────
                iy += 5;
                doc.setFillColor(30, 27, 75);
                doc.roundedRect(PL, iy, 182, 9, 1, 1, "F");
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(8.5);
                doc.setFont("helvetica", "bold");
                doc.text("PAYOUT RECONCILIATION", PL + 4, iy + 6);
                iy += 11;

                const onboardingTotal = Math.round((row.ownerFee + row.gstOnOwner) * 100) / 100;
                const payoutItems = isOnboarding
                    ? [
                        { label: "B2B Service Fee (excl. GST)", value: inr(row.ownerFee), bold: false },
                        { label: "Add: GST 18% (SAC 998314)", value: `+ ${inr(row.gstOnOwner)}`, bold: false },
                        { label: "TOTAL PAID BY OWNER (INCLUSIVE)", value: inr(onboardingTotal), bold: true, red: true },
                      ]
                    : [
                        { label: "Gross Rent Collected from Tenant",      value: inr(row.gross), bold: false },
                        { label: "Less: Platform Commission (incl. GST)", value: `- ${inr(row.ownerFee)}`, red: true },
                      ];
                if (!isOnboarding && row.tds > 0) {
                    payoutItems.push({ label: `Less: TDS Deducted (1% u/s 194-O on Rent)`, value: `- ${inr(row.tds)}`, amber: true } as any);
                }
                if (!isOnboarding) {
                    payoutItems.push({ label: "NET PAYOUT TO OWNER BANK ACCOUNT",         value: inr(row.netPayout), bold: true, green: true } as any);
                }

                payoutItems.forEach((pi: any, pii: number) => {
                    const pEven = pii % 2 === 0;
                    if (pi.green)       doc.setFillColor(220, 252, 231);
                    else if (pi.red)    doc.setFillColor(254, 226, 226);
                    else if (pi.amber)  doc.setFillColor(255, 251, 235);
                    else doc.setFillColor(pEven ? 248 : 255, pEven ? 250 : 255, pEven ? 252 : 255);
                    doc.rect(PL, iy, 182, 9, "F");
                    doc.setDrawColor(226, 232, 240);
                    doc.line(PL, iy, PR, iy);
                    doc.line(130, iy, 130, iy + 9);
                    doc.setFont("helvetica", pi.bold ? "bold" : "normal");
                    doc.setFontSize(pi.bold ? 9 : 8);
                    doc.setTextColor(pi.bold ? 55 : 100, pi.bold ? 48 : 116, pi.bold ? 163 : 139);
                    doc.text(pi.label, PL + 4, iy + 6);
                    doc.setTextColor(15, 23, 42);
                    doc.setFont("helvetica", pi.bold ? "bold" : "normal");
                    doc.text(pi.value, PR - 4, iy + 6, { align: "right" });
                    iy += 9;
                });
                doc.setDrawColor(199, 210, 254);
                doc.rect(PL, iy - (payoutItems.length * 9), 182, payoutItems.length * 9);
                iy += 5;

                // ── CA Advisory ─────────────────────────────────────────────
                doc.setFillColor(255, 251, 235);
                doc.roundedRect(PL, iy, 182, 20, 2, 2, "F");
                doc.setDrawColor(253, 230, 138);
                doc.roundedRect(PL, iy, 182, 20, 2, 2);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(7.5);
                doc.setTextColor(146, 64, 14);
                doc.text("CA & TAX ADVISORY", PL + 4, iy + 7);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(7);
                doc.setTextColor(92, 45, 5);
                if (isOnboarding) {
                    doc.text("1. This Property Onboarding Fee is a capital business expense, not a rental commission.", PL + 4, iy + 13);
                    doc.text(`2. You paid ${inr(onboardingTotal)} (including GST). You can claim ${inr(row.gstOnOwner)} as Input Tax Credit (ITC).`, PL + 4, iy + 18);
                } else {
                    doc.text(`1. Declare Gross Rent of ${inr(row.gross)} as Rental Income in ITR. NOT the net payout.`, PL + 4, iy + 13);
                    doc.text(`2. Platform Commission of ${inr(row.ownerFee)} is an allowable business expense — deductible from taxable income.`, PL + 4, iy + 18);
                }
                iy += 24;

                // ── Page footer ─────────────────────────────────────────────
                doc.setFillColor(248, 250, 252);
                doc.roundedRect(PL, iy, 182, 14, 1, 1, "F");
                doc.setDrawColor(226, 232, 240);
                doc.roundedRect(PL, iy, 182, 14, 1, 1);
                doc.setFont("helvetica", "italic");
                doc.setFontSize(7);
                doc.setTextColor(100, 116, 139);
                doc.text("Computer-generated tax invoice. Valid without signature. For disputes, contact support@rentpe.in", pw / 2, iy + 6, { align: "center" });
                doc.setFont("helvetica", "bold");
                doc.setTextColor(55, 48, 163);
                doc.text("rentpe.in", pw / 2, iy + 12, { align: "center" });

                doc.setFont("helvetica", "normal");
                doc.setFontSize(6.5);
                doc.setTextColor(148, 163, 184);
                doc.text(
                    `Generated: ${generatedOnStr}  ·  Invoice: ${taxInvoiceNo}  ·  Page ${idx + 2} of ${rows.length + 1}`,
                    pw / 2, ph - 5, { align: "center" }
                );
            });
        }

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
