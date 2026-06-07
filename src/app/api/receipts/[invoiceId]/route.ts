import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { jsPDF } from "jspdf";
import { format } from "date-fns";

// jsPDF does not support the ₹ glyph in its built-in fonts.
// We use "Rs." as the printed symbol (standard on Indian receipts/invoices)
// and format numbers correctly without extra spaces.
function inr(amount: number): string {
    // Converts 5670 → "Rs. 5,670.00"
    return `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function inrShort(amount: number): string {
    // For the badge/highlight rows: "Rs. 5,670"
    return `Rs. ${amount.toLocaleString("en-IN")}`;
}

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
                billingProfile: {
                    include: {
                        tenant: true,
                    }
                },
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

        // Ownership check — students can only see their own; owners/admins see all
        if ((session as any).role === "USER" && invoice.booking?.userId !== userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (invoice.status !== "PAID") {
            return new NextResponse("Receipt only available for paid invoices", { status: 400 });
        }

        // ── Pull data ──────────────────────────────────────────────────────────
        const receiptNo   = invoice.displayId || `INV-${invoiceId.slice(0, 8).toUpperCase()}`;
        const tenantName  = invoice.billingProfile?.tenant?.name || invoice.booking?.user?.name || "—";
        const tenantEmail = invoice.billingProfile?.tenant?.email || invoice.booking?.user?.email || "—";
        const tenantId    = invoice.billingProfile?.tenant?.displayId || invoice.booking?.user?.displayId || "—";
        const roomNo      = invoice.billingProfile?.tenant?.roomNumber
                            || invoice.booking?.roomAssigned
                            || invoice.booking?.room?.roomNumber || "—";
        const bedInfo     = invoice.billingProfile?.tenant?.roomType ? ` (${invoice.billingProfile.tenant.roomType})` : "";
        const stayStart   = invoice.booking?.agreementSignedAt
                            ? format(new Date(invoice.booking.agreementSignedAt), "dd MMM yyyy")
                            : (invoice.billingProfile?.tenant?.startDate || (invoice.booking as any)?.moveInDate || "—");
        const propName    = invoice.booking?.propertyName || invoice.booking?.property?.name || "—";
        const propAddr    = invoice.booking?.property?.address || "—";
        const propCity    = invoice.booking?.property?.city || "";
        const propGst     = (invoice.booking?.property as any)?.gstNumber || null;

        const paymentMethod = invoice.paymentMethod || invoice.payments[0]?.method || "Online";
        const paymentRef    = (invoice.payments[0] as any)?.razorpayId
                              || (invoice as any).confirmedByName
                              || "—";
        const paidOn        = invoice.paidAt ? format(new Date(invoice.paidAt), "dd MMM yyyy, HH:mm") : "—";
        const dueDate       = format(new Date(invoice.dueDate), "dd MMM yyyy");
        const generatedOn   = format(new Date(), "dd MMM yyyy, HH:mm");

        // ── Build PDF ──────────────────────────────────────────────────────────
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageW = doc.internal.pageSize.getWidth();   // 210
        const pageH = doc.internal.pageSize.getHeight();  // 297

        const L = 14;  // left margin
        const R = 196; // right edge (pageW - 14)

        // ═══════════════════════════════════════════════════════════════════════
        // HEADER
        // ═══════════════════════════════════════════════════════════════════════
        doc.setFillColor(55, 48, 163); // indigo-700
        doc.rect(0, 0, pageW, 45, "F");

        // Purple accent strip
        doc.setFillColor(109, 40, 217);
        doc.rect(0, 38, pageW, 7, "F");

        // Brand
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(24);
        doc.text("RentPe", L, 20);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(199, 210, 254);
        doc.text("Verified PGs & Hostels", L, 27);

        // Title + Invoice number (right side)
        doc.setFontSize(15);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("RENT RECEIPT", R, 18, { align: "right" });

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

        // ═══════════════════════════════════════════════════════════════════════
        // TENANT & PROPERTY CARDS
        // ═══════════════════════════════════════════════════════════════════════
        let y = 52;

        // ── Tenant card ──
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
        doc.text(`Room: ${roomNo}${bedInfo}`, L + 4, y + 36);
        doc.text(`Stay from: ${stayStart}`, L + 4, y + 43);

        // ── Property card ──
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
        if (propGst) doc.text(`GSTIN: ${propGst}`, 112, y + 36);

        // ═══════════════════════════════════════════════════════════════════════
        // PAYMENT SUMMARY TABLE — professional Indian invoice layout
        // ═══════════════════════════════════════════════════════════════════════
        y += 58;

        // Table header
        doc.setFillColor(55, 48, 163);
        doc.roundedRect(L, y, 182, 9, 1, 1, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.text("PAYMENT SUMMARY", L + 4, y + 6);
        y += 11;

        // ── Table rows ──
        const rows: Array<{ label: string; value: string; bold?: boolean; highlight?: boolean }> = [
            { label: "Period / Month",  value: invoice.month || "—" },
            { label: "Invoice No.",     value: receiptNo },
            { label: "Tenant ID",       value: tenantId },
            { label: "Rent Amount",     value: inr(Number(invoice.rentAmount)) },
        ];

        if (Number(invoice.foodAmount) > 0) {
            rows.push({ label: "Food Charges", value: inr(Number(invoice.foodAmount)) });
        }
        if (Number(invoice.creditApplied) > 0) {
            rows.push({ label: "Credit Applied", value: `- ${inr(Number(invoice.creditApplied))}` });
        }

        rows.push(
            { label: "Total Amount",    value: inrShort(Number(invoice.amount)), bold: true, highlight: true },
            { label: "Due Date",        value: dueDate },
            { label: "Paid On",         value: paidOn },
            { label: "Payment Method",  value: paymentMethod },
            { label: "Payment Ref",     value: paymentRef },
        );

        const ROW_H = 9;

        rows.forEach((row, i) => {
            const isEven = i % 2 === 0;

            if (row.highlight) {
                doc.setFillColor(238, 242, 255); // indigo-50 for total row
            } else {
                doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
            }
            doc.rect(L, y, 182, ROW_H, "F");

            // Row border
            doc.setDrawColor(226, 232, 240);
            doc.line(L, y, R, y);

            // Vertical separator
            doc.setDrawColor(226, 232, 240);
            doc.line(130, y, 130, y + ROW_H);

            // Left label
            doc.setFont("helvetica", row.bold ? "bold" : "normal");
            doc.setFontSize(row.bold ? 9 : 8);
            doc.setTextColor(row.bold ? 55 : 100, row.bold ? 48 : 116, row.bold ? 163 : 139);
            doc.text(row.label, L + 4, y + 6);

            // Right value — always right-aligned at R-4
            doc.setTextColor(15, 23, 42);
            doc.setFont("helvetica", row.bold ? "bold" : "normal");
            doc.setFontSize(row.bold ? 9.5 : 8);
            doc.text(row.value, R - 4, y + 6, { align: "right" });

            y += ROW_H;
        });

        // Bottom border
        doc.setDrawColor(226, 232, 240);
        doc.line(L, y, R, y);

        // Outer border for the whole table
        doc.setDrawColor(199, 210, 254);
        doc.rect(L, y - (rows.length * ROW_H), 182, rows.length * ROW_H);

        // ═══════════════════════════════════════════════════════════════════════
        // AMOUNT IN WORDS — real Indian invoice standard
        // ═══════════════════════════════════════════════════════════════════════
        y += 6;
        const totalWords = numberToWords(Number(invoice.amount));
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(L, y, 182, 10, 1, 1, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(L, y, 182, 10, 1, 1);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(`Amount in words: ${totalWords} Only`, L + 4, y + 6.5);

        // ═══════════════════════════════════════════════════════════════════════
        // FOOTER
        // ═══════════════════════════════════════════════════════════════════════
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

        // Page number + generated timestamp
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
            `Generated: ${generatedOn}  ·  Invoice: ${receiptNo}  ·  Page 1 of 1`,
            pageW / 2, pageH - 6, { align: "center" }
        );

        // ═══════════════════════════════════════════════════════════════════════
        // OUTPUT — inline for preview, attachment for download
        // ═══════════════════════════════════════════════════════════════════════
        const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
        const disposition = isDownload
            ? `attachment; filename="RentPe-Receipt-${receiptNo}.pdf"`
            : `inline; filename="RentPe-Receipt-${receiptNo}.pdf"`;

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

// ─── Number → Words (Indian system) ──────────────────────────────────────────
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
