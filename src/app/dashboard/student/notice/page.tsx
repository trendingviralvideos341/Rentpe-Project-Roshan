'use client';

import { useEffect, useState, useTransition } from 'react';
import { getBookings } from '@/actions/bookings';
import { fileVacatingNotice, getMyVacatingNotice, withdrawVacatingNotice, getSettlementForNotice } from '@/actions/tenancy';
import { toast } from 'sonner';
import {
    FileText, AlertTriangle, CheckCircle2, Clock, Loader2,
    ArrowLeft, XCircle, CalendarDays, Info, MessageSquare, Lock, FileDown, Eye, X, Printer
} from 'lucide-react';
import Link from 'next/link';
import { VacatingTimeline } from '@/components/ui/VacatingTimeline';

const REASON_OPTIONS = [
    'Relocating to another city',
    'Job/internship ended',
    'College semester ended',
    'Found better accommodation',
    'Personal reasons',
    'Property issues',
    'Financial reasons',
    'Other',
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; desc: string }> = {
    SUBMITTED:    { label: 'Submitted',    color: 'amber',   icon: Clock,         desc: 'Waiting for owner acknowledgement.' },
    ACKNOWLEDGED: { label: 'Acknowledged', color: 'blue',    icon: CheckCircle2,  desc: 'Owner has received and acknowledged your notice.' },
    APPROVED:     { label: 'Approved',     color: 'emerald', icon: CheckCircle2,  desc: 'Your move-out has been approved.' },
    DISPUTED:     { label: 'Disputed',     color: 'red',     icon: XCircle,       desc: 'Owner has raised a dispute. Please contact support.' },
    WITHDRAWN:    { label: 'Withdrawn',    color: 'slate',   icon: XCircle,       desc: 'You have withdrawn this notice.' },
    VACATED:      { label: 'Move-Out Complete', color: 'emerald', icon: CheckCircle2,  desc: 'Your move-out has been finalized and settled by the owner.' },
};

// Auto-compute 30-days-from-today (locked date)
function getLockedMoveOutDate() {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
}

