import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import {
    uploadReceiptToStorage,
    downloadReceiptFromStorage,
    receiptExistsInStorage,
} from "@/lib/supabase";

// ─── Month Label Helper ──────────────────────────────────────────────────────
// Converts DB format "2026-07" → human-readable "July 2026" for PDF display
const monthLabel = (m: string) => {
    if (!m) return '';
    const [y, mo] = m.split('-');
    if (!y || !mo) return m;
    return new Date(Number(y), Number(mo) - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
};

// ─── Currency Helpers ─────────────────────────────────────────────────────────
// jsPDF does not support the ₹ glyph. We use "Rs." — standard on Indian receipts.
function inr(amount: number): string {
    return `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function inrShort(amount: number): string {
    return `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Financial Year Helper ────────────────────────────────────────────────────
// Returns e.g. "26-27" for any date between Apr 2026 – Mar 2027
function getFY(date: Date): string {
    const y = date.getFullYear();
    const m = date.getMonth(); // 0-indexed; April = 3
    const startYear = m >= 3 ? y : y - 1;
    const endYear = startYear + 1;
    return `${String(startYear).slice(2)}-${String(endYear).slice(2)}`;
}

// ─── Drawing Helper ───────────────────────────────────────────────────────────
function drawPageBorder(doc: jsPDF) {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(199, 210, 254);
    doc.setLineWidth(0.4);
    doc.rect(6, 6, w - 12, h - 12);
}

// ─── Header Block ─────────────────────────────────────────────────────────────
function drawHeader(doc: jsPDF, title: string, subtitle: string, badgeText: string, badgeColor: [number, number, number], cornerLabel?: string) {
    const pageW = doc.internal.pageSize.getWidth();
    const L = 14; const R = 196;

    // Indigo header band
    doc.setFillColor(55, 48, 163);
    doc.rect(0, 0, pageW, 42, "F");
    // Purple accent strip
    doc.setFillColor(109, 40, 217);
    doc.rect(0, 36, pageW, 6, "F");

    // Brand name
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("RentPe", L, 19);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(199, 210, 254);
    doc.text("Verified PGs & Hostels", L, 26);

    // Title (right)
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(title, R, 17, { align: "right" });
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(199, 210, 254);
    doc.text(subtitle, R, 24, { align: "right" });

    if (cornerLabel) {
        doc.setFillColor(255, 255, 255, 0.15); // Transparent white
        doc.roundedRect(L, 30, 32, 5, 1, 1, "F");
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(cornerLabel, L + 16, 33.5, { align: "center" });
    }

    // Status badge
    doc.setFillColor(...badgeColor);
    doc.roundedRect(R - 30, 27, 30, 8, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(badgeText, R - 15, 32.5, { align: "center" });
}

// ─── Info Cards (Tenant + Property) ──────────────────────────────────────────
function drawInfoCards(doc: jsPDF, y: number, leftLines: string[], rightLines: string[]) {
    const L = 14;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(L, y, 88, 52, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(L, y, 88, 52, 2, 2);

    doc.setFillColor(238, 242, 255);
    doc.roundedRect(108, y, 88, 52, 2, 2, "F");
    doc.setDrawColor(199, 210, 254);
    doc.roundedRect(108, y, 88, 52, 2, 2);

    const drawLines = (lines: string[], xStart: number, label: string) => {
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text(label, xStart + 4, y + 7);

        lines.forEach((line, i) => {
            doc.setFontSize(i === 0 ? 10 : 7.5);
            doc.setFont("helvetica", i === 0 ? "bold" : "normal");
            doc.setTextColor(i === 0 ? 15 : 71, i === 0 ? 23 : 85, i === 0 ? 42 : 105);
            const maxLen = i === 0 ? 22 : 32;
            const txt = line.length > maxLen ? line.substring(0, maxLen) + "…" : line;
            doc.text(txt, xStart + 4, y + 14 + (i * 8));
        });
    };

    drawLines(leftLines, L, "TENANT DETAILS");
    drawLines(rightLines, 108, "PROPERTY DETAILS");
}

// ─── Table Row Renderer ───────────────────────────────────────────────────────
function drawTableRows(
    doc: jsPDF,
    y: number,
    rows: Array<{
        label: string;
        value: string;
        bold?: boolean;
        highlight?: "blue" | "green" | "red" | "amber";
        indent?: boolean;
        divider?: boolean;
    }>
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

    // Bottom border + outer rect
    doc.setDrawColor(226, 232, 240);
    doc.line(L, y, R, y);
    doc.setDrawColor(199, 210, 254);
    const totalRows = rows.filter(r => !r.divider);
    doc.rect(L, y - (totalRows.length * ROW_H), 182, totalRows.length * ROW_H);

    return y;
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function drawFooter(doc: jsPDF, generatedOn: string, receiptNo: string, pageNum: number, totalPages: number) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const L = 14; const R = 196;

    const y = pageH - 30;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(L, y, 182, 18, 1, 1, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(L, y, 182, 18, 1, 1);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("This is a computer-generated document and does not require a physical signature.", pageW / 2, y + 6, { align: "center" });
    doc.text("For disputes, raise a support ticket at rentpe.in/dashboard/student/tickets", pageW / 2, y + 11, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(55, 48, 163);
    doc.text("rentpe.in", pageW / 2, y + 16, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
        `Generated: ${generatedOn}  ·  Ref: ${receiptNo}  ·  Page ${pageNum} of ${totalPages}`,
        pageW / 2, pageH - 5, { align: "center" }
    );
}

// ─── Number to Indian Words ───────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ROUTE HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ invoiceId: string }> }
) {
    try {
        const session = await getSession();
        if (!session) return new NextResponse("Unauthorized", { status: 401 });

        const { invoiceId } = await params;
        const userId = (session as any).userId;
        const isDownload = req.nextUrl.searchParams.get("download") === "1";

        const invoice = await prisma.rentInvoice.findUnique({
            where: { id: invoiceId },
            include: {
                billingProfile: { include: { tenant: true } },
                booking: {
                    include: {
                        property: true,
                        room: true,
                        user: { select: { name: true, email: true, displayId: true } }
                    }
                },
                payments: { where: { status: "VERIFIED" }, orderBy: { date: "desc" }, take: 1 }
            }
        });

        if (!invoice) return new NextResponse("Not found", { status: 404 });
        const sessionRole = (session as any).role;
        const sessionOwnerId = (session as any).parentOwnerId || userId;

        if (sessionRole === "USER" && invoice.booking?.userId !== userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }
        if ((sessionRole === "OWNER" || sessionRole === "STAFF") && invoice.booking?.property?.ownerId !== sessionOwnerId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }
        if (invoice.status !== "PAID") {
            return new NextResponse("Receipt only available for paid invoices", { status: 400 });
        }

        // ── Platform Fee Record ───────────────────────────────────────────────
        // Fetch the recorded platform fee for this invoice's payment
        const payment = await prisma.payment.findFirst({
            where: { invoiceId: invoice.id, status: 'VERIFIED' }
        });
        const platformFee = payment ? await (prisma as any).platformFee.findFirst({
            where: { paymentId: payment.id }
        }) : null;

        // GST-INCLUSIVE decomposition (Rs.9 incl. GST → base Rs.7.63 + GST Rs.1.37)
        const GST_RATE = 0.18;
        const convFee       = platformFee ? Number(platformFee.customerFee) : 0;
        const gstOnFee      = convFee > 0 ? Math.round((convFee * GST_RATE / (1 + GST_RATE)) * 100) / 100 : 0;
        const convFeeBase   = convFee > 0 ? Math.round((convFee - gstOnFee) * 100) / 100 : 0;
        const cgstAmt       = Math.round((gstOnFee / 2) * 100) / 100;
        const sgstAmt       = Math.round((gstOnFee - cgstAmt) * 100) / 100;
        const tdsAmt        = platformFee ? Number(platformFee.tdsAmount) : 0;
        const ownerFee      = platformFee ? Number(platformFee.ownerFee ?? 0) : 0;
        const ownerFeeGst   = ownerFee > 0 ? Math.round((ownerFee * GST_RATE / (1 + GST_RATE)) * 100) / 100 : 0;
        const ownerFeeBase  = ownerFee > 0 ? Math.round((ownerFee - ownerFeeGst) * 100) / 100 : 0;
        const ownerCgst     = Math.round((ownerFeeGst / 2) * 100) / 100;
        const ownerSgst     = Math.round((ownerFeeGst - ownerCgst) * 100) / 100;
        const sacCode       = platformFee?.sacCode || "997312";
        const feesApplied   = convFee > 0;

        // ── Sequence Numbers ──────────────────────────────────────────────────
        // Student Receipt: REC-RP-XXXXXX (infinite, never resets)
        // Tax Invoice:     RP/FYXX-YY/XXXXXX (resets per financial year — GST Rule 46)
        const paidAt        = invoice.paidAt ? new Date(invoice.paidAt) : new Date();
        const fy            = getFY(paidAt);
        const seqBase       = invoice.displayId?.replace(/\D/g, "") || invoiceId.slice(0, 6).toUpperCase();
        const studentReceiptNo  = invoice.displayId || `REC-RP-${seqBase.padStart(6, "0")}`;
        const taxInvoiceNo      = `RP/FY${fy}/${seqBase.padStart(6, "0")}`;

        // ── Tenant & Property ─────────────────────────────────────────────────
        const tenantName  = invoice.billingProfile?.tenant?.name || invoice.booking?.user?.name || "—";
        const tenantEmail = invoice.billingProfile?.tenant?.email || invoice.booking?.user?.email || "—";
        const tenantId    = invoice.billingProfile?.tenant?.displayId || invoice.booking?.user?.displayId || "—";
        const roomNo      = invoice.billingProfile?.tenant?.roomNumber || invoice.booking?.roomAssigned || invoice.booking?.room?.roomNumber || "—";
        const bedInfo     = invoice.billingProfile?.tenant?.roomType ? ` · ${invoice.billingProfile.tenant.roomType}` : "";
        const stayStart   = invoice.booking?.agreementSignedAt
            ? format(new Date(invoice.booking.agreementSignedAt), "dd MMM yyyy")
            : (invoice.billingProfile?.tenant?.startDate || "—");
        const propName    = invoice.booking?.propertyName || invoice.booking?.property?.name || "—";
        const propAddr    = invoice.booking?.property?.address || "—";
        const propCity    = invoice.booking?.property?.city || "";
        const propGst     = (invoice.booking?.property as any)?.gstNumber || null;
        const ownerName   = (invoice.booking?.property as any)?.owner?.name || "Property Owner";

        // ── Amounts ───────────────────────────────────────────────────────────
        const baseRent    = Number(invoice.rentAmount);
        const foodAmt     = Number(invoice.foodAmount || 0);
        const creditAmt   = Number((invoice as any).creditApplied || 0);
        // The exact amount the student paid (rent + food - credit + platform fee)
        // convFee is GST-inclusive so we do NOT add gstOnFee on top
        const studentTotalPaid = baseRent + foodAmt - creditAmt + convFee;
        // The owner's gross income is just the rent portion (not the platform fee)
        const ownerGrossRent  = baseRent + foodAmt - creditAmt;
        const ownerNetPayout  = ownerGrossRent - ownerFee - tdsAmt;

        const paymentMethod = invoice.paymentMethod || invoice.payments[0]?.method || "Online";
        const paymentRef    = (invoice.payments[0] as any)?.razorpayId || (invoice as any).confirmedByName || "—";
        const paidOnStr     = invoice.paidAt ? format(new Date(invoice.paidAt), "dd MMM yyyy, HH:mm") : "—";
        const dueDateStr    = format(new Date(invoice.dueDate), "dd MMM yyyy");
        const generatedOn   = format(new Date(), "dd MMM yyyy, HH:mm");

        // ═══════════════════════════════════════════════════════════════════════
        // BUILD PDF
        // ═══════════════════════════════════════════════════════════════════════
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageW = doc.internal.pageSize.getWidth();
        const L = 14;

        // ───────────────────────────────────────────────────────────────────────
        // PAGE 1: STUDENT RENT RECEIPT (HRA-Compliant)
        // ───────────────────────────────────────────────────────────────────────
        const isActuallyOwnerOrAdmin = (session as any).role === "OWNER" || (session as any).role === "OWNER_STAFF" || (session as any).role === "ADMIN" || (session as any).role === "ADMIN_STAFF";
        const forceTenantCopy = req.nextUrl.searchParams.get("copy") === "tenant";
        const showOwnerCopy = isActuallyOwnerOrAdmin && !forceTenantCopy;
        const copyLabel = showOwnerCopy ? "LANDLORD COPY" : "TENANT COPY";
        drawPageBorder(doc);
        drawHeader(doc, "RENT RECEIPT", `#${studentReceiptNo}`, "✓  PAID", [16, 185, 129], copyLabel);

        let y = 50;

        // Tenant + Property cards
        drawInfoCards(doc, y, [
            tenantName,
            `ID: ${tenantId}`,
            tenantEmail,
            `Room: ${roomNo}${bedInfo}`,
            `Stay from: ${stayStart}`,
        ], [
            propName,
            propAddr.length > 32 ? propAddr.substring(0, 32) + "…" : propAddr,
            propCity,
            propGst ? `GSTIN: ${propGst}` : "GSTIN: Not Registered",
        ]);

        y += 60;

        // ── HRA Note (The Key Legal Box) ──────────────────────────────────────
        doc.setFillColor(236, 253, 245);
        doc.roundedRect(L, y, 182, 12, 2, 2, "F");
        doc.setDrawColor(167, 243, 208);
        doc.roundedRect(L, y, 182, 12, 2, 2);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(5, 150, 105);
        doc.text("HRA EXEMPTION NOTE:", L + 4, y + 5.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(6, 95, 70);
        doc.text(
            `For Income Tax / HRA claim, the chargeable rent is ${inr(ownerGrossRent)}. Convenience fee of ${inr(convFee)} is a separate RentPe service charge.`,
            L + 4, y + 10
        );
        y += 16;

        // ── Payment Summary Table ─────────────────────────────────────────────
        doc.setFillColor(55, 48, 163);
        doc.roundedRect(L, y, 182, 9, 1, 1, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.text("PAYMENT SUMMARY", L + 4, y + 6);
        y += 11;

        const rows: Array<{ label: string; value: string; bold?: boolean; highlight?: "blue" | "green" | "red" | "amber"; indent?: boolean; divider?: boolean }> = [
            { label: "Period / Month",  value: invoice.month ? monthLabel(invoice.month) : "—" },
            { label: "Receipt No.",     value: studentReceiptNo },
            { label: "Tenant ID",       value: tenantId },
        ];

        // Rent row
        rows.push({ label: "Base Rent", value: inr(baseRent) });
        if (foodAmt > 0) rows.push({ label: "Food / Mess Charges", value: inr(foodAmt) });
        if (creditAmt > 0) rows.push({ label: "Credit / Adjustment Applied", value: `- ${inr(creditAmt)}` });

        // Platform fee row (GST-inclusive)
        if (feesApplied) {
            rows.push({ divider: true, label: "", value: "" });
            rows.push({ label: `RentPe Convenience Fee (SAC ${sacCode}) — Incl. 18% GST`, value: inr(convFee) });
            rows.push({ label: `  Base Service Fee`, value: inr(convFeeBase), indent: true });
            rows.push({ label: `  CGST @ 9%`, value: inr(cgstAmt), indent: true });
            rows.push({ label: `  SGST @ 9%`, value: inr(sgstAmt), indent: true });
            rows.push({ divider: true, label: "", value: "" });
        }

        rows.push({ label: "TOTAL AMOUNT PAID", value: inrShort(studentTotalPaid), bold: true, highlight: "green" });
        rows.push({ label: "Due Date", value: dueDateStr });
        rows.push({ label: "Paid On", value: paidOnStr });
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

        // ── Disclaimer Box ────────────────────────────────────────────────────
        doc.setFillColor(255, 251, 235);
        doc.roundedRect(L, y, 182, 14, 1, 1, "F");
        doc.setDrawColor(253, 230, 138);
        doc.roundedRect(L, y, 182, 14, 1, 1);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(146, 64, 14);
        doc.text("IMPORTANT:", L + 4, y + 5.5);
        doc.setFont("helvetica", "normal");
        doc.text(
            `Submit ONLY the Rent amount of ${inr(ownerGrossRent)} to your employer HR for HRA exemption. The convenience fee is NOT part of rent.`,
            L + 4, y + 10.5
        );

        drawFooter(doc, generatedOn, studentReceiptNo, 1, feesApplied ? 2 : 1);

        // ═══════════════════════════════════════════════════════════════════════
        // PAGE 2: PLATFORM FEE TAX INVOICE (GST Compliance — Owner View)
        // ═══════════════════════════════════════════════════════════════════════
        if (feesApplied && showOwnerCopy) {
            doc.addPage();
            drawPageBorder(doc);

            // Formal dark header for tax invoice
            doc.setFillColor(30, 27, 75); // deep navy
            doc.rect(0, 0, pageW, 42, "F");
            doc.setFillColor(49, 46, 129);
            doc.rect(0, 36, pageW, 6, "F");

            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(22);
            doc.text("RentPe", L, 19);
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(199, 210, 254);
            doc.text("E-Commerce Operator under Section 52 CGST Act", L, 26);

            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(255, 255, 255);
            doc.text("TAX INVOICE", 196, 17, { align: "right" });
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(199, 210, 254);
            doc.text(`#${taxInvoiceNo}`, 196, 24, { align: "right" });

            // Original / Duplicate badge
            doc.setFillColor(99, 102, 241);
            doc.roundedRect(156, 27, 40, 8, 2, 2, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(6.5);
            doc.setFont("helvetica", "bold");
            doc.text("ORIGINAL FOR RECIPIENT", 176, 32.5, { align: "center" });

            y = 50;

            // ── Supplier & Receiver Cards ─────────────────────────────────────
            doc.setFillColor(238, 242, 255);
            doc.roundedRect(L, y, 88, 56, 2, 2, "F");
            doc.setDrawColor(199, 210, 254);
            doc.roundedRect(L, y, 88, 56, 2, 2);

            doc.setFillColor(248, 250, 252);
            doc.roundedRect(108, y, 88, 56, 2, 2, "F");
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(108, y, 88, 56, 2, 2);

            const drawBillingCard = (lines: string[], xStart: number, title: string) => {
                doc.setFontSize(6.5);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(100, 116, 139);
                doc.text(title, xStart + 4, y + 7);
                lines.forEach((line, i) => {
                    doc.setFontSize(i === 0 ? 9.5 : 7.5);
                    doc.setFont("helvetica", i === 0 ? "bold" : "normal");
                    doc.setTextColor(i === 0 ? 15 : 71, i === 0 ? 23 : 85, i === 0 ? 42 : 105);
                    const txt = line.length > 30 ? line.substring(0, 30) + "…" : line;
                    doc.text(txt, xStart + 4, y + 14 + (i * 8));
                });
            };

            drawBillingCard([
                "RentPe (Antigravity Project)",
                "Service Provider",
                `GSTIN: ${process.env.RENTPE_GSTIN || "PENDING REGISTRATION"}`,
                "PAN: PENDING",
                "rentpe.in",
            ], L, "BILLED BY (SUPPLIER)");

            drawBillingCard([
                ownerName,
                propName.length > 26 ? propName.substring(0, 26) + "…" : propName,
                propAddr.length > 30 ? propAddr.substring(0, 30) + "…" : propAddr,
                propCity,
                propGst ? `GSTIN: ${propGst}` : "GSTIN: Not Registered",
            ], 108, "BILLED TO (RECIPIENT / OWNER)");

            y += 64;

            // ── Invoice Meta ──────────────────────────────────────────────────
            const metaRows = [
                { label: "Invoice Number", value: taxInvoiceNo },
                { label: "Invoice Date", value: paidOnStr },
                { label: "For Payment Reference", value: paymentRef !== "—" ? paymentRef : studentReceiptNo },
                { label: "Place of Supply", value: propCity || "Karnataka" },
                { label: "Nature of Supply", value: "Service (B2B)" },
            ];

            doc.setFillColor(55, 48, 163);
            doc.roundedRect(L, y, 182, 9, 1, 1, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "bold");
            doc.text("INVOICE DETAILS", L + 4, y + 6);
            y += 11;

            metaRows.forEach((row, i) => {
                const isEven = i % 2 === 0;
                doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
                doc.rect(L, y, 182, 9, "F");
                doc.setDrawColor(226, 232, 240);
                doc.line(L, y, 196, y);
                doc.line(130, y, 130, y + 9);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(100, 116, 139);
                doc.text(row.label, L + 4, y + 6);
                doc.setTextColor(15, 23, 42);
                doc.text(row.value, 196 - 4, y + 6, { align: "right" });
                y += 9;
            });
            doc.setDrawColor(199, 210, 254);
            doc.rect(L, y - (metaRows.length * 9), 182, metaRows.length * 9);
            y += 8;

            // ── GST Charge Table (The Formal Govt Table) ──────────────────────
            doc.setFillColor(30, 27, 75);
            doc.roundedRect(L, y, 182, 9, 1, 1, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.text("DESCRIPTION OF SERVICES", L + 4, y + 6);
            y += 10;

            // Column headers
            const cols = { desc: L + 4, sac: 100, base: 128, cgst: 148, sgst: 168, total: 192 };
            doc.setFillColor(238, 242, 255);
            doc.rect(L, y, 182, 9, "F");
            doc.setDrawColor(199, 210, 254);
            doc.line(L, y, 196, y);
            ["Description", "SAC", "Taxable Value", "CGST 9%", "SGST 9%", "Total"].forEach((h, i) => {
                const x = [cols.desc, cols.sac, cols.base, cols.cgst, cols.sgst, cols.total][i];
                doc.setFont("helvetica", "bold");
                doc.setFontSize(7.5);
                doc.setTextColor(55, 48, 163);
                if (i === 0) doc.text(h, x, y + 6);
                else doc.text(h, x, y + 6, { align: "right" });
            });
            y += 10;

            // Data row
            doc.setFillColor(248, 250, 252);
            doc.rect(L, y, 182, 10, "F");
            doc.setDrawColor(226, 232, 240);
            doc.line(L, y, 196, y);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(15, 23, 42);
            doc.text("Platform Commission", cols.desc, y + 6.5);
            doc.text(sacCode, cols.sac, y + 6.5, { align: "right" });
            doc.text(inr(ownerFeeBase), cols.base, y + 6.5, { align: "right" });
            doc.text(inr(ownerCgst), cols.cgst, y + 6.5, { align: "right" });
            doc.text(inr(ownerSgst), cols.sgst, y + 6.5, { align: "right" });
            doc.setFont("helvetica", "bold");
            doc.text(inr(ownerFee), cols.total, y + 6.5, { align: "right" });
            y += 11;

            // Total row
            doc.setFillColor(238, 242, 255);
            doc.rect(L, y, 182, 10, "F");
            doc.setDrawColor(199, 210, 254);
            doc.line(L, y, 196, y);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(55, 48, 163);
            doc.text("TOTAL INVOICE VALUE", cols.desc, y + 6.5);
            doc.setTextColor(15, 23, 42);
            doc.text(inr(ownerFee), cols.total, y + 6.5, { align: "right" });
            y += 12;

            // Outer border
            doc.setDrawColor(199, 210, 254);
            doc.rect(L, y - 31, 182, 31);

            // ── Payout Summary (The Owner's Bank Reconciliation) ──────────────
            y += 5;
            doc.setFillColor(30, 27, 75);
            doc.roundedRect(L, y, 182, 9, 1, 1, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "bold");
            doc.text("PAYOUT RECONCILIATION STATEMENT", L + 4, y + 6);
            y += 11;

            const payoutRows: Array<{ label: string; value: string; bold?: boolean; highlight?: "blue" | "green" | "red" | "amber"; indent?: boolean; divider?: boolean }> = [
                { label: "Gross Rent Collected from Tenant", value: inr(ownerGrossRent) },
                { label: "(Declare this full amount to your CA for Income Tax filing)", value: "", indent: true },
                { label: `Less: RentPe Platform Commission (Incl. GST)`, value: `- ${inr(ownerFee)}`, highlight: "red" as const },
                { label: `  Base Fee`, value: inr(ownerFeeBase), indent: true },
                { label: `  CGST @ 9%`, value: inr(ownerCgst), indent: true },
                { label: `  SGST @ 9%`, value: inr(ownerSgst), indent: true },
            ];

            if (tdsAmt > 0) {
                payoutRows.push({ label: "Less: TDS Deducted (1% u/s 194-O on Rent)", value: `- ${inr(tdsAmt)}`, highlight: "amber" as const });
                payoutRows.push({ label: "  (Visible in your Form 26AS. Claim as prepaid tax in ITR.)", value: "", indent: true });
            }

            payoutRows.push({ divider: true, label: "", value: "" });
            payoutRows.push({ label: "NET PAYOUT TO YOUR BANK ACCOUNT", value: inrShort(ownerNetPayout), bold: true, highlight: "green" as const });

            y = drawTableRows(doc, y, payoutRows);
            y += 5;

            // ── CA / Tax Advisory Box ─────────────────────────────────────────
            doc.setFillColor(255, 251, 235);
            doc.roundedRect(L, y, 182, 24, 2, 2, "F");
            doc.setDrawColor(253, 230, 138);
            doc.roundedRect(L, y, 182, 24, 2, 2);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(146, 64, 14);
            doc.text("CA & TAX ADVISORY", L + 4, y + 7);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(92, 45, 5);
            doc.text(`1. Declare Gross Rent of ${inr(ownerGrossRent)} as Rental Income in ITR. NOT the net payout.`, L + 4, y + 13);
            doc.text(`2. The Platform Commission of ${inr(ownerFee)} is your allowable business expense. Deduct it when computing profit.`, L + 4, y + 18);
            if (tdsAmt > 0) {
                doc.text(`3. TDS of ${inr(tdsAmt)} is deposited against your PAN. Check Form 26AS and claim it when filing ITR.`, L + 4, y + 23);
            }

            drawFooter(doc, generatedOn, taxInvoiceNo, 2, 2);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // OUTPUT — Cache-on-first-request via Supabase Storage
        // ═══════════════════════════════════════════════════════════════════════
        const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
        const fileName = `RentPe-Receipt-${studentReceiptNo}.pdf`;
        const disposition = isDownload
            ? `attachment; filename="${fileName}"`
            : `inline; filename="${fileName}"`;

        // ── Upload to Supabase Storage (background, non-blocking on failure) ──
        // Failure to upload to storage must NEVER break the download for the user.
        // The PDF is always streamed to the user from memory regardless of storage status.
        const copyKey = showOwnerCopy ? "landlord" : "tenant";
        const storagePath = `${invoiceId}/${copyKey}.pdf`;
        try {
            await uploadReceiptToStorage(invoiceId, copyKey, pdfBuffer);
            // Save the storage path reference to the database for future cache hits
            await prisma.rentInvoice.update({
                where: { id: invoiceId },
                data: { receiptUrl: storagePath },
            });
        } catch (storageErr: any) {
            // Log the error but do NOT fail the request — user still gets their PDF
            console.warn("[Storage] PDF upload to Supabase failed (non-critical):", storageErr?.message);
        }

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": disposition,
                "Cache-Control": "no-store",
            }
        });

    } catch (err: any) {
        console.error("Receipt generation error:", err);
        return new NextResponse("Failed to generate receipt", { status: 500 });
    }
}
