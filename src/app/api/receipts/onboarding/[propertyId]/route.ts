import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { jsPDF } from "jspdf";
import { format } from "date-fns";

function inr(amount: number): string {
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
            doc.setDrawColor(199, 210, 254); doc.setLineWidth(0.5); doc.line(L, y, R, y); y += 2; return;
        }
        const isEven = i % 2 === 0;
        if (row.highlight === "green") doc.setFillColor(220, 252, 231);
        else if (row.highlight === "red") doc.setFillColor(254, 226, 226);
        else if (row.highlight === "amber") doc.setFillColor(255, 251, 235);
        else if (row.highlight === "blue") doc.setFillColor(238, 242, 255);
        else if (row.indent) doc.setFillColor(248, 250, 255);
        else doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
        doc.rect(L, y, 182, ROW_H, "F");
        doc.setDrawColor(226, 232, 240); doc.line(L, y, R, y); doc.line(130, y, 130, y + ROW_H);
        const labelX = row.indent ? L + 8 : L + 4;
        doc.setFont("helvetica", row.bold ? "bold" : (row.indent ? "italic" : "normal"));
        doc.setFontSize(row.bold ? 9 : (row.indent ? 7.5 : 8));
        doc.setTextColor(row.bold ? 55 : (row.indent ? 99 : 100), row.bold ? 48 : (row.indent ? 102 : 116), row.bold ? 163 : (row.indent ? 241 : 139));
        doc.text(row.label, labelX, y + 6);
        doc.setTextColor(15, 23, 42); doc.setFont("helvetica", row.bold ? "bold" : "normal"); doc.setFontSize(row.bold ? 9.5 : 8);
        doc.text(row.value, R - 4, y + 6, { align: "right" });
        y += ROW_H;
    });
    doc.setDrawColor(226, 232, 240); doc.line(L, y, R, y);
    const totalRows = rows.filter(r => !r.divider);
    doc.setDrawColor(199, 210, 254); doc.rect(L, y - (totalRows.length * ROW_H), 182, totalRows.length * ROW_H);
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
    const rupees = Math.floor(n); const paise = Math.round((n - rupees) * 100);
    let result = "Rupees " + (convert(rupees) || "Zero");
    if (paise > 0) result += ` and ${convert(paise)} Paise`;
    return result;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ propertyId: string }> }
) {
    try {
        const session = await getSession();
        if (!session) return new NextResponse("Unauthorized", { status: 401 });

        const { propertyId } = await params;
        const userId = (session as any).userId;
        const role = (session as any).role;
        const isDownload = req.nextUrl.searchParams.get("download") === "1";

        const property = await (prisma.property as any).findUnique({
            where: { id: propertyId },
            include: {
                owner: { select: { name: true, email: true, phone: true, displayId: true } },
            },
        });

        if (!property) return new NextResponse("Property not found", { status: 404 });

        // Security: owner can only download their own receipt
        if (role !== "ADMIN" && property.ownerId !== userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (!property.onboardingPaidAt) {
            return new NextResponse("Onboarding fee has not been paid yet", { status: 400 });
        }

        // ── Fee & GST Calculation ─────────────────────────────────────────────
        const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
        const feeTotal   = settings?.ownerOnboardingFeeFlat || 99;
        const GST_RATE   = 0.18;
        const feeBase    = Math.round((feeTotal / (1 + GST_RATE)) * 100) / 100;
        const gstTotal   = Math.round((feeTotal - feeBase) * 100) / 100;
        const cgst       = Math.round((gstTotal / 2) * 100) / 100;
        const sgst       = Math.round((gstTotal - cgst) * 100) / 100;
        const SAC_CODE   = "998314"; // Platform intermediary / IT-enabled services

        // ── Receipt Data ──────────────────────────────────────────────────────
        const receiptNo      = `OBD-RP-${property.displayId || propertyId.slice(-6).toUpperCase()}`;
        const ownerName      = property.owner?.name || "—";
        const ownerEmail     = property.owner?.email || "—";
        const ownerPhone     = property.owner?.phone || "—";
        const ownerId        = property.owner?.displayId || "—";
        const propName       = property.name || "—";
        const propAddr       = property.address || "—";
        const propCity       = property.city || "";
        const propDisplayId  = property.displayId || "—";
        const propGstin      = property.gstNumber || null;
        const paidAt         = property.onboardingPaidAt
            ? format(new Date(property.onboardingPaidAt), "dd MMM yyyy, HH:mm") : "—";
        const razorpayId     = property.onboardingRazorpayId || (property.onboardingPaymentMethod === "CASH" ? "Cash Payment" : "—");
        const razorpayOrderId = property.onboardingRazorpayOrderId || "—";
        const paymentMethod  = property.onboardingPaymentMethod === "ONLINE" ? "Online (Razorpay)" : (property.onboardingPaymentMethod || "—");
        const generatedOn    = format(new Date(), "dd MMM yyyy, HH:mm");

        // ── Build PDF ─────────────────────────────────────────────────────────
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const L = 14; const R = 196;

        drawPageBorder(doc);

        // ── Header ────────────────────────────────────────────────────────────
        doc.setFillColor(55, 48, 163);
        doc.rect(0, 0, pageW, 42, "F");
        doc.setFillColor(124, 58, 237);
        doc.rect(0, 36, pageW, 6, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("RentPe", L, 19);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(199, 210, 254);
        doc.text("Verified PGs & Hostels", L, 26);

        // Badge
        doc.setFillColor(124, 58, 237);
        doc.roundedRect(L, 27, 48, 8, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.text("PROPERTY ONBOARDING", L + 24, 32.5, { align: "center" });

        // Title
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("ONBOARDING FEE INVOICE", R, 17, { align: "right" });
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

        // ── Owner & Property Cards ────────────────────────────────────────────
        let y = 50;

        // Owner card (left)
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(L, y, 88, 54, 2, 2, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(L, y, 88, 54, 2, 2);
        doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(100, 116, 139);
        doc.text("OWNER DETAILS", L + 4, y + 7);
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
        doc.text(ownerName.length > 22 ? ownerName.substring(0, 22) + "…" : ownerName, L + 4, y + 15);
        doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(71, 85, 105);
        doc.text(`ID: ${ownerId}`, L + 4, y + 23);
        doc.text(ownerEmail.length > 28 ? ownerEmail.substring(0, 28) + "…" : ownerEmail, L + 4, y + 30);
        doc.text(`Phone: ${ownerPhone}`, L + 4, y + 37);

        // Property card (right)
        doc.setFillColor(238, 242, 255);
        doc.roundedRect(108, y, 88, 54, 2, 2, "F");
        doc.setDrawColor(199, 210, 254);
        doc.roundedRect(108, y, 88, 54, 2, 2);
        doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(100, 116, 139);
        doc.text("PROPERTY DETAILS", 112, y + 7);
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
        const pn = propName.length > 22 ? propName.substring(0, 22) + "…" : propName;
        doc.text(pn, 112, y + 15);
        doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(71, 85, 105);
        doc.text(`Property ID: ${propDisplayId}`, 112, y + 23);
        const addr = propAddr.length > 30 ? propAddr.substring(0, 30) + "…" : propAddr;
        doc.text(addr, 112, y + 30);
        doc.text(propCity, 112, y + 37);
        if (propGstin) doc.text(`GSTIN: ${propGstin}`, 112, y + 44);

        y += 62;

        // ── Service Description Banner ────────────────────────────────────────
        doc.setFillColor(238, 242, 255);
        doc.roundedRect(L, y, 182, 12, 1, 1, "F");
        doc.setDrawColor(199, 210, 254);
        doc.roundedRect(L, y, 182, 12, 1, 1);
        doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(55, 48, 163);
        doc.text("SERVICE:", L + 4, y + 5);
        doc.setFont("helvetica", "normal"); doc.setTextColor(71, 85, 105);
        doc.text(`Platform Property Onboarding Fee — One-time fee to list your property on RentPe (SAC Code: ${SAC_CODE})`, L + 24, y + 5);
        doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(100, 116, 139);
        doc.text("18% GST (CGST 9% + SGST 9%) is inclusive in the total amount. This is a tax invoice under CGST Act, 2017.", L + 4, y + 10);
        y += 16;

        // ── Payment Summary Table ─────────────────────────────────────────────
        doc.setFillColor(55, 48, 163);
        doc.roundedRect(L, y, 182, 9, 1, 1, "F");
        doc.setTextColor(255, 255, 255); doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
        doc.text("PAYMENT SUMMARY", L + 4, y + 6);
        y += 11;

        type RowType = { label: string; value: string; bold?: boolean; highlight?: "blue" | "green" | "red" | "amber"; indent?: boolean; divider?: boolean };
        const rows: RowType[] = [
            { label: "Invoice / Receipt No.", value: receiptNo },
            { label: "Property Name", value: propName.length > 36 ? propName.substring(0, 36) + "…" : propName },
            { label: "Property ID", value: propDisplayId },
            { label: "Owner Name", value: ownerName },
            { divider: true, label: "", value: "" },
            { label: `Platform Onboarding Service Fee (SAC ${SAC_CODE}) — Incl. 18% GST`, value: inr(feeTotal) },
            { label: "  Base Service Fee (excl. GST)", value: inr(feeBase), indent: true },
            { label: "  CGST @ 9%", value: inr(cgst), indent: true },
            { label: "  SGST @ 9%", value: inr(sgst), indent: true },
            { divider: true, label: "", value: "" },
            { label: "TOTAL AMOUNT PAID (incl. 18% GST)", value: inr(feeTotal), bold: true, highlight: "green" },
            { divider: true, label: "", value: "" },
            { label: "Paid On", value: paidAt },
            { label: "Payment Method", value: paymentMethod },
            { label: "Razorpay Payment ID", value: razorpayId },
            { label: "Razorpay Order ID", value: razorpayOrderId },
        ];

        y = drawTableRows(doc, y, rows);
        y += 5;

        // ── Amount in Words ───────────────────────────────────────────────────
        doc.setFillColor(249, 250, 251); doc.roundedRect(L, y, 182, 10, 1, 1, "F");
        doc.setDrawColor(226, 232, 240); doc.roundedRect(L, y, 182, 10, 1, 1);
        doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); doc.setTextColor(71, 85, 105);
        doc.text(`Amount in words: ${numberToWords(feeTotal)} Only`, L + 4, y + 6.5);
        y += 14;

        // ── Legal Note ────────────────────────────────────────────────────────
        doc.setFillColor(254, 243, 199); doc.roundedRect(L, y, 182, 12, 1, 1, "F");
        doc.setDrawColor(252, 211, 77); doc.roundedRect(L, y, 182, 12, 1, 1);
        doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(146, 64, 14);
        doc.text("NOTE:", L + 4, y + 5);
        doc.setFont("helvetica", "normal"); doc.setTextColor(92, 45, 3);
        doc.text("This is a one-time, non-refundable platform onboarding fee. GST is inclusive. For GST credit, consult your CA.", L + 18, y + 5);
        doc.text(`RentPe's GSTIN is on record. SAC Code ${SAC_CODE} applies for ITC purposes.`, L + 4, y + 10);
        y += 16;

        // ── Footer ────────────────────────────────────────────────────────────
        doc.setFillColor(248, 250, 252); doc.roundedRect(L, y, 182, 18, 1, 1, "F");
        doc.setDrawColor(226, 232, 240); doc.roundedRect(L, y, 182, 18, 1, 1);
        doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(100, 116, 139);
        doc.text("This is a computer-generated tax invoice and does not require a physical signature.", pageW / 2, y + 6, { align: "center" });
        doc.text("For disputes, raise a support ticket at rentpe.in/dashboard/owner/tickets", pageW / 2, y + 11, { align: "center" });
        doc.setFont("helvetica", "bold"); doc.setTextColor(55, 48, 163);
        doc.text("rentpe.in", pageW / 2, y + 16, { align: "center" });

        doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(148, 163, 184);
        doc.text(`Generated: ${generatedOn}  ·  Invoice: ${receiptNo}  ·  Page 1 of 1`, pageW / 2, pageH - 5, { align: "center" });

        // ── Output ────────────────────────────────────────────────────────────
        const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
        const fileName  = `RentPe-Onboarding-${receiptNo}.pdf`;
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": isDownload ? `attachment; filename="${fileName}"` : `inline; filename="${fileName}"`,
                "Cache-Control": "no-store",
            },
        });

    } catch (err: any) {
        console.error("Onboarding receipt generation error:", err);
        return new NextResponse("Failed to generate receipt", { status: 500 });
    }
}
