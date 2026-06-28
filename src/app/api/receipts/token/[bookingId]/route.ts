import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { jsPDF } from "jspdf";
import { format } from "date-fns";

function inr(amount: number): string {
    return `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function inrShort(amount: number): string {
    return `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function drawPageBorder(doc: jsPDF) {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(199, 210, 254);
    doc.setLineWidth(0.4);
    doc.rect(6, 6, w - 12, h - 12);
}

function drawTableRows(
    doc: jsPDF,
    y: number,
    rows: Array<{ label: string; value: string; bold?: boolean; highlight?: "blue" | "green" | "red" | "amber"; indent?: boolean; divider?: boolean }>
): number {
    const L = 14; const R = 196;
    const ROW_H = 9;

    rows.forEach((row, i) => {
        if (row.divider) {
            doc.setDrawColor(199, 210, 254);
            doc.setLineWidth(0.5);
            doc.line(L, y, R, y);
            y += 2;
            return;
        }
        const isEven = i % 2 === 0;
        if (row.highlight === "green") doc.setFillColor(220, 252, 231);
        else if (row.highlight === "red") doc.setFillColor(254, 226, 226);
        else if (row.highlight === "amber") doc.setFillColor(255, 251, 235);
        else if (row.highlight === "blue") doc.setFillColor(238, 242, 255);
        else if (row.indent) doc.setFillColor(248, 250, 255);
        else doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);

        doc.rect(L, y, 182, ROW_H, "F");
        doc.setDrawColor(226, 232, 240);
        doc.line(L, y, R, y);
        doc.line(130, y, 130, y + ROW_H);

        const labelX = row.indent ? L + 8 : L + 4;
        doc.setFont("helvetica", row.bold ? "bold" : (row.indent ? "italic" : "normal"));
        doc.setFontSize(row.bold ? 9 : (row.indent ? 7.5 : 8));
        doc.setTextColor(row.bold ? 55 : (row.indent ? 99 : 100), row.bold ? 48 : (row.indent ? 102 : 116), row.bold ? 163 : (row.indent ? 241 : 139));
        doc.text(row.label, labelX, y + 6);

        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", row.bold ? "bold" : "normal");
        doc.setFontSize(row.bold ? 9.5 : 8);
        doc.text(row.value, R - 4, y + 6, { align: "right" });
        y += ROW_H;
    });

    doc.setDrawColor(226, 232, 240);
    doc.line(L, y, R, y);
    const totalRows = rows.filter(r => !r.divider);
    doc.setDrawColor(199, 210, 254);
    doc.rect(L, y - (totalRows.length * ROW_H), 182, totalRows.length * ROW_H);
    return y;
}

