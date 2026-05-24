import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { jsPDF } from "jspdf";
import { format } from "date-fns";

function inr(amount: number): string {
    return `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function inrShort(amount: number): string {
    return `Rs. ${amount.toLocaleString("en-IN")}`;
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
                user: { select: { name: true, email: true, displayId: true } },
            }
        });

        if (!booking) return new NextResponse("Not found", { status: 404 });

        // Ownership check
        if ((session as any).role === "USER" && booking.userId !== userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (!(booking as any).tokenPaidAt) {
            return new NextResponse("Token not yet paid", { status: 400 });
        }

        // ── Data ──────────────────────────────────────────────────────────────
        const receiptNo    = `TKN-${booking.displayId}`;
        const tenantName   = booking.guestName || booking.user?.name || "—";
        const tenantEmail  = booking.guestEmail || booking.user?.email || "—";
        const tenantId     = booking.user?.displayId || booking.displayId;
        const propName     = booking.propertyName || booking.property?.name || "—";
        const propAddr     = booking.property?.address || "—";
        const propCity     = booking.property?.city || "";
        const tokenAmount  = Number((booking as any).tokenAmount || 1000);
        const tokenPaidAt  = (booking as any).tokenPaidAt
            ? format(new Date((booking as any).tokenPaidAt), "dd MMM yyyy, HH:mm")
            : "—";
        const paymentRef   = (booking as any).tokenPaymentId || "—";
        const paymentMethod = (booking as any).paymentMethod || "Online";
        const bookingRef   = booking.displayId;
        const generatedOn  = format(new Date(), "dd MMM yyyy, HH:mm");

        // ── Build PDF ─────────────────────────────────────────────────────────
        const doc  = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const L = 14;
        const R = 196;

        // ── Header ────────────────────────────────────────────────────────────
        doc.setFillColor(55, 48, 163);
        doc.rect(0, 0, pageW, 45, "F");
        doc.setFillColor(109, 40, 217);
        doc.rect(0, 38, pageW, 7, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(24);
        doc.text("RentPe", L, 20);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(199, 210, 254);
        doc.text("Verified PGs & Hostels", L, 27);

        doc.setFontSize(15);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("TOKEN RECEIPT", R, 18, { align: "right" });

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(199, 210, 254);
        doc.text(`#${receiptNo}`, R, 25, { align: "right" });

        // PAID badge
        doc.setFillColor(16, 185, 129);
        doc.roundedRect(R - 32, 28, 32, 9, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.text("✓  PAID", R - 16, 34, { align: "center" });

        // Token badge
        doc.setFillColor(124, 58, 237);
        doc.roundedRect(L, 28, 40, 9, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("TOKEN PAYMENT", L + 20, 34, { align: "center" });

        // ── Tenant & Property cards ───────────────────────────────────────────
        let y = 52;

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(L, y, 88, 50, 2, 2, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(L, y, 88, 50, 2, 2);

        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("TENANT DETAILS", L + 4, y + 7);

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(tenantName, L + 4, y + 15);

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(`ID: ${tenantId}`, L + 4, y + 22);
        doc.text(tenantEmail, L + 4, y + 29);
        doc.text(`Booking: ${bookingRef}`, L + 4, y + 36);

        // Property card
        doc.setFillColor(238, 242, 255);
        doc.roundedRect(108, y, 88, 50, 2, 2, "F");
        doc.setDrawColor(199, 210, 254);
        doc.roundedRect(108, y, 88, 50, 2, 2);

        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("PROPERTY DETAILS", 112, y + 7);

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        const pn = propName.length > 26 ? propName.substring(0, 26) + "…" : propName;
        doc.text(pn, 112, y + 15);

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        const addr = propAddr.length > 34 ? propAddr.substring(0, 34) + "…" : propAddr;
        doc.text(addr, 112, y + 22);
        doc.text(propCity, 112, y + 29);

        // ── Notice box ───────────────────────────────────────────────────────
        y += 58;
        doc.setFillColor(255, 251, 235);
        doc.roundedRect(L, y, 182, 10, 1, 1, "F");
        doc.setDrawColor(253, 230, 138);
        doc.roundedRect(L, y, 182, 10, 1, 1);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(146, 64, 14);
        doc.text(
            "IMPORTANT: This token amount (Rs. 1,000) is NON-REFUNDABLE and confirms your intent to join.",
            pageW / 2, y + 6.5, { align: "center" }
        );
        y += 14;

        // ── Payment summary table ─────────────────────────────────────────────
        doc.setFillColor(55, 48, 163);
        doc.roundedRect(L, y, 182, 9, 1, 1, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.text("PAYMENT SUMMARY", L + 4, y + 6);
        y += 11;

        const rows: Array<{ label: string; value: string; bold?: boolean; highlight?: boolean }> = [
            { label: "Receipt No.",      value: receiptNo },
            { label: "Booking Ref.",     value: bookingRef },
            { label: "Tenant ID",        value: tenantId },
            { label: "Property",         value: propName.length > 36 ? propName.substring(0, 36) + "…" : propName },
            { label: "Token Amount",     value: inrShort(tokenAmount), bold: true, highlight: true },
            { label: "Paid On",          value: tokenPaidAt },
            { label: "Payment Method",   value: paymentMethod },
            { label: "Payment Ref",      value: paymentRef },
        ];

        const ROW_H = 9;
        rows.forEach((row, i) => {
            const isEven = i % 2 === 0;
            if (row.highlight) {
                doc.setFillColor(238, 242, 255);
            } else {
                doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
            }
            doc.rect(L, y, 182, ROW_H, "F");
            doc.setDrawColor(226, 232, 240);
            doc.line(L, y, R, y);
            doc.line(130, y, 130, y + ROW_H);

            doc.setFont("helvetica", row.bold ? "bold" : "normal");
            doc.setFontSize(row.bold ? 9 : 8);
            doc.setTextColor(row.bold ? 55 : 100, row.bold ? 48 : 116, row.bold ? 163 : 139);
            doc.text(row.label, L + 4, y + 6);

            doc.setTextColor(15, 23, 42);
            doc.setFont("helvetica", row.bold ? "bold" : "normal");
            doc.setFontSize(row.bold ? 9.5 : 8);
            doc.text(row.value, R - 4, y + 6, { align: "right" });

            y += ROW_H;
        });

        doc.setDrawColor(226, 232, 240);
        doc.line(L, y, R, y);
        doc.setDrawColor(199, 210, 254);
        doc.rect(L, y - (rows.length * ROW_H), 182, rows.length * ROW_H);

        // ── Amount in words ───────────────────────────────────────────────────
        y += 6;
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(L, y, 182, 10, 1, 1, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(L, y, 182, 10, 1, 1);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(`Amount in words: ${numberToWords(tokenAmount)} Only`, L + 4, y + 6.5);

        // ── Footer ────────────────────────────────────────────────────────────
        y += 16;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(L, y, 182, 18, 1, 1, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(L, y, 182, 18, 1, 1);

        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(
            "This is a computer-generated receipt and does not require a physical signature.",
            pageW / 2, y + 6, { align: "center" }
        );
        doc.text(
            "For disputes, raise a support ticket at rentpe.in/dashboard/student/tickets",
            pageW / 2, y + 11, { align: "center" }
        );
        doc.setFont("helvetica", "bold");
        doc.setTextColor(55, 48, 163);
        doc.text("rentpe.in", pageW / 2, y + 16, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
            `Generated: ${generatedOn}  ·  Receipt: ${receiptNo}  ·  Page 1 of 1`,
            pageW / 2, pageH - 6, { align: "center" }
        );

        // ── Output ────────────────────────────────────────────────────────────
        const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
        const disposition = isDownload
            ? `attachment; filename="RentPe-Token-${receiptNo}.pdf"`
            : `inline; filename="RentPe-Token-${receiptNo}.pdf"`;

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

function numberToWords(n: number): string {
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
        "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
        "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    function convert(num: number): string {
        if (num === 0) return "";
        if (num < 20) return ones[num];
        if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? " " + ones[num % 10] : "");
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
