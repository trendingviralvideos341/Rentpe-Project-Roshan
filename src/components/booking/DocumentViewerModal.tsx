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

// ─── Agreement Copy Render (Full — mirrors signing modal, read-only) ──────────
function AgreementView({ data }: { data: AgreementCopyData }) {
    const rent = Number(data.monthlyRent) || 0;
    const deposit = Number(data.depositAmount) || 0;
    const balance = Math.max(0, rent + deposit - 1000);
    const noticePeriod = data.noticePeriod || 30;

    return (
        <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
            {/* Signed Banner */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                <p className="text-sm font-black text-emerald-700">✍️ Digitally Signed by Tenant</p>
                <p className="text-xs text-emerald-600 mt-0.5">Legally binding under IT Act, 2000 · Version {data.agreementVersion || "v1.0-2026"}</p>
            </div>

            {/* Identity Panel */}
            {(data.tenantDisplayId || data.bookingDisplayId || data.propertyDisplayId) && (
                <div className="bg-indigo-950 border border-indigo-700/50 rounded-xl p-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2">📋 Permanent Legal Identifiers — Keep This Safe</p>
                    <div className="grid grid-cols-2 gap-2">
                        {data.bookingDisplayId && (
                            <div className="bg-indigo-900/60 rounded-lg p-2 border border-indigo-600/30">
                                <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider mb-0.5">Booking ID</p>
                                <p className="text-[10px] font-black text-white font-mono">{data.bookingDisplayId}</p>
                            </div>
                        )}
                        {data.tenantDisplayId && (
                            <div className="bg-emerald-900/60 rounded-lg p-2 border border-emerald-600/40">
                                <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider mb-0.5">Tenant ID ✓ KYC Verified</p>
                                <p className="text-[10px] font-black text-emerald-300 font-mono">{data.tenantDisplayId}</p>
                            </div>
                        )}
                        {data.propertyDisplayId && (
                            <div className="bg-indigo-900/60 rounded-lg p-2 border border-indigo-600/30">
                                <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider mb-0.5">PG / Property ID</p>
                                <p className="text-[10px] font-black text-white font-mono">{data.propertyDisplayId}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Title */}
            <div className="text-center space-y-1 pb-3 border-b-2 border-dashed border-slate-200">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Accommodation Occupancy Agreement</h3>
                <p className="text-[10px] text-slate-400">Facilitated by RentPe (Marketplace Intermediary)</p>
                <p className="text-[10px] text-slate-400">Ref: {data.propertyName} · Executed: {data.signedAt}</p>
            </div>

            {/* 1. Parties */}
            <section>
                <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-2 pb-1 border-b border-slate-100">1. Parties to This Agreement</h4>
                <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                    <p><strong className="text-slate-700">Tenant:</strong> {data.tenantName}{data.tenantEmail ? ` (${data.tenantEmail})` : ""}</p>
                    <p><strong className="text-slate-700">Property:</strong> {data.propertyName}, {data.propertyAddress}, {data.propertyCity}</p>
                    <p><strong className="text-slate-700">Facilitated By:</strong> RentPe Platform — an intermediary marketplace. RentPe is NOT the property owner or landlord.</p>
                </div>
            </section>

            {/* 2. Financial Terms */}
            <section>
                <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-2 pb-1 border-b border-slate-100">2. Financial Terms (Locked at Signing)</h4>
                <div className="rounded-xl overflow-hidden border border-slate-200 font-mono text-[11px]">
                    <div className="bg-slate-900 px-4 py-1.5">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Payment Breakdown</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                        <div className="flex justify-between px-4 py-2.5">
                            <span className="text-slate-600">Monthly Rent (1st Month)</span>
                            <span className="font-black text-slate-900">₹{rent.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between px-4 py-2.5 bg-emerald-50/50">
                            <div>
                                <span className="text-emerald-700">Security Deposit ({data.depositMonths} month{data.depositMonths > 1 ? "s" : ""})</span>
                                <span className="ml-2 text-[9px] bg-emerald-100 text-emerald-600 font-bold px-1.5 py-0.5 rounded-full">✓ Refundable</span>
                            </div>
                            <span className="font-black text-emerald-700">₹{deposit.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between px-4 py-3 bg-slate-900">
                            <span className="text-sm font-black text-white">Joining Balance Due</span>
                            <span className="text-sm font-black text-white">₹{balance.toLocaleString("en-IN")}</span>
                        </div>
                    </div>
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400 italic">These amounts are fixed as of the agreement date and cannot be altered retroactively.</p>
            </section>

            {/* 3. Tenancy Duration */}
            <section>
                <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-2 pb-1 border-b border-slate-100">3. Tenancy Duration &amp; Rent Schedule</h4>
                <ul className="space-y-1 list-disc ml-4">
                    <li>Move-in Date: <strong>{data.moveInDate}</strong></li>
                    <li>Monthly rent is due on the <strong>1st of every calendar month</strong>. Late payment may attract a penalty as specified by the property owner.</li>
                    <li>Tenancy is on a month-to-month basis. Minimum stay and notice period rules apply (see Section 5).</li>
                </ul>
            </section>

            {/* 4. House Rules */}
            <section>
                <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-2 pb-1 border-b border-slate-100">4. House Rules &amp; Code of Conduct</h4>
                <ul className="list-disc ml-4 space-y-1">
                    <li>You must follow all property rules communicated by the owner, including visitor policies, curfew timings, noise guidelines, and food-related rules.</li>
                    <li>You are responsible for maintaining your room and assigned area in a clean, undamaged condition.</li>
                    <li>Illegal activities, possession of prohibited substances, vandalism, or harassment of other residents is strictly prohibited and will result in immediate eviction.</li>
                    <li>No subletting of your assigned bed/room without written owner consent.</li>
                    <li>Guests must be declared and comply with the property's visitor policy.</li>
                </ul>
            </section>

            {/* 5. Notice Period */}
            <section>
                <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-2 pb-1 border-b border-slate-100">5. Notice Period &amp; Vacating</h4>
                <p>You must provide written notice of <strong>{noticePeriod} days</strong> before vacating. Failure to provide adequate notice may result in forfeiture of part or all of the security deposit.</p>
                <p className="mt-1">A joint move-out inspection will be conducted. Deductions, if any, will be communicated in writing within 7 days of vacating.</p>
            </section>

            {/* 6. Deposit Refund */}
            <section>
                <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-2 pb-1 border-b border-slate-100">6. Security Deposit Refund <span className="text-emerald-600 normal-case">(MTA 2021 Compliant)</span></h4>
                <p>Your security deposit of <strong>₹{deposit.toLocaleString("en-IN")}</strong> ({data.depositMonths} month{data.depositMonths > 1 ? "s" : ""} rent) is <strong className="text-emerald-600">fully refundable</strong> subject to:</p>
                <ul className="list-disc ml-4 space-y-1 mt-1">
                    <li><strong>Permitted deductions only:</strong> Documented physical damage (beyond normal wear &amp; tear), unpaid dues, unreturned keys or property assets.</li>
                    <li><strong>Normal wear &amp; tear is NOT deductible</strong> (fading paint, minor scuffs, worn fixtures from normal use).</li>
                    <li><strong>Refund timeline:</strong> Within <strong>30 days</strong> of handing over possession of the room.</li>
                    <li>All deductions will be supported by a written, itemised explanation.</li>
                </ul>
                <p className="mt-1.5 text-[10px] text-slate-400">In compliance with Model Tenancy Act 2021 and established Indian PG industry standards.</p>
            </section>

            {/* 7. Platform Disclaimer */}
            <section>
                <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-2 pb-1 border-b border-slate-100">7. Platform Disclaimer</h4>
                <p>RentPe is an <strong>intermediary marketplace platform</strong> and is NOT the property owner or landlord. RentPe is not liable for the physical condition of the property, actions of the owner, or service delivery. Disputes arising from the accommodation are between the Tenant and the Property Owner. RentPe may assist in mediation through its Resolution Centre but bears no direct financial liability.</p>
            </section>

            {/* 8. Cancellation Policy */}
            <section>
                <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-2 pb-1 border-b border-slate-100">8. Refund &amp; Cancellation Policy</h4>
                <p>{data.refundPolicy || "Cancellation refunds are subject to the property owner's cancellation policy. Token amounts, once the reservation window has expired, are non-refundable. Platform service fees are strictly non-refundable upon booking confirmation."}</p>
            </section>

            {/* 9. Governing Law */}
            <section>
                <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-2 pb-1 border-b border-slate-100">9. Governing Law &amp; Jurisdiction</h4>
                <p>This agreement is governed by the laws of India, including the Model Tenancy Act 2021, Consumer Protection Act 2019, and applicable State laws. Jurisdiction: Bangalore, Karnataka, India.</p>
            </section>

            {/* Acceptance Confirmation Banner */}
            <div className="bg-gradient-to-r from-indigo-950 to-slate-900 rounded-xl p-4 border border-indigo-500/30">
                <p className="text-[11px] text-indigo-200 font-semibold text-center leading-relaxed">
                    You confirmed you had read, understood, and irrevocably accepted all terms of this agreement. Your digital acceptance is legally binding under the <strong className="text-white">Information Technology Act, 2000</strong>.
                </p>
            </div>

            {/* Audit Trail */}
            <Section title="Digital Signature Audit Trail" />
            <Row label="Agreement ID" value={data.agreementId} />
            <Row label="Signed At (IST)" value={data.signedAt} accent />
            <Row label="IP Address" value={data.signedIp || "—"} />
            <Row label="Device / Browser" value={(data.signedDevice || "—").substring(0, 60)} accent />
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mt-1">
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