function numberToWords(n: number): string {
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
        "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens_arr = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    function convert(num: number): string {
        if (num === 0) return "";
        if (num < 20) return ones[num];
        if (num < 100) return tens_arr[Math.floor(num / 10)] + (num % 10 !== 0 ? " " + ones[num % 10] : "");
        if (num < 1000) return ones[Math.floor(num / 100)] + " Hundred" + (num % 100 !== 0 ? " " + convert(num % 100) : "");
        if (num < 100000) return convert(Math.floor(num / 1000)) + " Thousand" + (num % 1000 !== 0 ? " " + convert(num % 1000) : "");
        if (num < 10000000) return convert(Math.floor(num / 100000)) + " Lakh" + (num % 100000 !== 0 ? " " + convert(num % 100000) : "");
        return convert(Math.floor(num / 10000000)) + " Crore" + (num % 10000000 !== 0 ? " " + convert(num % 10000000) : "");
    }
    const rupees = Math.floor(n);
    const paise = Math.round((n - rupees) * 100);
    let result = "Rupees " + (convert(rupees) || "Zero");
    if (paise > 0) result += ` and ${convert(paise)} Paise`;
    return result;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ bookingId: string }> }
) {
    try {
        const session = await getSession();
        if (!session) return new NextResponse("Unauthorized", { status: 401 });

        const { bookingId } = await params;
        const userId = (session as any).userId;
        const isDownload = req.nextUrl.searchParams.get("download") === "1";

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                property: true,
                user: { select: { name: true, email: true, displayId: true, phone: true } },
            }
        });

        if (!booking) return new NextResponse("Not found", { status: 404 });
        if ((session as any).role === "USER" && booking.userId !== userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }
        if (!(booking as any).tokenPaidAt) {
            return new NextResponse("Token not yet paid", { status: 400 });
        }

        // ── Platform Fee for Token Payment ────────────────────────────────────
        // Check if a platform fee was recorded for this token payment
        const platformFee = await (prisma as any).platformFee.findFirst({
            where: { bookingId: booking.id, paymentType: "TOKEN" },
            orderBy: { createdAt: "desc" }
        });

        const GST_RATE = 0.18;
        const tokenConvFee   = platformFee ? Number(platformFee.customerFee) : 0;
        const tokenGstOnFee  = tokenConvFee > 0 ? Math.round((tokenConvFee * GST_RATE / (1 + GST_RATE)) * 100) / 100 : 0;
        const tokenFeeBase   = tokenConvFee > 0 ? Math.round((tokenConvFee - tokenGstOnFee) * 100) / 100 : 0;
        const tokenCgst      = Math.round((tokenGstOnFee / 2) * 100) / 100;
        const tokenSgst      = Math.round((tokenGstOnFee - tokenCgst) * 100) / 100;
        // TDS on token (1% of token amount under 194-O — advance rent)
        const tokenAmount    = Number((booking as any).tokenAmount || 1000);
        const tdsAmt         = platformFee ? Number(platformFee.tdsAmount) : Math.round(tokenAmount * 0.01 * 100) / 100;
        const sacCode        = platformFee?.sacCode || "997312";
        const feesApplied    = tokenConvFee > 0;
        // Total charged to student card
        const studentTotalPaid = tokenAmount + tokenConvFee;

        // ── Sequence Numbers ──────────────────────────────────────────────────
        const receiptNo = `TKN-RP-${booking.displayId}`;
        
        // ── Data ──────────────────────────────────────────────────────────────
        const tenantName    = booking.guestName || booking.user?.name || "—";
        const tenantEmail   = booking.guestEmail || booking.user?.email || "—";
        const tenantPhone   = booking.guestPhone || (booking.user as any)?.phone || "—";
        const tenantId      = booking.user?.displayId || booking.displayId;
        const propName      = booking.propertyName || booking.property?.name || "—";
        const propAddr      = booking.property?.address || "—";
        const propCity      = booking.property?.city || "";
        const propGst       = (booking.property as any)?.gstNumber || null;
        const tokenPaidAt   = (booking as any).tokenPaidAt
            ? format(new Date((booking as any).tokenPaidAt), "dd MMM yyyy, HH:mm") : "—";
        const paymentRef    = (booking as any).tokenPaymentId || "—";
        const paymentMethod = (booking as any).paymentMethod || "Online";
        const bookingRef    = booking.displayId;
        const generatedOn   = format(new Date(), "dd MMM yyyy, HH:mm");
        const occupancy     = booking.occupancy || "";

        // ── Build PDF ─────────────────────────────────────────────────────────
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const L = 14; const R = 196;

        drawPageBorder(doc);

        // ── Header ────────────────────────────────────────────────────────────
        doc.setFillColor(55, 48, 163);
        doc.rect(0, 0, pageW, 42, "F");
        doc.setFillColor(124, 58, 237); // purple accent
        doc.rect(0, 36, pageW, 6, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("RentPe", L, 19);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(199, 210, 254);
        doc.text("Verified PGs & Hostels", L, 26);

        // Token badge (left)
        doc.setFillColor(124, 58, 237);
        doc.roundedRect(L, 27, 36, 8, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.text("TOKEN ADVANCE", L + 18, 32.5, { align: "center" });

        // Title (right)
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("TOKEN RECEIPT", R, 17, { align: "right" });
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(199, 210, 254);
        doc.text(`#${receiptNo}`, R, 24, { align: "right" });

        // PAID badge
        doc.setFillColor(16, 185, 129);
        doc.roundedRect(R - 30, 27, 30, 8, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("✓  PAID", R - 15, 32.5, { align: "center" });

        // ── Tenant & Property Cards ───────────────────────────────────────────
        let y = 50;

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(L, y, 88, 54, 2, 2, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(L, y, 88, 54, 2, 2);

        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("TENANT DETAILS", L + 4, y + 7);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(tenantName.length > 22 ? tenantName.substring(0, 22) + "…" : tenantName, L + 4, y + 15);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(`ID: ${tenantId}`, L + 4, y + 23);
        doc.text(tenantEmail.length > 28 ? tenantEmail.substring(0, 28) + "…" : tenantEmail, L + 4, y + 30);
        doc.text(`Phone: ${tenantPhone}`, L + 4, y + 37);
        doc.text(`Booking Ref: ${bookingRef}`, L + 4, y + 44);
        if (occupancy) doc.text(`Occupancy: ${occupancy}`, L + 4, y + 51);

        doc.setFillColor(238, 242, 255);
        doc.roundedRect(108, y, 88, 54, 2, 2, "F");
        doc.setDrawColor(199, 210, 254);
        doc.roundedRect(108, y, 88, 54, 2, 2);

        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("PROPERTY DETAILS", 112, y + 7);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        const pn = propName.length > 22 ? propName.substring(0, 22) + "…" : propName;
        doc.text(pn, 112, y + 15);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        const addr = propAddr.length > 32 ? propAddr.substring(0, 32) + "…" : propAddr;
        doc.text(addr, 112, y + 23);
        doc.text(propCity, 112, y + 30);
        if (propGst) doc.text(`GSTIN: ${propGst}`, 112, y + 37);

        y += 62;

        // ── Non-Refundable Notice ─────────────────────────────────────────────
        doc.setFillColor(254, 243, 199);
        doc.roundedRect(L, y, 182, 10, 1, 1, "F");
        doc.setDrawColor(252, 211, 77);
        doc.roundedRect(L, y, 182, 10, 1, 1);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(146, 64, 14);
        doc.text(
            `IMPORTANT: This Rs. ${tokenAmount.toLocaleString("en-IN")} token advance is NON-REFUNDABLE and confirms your intent to join.`,
            pageW / 2, y + 6.5, { align: "center" }
        );
        y += 14;

        // ── Adjustment Note ───────────────────────────────────────────────────
        doc.setFillColor(236, 253, 245);
        doc.roundedRect(L, y, 182, 10, 1, 1, "F");
        doc.setDrawColor(167, 243, 208);
        doc.roundedRect(L, y, 182, 10, 1, 1);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(5, 150, 105);
        doc.text("ADJUSTMENT NOTE:", L + 4, y + 4.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(6, 95, 70);
        doc.text(
            `This Rs. ${tokenAmount.toLocaleString("en-IN")} will be deducted from your final Joining Payment. Your receipt for the joining payment will reflect this adjustment.`,
            L + 4, y + 9
        );
        y += 14;

        // ── Payment Summary Table ─────────────────────────────────────────────
        doc.setFillColor(55, 48, 163);
        doc.roundedRect(L, y, 182, 9, 1, 1, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.text("PAYMENT SUMMARY", L + 4, y + 6);
        y += 11;

        const rows: Array<{ label: string; value: string; bold?: boolean; highlight?: "blue" | "green" | "red" | "amber"; indent?: boolean; divider?: boolean }> = [
            { label: "Receipt No.", value: receiptNo },
            { label: "Booking Reference", value: bookingRef },
            { label: "Tenant ID", value: tenantId },
            { label: "Property", value: propName.length > 36 ? propName.substring(0, 36) + "…" : propName },
        ];

        // Token amount
        rows.push({ label: "Token Advance Amount", value: inr(tokenAmount) });

        // Platform fee (if charged on token)
        if (feesApplied) {
            rows.push({ divider: true, label: "", value: "" });
            rows.push({ label: `RentPe Convenience Fee (SAC ${sacCode}) — Incl. 18% GST`, value: inr(tokenConvFee) });
            rows.push({ label: "  Base Service Fee", value: inr(tokenFeeBase), indent: true });
            rows.push({ label: "  CGST @ 9%", value: inr(tokenCgst), indent: true });
            rows.push({ label: "  SGST @ 9%", value: inr(tokenSgst), indent: true });
            rows.push({ divider: true, label: "", value: "" });
        }

        rows.push({ label: "TOTAL AMOUNT PAID", value: inrShort(studentTotalPaid), bold: true, highlight: "green" });

        // TDS info row (informational — TDS deducted from owner's side)
        rows.push({ divider: true, label: "", value: "" });
        rows.push({ label: `TDS Deducted u/s 194-O (1% on Token as Advance Rent)`, value: inr(tdsAmt), highlight: "amber" });
        rows.push({ label: "  (Credited against PG Owner's PAN. Visible in Form 26AS.)", value: "", indent: true });
        rows.push({ divider: true, label: "", value: "" });

        rows.push({ label: "Paid On", value: tokenPaidAt });
        rows.push({ label: "Payment Method", value: paymentMethod });
        rows.push({ label: "Payment Reference", value: paymentRef });

        y = drawTableRows(doc, y, rows);
        y += 5;

        // ── Amount in Words ───────────────────────────────────────────────────
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(L, y, 182, 10, 1, 1, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(L, y, 182, 10, 1, 1);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Amount in words: ${numberToWords(studentTotalPaid)} Only`, L + 4, y + 6.5);
        y += 14;

        // ── Footer ────────────────────────────────────────────────────────────
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(L, y, 182, 18, 1, 1, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(L, y, 182, 18, 1, 1);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text("This is a computer-generated receipt and does not require a physical signature.", pageW / 2, y + 6, { align: "center" });
        doc.text("For disputes, raise a support ticket at rentpe.in/dashboard/student/tickets", pageW / 2, y + 11, { align: "center" });
        doc.setFont("helvetica", "bold");
        doc.setTextColor(55, 48, 163);
        doc.text("rentpe.in", pageW / 2, y + 16, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
            `Generated: ${generatedOn}  ·  Receipt: ${receiptNo}  ·  Page 1 of 1`,
            pageW / 2, pageH - 5, { align: "center" }
        );

        // ── Output ────────────────────────────────────────────────────────────
        const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
        const fileName = `RentPe-Token-${receiptNo}.pdf`;
        const disposition = isDownload
            ? `attachment; filename="${fileName}"`
            : `inline; filename="${fileName}"`;

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": disposition,
                "Cache-Control": "no-store",
            }
        });

    } catch (err: any) {
        console.error("Token receipt generation error:", err);
        return new NextResponse("Failed to generate receipt", { status: 500 });
    }
}
