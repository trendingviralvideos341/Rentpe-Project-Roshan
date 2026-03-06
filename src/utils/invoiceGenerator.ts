import jsPDF from "jspdf";
import "jspdf-autotable";

export interface InvoiceData {
    invoiceId: string;
    date: string;
    description: string;
    month: string;
    amount: number;
    paymentMethod?: string;
    tenantName?: string;
}

export function generateInvoicePDF(data: InvoiceData) {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(41, 128, 185);
    doc.text("RentPe", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Smart PG Management Platform", 14, 26);

    // Invoice details right aligned
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("RECEIPT / INVOICE", 150, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Invoice No: ${data.invoiceId.substring(0, 10).toUpperCase()}`, 150, 26);
    doc.text(`Date: ${data.date}`, 150, 32);

    // Line
    doc.setDrawColor(200);
    doc.line(14, 40, 196, 40);

    // Billed To
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text("Billed To:", 14, 50);
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`Name: ${data.tenantName || 'User'}`, 14, 56);

    // Billed By
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text("Issued By:", 120, 50);
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text("RentPe Operations India", 120, 56);
    doc.text("Support: support@rentpe.com", 120, 62);

    // Table
    const tableData = [
        ["Payment", data.description, `Rs. ${data.amount.toLocaleString('en-IN')}`]
    ];

    (doc as any).autoTable({
        startY: 80,
        head: [['Type', 'Details', 'Amount Paid']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] },
        margin: { top: 10 }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 100;

    // Total
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Total Paid: Rs. ${data.amount.toLocaleString('en-IN')}`, 140, finalY + 10);
    if (data.paymentMethod) {
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Paid via: ${data.paymentMethod}`, 140, finalY + 16);
    }

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text("Thank you for using RentPe. This is a computer generated receipt.", 14, 280);

    doc.save(`RentPe_Receipt_${data.invoiceId.substring(0, 8)}.pdf`);
}
