'use client';

import { useEffect, useState, useTransition } from 'react';
import { getBookings } from '@/actions/bookings';
import { fileVacatingNotice, getMyVacatingNotice, withdrawVacatingNotice } from '@/actions/tenancy';
import { toast } from 'sonner';
import {
    FileText, AlertTriangle, CheckCircle2, Clock, Loader2,
    ArrowLeft, XCircle, CalendarDays, Info, MessageSquare, Lock
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

                {/* ── No Booking ── */}
                {!booking ? (
                    <div className="bg-white rounded-3xl shadow-xl p-10 text-center border border-slate-100">
                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h2 className="font-black text-slate-700 text-lg">No Active Booking</h2>
                        <p className="text-slate-400 text-sm mt-2">Vacating notice is only available for active tenants.</p>
                    </div>

                ) : notice && statusConf ? (
                    /* ── Existing Notice Status ── */
                    <div className="space-y-4">
                        {/* ── Flow Timeline ── */}
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                            <div className="px-6 pt-5 pb-2 border-b border-slate-100">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Vacating Progress</p>
                            </div>
                            <div className="px-4 pb-4">
                                <VacatingTimeline notice={notice} />
                            </div>
                        </div>

                        {/* ── Vacate Completed Receipt Banner ── */}
                        {notice.status === 'VACATED' && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl shadow-xl p-6 text-center space-y-3">
                                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                                <h3 className="text-xl font-black text-emerald-900">Move-Out Finalized!</h3>
                                <p className="text-sm text-emerald-700">Your move-out has been processed and settled by your property owner. Your room has been released.</p>
                                <div className="bg-white rounded-2xl p-4 text-left space-y-2 border border-emerald-100 mt-2">
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
                                <p className="text-xs text-emerald-600 font-medium">Contact your owner for the final security deposit refund or any outstanding amounts.</p>
                            </div>
                        )}

                        {/* ── Notice Details Card ── */}
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                        <div className={`p-6 bg-${statusConf.color}-50 border-b border-${statusConf.color}-100`}>
                            <div className="flex items-center gap-3">
                                {StatusIcon && <StatusIcon className={`w-6 h-6 text-${statusConf.color}-600`} />}
                                <div>
                                    <p className={`text-xs font-black uppercase tracking-widest text-${statusConf.color}-600`}>Notice Status</p>
                                    <h2 className="text-xl font-black text-slate-900">{statusConf.label}</h2>
                                </div>
                            </div>
                            <p className="text-sm text-slate-600 mt-3">{statusConf.desc}</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 rounded-2xl p-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notice ID</p>
                                    <p className="font-black text-slate-900 mt-1 text-sm">{notice.displayId}</p>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Planned Move-Out</p>
                                    <p className="font-black text-slate-900 mt-1 text-sm">
                                        {new Date(notice.plannedMoveOut).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-4 col-span-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reason</p>
                                    <p className="font-medium text-slate-700 mt-1 text-sm">{notice.reason}</p>
                                </div>
                                {notice.tenantComment && (
                                    <div className="bg-violet-50 rounded-2xl p-4 col-span-2 border border-violet-100">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-violet-500">Your Early-Leave Request</p>
                                        <p className="font-medium text-violet-800 mt-1 text-sm">{notice.tenantComment}</p>
                                    </div>
                                )}
                                {notice.ownerNote && (
                                    <div className="bg-indigo-50 rounded-2xl p-4 col-span-2 border border-indigo-100">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Owner Response</p>
                                        <p className="font-medium text-indigo-800 mt-1 text-sm">{notice.ownerNote}</p>
                                    </div>
                                )}
                            </div>
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
                    </div>
                </div>

                ) : (
                    /* ── File Notice Form ── */
                    <form onSubmit={handleSubmit} className="space-y-5">

                        {/* Card 1 — Locked Move-Out Date */}
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

                        {/* Card 2 — Early Leave Request (optional) */}
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
        </div>
    );
}
