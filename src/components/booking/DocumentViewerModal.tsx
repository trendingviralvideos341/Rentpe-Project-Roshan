"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, FileText, Shield, Receipt } from "lucide-react";
import {
    downloadTokenReceipt, type TokenReceiptData,
    downloadAgreementCopy, type AgreementCopyData,
    downloadFinalPaymentReceipt, type FinalPaymentReceiptData,
} from "@/utils/invoiceGenerator";

// ─── Discriminated union of document types ───────────────────────────────────
export type DocumentViewerDoc =
    | { type: "token"; data: TokenReceiptData }
    | { type: "agreement"; data: AgreementCopyData }
    | { type: "payment"; data: FinalPaymentReceiptData };

interface Props {
    doc: DocumentViewerDoc | null;
    onClose: () => void;
}

// ─── Row helper ──────────────────────────────────────────────────────────────
function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    return (
        <div className={`flex justify-between items-start py-2.5 px-3 rounded-lg ${accent ? "bg-indigo-50" : ""}`}>
            <span className="text-xs text-slate-500 font-semibold shrink-0 w-40">{label}</span>
            <span className="text-xs text-slate-900 font-bold text-right break-all">{value}</span>
        </div>
    );
}

function Section({ title }: { title: string }) {
    return (
        <div className="flex items-center gap-2 mt-5 mb-1">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] shrink-0">{title}</span>
            <div className="h-px flex-1 bg-slate-200" />
        </div>
    );
}

// ─── Token Receipt Render ────────────────────────────────────────────────────
function TokenView({ data }: { data: TokenReceiptData }) {
    return (
        <div className="space-y-1">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center mb-3">
                <p className="text-sm font-black text-emerald-700">✅ Token Payment Confirmed</p>
                <p className="text-xs text-emerald-600 mt-0.5">Non-refundable bed reservation fee</p>
            </div>
            <Section title="Tenant Details" />
            <Row label="Name" value={data.tenantName} />
            <Row label="Email" value={data.tenantEmail || "—"} accent />
            <Row label="Booking Ref" value={data.bookingDisplayId} />
            <Section title="Property & Room" />
            <Row label="Property" value={data.propertyName} />
            <Row label="Room / Bed Allocated" value={data.roomAssigned} accent />
            <Section title="Payment Details" />
            <Row label="Token Amount" value={`₹${data.tokenAmount.toLocaleString("en-IN")}`} />
            <Row label="Paid On" value={data.paidAt} accent />
            <Row label="Payment Method" value={data.paymentMethod} />
            {data.paymentId && <Row label="Transaction ID" value={data.paymentId} accent />}
            <div className="bg-slate-900 rounded-xl p-4 flex justify-between items-center mt-4">
                <span className="text-sm font-black text-white">Total Token Paid</span>
                <span className="text-lg font-black text-white">₹{data.tokenAmount.toLocaleString("en-IN")}</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-2">
                <p className="text-xs font-black text-amber-700">⚠ Non-Refundable</p>
                <p className="text-xs text-amber-600 mt-0.5">This token is deducted from your final joining payment. Forfeited on cancellation.</p>
            </div>
        </div>
    );
}

// ─── Agreement Copy Render ───────────────────────────────────────────────────
function AgreementView({ data }: { data: AgreementCopyData }) {
    const balance = Math.max(0, data.monthlyRent + data.depositAmount - 1000);
    return (
        <div className="space-y-1">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center mb-1">
                <p className="text-sm font-black text-emerald-700">✍️ Digitally Signed by Tenant</p>
                <p className="text-xs text-emerald-600 mt-0.5">Legally binding under IT Act, 2000 · Version {data.agreementVersion || "v1.0-2026"}</p>
            </div>
            <Section title="Parties" />
            <Row label="Tenant" value={data.tenantName} />
            <Row label="Email" value={data.tenantEmail || "—"} accent />
            <Row label="Property Owner" value={data.ownerName || "Property Owner"} />
            <Row label="Facilitated By" value="RentPe Technologies Pvt. Ltd." accent />
            <Section title="Accommodation" />
            <Row label="Property" value={data.propertyName} />
            <Row label="Address" value={`${data.propertyAddress}, ${data.propertyCity}`} accent />
            <Row label="Room / Bed" value={`${data.roomAssigned} (${data.occupancy})`} />
            <Row label="Move-In Date" value={data.moveInDate} accent />
            <Section title="Financial Terms" />
            <Row label="Monthly Rent" value={`₹${data.monthlyRent.toLocaleString("en-IN")}`} />
            <Row label={`Deposit (${data.depositMonths}M) — Refundable`} value={`₹${data.depositAmount.toLocaleString("en-IN")}`} accent />
            <Row label="Token Already Paid" value="₹1,000" />
            <div className="bg-slate-900 rounded-xl p-4 flex justify-between items-center mt-2">
                <span className="text-sm font-black text-white">Joining Balance Due</span>
                <span className="text-lg font-black text-white">₹{balance.toLocaleString("en-IN")}</span>
            </div>
            <Section title="Digital Signature Audit Trail" />
            <Row label="Agreement ID" value={data.agreementId} />
            <Row label="Signed At (IST)" value={data.signedAt} accent />
            <Row label="IP Address" value={data.signedIp || "—"} />
            <Row label="Device / Browser" value={(data.signedDevice || "—").substring(0, 60)} accent />
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mt-3">
                <p className="text-xs font-black text-indigo-700">⚖️ Legally Binding under Information Technology Act, 2000</p>
                <p className="text-xs text-indigo-600 mt-0.5">Governing Law: Model Tenancy Act 2021 · Jurisdiction: Bangalore, Karnataka</p>
            </div>
        </div>
    );
}

