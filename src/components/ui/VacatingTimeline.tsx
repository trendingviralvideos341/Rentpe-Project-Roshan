'use client';

import { Check, Clock, FileText, CheckCircle2, Timer, Receipt, IndianRupee, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface VacatingTimelineProps {
    notice: {
        status: string;
        plannedMoveOut: string | Date;
        submittedAt?: string | Date;
        acknowledgedAt?: string | Date;
        settlementStatus?: string;     // 'PENDING_PAYMENT' | 'PENDING_REFUND' | 'CLEARED'
        moveOutCompletedAt?: string | Date;
    } | null;
}

const STEPS = [
    {
        key: 'SUBMITTED',
        label: 'Notice Filed',
        icon: FileText,
        description: 'Your 30-day vacating notice has been submitted.',
    },
    {
        key: 'ACKNOWLEDGED',
        label: 'Management Acknowledged',
        icon: CheckCircle2,
        description: 'Building management has received & acknowledged your notice.',
    },
    {
        key: 'WAITING',
        label: 'Notice Period',
        icon: Timer,
        description: 'Serving your notice period. Move-out date is confirmed.',
    },
    {
        key: 'SETTLEMENT',
        label: 'Settlement',
        icon: IndianRupee,
        description: 'Final settlement calculation & payment clearance.',
    },
    {
        key: 'RECEIPT',
        label: 'Receipt Issued',
        icon: Receipt,
        description: 'Settlement receipt generated for your records.',
    },
    {
        key: 'VACATED',
        label: 'Vacated',
        icon: Home,
        description: 'Move-out complete. Room is released.',
    },
];

function getActiveIndex(notice: VacatingTimelineProps['notice']): number {
    if (!notice) return 0;
    switch (notice.status) {
        case 'SUBMITTED':   return 0;
        case 'ACKNOWLEDGED': {
            // While waiting in notice period → step 2 (Waiting) is current
            const moveOut = new Date(notice.plannedMoveOut);
            const today   = new Date();
            if (today < moveOut) return 2; // still in waiting
            return 3; // past move-out date → settlement
        }
        case 'SETTLEMENT_PENDING':
        case 'PAYMENT_REQUESTED': return 3;
        case 'RECEIPT_ISSUED':   return 4;
        case 'VACATED':          // ← fully completed vacate via owner settlement
        case 'COMPLETED':
        case 'CHECKED_OUT':      return 5;
        case 'WITHDRAWN':        return 0;
        default:                 return 0;
    }
}

function getDaysLeft(moveOut: string | Date): number {
    const now = new Date();
    const target = new Date(moveOut);
    return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

export function VacatingTimeline({ notice }: VacatingTimelineProps) {
    if (!notice) return null;

    const activeIndex = getActiveIndex(notice);
    const isWithdrawn = notice.status === 'WITHDRAWN';
    const isCompleted = notice.status === 'COMPLETED' || notice.status === 'CHECKED_OUT' || notice.status === 'VACATED';
    const daysLeft    = notice.plannedMoveOut ? getDaysLeft(notice.plannedMoveOut) : null;

    return (
        <div className="w-full py-4 px-2">
            {/* ── Horizontal Steps ── */}
            <div className="flex flex-col md:flex-row justify-between relative gap-6 md:gap-0">

                {/* Desktop connecting line */}
                <div className="hidden md:block absolute top-[18px] left-0 w-full h-0.5 bg-slate-200 -z-10" />
                <div
                    className="hidden md:block absolute top-[18px] left-0 h-0.5 bg-gradient-to-r from-rose-500 to-orange-500 transition-all duration-1000 -z-10 shadow-[0_0_10px_rgba(244,63,94,0.3)]"
                    style={{ width: isWithdrawn ? '0%' : `${(activeIndex / (STEPS.length - 1)) * 100}%` }}
                />

                {STEPS.map((step, idx) => {
                    const isFullyDone = isCompleted;
                    const isCompleted_ =
                        idx < activeIndex ||
                        (isFullyDone && idx === STEPS.length - 1);
                    const isCurrent = idx === activeIndex && !isWithdrawn && !isFullyDone;
                    const isUpcoming = idx > activeIndex;
                    const Icon = step.icon;

                    return (
                        <div
                            key={step.key}
                            className="flex flex-row md:flex-col items-start md:items-center gap-3 md:gap-2 flex-1 relative group"
                        >
                            {/* Mobile connector */}
                            {idx < STEPS.length - 1 && (
                                <div className="md:hidden absolute left-[18px] top-[36px] w-0.5 h-[calc(100%-16px)] bg-slate-200 -z-10" />
                            )}
                            {idx < activeIndex && (
                                <div className="md:hidden absolute left-[18px] top-[36px] w-0.5 h-[calc(100%-16px)] bg-gradient-to-b from-rose-500 to-orange-500 -z-10" />
                            )}

                            {/* Node icon */}
                            <div className={cn(
                                "relative w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 shrink-0",
                                isCompleted_
                                    ? "bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-lg shadow-rose-200"
                                    : isCurrent
                                        ? "bg-white border-2 border-rose-500 text-rose-500 ring-4 ring-rose-100"
                                        : "bg-white border-2 border-dashed border-slate-300 text-slate-400"
                            )}>
                                {isCompleted_
                                    ? <Check className="w-4 h-4 stroke-[3]" />
                                    : <Icon className="w-4 h-4" />
                                }
                                {isCurrent && (
                                    <span className="absolute inset-0 rounded-full border-2 border-rose-500 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] opacity-40" />
                                )}
                            </div>

                            {/* Card */}
                            <div className={cn(
                                "flex flex-col gap-0.5 p-1.5 md:p-2 rounded-lg border transition-all duration-300 w-full md:max-w-[110px] md:text-center",
                                isCurrent
                                    ? "bg-white border-rose-200 shadow-md shadow-rose-500/5 -translate-y-0.5"
                                    : isCompleted_
                                        ? "bg-rose-50/50 border-rose-100"
                                        : "bg-slate-50 border-slate-100 opacity-60"
                            )}>
                                <span className={cn(
                                    "text-[10px] md:text-xs font-black uppercase tracking-tight leading-tight",
                                    isCurrent ? "text-rose-900" : isCompleted_ ? "text-rose-800" : "text-slate-500"
                                )}>
                                    {step.label}
                                </span>

                                {/* Days left badge — only on the "Waiting" step while it's current */}
                                {isCurrent && step.key === 'WAITING' && daysLeft !== null && daysLeft > 0 && (
                                    <span className="text-[9px] font-black text-rose-600 mt-0.5 md:text-center">
                                        {daysLeft}d left
                                    </span>
                                )}

                                {isCurrent && step.key === 'WAITING' && daysLeft !== null && daysLeft <= 0 && (
                                    <span className="text-[9px] font-black text-emerald-600 mt-0.5">
                                        Today!
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Countdown Banner (while serving notice period) ── */}
            {notice.status === 'ACKNOWLEDGED' && daysLeft !== null && daysLeft > 0 && (
                <div className="mt-5 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                        <Timer className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-amber-700">Notice Period in Progress</p>
                        <p className="text-sm font-black text-amber-900 mt-0.5">
                            {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining until move-out
                        </p>
                        <p className="text-[10px] text-amber-600 mt-0.5">
                            Move-out: {new Date(notice.plannedMoveOut).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                </div>
            )}

            {/* ── Move-out day banner ── */}
            {notice.status === 'ACKNOWLEDGED' && daysLeft !== null && daysLeft <= 0 && (
                <div className="mt-5 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                        <Home className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Move-out Day</p>
                        <p className="text-sm font-black text-emerald-900 mt-0.5">
                            Today is your move-out date. Building management will process your settlement shortly.
                        </p>
                    </div>
                </div>
            )}

            {/* ── Withdrawn Banner ── */}
            {isWithdrawn && (
                <div className="mt-5 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Notice Withdrawn</p>
                        <p className="text-sm text-slate-600 mt-0.5">You have withdrawn this vacating notice. Your stay continues normally.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
