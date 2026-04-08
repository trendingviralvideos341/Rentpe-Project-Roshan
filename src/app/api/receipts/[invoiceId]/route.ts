import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { jsPDF } from "jspdf";
import { format } from "date-fns";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ invoiceId: string }> }
) {
    try {
        const session = await getSession();
        if (!session) return new NextResponse("Unauthorized", { status: 401 });

        const { invoiceId } = await params;
        const userId = (session as any).userId;

        const invoice = await prisma.rentInvoice.findUnique({
            where: { id: invoiceId },
            include: {
                booking: {
                    include: {
                        property: true,
                        room: true,
                        user: { select: { name: true, email: true } }
                    }
                },
                payments: { where: { status: "VERIFIED" }, orderBy: { date: "desc" }, take: 1 }
            }
        });

        if (!invoice) return new NextResponse("Not found", { status: 404 });

        // Ownership check
        if ((session as any).role === "USER" && invoice.booking?.userId !== userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (invoice.status !== "PAID") {
            return new NextResponse("Receipt only available for paid invoices", { status: 400 });
        }

        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();

        // ─── HEADER GRADIENT (simulated with filled rect) ────────────────────
        doc.setFillColor(79, 70, 229); // indigo-600
        doc.rect(0, 0, pageW, 42, "F");

        doc.setFillColor(109, 40, 217); // purple accent strip
        doc.rect(0, 36, pageW, 6, "F");

        // Brand name
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("RentPe", 14, 18);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(199, 210, 254); // indigo-200
        doc.text("Verified PGs & Hostels", 14, 25);

        // RECEIPT label
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("RENT RECEIPT", pageW - 14, 18, { align: "right" });

        const receiptNo = invoice.displayId || `INV-${invoiceId.slice(0, 8).toUpperCase()}`;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(199, 210, 254);
        doc.text(`#${receiptNo}`, pageW - 14, 25, { align: "right" });

        // ─── PAID WATERMARK BADGE ─────────────────────────────────────────────
        doc.setFillColor(16, 185, 129); // emerald-500
        doc.roundedRect(pageW - 46, 28, 32, 8, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("✓ PAID", pageW - 30, 33.5, { align: "center" });

        // ─── SECTION: TENANT & PROPERTY DETAILS ──────────────────────────────
        let y = 52;

        // Tenant block
        doc.setFillColor(248, 250, 252); // slate-50
        doc.rect(14, y, 85, 44, "F");
        doc.setDrawColor(226, 232, 240);
        doc.rect(14, y, 85, 44);

        doc.setTextColor(100, 116, 139); // slate-500
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text("TENANT DETAILS", 18, y + 7);

        doc.setTextColor(15, 23, 42); // slate-950
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(invoice.booking?.user?.name || "—", 18, y + 15);

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(invoice.booking?.user?.email || "—", 18, y + 22);
        doc.text(`Room: ${invoice.booking?.roomAssigned || invoice.booking?.room?.roomNumber || "—"}`, 18, y + 29);
        doc.text(`Stay: ${invoice.booking?.moveInDate || "—"}`, 18, y + 36);

        // Property block
        doc.setFillColor(238, 242, 255); // indigo-50
        doc.rect(105, y, 91, 44, "F");
        doc.setDrawColor(199, 210, 254);
        doc.rect(105, y, 91, 44);

        doc.setTextColor(100, 116, 139);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text("PROPERTY DETAILS", 109, y + 7);

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        const propName = invoice.booking?.propertyName || invoice.booking?.property?.name || "—";
        doc.text(propName.length > 28 ? propName.substring(0, 28) + "…" : propName, 109, y + 15);

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        const addr = invoice.booking?.property?.address || "—";
        const city = invoice.booking?.property?.city || "";
        doc.text(addr.length > 32 ? addr.substring(0, 32) + "…" : addr, 109, y + 22);
        doc.text(city, 109, y + 29);

        // ─── PAYMENT SUMMARY TABLE ────────────────────────────────────────────
        y += 52;

        doc.setFillColor(79, 70, 229);
        doc.rect(14, y, 182, 8, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("PAYMENT SUMMARY", 18, y + 5.5);

        y += 10;

        const rows = [
            ["Period / Month",    invoice.month],
            ["Invoice No.",       receiptNo],
            ["Rent Amount",       `₹${invoice.rentAmount.toLocaleString("en-IN")}`],
            invoice.foodAmount > 0 ? ["Food Charges", `₹${invoice.foodAmount.toLocaleString("en-IN")}`] : null,
            invoice.creditApplied > 0 ? ["Credit Applied", `-₹${invoice.creditApplied.toLocaleString("en-IN")}`] : null,
            ["Total Amount",      `₹${invoice.amount.toLocaleString("en-IN")}`],
            ["Due Date",          format(new Date(invoice.dueDate), "dd MMM yyyy")],
            ["Paid On",           invoice.paidAt ? format(new Date(invoice.paidAt), "dd MMM yyyy, HH:mm") : "—"],
            ["Payment Method",    invoice.payments[0]?.method || "Online"],
            ["Payment Ref",       invoice.payments[0]?.razorpayId || "—"],
        ].filter(Boolean) as [string, string][];

        rows.forEach((row, i) => {
            const isEven = i % 2 === 0;
            doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
            doc.rect(14, y, 182, 8, "F");
            doc.setDrawColor(226, 232, 240);
            doc.line(14, y, 196, y);

            const isTotal = row[0] === "Total Amount";
            doc.setFont("helvetica", isTotal ? "bold" : "normal");
            doc.setFontSize(isTotal ? 9 : 8);
            doc.setTextColor(isTotal ? 79 : 100, isTotal ? 70 : 116, isTotal ? 229 : 139);
            doc.text(row[0], 18, y + 5.5);

            doc.setTextColor(isTotal ? 15 : 30, isTotal ? 23 : 41, isTotal ? 42 : 55);
            doc.text(row[1], 194, y + 5.5, { align: "right" });

            y += 8;
        });

        // Bottom border of table
        doc.setDrawColor(226, 232, 240);
        doc.line(14, y, 196, y);

        // ─── FOOTER ───────────────────────────────────────────────────────────
        y += 12;
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y, 182, 16, "F");
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.text("This is a computer-generated receipt and does not require a physical signature.", pageW / 2, y + 6, { align: "center" });
        doc.text("For queries or disputes, please raise a support ticket at rentpe.in/dashboard/student/tickets", pageW / 2, y + 11, { align: "center" });

        // Page footer
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184);
        doc.text(`Generated on ${format(new Date(), "dd MMM yyyy, HH:mm")} · rentpe.in`, pageW / 2, pageH - 8, { align: "center" });

        const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="RentPe-Receipt-${receiptNo}.pdf"`,
                "Cache-Control": "no-store",
            }
        });

    } catch (err: any) {
        console.error("Receipt generation error:", err);
        return new NextResponse("Failed to generate receipt", { status: 500 });
    }
}
