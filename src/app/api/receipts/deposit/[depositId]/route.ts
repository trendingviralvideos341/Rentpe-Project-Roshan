import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { jsPDF } from "jspdf";
import { format } from "date-fns";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function inr(amount: number): string {
    return `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function drawPageBorder(doc: jsPDF) {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(167, 243, 208); // teal-200
    doc.setLineWidth(0.4);
    doc.rect(6, 6, w - 12, h - 12);
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

// ─── Route Handler ────────────────────────────────────────────────────────────
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ depositId: string }> }
) {
    try {
        const session = await getSession();
        if (!session) return new NextResponse("Unauthorized", { status: 401 });

        const { depositId } = await params;
        const userId    = (session as any).userId;
        const role      = (session as any).role;
        const isDownload = req.nextUrl.searchParams.get("download") === "1";

        // ── Fetch SecurityDeposit with full chain ─────────────────────────────
        const deposit = await (prisma as any).securityDeposit.findUnique({
            where: { id: depositId },
            include: {
                billingProfile: {
                    include: {
                        tenant: true,
                    }
                },
                payments: {
                    where: { status: { in: ["VERIFIED", "SUCCESS"] } },
                    orderBy: { date: "desc" },
                    take: 1,
                }
            }
        });

        if (!deposit) return new NextResponse("Deposit not found", { status: 404 });

        // Fetch the booking linked to this tenant for property details
        const booking = await prisma.booking.findFirst({
            where: { tenantId: deposit.tenantId },
            include: {
                property: { select: { name: true, address: true, city: true, gstNumber: true, owner: { select: { name: true } } } },
                room: true,
                user: { select: { name: true, email: true, displayId: true, phone: true } },
            }
        });

        // Authorization: student can only see their own deposit
        if (role === "USER") {
            if (booking?.userId !== userId) return new NextResponse("Unauthorized", { status: 401 });
        }

        if (deposit.status === "PENDING") {
            return new NextResponse("Deposit receipt only available after payment", { status: 400 });
        }

        // ── Extract Fields ────────────────────────────────────────────────────
        const tenant        = deposit.billingProfile?.tenant;
        const tenantName    = tenant?.name || booking?.guestName || "—";
        const tenantEmail   = tenant?.email || booking?.guestEmail || "—";
        const tenantPhone   = tenant?.phone || booking?.guestPhone || "—";
        const tenantId      = tenant?.displayId || booking?.user?.displayId || "—";
        const roomNo        = tenant?.roomNumber || booking?.roomAssigned || "—";
        const roomType      = tenant?.roomType || "";
        const stayStart     = tenant?.startDate
            ? tenant.startDate
            : (booking?.agreementSignedAt ? format(new Date(booking.agreementSignedAt), "dd MMM yyyy") : "—");

        const propName      = booking?.property?.name || booking?.propertyName || "—";
        const propAddr      = (booking?.property as any)?.address || "—";
        const propCity      = (booking?.property as any)?.city || "";
        const propGst       = (booking?.property as any)?.gstNumber || null;
        const ownerName     = (booking?.property as any)?.owner?.name || "Property Owner";
        const bookingRef    = booking?.displayId || "—";

        const depositAmt    = Number(deposit.amount);
        const paidAt        = deposit.paidAt
            ? format(new Date(deposit.paidAt), "dd MMM yyyy, HH:mm") : "—";
        const payment       = deposit.payments?.[0];
        const paymentRef    = payment?.razorpayId || payment?.razorpayOrderId || "—";
        const paymentMethod = payment?.method || "Online";

        // Sequence: DEP-RP-[depositId short]
        const receiptNo     = `DEP-RP-${deposit.id.slice(0, 8).toUpperCase()}`;
        const generatedOn   = format(new Date(), "dd MMM yyyy, HH:mm");

        // Refund/Status Labels
        const statusMap: Record<string, { label: string; color: [number, number, number] }> = {
            PAID:                     { label: "HELD BY OWNER", color: [16, 185, 129] },
            REFUND_PENDING:           { label: "REFUND PENDING", color: [245, 158, 11] },
            REFUNDED:                 { label: "FULLY REFUNDED", color: [99, 102, 241] },
            PARTIALLY_REFUNDED:       { label: "PART REFUNDED", color: [249, 115, 22] },
            FORFEITED:                { label: "FORFEITED", color: [239, 68, 68] },
            REFUND_OVERDUE:           { label: "REFUND OVERDUE", color: [220, 38, 38] },
            REFUNDED_VIA_WITHHOLDING: { label: "REFUNDED (WITHHELD)", color: [139, 92, 246] },
        };
        const statusInfo = statusMap[deposit.status] || { label: deposit.status, color: [100, 116, 139] as [number, number, number] };

        // ── Build PDF ─────────────────────────────────────────────────────────
        const doc   = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const L = 14; const R = 196;

        drawPageBorder(doc);

        // ── Header — deep teal theme ──────────────────────────────────────────
        doc.setFillColor(15, 118, 110);  // teal-700
        doc.rect(0, 0, pageW, 42, "F");
        doc.setFillColor(13, 148, 136);  // teal-600 accent strip
        doc.rect(0, 36, pageW, 6, "F");

        // Brand
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("RentPe", L, 19);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(153, 246, 228); // teal-200
        doc.text("Verified PGs & Hostels", L, 26);

        // Security Deposit badge (left)
        doc.setFillColor(13, 148, 136);
        doc.roundedRect(L, 27, 42, 8, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.text("SECURITY DEPOSIT", L + 21, 32.5, { align: "center" });

        // Copy label badge
        const isOwnerOrAdmin = role === "OWNER" || role === "OWNER_STAFF" || role === "ADMIN" || role === "ADMIN_STAFF";
        const copyLabel = isOwnerOrAdmin ? "LANDLORD COPY" : "TENANT COPY";
        doc.setFillColor(255, 255, 255, 0.15); // transparent white
        doc.roundedRect(59, 27, 28, 8, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.text(copyLabel, 73, 32.5, { align: "center" });

        // Title (right)
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("DEPOSIT RECEIPT", R, 17, { align: "right" });
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(153, 246, 228);
        doc.text(`#${receiptNo}`, R, 24, { align: "right" });

        // Status badge
        doc.setFillColor(...statusInfo.color);
        doc.roundedRect(R - 38, 27, 38, 8, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text(statusInfo.label, R - 19, 32.5, { align: "center" });

        // ── KEY LEGAL BOX — Right at the top ─────────────────────────────────
        let y = 50;
        doc.setFillColor(240, 253, 250);  // teal-50
        doc.roundedRect(L, y, 182, 14, 2, 2, "F");
        doc.setDrawColor(167, 243, 208);
        doc.roundedRect(L, y, 182, 14, 2, 2);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(15, 118, 110);
        doc.text("LEGAL CLASSIFICATION:", L + 4, y + 5.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(17, 94, 89);
        doc.text("Security Deposit is a REFUNDABLE LIABILITY — NOT taxable income for the owner. It is held in trust.", L + 4, y + 10.5);
        doc.text("NO TDS deducted on Deposit (TDS only applies on Rent under Section 194-O). Deposit is NOT HRA-eligible.", L + 4, y + 10.5 + 3.5);
        y += 18;

        // ── Tenant + Property Info Cards ──────────────────────────────────────
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(L, y, 88, 56, 2, 2, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(L, y, 88, 56, 2, 2);

        doc.setFillColor(240, 253, 250);
        doc.roundedRect(108, y, 88, 56, 2, 2, "F");
        doc.setDrawColor(167, 243, 208);
        doc.roundedRect(108, y, 88, 56, 2, 2);

        // Tenant card
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("TENANT (DEPOSITOR) DETAILS", L + 4, y + 7);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        const tn = tenantName.length > 22 ? tenantName.substring(0, 22) + "…" : tenantName;
        doc.text(tn, L + 4, y + 14);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(`ID: ${tenantId}`, L + 4, y + 21);
        doc.text(tenantEmail.length > 28 ? tenantEmail.substring(0, 28) + "…" : tenantEmail, L + 4, y + 28);
        doc.text(`Phone: ${tenantPhone}`, L + 4, y + 35);
        doc.text(`Room: ${roomNo}${roomType ? ` · ${roomType}` : ""}`, L + 4, y + 42);
        doc.text(`Move-in: ${stayStart}`, L + 4, y + 49);

        // Property card
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("PROPERTY (DEPOSIT HOLDER) DETAILS", 112, y + 7);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        const pn = propName.length > 22 ? propName.substring(0, 22) + "…" : propName;
        doc.text(pn, 112, y + 14);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        const addr = propAddr.length > 30 ? propAddr.substring(0, 30) + "…" : propAddr;
        doc.text(addr, 112, y + 21);
        doc.text(propCity, 112, y + 28);
        doc.text(`Owner: ${ownerName}`, 112, y + 35);
        if (propGst) doc.text(`GSTIN: ${propGst}`, 112, y + 42);
        doc.text(`Booking: ${bookingRef}`, 112, y + 49);

        y += 64;

        // ── Payment Summary Table ─────────────────────────────────────────────
        doc.setFillColor(15, 118, 110);
        doc.roundedRect(L, y, 182, 9, 1, 1, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.text("DEPOSIT PAYMENT SUMMARY", L + 4, y + 6);
        y += 11;

        type DepRow = { label: string; value: string; bold?: boolean; highlight?: string; indent?: boolean; divider?: boolean };
        const ROW_H = 9;

        const rows: DepRow[] = [
            { label: "Receipt No.",           value: receiptNo },
            { label: "Booking Reference",     value: bookingRef },
            { label: "Tenant ID",             value: tenantId },
            { label: "Security Deposit",      value: inr(depositAmt),     bold: true, highlight: "teal" },
            { label: "  Nature of Payment",   value: "Refundable Liability — NOT taxable income", indent: true },
            { label: "  TDS Deducted",        value: "Rs. 0.00 (TDS EXEMPT — Deposit is not rent)", indent: true },
            { label: "  GST Charged",         value: "Rs. 0.00 (Deposits not subject to GST)", indent: true },
            { divider: true, label: "", value: "" },
            { label: "Deposit Status",        value: statusInfo.label },
            { label: "Paid On",               value: paidAt },
            { label: "Payment Method",        value: paymentMethod },
            { label: "Payment Reference",     value: paymentRef },
        ];

        // Refund info if applicable
        if (deposit.refundAmount && deposit.refundAmount > 0) {
            rows.push({ divider: true, label: "", value: "" });
            rows.push({ label: "Refund Amount",      value: inr(Number(deposit.refundAmount)), bold: true });
            if (deposit.deductionAmount && deposit.deductionAmount > 0) {
                rows.push({ label: "Total Deductions",  value: inr(Number(deposit.deductionAmount)), highlight: "red" });
                if (deposit.deductionDamages)   rows.push({ label: "  Room Damages",    value: inr(Number(deposit.deductionDamages)),   indent: true });
                if (deposit.deductionUtilities) rows.push({ label: "  Unpaid Utilities", value: inr(Number(deposit.deductionUtilities)), indent: true });
                if (deposit.deductionRent)      rows.push({ label: "  Rent Arrears",    value: inr(Number(deposit.deductionRent)),      indent: true });
                if (deposit.deductionNotice)    rows.push({ label: "  Notice Default",  value: inr(Number(deposit.deductionNotice)),    indent: true });
                if (deposit.deductionOther)     rows.push({ label: "  Other",           value: inr(Number(deposit.deductionOther)),     indent: true });
            }
        }

        rows.forEach((row, i) => {
            if (row.divider) {
                doc.setDrawColor(167, 243, 208);
                doc.setLineWidth(0.5);
                doc.line(L, y, R, y);
                y += 2;
                return;
            }
            const isEven = i % 2 === 0;
            if (row.highlight === "teal")    doc.setFillColor(240, 253, 250);
            else if (row.highlight === "red") doc.setFillColor(254, 226, 226);
            else if (row.indent)              doc.setFillColor(248, 255, 253);
            else doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);

            doc.rect(L, y, 182, ROW_H, "F");
            doc.setDrawColor(226, 232, 240);
            doc.line(L, y, R, y);
            doc.line(130, y, 130, y + ROW_H);

            const labelX = row.indent ? L + 8 : L + 4;
            doc.setFont("helvetica", row.bold ? "bold" : (row.indent ? "italic" : "normal"));
            doc.setFontSize(row.bold ? 9 : (row.indent ? 7 : 8));
            doc.setTextColor(row.bold ? 15 : (row.indent ? 71 : 100), row.bold ? 118 : (row.indent ? 85 : 116), row.bold ? 110 : (row.indent ? 105 : 139));
            doc.text(row.label, labelX, y + 6);

            doc.setTextColor(15, 23, 42);
            doc.setFont("helvetica", row.bold ? "bold" : "normal");
            doc.setFontSize(row.bold ? 9.5 : 8);
            const val = row.value.length > 38 ? row.value.substring(0, 38) + "…" : row.value;
            doc.text(val, R - 4, y + 6, { align: "right" });
            y += ROW_H;
        });

        doc.setDrawColor(226, 232, 240);
        doc.line(L, y, R, y);
        doc.setDrawColor(167, 243, 208);
        const tableRows = rows.filter(r => !r.divider);
        doc.rect(L, y - (tableRows.length * ROW_H), 182, tableRows.length * ROW_H);

        y += 5;

        // ── Amount in Words ───────────────────────────────────────────────────
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(L, y, 182, 10, 1, 1, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(L, y, 182, 10, 1, 1);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Deposit amount in words: ${numberToWords(depositAmt)} Only`, L + 4, y + 6.5);
        y += 14;

        // ── Refund Terms Box ──────────────────────────────────────────────────
        doc.setFillColor(240, 253, 250);
        doc.roundedRect(L, y, 182, 24, 2, 2, "F");
        doc.setDrawColor(167, 243, 208);
        doc.roundedRect(L, y, 182, 24, 2, 2);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(15, 118, 110);
        doc.text("REFUND TERMS & LEGAL RIGHTS (MAHARERA / Indian Contract Act)", L + 4, y + 7);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(17, 94, 89);
        doc.text("1. This deposit is FULLY REFUNDABLE within 15 days of checkout, subject to deductions for damages, unpaid dues, or notice period defaults.", L + 4, y + 13);
        doc.text("2. Owner CANNOT withhold deposit for normal wear & tear. Tenant has the right to dispute via RentPe's Dispute Portal.", L + 4, y + 18);
        doc.text("3. If refund is delayed beyond 15 days, RentPe's Withholding Shield may auto-deduct from the owner's future payouts.", L + 4, y + 23);
        y += 28;

        // ── CA & Owner Advisory Box ───────────────────────────────────────────
        doc.setFillColor(255, 251, 235);
        doc.roundedRect(L, y, 182, 18, 2, 2, "F");
        doc.setDrawColor(253, 230, 138);
        doc.roundedRect(L, y, 182, 18, 2, 2);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(146, 64, 14);
        doc.text("OWNER & CA ADVISORY", L + 4, y + 7);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(92, 45, 5);
        doc.text(`Record ${inr(depositAmt)} as "Tenant Deposit Received" under Current Liabilities in your books — NOT as income.`, L + 4, y + 13);
        doc.text("When refunded, debit the liability. Any forfeited portion (if deducted) becomes taxable income in the year of forfeiture.", L + 4, y + 17.5);
        y += 22;

        // ── Footer ────────────────────────────────────────────────────────────
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(L, y, 182, 18, 1, 1, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(L, y, 182, 18, 1, 1);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text("This is a computer-generated deposit receipt and does not require a physical signature.", pageW / 2, y + 6, { align: "center" });
        doc.text("For refund disputes, raise a ticket at rentpe.in/dashboard/student/tickets", pageW / 2, y + 11, { align: "center" });
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 118, 110);
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
        const fileName  = `RentPe-Deposit-${receiptNo}.pdf`;
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
        console.error("Deposit receipt error:", err);
        return new NextResponse("Failed to generate deposit receipt", { status: 500 });
    }
}
