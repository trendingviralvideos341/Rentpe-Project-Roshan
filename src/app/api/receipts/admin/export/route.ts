/**
 * RentPe — Admin Platform Tax Summary Export
 * Route: GET /api/receipts/admin/export?from=YYYY-MM&to=YYYY-MM&format=pdf|csv
 *
 * ─── SECURITY ────────────────────────────────────────────────────────────────
 * • ADMIN and ADMIN_STAFF only
 * • All session checks enforced
 *
 * ─── WHAT'S INCLUDED ────────────────────────────────────────────────────────
 * • All platform fee records in the given date range
 * • Property-wise and owner-wise breakdown
 * • Total GST collected (CGST + SGST), total TDS deducted
 * • Net platform earnings
 * • Export-ready for CA/Chartered Accountant
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { jsPDF } from "jspdf";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";

export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return new NextResponse("Unauthorized", { status: 401 });
        if (!["ADMIN", "ADMIN_STAFF"].includes((session as any).role)) {
            return new NextResponse("Forbidden — Admin only", { status: 403 });
        }

        const fromParam     = req.nextUrl.searchParams.get("from") || format(new Date(), "yyyy-MM");
        const toParam       = req.nextUrl.searchParams.get("to")   || fromParam;
        const outputFormat  = req.nextUrl.searchParams.get("format") || "csv";

        let fromDate: Date, toDate: Date;
        try {
            fromDate = startOfMonth(parseISO(`${fromParam}-01`));
            toDate   = endOfMonth(parseISO(`${toParam}-01`));
        } catch {
            return new NextResponse("Invalid date format. Use YYYY-MM", { status: 400 });
        }

        // Fetch all platform fee records in date range
        const fees = await (prisma as any).platformFee.findMany({
            where: {
                createdAt: { gte: fromDate, lte: toDate },
                status: "ACTIVE",
            },
            include: {
                booking: {
                    include: {
                        user: { select: { name: true, email: true, displayId: true } },
                        room: {
                            include: {
                                property: {
                                    include: {
                                        owner: { select: { name: true, email: true, displayId: true } }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: "asc" },
        });

        // Aggregate totals
        let totalGross          = 0;
        let totalStudentFee     = 0;
        let totalOwnerFee       = 0;
        let totalGstStudent     = 0;
        let totalGstOwner       = 0;
        let totalTds            = 0;
        let totalPlatformEarned = 0;

        const rows = fees.map((f: any) => {
            const gross           = Number(f.grossAmount);
            const studentFee      = Number(f.customerFee);
            const ownerFee        = Number(f.ownerFee);
            const gstStudent      = Number(f.gstOnStudentFee || 0);
            const gstOwner        = Number(f.gstOnOwnerFee   || 0);
            const tds             = Number(f.tdsAmount        || 0);
            const platformEarned  = Number(f.platformEarned);
            const ownerName       = f.booking?.room?.property?.owner?.name || "—";
            const property        = f.booking?.room?.property?.name || f.booking?.propertyName || "—";
            const tenant          = f.booking?.user?.name || "—";

            totalGross          += gross;
            totalStudentFee     += studentFee;
            totalOwnerFee       += ownerFee;
            totalGstStudent     += gstStudent;
            totalGstOwner       += gstOwner;
            totalTds            += tds;
            totalPlatformEarned += platformEarned;

            return {
                date:           format(new Date(f.createdAt), "dd MMM yyyy"),
                bookingId:      f.bookingId?.slice(0, 8).toUpperCase() || "—",
                owner:          ownerName,
                property,
                tenant,
                gross,
                studentFee,
                ownerFee,
                gstStudent,
                gstOwner,
                totalGst:       Math.round((gstStudent + gstOwner) * 100) / 100,
                tds,
                platformEarned,
                netPlatform:    Math.round((platformEarned + gstStudent + gstOwner) * 100) / 100,
            };
        });

        const rangeLabel     = fromParam === toParam ? format(fromDate, "MMMM yyyy") : `${format(fromDate, "MMM yyyy")} – ${format(toDate, "MMM yyyy")}`;
        const generatedOn    = format(new Date(), "dd MMM yyyy, HH:mm");
        const totalGst       = Math.round((totalGstStudent + totalGstOwner) * 100) / 100;

        // ── CSV Export ────────────────────────────────────────────────────────
        if (outputFormat === "csv") {
            const csvLines = [
                `RentPe — Admin Platform Tax Summary Report`,
                `Period: ${rangeLabel} | Generated: ${generatedOn}`,
                `GSTIN: PENDING REGISTRATION | SAC: 997312 | GST: 18% (CGST 9% + SGST 9%) | TDS Sec 194-O: 1%`,
                "",
                "Date,Booking ID,Owner,Property,Tenant,Gross Rent (Rs.),Student Fee (Rs.),Owner Comm. (Rs.),GST-Student (Rs.),GST-Owner (Rs.),Total GST (Rs.),TDS 1% (Rs.),Platform Earned (Rs.)",
                ...rows.map((r: any) =>
                    `"${r.date}","${r.bookingId}","${r.owner}","${r.property}","${r.tenant}",${r.gross.toFixed(2)},${r.studentFee.toFixed(2)},${r.ownerFee.toFixed(2)},${r.gstStudent.toFixed(2)},${r.gstOwner.toFixed(2)},${r.totalGst.toFixed(2)},${r.tds.toFixed(2)},${r.platformEarned.toFixed(2)}`
                ),
                "",
                `TOTALS,,,,, ${totalGross.toFixed(2)},${totalStudentFee.toFixed(2)},${totalOwnerFee.toFixed(2)},${totalGstStudent.toFixed(2)},${totalGstOwner.toFixed(2)},${totalGst.toFixed(2)},${totalTds.toFixed(2)},${totalPlatformEarned.toFixed(2)}`,
                "",
                "SUMMARY",
                `Total Gross Transactions,Rs. ${totalGross.toFixed(2)}`,
                `Total GST Collected (to remit to Govt),Rs. ${totalGst.toFixed(2)}`,
                `  Of which CGST (9%),Rs. ${(totalGst / 2).toFixed(2)}`,
                `  Of which SGST (9%),Rs. ${(totalGst / 2).toFixed(2)}`,
                `Total TDS Deducted (Sec 194-O),Rs. ${totalTds.toFixed(2)}`,
                `Net Platform Earnings,Rs. ${totalPlatformEarned.toFixed(2)}`,
                "",
                "Note: Share GST amounts with your CA for GSTR-1 filing. TDS amounts to be deposited with Form 26QB.",
            ];

            return new NextResponse(csvLines.join("\n"), {
                status: 200,
                headers: {
                    "Content-Type": "text/csv; charset=utf-8",
                    "Content-Disposition": `attachment; filename="RentPe-Tax-Summary-${fromParam}-to-${toParam}.csv"`,
                    "Cache-Control": "no-store",
                }
            });
        }

        // ── PDF Export ────────────────────────────────────────────────────────
        const doc   = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const L = 10, R = pageW - 10;

        // Header
        doc.setFillColor(17, 24, 39);
        doc.rect(0, 0, pageW, 38, "F");
        doc.setFillColor(55, 48, 163);
        doc.rect(0, 31, pageW, 7, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.text("RentPe", L, 16);

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(156, 163, 175);
        doc.text("ADMIN — Platform Tax Summary Report", L, 23);

        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(rangeLabel, R, 16, { align: "right" });
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(156, 163, 175);
        doc.text(`Generated: ${generatedOn} | ADMIN CONFIDENTIAL`, R, 23, { align: "right" });

        // Summary cards
        let y = 46;
        const cards = [
            { label: "Total Gross",       value: `Rs. ${totalGross.toFixed(0)}`,          color: [15, 23, 42]  as [number,number,number] },
            { label: "GST Collected",     value: `Rs. ${totalGst.toFixed(0)}`,             color: [55, 48, 163] as [number,number,number] },
            { label: "TDS Deducted",      value: `Rs. ${totalTds.toFixed(0)}`,             color: [220, 38, 38] as [number,number,number] },
            { label: "Platform Earned",   value: `Rs. ${totalPlatformEarned.toFixed(0)}`,  color: [16, 185, 129]as [number,number,number] },
        ];
        const cardW = (pageW - 28) / 4;
        cards.forEach((card, i) => {
            const cx = L + i * (cardW + 2.5);
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(cx, y, cardW, 16, 2, 2, "F");
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(cx, y, cardW, 16, 2, 2);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(...card.color);
            doc.text(card.value, cx + cardW / 2, y + 9, { align: "center" });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.5);
            doc.setTextColor(100, 116, 139);
            doc.text(card.label, cx + cardW / 2, y + 14, { align: "center" });
        });

        y += 22;

        // Table header
        doc.setFillColor(17, 24, 39);
        doc.rect(L, y, pageW - 20, 8, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);

        const cols = [
            { label: "Date",         x: L + 1,   w: 18 },
            { label: "Owner",        x: L + 19,  w: 32 },
            { label: "Property",     x: L + 51,  w: 32 },
            { label: "Tenant",       x: L + 83,  w: 28 },
            { label: "Gross",        x: L + 111, w: 22 },
            { label: "St.Fee",       x: L + 133, w: 20 },
            { label: "Own.Comm",     x: L + 153, w: 22 },
            { label: "GST-St",       x: L + 175, w: 20 },
            { label: "GST-Own",      x: L + 195, w: 20 },
            { label: "TDS 1%",       x: L + 215, w: 22 },
            { label: "Plat.Earned",  x: L + 237, w: 28 },
        ];
        cols.forEach(c => doc.text(c.label, c.x, y + 5.5));
        y += 9;

        const ROW_H = 7;
        rows.forEach((row: any, i: number) => {
            if (y > pageH - 25) {
                doc.addPage("a4", "landscape");
                y = 15;
            }
            const isEven = i % 2 === 0;
            doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
            doc.rect(L, y, pageW - 20, ROW_H, "F");
            doc.setDrawColor(230, 230, 230);
            doc.line(L, y, R, y);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(6);
            doc.setTextColor(30, 30, 30);

            const t = (s: string, n: number) => s.length > n ? s.slice(0, n) + "…" : s;
            doc.text(row.date,                     cols[0].x, y + 4.5);
            doc.text(t(row.owner, 17),             cols[1].x, y + 4.5);
            doc.text(t(row.property, 17),          cols[2].x, y + 4.5);
            doc.text(t(row.tenant, 14),            cols[3].x, y + 4.5);
            doc.text(row.gross.toFixed(0),         cols[4].x + cols[4].w, y + 4.5, { align: "right" });
            doc.text(row.studentFee.toFixed(0),    cols[5].x + cols[5].w, y + 4.5, { align: "right" });
            doc.text(row.ownerFee.toFixed(0),      cols[6].x + cols[6].w, y + 4.5, { align: "right" });
            doc.setTextColor(55, 48, 163);
            doc.text(row.gstStudent.toFixed(2),    cols[7].x + cols[7].w, y + 4.5, { align: "right" });
            doc.text(row.gstOwner.toFixed(2),      cols[8].x + cols[8].w, y + 4.5, { align: "right" });
            doc.setTextColor(220, 38, 38);
            doc.text(row.tds.toFixed(2),           cols[9].x + cols[9].w, y + 4.5, { align: "right" });
            doc.setTextColor(16, 185, 129);
            doc.text(row.platformEarned.toFixed(2),cols[10].x + cols[10].w, y + 4.5, { align: "right" });
            doc.setTextColor(30, 30, 30);

            y += ROW_H;
        });

        // Totals row
        doc.setFillColor(238, 242, 255);
        doc.rect(L, y, pageW - 20, ROW_H + 1, "F");
        doc.setDrawColor(199, 210, 254);
        doc.rect(L, y, pageW - 20, ROW_H + 1);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(55, 48, 163);
        doc.text("TOTALS", L + 2, y + 5.5);
        doc.setTextColor(15, 23, 42);
        doc.text(totalGross.toFixed(0),          cols[4].x + cols[4].w, y + 5.5, { align: "right" });
        doc.text(totalStudentFee.toFixed(0),     cols[5].x + cols[5].w, y + 5.5, { align: "right" });
        doc.text(totalOwnerFee.toFixed(0),       cols[6].x + cols[6].w, y + 5.5, { align: "right" });
        doc.setTextColor(55, 48, 163);
        doc.text(totalGstStudent.toFixed(2),     cols[7].x + cols[7].w, y + 5.5, { align: "right" });
        doc.text(totalGstOwner.toFixed(2),       cols[8].x + cols[8].w, y + 5.5, { align: "right" });
        doc.setTextColor(220, 38, 38);
        doc.text(totalTds.toFixed(2),            cols[9].x + cols[9].w, y + 5.5, { align: "right" });
        doc.setTextColor(16, 185, 129);
        doc.text(totalPlatformEarned.toFixed(2), cols[10].x + cols[10].w, y + 5.5, { align: "right" });

        // Footer
        doc.setFont("helvetica", "italic");
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.text(
            `GSTIN: PENDING REGISTRATION | SAC: 997312 | GST: 18% (CGST 9% + SGST 9%) | TDS Sec 194-O @ 1% | ADMIN CONFIDENTIAL`,
            pageW / 2, pageH - 7, { align: "center" }
        );

        const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="RentPe-Admin-Tax-Report-${fromParam}-${toParam}.pdf"`,
                "Cache-Control": "no-store",
            }
        });

    } catch (err: any) {
        console.error("Admin tax report error:", err);
        return new NextResponse("Failed to generate report", { status: 500 });
    }
}