// ─── Final Payment Receipt Render ────────────────────────────────────────────
function PaymentView({ data }: { data: FinalPaymentReceiptData }) {
    return (
        <div className="space-y-1">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center mb-3">
                <p className="text-sm font-black text-emerald-700">✅ Payment Confirmed — Stay Active</p>
                <p className="text-xs text-emerald-600 mt-0.5">Full joining payment received</p>
            </div>
            <Section title="Tenant Details" />
            <Row label="Name" value={data.tenantName} />
            <Row label="Email" value={data.tenantEmail || "—"} accent />
            <Row label="Booking Ref" value={data.bookingDisplayId} />
            <Section title="Property & Room" />
            <Row label="Property" value={data.propertyName} />
            <Row label="Room / Bed" value={data.roomAssigned} accent />
            <Section title="Payment Breakdown" />
            <Row label="Monthly Rent (1st Month)" value={`₹${data.monthlyRent.toLocaleString("en-IN")}`} />
            <Row label={`Security Deposit (${data.depositMonths}M) — Refundable`} value={`₹${data.depositAmount.toLocaleString("en-IN")}`} accent />
            <Row label="Token Deducted" value={`− ₹${data.tokenAlreadyPaid.toLocaleString("en-IN")}`} />
            <div className="bg-slate-900 rounded-xl p-4 flex justify-between items-center mt-2">
                <span className="text-sm font-black text-white">Total Paid Now</span>
                <span className="text-lg font-black text-white">₹{data.finalAmountPaid.toLocaleString("en-IN")}</span>
            </div>
            <Section title="Payment Details" />
            <Row label="Paid On" value={data.paidAt} />
            <Row label="Payment Method" value={data.paymentMethod} accent />
            {data.paymentId && <Row label="Transaction ID" value={data.paymentId} />}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-3">
                <p className="text-xs font-black text-emerald-700">Deposit Refund Policy (MTA 2021 Compliant)</p>
                <p className="text-xs text-emerald-600 mt-0.5">Your deposit of ₹{data.depositAmount.toLocaleString("en-IN")} is fully refundable within 30 days of vacating, subject only to documented damage deductions.</p>
            </div>
        </div>
    );
}

// ─── Main Modal ──────────────────────────────────────────────────────────────
const META: Record<DocumentViewerDoc["type"], { title: string; icon: React.ReactNode; color: string }> = {
    token: { title: "Token Payment Receipt", icon: <Receipt className="w-4 h-4 text-emerald-500" />, color: "text-emerald-700" },
    agreement: { title: "Rental Agreement Copy", icon: <Shield className="w-4 h-4 text-indigo-500" />, color: "text-indigo-700" },
    payment: { title: "Joining Payment Receipt", icon: <FileText className="w-4 h-4 text-violet-500" />, color: "text-violet-700" },
};

export function DocumentViewerModal({ doc, onClose }: Props) {
    if (!doc) return null;
    const meta = META[doc.type];

    const handleDownload = () => {
        if (doc.type === "token") downloadTokenReceipt(doc.data);
        else if (doc.type === "agreement") downloadAgreementCopy(doc.data);
        else if (doc.type === "payment") downloadFinalPaymentReceipt(doc.data);
    };

    return (
        <Dialog open={!!doc} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden border-0 shadow-2xl">
                {/* Header */}
                <DialogHeader className="px-5 pt-5 pb-4 bg-slate-950 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-xl">{meta.icon}</div>
                        <div>
                            <DialogTitle className="text-sm font-extrabold text-white">{meta.title}</DialogTitle>
                            <p className="text-[11px] text-slate-400 mt-0.5">RentPe · Official Document</p>
                        </div>
                    </div>
                </DialogHeader>

                {/* Body — scrollable */}
                <div className="flex-1 overflow-y-auto bg-white px-5 py-4">
                    {/* RentPe letterhead */}
                    <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-dashed border-slate-200">
                        <div>
                            <p className="text-base font-black text-slate-900">RentPe</p>
                            <p className="text-[10px] text-slate-400">Smart Student Housing · rentpe.in</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">{meta.title}</p>
                            <p className="text-[10px] text-slate-400">{new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}</p>
                        </div>
                    </div>

                    {doc.type === "token" && <TokenView data={doc.data} />}
                    {doc.type === "agreement" && <AgreementView data={doc.data} />}
                    {doc.type === "payment" && <PaymentView data={doc.data} />}

                    <p className="text-[10px] text-slate-400 text-center mt-5 pt-3 border-t border-slate-100">
                        © {new Date().getFullYear()} RentPe Technologies Pvt. Ltd. · Bangalore, Karnataka, India
                    </p>
                </div>

                {/* Footer actions */}
                <div className="px-5 py-4 border-t border-slate-100 bg-white shrink-0 flex gap-3">
                    <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl h-11 font-bold border-slate-200">
                        <X className="w-4 h-4 mr-1.5" /> Close
                    </Button>
                    <Button onClick={handleDownload} className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl h-11 font-black shadow-lg shadow-indigo-200">
                        <Download className="w-4 h-4 mr-1.5" /> Download PDF
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
