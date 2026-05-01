import jsPDF from "jspdf";
import "jspdf-autotable";

// ─── Shared brand constants ──────────────────────────────────────────────────
const BRAND_BLUE: [number, number, number] = [30, 27, 75];
const BRAND_ACCENT: [number, number, number] = [99, 102, 241];
const SUCCESS_GREEN: [number, number, number] = [4, 120, 87];
const TEXT_DARK: [number, number, number] = [15, 23, 42];
const TEXT_MID: [number, number, number] = [100, 116, 139];
const TEXT_LIGHT: [number, number, number] = [148, 163, 184];

function drawHeader(doc: jsPDF, title: string, subtitle: string, refId: string) {
    doc.setFillColor(...BRAND_BLUE);
    doc.rect(0, 0, 210, 38, 'F');
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('RentPe', 14, 16);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(165, 180, 252);
    doc.text('Smart Student Housing \u00b7 rentpe.in', 14, 22);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(title, 210 - 14, 15, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(165, 180, 252);
    doc.text(subtitle, 210 - 14, 21, { align: 'right' });
    doc.text('Ref: ' + refId, 210 - 14, 27, { align: 'right' });
    doc.setFillColor(...BRAND_ACCENT);
    doc.rect(0, 38, 210, 1.5, 'F');
}

function drawFooter(doc: jsPDF, note?: string) {
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 275, 210, 22, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(0, 275, 210, 275);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_LIGHT);
    doc.text(note || 'This is a computer-generated document and does not require a physical signature.', 14, 281);
    doc.text('RentPe Technologies Pvt. Ltd. \u00b7 support@rentpe.in \u00b7 Bangalore, Karnataka, India', 14, 287);
    doc.text('Generated: ' + new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST', 210 - 14, 287, { align: 'right' });
}

function sectionLabel(doc: jsPDF, text: string, y: number) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND_ACCENT);
    doc.text(text.toUpperCase(), 14, y);
    doc.setDrawColor(...BRAND_ACCENT);
    doc.setLineWidth(0.3);
    doc.line(14, y + 1, 196, y + 1);
}

function kvRow(doc: jsPDF, label: string, value: string, y: number, highlight = false) {
    if (highlight) {
        doc.setFillColor(238, 242, 255);
        doc.rect(14, y - 4.5, 182, 7, 'F');
    }
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MID);
    doc.text(label, 16, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXT_DARK);
    doc.text(value, 196, y, { align: 'right' });
}

// ─── 1. TOKEN PAYMENT RECEIPT ────────────────────────────────────────────────
export interface TokenReceiptData {
    bookingDisplayId: string;
    tenantName: string;
    tenantEmail?: string;
    propertyName: string;
    roomAssigned: string;
    tokenAmount: number;
    paidAt: string;
    paymentMethod: string;
    paymentId?: string;
}