function formatDate(d: Date) {
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function toISODate(d: Date) {
    return d.toISOString().split('T')[0];
}

export default function NoticePage() {
    const [booking, setBooking]       = useState<any>(null);
    const [notice, setNotice]         = useState<any>(null);
    const [loading, setLoading]       = useState(true);
    const [isPending, startTransition] = useTransition();
    const [form, setForm]             = useState({
        reason: '',
        agreed: false,
        customReason: '',
        tenantComment: '',
    });
    const [receiptLoading, setReceiptLoading] = useState(false);
    const [viewingReceipt, setViewingReceipt] = useState<any>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    // Generates the complete, legally-valid official HTML for the settlement receipt
    const getReceiptHtml = (d: any) => {
        const fmt = (date: string | null) => date ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Ã¢â‚¬â€';
        const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
        const net = d.netRefund ?? (d.securityDeposit - d.totalRentDue - d.totalDeductions);
        const unpaidRows = (d.unpaidRecords || []).map((r: any) =>
            `<tr><td style="color:#ef4444;padding-left:20px">${r.note ? `${r.month} (${r.note})` : r.month}</td><td style="text-align:right;color:#ef4444">- ${inr(r.amount)}</td></tr>`
        ).join('');
        const deductionRows = (d.deductionItems || []).map((item: any) =>
            `<tr><td style="color:#d97706;padding-left:20px">${item.description}</td><td style="text-align:right;color:#d97706">- ${inr(item.amount)}</td></tr>`
        ).join('');
        const moveOutStr = d.moveOutDate
            ? new Date(d.moveOutDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'Ã¢â‚¬â€';
        const netRefund = net;
        
        return `<!DOCTYPE html><html><head><meta charset='utf-8'><title>Official Settlement Receipt - ${d.name}</title>
<style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #0f172a; max-width: 700px; margin: 0 auto; line-height: 1.5; }
    .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
    .brand { font-size: 32px; font-weight: 900; color: #4f46e5; text-transform: uppercase; letter-spacing: -1px; }
    .doc-type { font-size: 14px; font-weight: 700; color: #64748b; letter-spacing: 4px; text-transform: uppercase; margin-top: 4px; }
    .meta-table { width: 100%; margin-bottom: 30px; border-collapse: collapse; }
    .meta-table td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
    .label { color: #64748b; font-weight: 600; width: 40%; }
    .value { font-weight: 700; color: #1e293b; text-align: right; }
    .section-title { font-size: 11px; font-weight: 900; text-transform: uppercase; color: #4f46e5; letter-spacing: 1px; margin: 24px 0 12px; }
    .summary-table { width: 100%; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    .summary-table th { background: #f8fafc; padding: 12px; text-align: left; font-size: 11px; font-weight: 900; color: #64748b; border-bottom: 1px solid #e2e8f0; }
    .summary-table td { padding: 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    .total-row { background: #0f172a; color: white; font-weight: 900; font-size: 16px; }
    .total-row td { padding: 16px; border: none; }
    .amt-refund { color: #34d399; } .amt-due { color: #f87171; }
    .legal-footer { margin-top: 50px; text-align: center; border-top: 1px solid #e2e8f0; pt: 20px; }
    .stamp { display: inline-block; border: 3px solid #ef4444; color: #ef4444; padding: 8px 24px; border-radius: 4px; font-weight: 900; font-size: 14px; margin: 20px 0; transform: rotate(-5deg); text-transform: uppercase; }
    .footer-note { font-size: 10px; color: #94a3b8; margin-top: 10px; }
    @media print { .no-print { display: none; } body { padding: 20px; } }
</style></head><body>
    <div class="header">
        <div class="brand">RentPe</div>
        <div class="doc-type">Final Settlement Receipt</div>
    </div>
    
    <div class="section-title">Tenant & Property Details</div>
    <table class="meta-table">
        <tr><td class="label">Tenant Name</td><td class="value">${d.name}</td></tr>
        <tr><td class="label">Tenant ID</td><td class="value">${d.tenantDisplayId}</td></tr>
        <tr><td class="label">Notice Reference</td><td class="value">${d.noticeDisplayId || 'N/A'}</td></tr>
        <tr><td class="label">Room / Bed</td><td class="value">${d.roomNumber} (${d.bedNo || 'Standard'})</td></tr>
        <tr><td class="label">Room Type</td><td class="value">${d.roomType}</td></tr>
        <tr><td class="label">Final Move-Out Date</td><td class="value">${moveOutStr}</td></tr>
    </table>

    <div class="section-title">Financial Breakdown</div>
    <table class="summary-table" cellspacing="0">
        <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>
            <tr><td>Security Deposit (Credit)</td><td style="text-align:right">${inr(d.securityDeposit)}</td></tr>
            ${d.totalRentDue > 0 ? `<tr><td style="color:#ef4444">Rent Dues (Outstanding)</td><td style="text-align:right;color:#ef4444">- ${inr(d.totalRentDue)}</td></tr>${unpaidRows}` : ''}
            ${d.totalDeductions > 0 ? `<tr><td style="color:#d97706">Damage &amp; Maintenance Deductions</td><td style="text-align:right;color:#d97706">- ${inr(d.totalDeductions)}</td></tr>${deductionRows}` : ''}
            <tr class="total-row">
                <td>${netRefund >= 0 ? 'Net Refund Payable to Tenant' : 'Net Balance Due from Tenant'}</td>
                <td style="text-align:right" class="${netRefund >= 0 ? 'amt-refund' : 'amt-due'}">${inr(Math.abs(netRefund))}</td>
            </tr>
        </tbody>
    </table>

    ${d.settlementNotes ? `<div style="margin-top:20px; font-size:12px; color:#64748b"><strong>Notes:</strong> ${d.settlementNotes}</div>` : ''}

    <div class="legal-footer">
        <div class="stamp">Verified & Settled</div>
        <div class="footer-note">This is a system-generated document and is legally valid under the Information Technology Act, 2000. It confirms the final settlement between the property owner and the tenant. No physical signature is required.</div>
        <div style="font-size:10px; color:#cbd5e1; margin-top:10px">Generated on: ${new Date().toLocaleString('en-IN')} | Ref: ${d.tenantId}</div>
    </div>
</body></html>`;
    };

    const openStudentReceipt = async (action: 'view' | 'download' = 'view') => {
        if (!notice || !booking) return;
        setReceiptLoading(true);
        try {
            const d = await getSettlementForNotice(booking.id);
            if (action === 'view') {
                setViewingReceipt(d);
            } else {
                const html = getReceiptHtml(d);
                const win = window.open('', '_blank');
                if (win) { win.document.write(html); win.document.close(); win.print(); }
            }
        } catch (e: any) {
            toast.error(e.message || 'Could not load receipt.');
        } finally {
            setReceiptLoading(false);
        }
    };

    const lockedDate    = getLockedMoveOutDate();
    const lockedDateISO = toISODate(lockedDate);
    const lockedDateFmt = formatDate(lockedDate);

    useEffect(() => {
        const load = async () => {
            try {
                const bookings = await getBookings();
                // Include CHECKED_OUT so tenant can view their completed notice after move-out
                const active = bookings.find((b: any) => ['ACTIVE', 'MOVE_IN_SCHEDULED', 'CHECKED_OUT'].includes(b.status));
                if (active) {
                    setBooking(active);
                    const existing = await getMyVacatingNotice(active.id);
                    setNotice(existing);
                }
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.agreed) { toast.error('Please confirm you understand the notice period.'); return; }
        const reason = form.reason === 'Other' ? form.customReason : form.reason;
        if (!reason) { toast.error('Please provide a reason.'); return; }

        startTransition(async () => {
            try {
                const result = await fileVacatingNotice({
                    bookingId:     booking.id,
                    plannedMoveOut: lockedDateISO,
                    reason,
                    tenantComment: form.tenantComment.trim() || undefined,
                });
                setNotice(result);
                toast.success('Vacating notice filed successfully!');
            } catch (e: any) {
                toast.error(e.message || 'Failed to file notice.');
            }
        });
    };

    const handleWithdraw = () => {
        if (!notice) return;
        startTransition(async () => {
            try {
                await withdrawVacatingNotice(notice.id);
                setNotice(null);
                toast.success('Notice withdrawn successfully.');
            } catch (e: any) {
                toast.error(e.message || 'Failed to withdraw notice.');
            }
        });
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
    );

    const statusConf = notice ? STATUS_CONFIG[notice.status] : null;
    const StatusIcon = statusConf?.icon;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-4 pt-10 pb-20 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="max-w-2xl mx-auto relative z-10">
                    <Link href="/dashboard/student" className="text-indigo-200 text-xs font-bold flex items-center gap-1 mb-4 hover:text-white">
                        <ArrowLeft className="w-3 h-3" /> Dashboard
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Vacating Notice</h1>
                    <p className="text-indigo-200 text-sm font-medium mt-1">File your 30-day move-out notice</p>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 -mt-12 relative z-10 space-y-5">

                {/* —â‚¬—â‚¬ No Booking —â‚¬—â‚¬ */}
                {!booking ? (
                    <div className="bg-white rounded-3xl shadow-xl p-10 text-center border border-slate-100">
                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h2 className="font-black text-slate-700 text-lg">No Active Booking</h2>
                        <p className="text-slate-400 text-sm mt-2">Vacating notice is only available for active tenants.</p>
                    </div>

                ) : notice && statusConf ? (
                    /* Existing Notice Status */
                    <div className="space-y-4">
                        {/* ── Vacating Progress Card ── */}
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                            {/* Card Header */}
                            <div className="px-6 pt-5 pb-4 border-b border-slate-100">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vacating Progress</p>
                                        {booking?.propertyName && (
                                            <p className="text-sm font-black text-slate-800 mt-0.5 flex items-center gap-1.5">
                                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                {booking.propertyName}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setShowDetailsModal(true)}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl transition-all shadow-md shadow-indigo-200 shrink-0"
                                    >
                                        <FileText className="w-3.5 h-3.5" /> View Details
                                    </button>
                                </div>
                            </div>
                            {/* Timeline with dates */}
                            <div className="px-4 pb-4">
                                <VacatingTimeline
                                    notice={notice}
                                    filedDate={notice.submittedAt
                                        ? new Date(notice.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                        : undefined}
                                    vacatedDate={notice.plannedMoveOut
                                        ? new Date(notice.plannedMoveOut).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                        : undefined}
                                />
                            </div>
                        </div>

                        {/* ── Withdraw button for SUBMITTED notices only ── */}
                        {notice.status === 'SUBMITTED' && (
                            <button
                                onClick={handleWithdraw}
                                disabled={isPending}
                                className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-700 font-black text-sm rounded-2xl border border-red-200 transition-all disabled:opacity-50"
                            >
                                {isPending ? 'Withdrawing...' : 'Withdraw Notice'}
                            </button>
                        )}
                    </div>

                ) : (
                    /* —â‚¬—â‚¬ File Notice Form —â‚¬—â‚¬ */
                    <form onSubmit={handleSubmit} className="space-y-5">

                        {/* Card 1 Ã¢â‚¬â€ Locked Move-Out Date */}
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                            <div className="p-6 border-b border-slate-100">
                                <h2 className="font-black text-slate-900 text-lg flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-indigo-600" /> File Vacating Notice
                                </h2>
                                <p className="text-sm text-slate-500 mt-1">Minimum 30 days notice required by law.</p>
                            </div>
                            <div className="p-6 space-y-5">

                                {/* Amber policy warning */}
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                    <p className="text-sm text-amber-800 font-medium">
                                        Your booking at <strong>{booking.propertyName}</strong> requires a minimum 30-day notice period as per the Model Tenancy Act.
                                    </p>
                                </div>

                                {/* Locked move-out date display */}
                                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <CalendarDays className="w-4 h-4 text-indigo-600" />
                                        <p className="text-xs font-black uppercase tracking-widest text-indigo-600">Your Move-Out Date</p>
                                        <span className="ml-auto flex items-center gap-1 text-[10px] font-black text-indigo-400 bg-indigo-100 px-2 py-0.5 rounded-full">
                                            <Lock className="w-3 h-3" /> Fixed by Policy
                                        </span>
                                    </div>
                                    <p className="text-xl font-black text-indigo-900 mt-1">{lockedDateFmt}</p>
                                    <p className="text-xs text-indigo-500 mt-1">
                                        Based on today's date + 30 days. This date cannot be changed.
                                    </p>
                                </div>

                                {/* Reason */}
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Reason for Leaving *</label>
                                    <select
                                        required
                                        value={form.reason}
                                        onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">Select a reason</option>
                                        {REASON_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>

                                {form.reason === 'Other' && (
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Please describe *</label>
                                        <textarea
                                            required
                                            rows={3}
                                            value={form.customReason}
                                            onChange={e => setForm(f => ({ ...f, customReason: e.target.value }))}
                                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                            placeholder="Please explain your reason..."
                                        />
                                    </div>
                                )}

                                {/* Agreement checkbox */}
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.agreed}
                                        onChange={e => setForm(f => ({ ...f, agreed: e.target.checked }))}
                                        className="mt-0.5 w-4 h-4 accent-indigo-600"
                                    />
                                    <span className="text-sm font-medium text-slate-700">
                                        I understand the 30-day notice period is mandatory and I will not be able to leave before the planned move-out date without penalty.
                                    </span>
                                </label>
                            </div>
                        </div>

                        {/* Card 2 Ã¢â‚¬â€ Early Leave Request (optional) */}
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                            <div className="p-6 border-b border-slate-100">
                                <h2 className="font-black text-slate-900 text-base flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-violet-600" /> Want to Leave Earlier?
                                </h2>
                            </div>
                            <div className="p-6 space-y-4">

                                {/* Info banner */}
                                <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 flex gap-3">
                                    <Info className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
                                    <div className="text-sm text-violet-800">
                                        <p className="font-black mb-1">If you wish to vacate before <span className="text-violet-900">{lockedDateFmt}</span>:</p>
                                        <ul className="list-disc list-inside space-y-1 text-violet-700 font-medium text-xs">
                                            <li>Use the message box below to request an early move-out directly to your owner.</li>
                                            <li>Reach out to your <strong>Building Management Incharge</strong> to discuss reducing or changing the notice period.</li>
                                            <li>Early departure without approval may result in a notice-period penalty as per your agreement.</li>
                                        </ul>
                                    </div>
                                </div>

                                {/* Tenant comment box */}
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                                        Message to Owner <span className="text-slate-300 font-medium normal-case">(optional)</span>
                                    </label>
                                    <textarea
                                        rows={4}
                                        value={form.tenantComment}
                                        onChange={e => setForm(f => ({ ...f, tenantComment: e.target.value }))}
                                        maxLength={500}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                                        placeholder="E.g. I need to vacate by 25 May due to my internship ending. Can the notice period be reduced? Please let me know."
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1 text-right">{form.tenantComment.length}/500</p>
                                </div>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isPending || !form.reason || !form.agreed}
                            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-sm rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
                        >
                            {isPending ? 'Filing Notice...' : `File Vacating Notice for ${lockedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} →`}
                        </button>
                    </form>
                )}
            </div>
            {/* ── View Details Modal ── */}
            {showDetailsModal && notice && statusConf && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                            <div>
                                <h2 className="font-black text-slate-900 text-lg">Notice Details</h2>
                                <p className="text-xs text-slate-500 mt-0.5">{notice.displayId}</p>
                            </div>
                            <button onClick={() => setShowDetailsModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 p-5 space-y-4">
                            {/* Vacating Progress Timeline */}
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Vacating Progress</p>
                                <VacatingTimeline notice={notice} />
                            </div>

                            {/* VACATED: Move-Out Finalized Banner */}
                            {notice.status === 'VACATED' && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-3">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                                    <h3 className="text-lg font-black text-emerald-900">Move-Out Finalized!</h3>
                                    <p className="text-sm text-emerald-700">Your move-out has been processed and settled by your property owner.</p>
                                    <div className="bg-white rounded-2xl p-4 text-left space-y-2 border border-emerald-100">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Settlement Details</p>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Notice Filed</span>
                                            <span className="font-black text-slate-900">{new Date(notice.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Planned Move-Out</span>
                                            <span className="font-black text-slate-900">{new Date(notice.plannedMoveOut).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        </div>
                                        {notice.ownerNote && (
                                            <div className="flex flex-col gap-1 pt-2 border-t border-slate-100">
                                                <span className="text-[10px] font-black uppercase text-slate-400">Owner Settlement Note</span>
                                                <span className="text-sm text-slate-700 font-medium">{notice.ownerNote}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => { setShowDetailsModal(false); openStudentReceipt('view'); }}
                                            disabled={receiptLoading}
                                            className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 disabled:opacity-60"
                                        >
                                            {receiptLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</> : <><Eye className="w-4 h-4" /> View Receipt</>}
                                        </button>
                                        <button
                                            onClick={() => openStudentReceipt('download')}
                                            disabled={receiptLoading}
                                            className="flex-1 py-3 bg-slate-900 text-white font-black text-sm rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                                        >
                                            <FileDown className="w-4 h-4" /> Download PDF
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Notice Info */}
                            <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notice Information</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-black uppercase">Notice ID</p>
                                        <p className="font-black text-slate-900 text-sm mt-0.5">{notice.displayId}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-black uppercase">Move-Out Date</p>
                                        <p className="font-black text-slate-900 text-sm mt-0.5">{new Date(notice.plannedMoveOut).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase">Reason</p>
                                    <p className="font-medium text-slate-700 text-sm mt-0.5">{notice.reason}</p>
                                </div>
                                {notice.tenantComment && (
                                    <div className="bg-violet-50 rounded-xl p-3 border border-violet-100">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-violet-500">Your Early-Leave Request</p>
                                        <p className="font-medium text-violet-800 mt-1 text-sm">{notice.tenantComment}</p>
                                    </div>
                                )}
                                {notice.ownerNote && (
                                    <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Owner Response</p>
                                        <p className="font-medium text-indigo-800 mt-1 text-sm">{notice.ownerNote}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 shrink-0">
                            <button onClick={() => setShowDetailsModal(false)} className="w-full py-3 bg-slate-100 text-slate-700 font-black text-sm rounded-2xl hover:bg-slate-200 transition-all">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {viewingReceipt && (() => {
                const vr = viewingReceipt;
                const net = vr.netRefund ?? (vr.securityDeposit - vr.totalRentDue - vr.totalDeductions);
                const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
                return (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                            <div><h2 className="font-black text-slate-900 text-lg">Settlement Receipt</h2><p className="text-xs text-slate-500 mt-0.5">Ref: {vr.tenantDisplayId}</p></div>
                            <button onClick={() => setViewingReceipt(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5 text-slate-500" /></button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-5 space-y-4">
                            <div className="text-center border-b border-slate-100 pb-4">
                                <p className="text-xl font-black text-indigo-600 tracking-tighter">RentPe</p>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Final Settlement Document</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase text-indigo-500 tracking-widest mb-2">Tenant & Property</p>
                                <div className="bg-slate-50 rounded-2xl p-4 space-y-1.5">
                                    {([['Tenant ID', vr.tenantDisplayId, true],['Notice Ref.', vr.noticeDisplayId || '—', true],['Booking Ref.', vr.bookingDisplayId || '—', true],['Name', vr.name, false],['Phone', vr.phone || '—', false],['Property', vr.propertyName || '—', false],['Room No.', vr.roomNumber || '—', false],['Bed No.', vr.bedNo || '—', false],['Room Type', vr.roomType || '—', false],['Move-In', fmtDate(vr.moveInDate), false],['Move-Out', fmtDate(vr.moveOutDate), false]] as [string,string,boolean][]).map(([l,v,isId]) => (
                                        <div key={l} className="flex justify-between text-xs">
                                            <span className="text-slate-400">{l}</span>
                                            <span className={`font-bold ${isId ? 'text-indigo-600 font-mono' : 'text-slate-900'}`}>{v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase text-indigo-500 tracking-widest mb-2">Pro-Rata Rent Calculation</p>
                                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-1.5 text-xs">
                                    <div className="flex justify-between"><span className="text-slate-500">Monthly Rent</span><span className="font-bold">{inr(vr.monthlyRent)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Days in Month</span><span className="font-bold">{vr.daysInMonth} days</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Daily Rate</span><span className="font-bold">{inr(vr.dailyRate)}/day</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Days Stayed</span><span className="font-bold">{vr.moveOutDay} days</span></div>
                                    <div className="flex justify-between pt-1 border-t border-emerald-200">
                                        <span className="font-black text-emerald-800">Pro-Rata Amount</span>
                                        <span className="font-black text-emerald-700">{inr(vr.dailyRate)} × {vr.moveOutDay} = {inr(vr.proRataAmt)}</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase text-indigo-500 tracking-widest mb-2">Settlement Breakdown</p>
                                <div className="bg-slate-50 rounded-2xl p-4 space-y-1.5 text-xs">
                                    <div className="flex justify-between"><span className="text-slate-500">Security Deposit (Credit)</span><span className="font-bold text-emerald-700">+ {inr(vr.securityDeposit)}</span></div>
                                    {vr.totalRentDue > 0 && (<><div className="flex justify-between font-bold text-red-600"><span>Rent Dues (Total)</span><span>- {inr(vr.totalRentDue)}</span></div>{(vr.unpaidRecords || []).map((r: any) => (<div key={r.month} className="flex justify-between pl-3 text-red-500"><span>{r.note ? `${r.month} (${r.note})` : r.month}</span><span>- {inr(r.amount)}</span></div>))}</>)}
                                    {vr.totalDeductions > 0 && (<><div className="flex justify-between font-bold text-amber-700"><span>Damage Deductions (Total)</span><span>- {inr(vr.totalDeductions)}</span></div>{(vr.deductionItems || []).map((item: any, i: number) => (<div key={i} className="flex justify-between pl-3 text-amber-600"><span>{item.description}</span><span>- {inr(item.amount)}</span></div>))}</>)}
                                    <div className="flex justify-between pt-2 border-t border-slate-200">
                                        <span className={`font-black ${net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{net >= 0 ? 'Net Refund to You' : 'Net Due'}</span>
                                        <span className={`font-black text-base ${net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{inr(Math.abs(net))}</span>
                                    </div>
                                </div>
                            </div>
                            {vr.settlementNotes && <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600"><span className="font-black uppercase text-slate-400 block mb-1">Note</span>{vr.settlementNotes}</div>}
                            <p className="text-[8px] text-center text-slate-300">Valid under IT Act 2000 & Model Tenancy Act 2021. No signature required.</p>
                        </div>
                        <div className="p-4 border-t border-slate-100 flex gap-3 shrink-0">
                            <button onClick={() => { const html = getReceiptHtml(viewingReceipt); const win = window.open('', '_blank'); if (win) { win.document.write(html); win.document.close(); win.print(); }}} className="flex-1 py-3 bg-indigo-600 text-white font-black text-sm rounded-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                                <Printer className="w-4 h-4" /> Print / Download
                            </button>
                            <button onClick={() => setViewingReceipt(null)} className="flex-1 py-3 bg-slate-100 text-slate-700 font-black text-sm rounded-2xl hover:bg-slate-200 transition-all">Close</button>
                        </div>
                    </div>
                </div>
                );
            })()}
        </div>
    );
}