export function downloadTokenReceipt(data: TokenReceiptData) {
    const doc = new jsPDF();
    const receiptId = 'TOK-' + data.bookingDisplayId;
    drawHeader(doc, 'TOKEN PAYMENT RECEIPT', 'Bed Reservation \u2014 Non-Refundable', receiptId);

    doc.setFillColor(236, 253, 245);
    doc.roundedRect(14, 46, 90, 12, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SUCCESS_GREEN);
    doc.text('\u2713  TOKEN PAYMENT CONFIRMED', 22, 54);

    sectionLabel(doc, 'Tenant Details', 68);
    kvRow(doc, 'Name', data.tenantName, 77);
    kvRow(doc, 'Email', data.tenantEmail || '\u2014', 85, true);
    kvRow(doc, 'Booking Ref', data.bookingDisplayId, 93);

    sectionLabel(doc, 'Property & Room', 105);
    kvRow(doc, 'Property', data.propertyName, 114);
    kvRow(doc, 'Room / Bed Allocated', data.roomAssigned, 122, true);

    sectionLabel(doc, 'Payment Details', 134);
    kvRow(doc, 'Token Amount', 'Rs. ' + data.tokenAmount.toLocaleString('en-IN'), 143);
    kvRow(doc, 'Paid On', data.paidAt, 151, true);
    kvRow(doc, 'Payment Method', data.paymentMethod, 159);
    if (data.paymentId) kvRow(doc, 'Transaction / Payment ID', data.paymentId, 167, true);

    doc.setFillColor(...BRAND_BLUE);
    doc.roundedRect(14, 178, 182, 20, 4, 4, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Token Amount Paid', 22, 190);
    doc.setFontSize(14);
    doc.text('Rs. ' + data.tokenAmount.toLocaleString('en-IN'), 196, 191, { align: 'right' });

    doc.setFillColor(255, 247, 237);
    doc.roundedRect(14, 204, 182, 22, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(146, 64, 14);
    doc.text('\u26a0  Important \u2014 Non-Refundable', 18, 212);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 83, 9);
    doc.text(
        'The token amount is strictly non-refundable. It is deducted from your final joining payment.\nThis amount confirms your bed reservation and is forfeited if you cancel.',
        18, 219
    );

    drawFooter(doc, 'This receipt confirms your bed reservation at the above property via RentPe platform.');
    doc.save('RentPe_Token_Receipt_' + data.bookingDisplayId + '.pdf');
}

// ─── 2. AGREEMENT COPY ───────────────────────────────────────────────────────
export interface AgreementCopyData {
    agreementId: string;
    bookingDisplayId: string;
    tenantName: string;
    tenantEmail?: string;
    propertyName: string;
    propertyAddress: string;
    propertyCity: string;
    roomAssigned: string;
    occupancy: string;
    monthlyRent: number;
    depositAmount: number;
    depositMonths: number;
    moveInDate: string;
    signedAt: string;
    signedIp?: string;
    signedDevice?: string;
    agreementVersion?: string;
    ownerName?: string;
}

export function downloadAgreementCopy(data: AgreementCopyData) {
    const doc = new jsPDF();
    drawHeader(doc, 'RENTAL AGREEMENT', 'Digital Execution Copy \u2014 IT Act 2000', data.agreementId);

    doc.setFillColor(236, 253, 245);
    doc.roundedRect(14, 46, 100, 12, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SUCCESS_GREEN);
    doc.text('\u2713  DIGITALLY SIGNED BY TENANT', 22, 54);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MID);
    doc.text('Agreement Version: ' + (data.agreementVersion || 'v1.0-2026'), 196, 54, { align: 'right' });

    sectionLabel(doc, 'Parties to this Agreement', 68);
    kvRow(doc, 'Tenant (Occupant)', data.tenantName, 77);
    kvRow(doc, 'Email', data.tenantEmail || '\u2014', 85, true);
    kvRow(doc, 'Property Owner', data.ownerName || 'Property Owner', 93);
    kvRow(doc, 'Facilitated By', 'RentPe Technologies Pvt. Ltd. (Marketplace Intermediary)', 101, true);

    sectionLabel(doc, 'Accommodation Details', 113);
    kvRow(doc, 'Property Name', data.propertyName, 122);
    kvRow(doc, 'Address', data.propertyAddress + ', ' + data.propertyCity, 130, true);
    kvRow(doc, 'Room / Bed', data.roomAssigned + ' (' + data.occupancy + ')', 138);
    kvRow(doc, 'Move-In Date', data.moveInDate, 146, true);

    sectionLabel(doc, 'Financial Terms (Locked at Signing)', 158);
    kvRow(doc, 'Monthly Rent', 'Rs. ' + data.monthlyRent.toLocaleString('en-IN'), 167);
    kvRow(doc, 'Security Deposit (' + data.depositMonths + ' month' + (data.depositMonths > 1 ? 's' : '') + ') \u2014 Refundable', 'Rs. ' + data.depositAmount.toLocaleString('en-IN'), 175, true);
    kvRow(doc, 'Token Paid (Deducted from Final)', 'Rs. 1,000', 183);

    const balance = Math.max(0, data.monthlyRent + data.depositAmount - 1000);
    doc.setFillColor(...BRAND_BLUE);
    doc.roundedRect(14, 190, 182, 15, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Joining Balance Due (after token deduction)', 20, 200);
    doc.text('Rs. ' + balance.toLocaleString('en-IN'), 196, 200, { align: 'right' });

    sectionLabel(doc, 'Digital Signature Audit Trail', 213);
    kvRow(doc, 'Agreement ID', data.agreementId, 222);
    kvRow(doc, 'Signed At (IST)', data.signedAt, 230, true);
    kvRow(doc, 'IP Address at Signing', data.signedIp || '\u2014', 238);
    kvRow(doc, 'Device / Browser', (data.signedDevice || '\u2014').substring(0, 70), 246, true);

    doc.setFillColor(238, 242, 255);
    doc.roundedRect(14, 254, 182, 16, 3, 3, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND_ACCENT);
    doc.text('Legally Binding under Information Technology Act, 2000', 18, 262);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(79, 70, 229);
    doc.text('Governing Law: Model Tenancy Act 2021 \u00b7 Consumer Protection Act 2019 \u00b7 Jurisdiction: Bangalore, Karnataka', 18, 268);

    drawFooter(doc, "This is the tenant's official copy of the digitally executed rental agreement. Owner countersignature pending.");
    doc.save('RentPe_Agreement_' + data.agreementId + '.pdf');
}

// ─── 3. FINAL PAYMENT RECEIPT ────────────────────────────────────────────────
export interface FinalPaymentReceiptData {
    bookingDisplayId: string;
    tenantName: string;
    tenantEmail?: string;
    propertyName: string;
    roomAssigned: string;
    monthlyRent: number;
    depositAmount: number;
    depositMonths: number;
    tokenAlreadyPaid: number;
    finalAmountPaid: number;
    paidAt: string;
    paymentMethod: string;
    paymentId?: string;
}

export function downloadFinalPaymentReceipt(data: FinalPaymentReceiptData) {
    const doc = new jsPDF();
    const receiptId = 'PAY-' + data.bookingDisplayId;
    drawHeader(doc, 'JOINING PAYMENT RECEIPT', 'Rent + Deposit \u2014 Onboarding Complete', receiptId);

    doc.setFillColor(236, 253, 245);
    doc.roundedRect(14, 46, 100, 12, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SUCCESS_GREEN);
    doc.text('\u2713  PAYMENT CONFIRMED \u2014 STAY ACTIVE', 22, 54);

    sectionLabel(doc, 'Tenant Details', 68);
    kvRow(doc, 'Name', data.tenantName, 77);
    kvRow(doc, 'Email', data.tenantEmail || '\u2014', 85, true);
    kvRow(doc, 'Booking Ref', data.bookingDisplayId, 93);

    sectionLabel(doc, 'Property & Room', 105);
    kvRow(doc, 'Property', data.propertyName, 114);
    kvRow(doc, 'Room / Bed', data.roomAssigned, 122, true);

    sectionLabel(doc, 'Payment Breakdown', 134);
    (doc as any).autoTable({
        startY: 138,
        head: [['Item', 'Details', 'Amount']],
        body: [
            ['Monthly Rent (1st Month)', data.propertyName, 'Rs. ' + data.monthlyRent.toLocaleString('en-IN')],
            ['Security Deposit (' + data.depositMonths + ' month' + (data.depositMonths > 1 ? 's' : '') + ')', 'Fully refundable on vacating', 'Rs. ' + data.depositAmount.toLocaleString('en-IN')],
            ['Token Amount (Already Paid)', 'Deducted from total', '\u2212 Rs. ' + data.tokenAlreadyPaid.toLocaleString('en-IN')],
        ],
        foot: [['', 'TOTAL PAID NOW', 'Rs. ' + data.finalAmountPaid.toLocaleString('en-IN')]],
        theme: 'striped',
        headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8 },
        footStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8.5 },
        alternateRowStyles: { fillColor: [238, 242, 255] },
        columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 14, right: 14 },
    });

    const finalY: number = (doc as any).lastAutoTable?.finalY || 200;

    sectionLabel(doc, 'Payment Details', finalY + 10);
    kvRow(doc, 'Paid On', data.paidAt, finalY + 20);
    kvRow(doc, 'Payment Method', data.paymentMethod, finalY + 28, true);
    if (data.paymentId) kvRow(doc, 'Transaction / Payment ID', data.paymentId, finalY + 36);

    const noteY = finalY + (data.paymentId ? 46 : 40);
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(14, noteY, 182, 18, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SUCCESS_GREEN);
    doc.text('Deposit Refund Policy (MTA 2021 Compliant)', 18, noteY + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(6, 95, 70);
    doc.text(
        'Your deposit of Rs. ' + data.depositAmount.toLocaleString('en-IN') + ' is fully refundable within 30 days of vacating, subject only to documented damage deductions.',
        18, noteY + 15
    );

    drawFooter(doc, 'This receipt confirms full joining payment. Your stay is now ACTIVE. Keep this for your records.');
    doc.save('RentPe_JoiningPayment_' + data.bookingDisplayId + '.pdf');
}

// ─── Legacy: kept for backward compatibility ─────────────────────────────────
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
    drawHeader(doc, 'PAYMENT RECEIPT', data.month, data.invoiceId.substring(0, 12).toUpperCase());
    sectionLabel(doc, 'Billed To', 52);
    kvRow(doc, 'Name', data.tenantName || 'Resident', 61);
    kvRow(doc, 'Date', data.date, 69, true);
    sectionLabel(doc, 'Payment Details', 81);
    kvRow(doc, 'Description', data.description, 90);
    kvRow(doc, 'Amount Paid', 'Rs. ' + data.amount.toLocaleString('en-IN'), 98, true);
    if (data.paymentMethod) kvRow(doc, 'Payment Method', data.paymentMethod, 106);
    doc.setFillColor(...BRAND_BLUE);
    doc.roundedRect(14, 118, 182, 18, 4, 4, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Total Paid', 20, 129);
    doc.text('Rs. ' + data.amount.toLocaleString('en-IN'), 196, 129, { align: 'right' });
    drawFooter(doc);
    doc.save('RentPe_Receipt_' + data.invoiceId.substring(0, 8) + '.pdf');
}
