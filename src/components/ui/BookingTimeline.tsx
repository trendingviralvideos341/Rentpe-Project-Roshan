'use client';

import {
    Check, AlertCircle, Calendar, Home,
    ClipboardList, CreditCard, ScrollText,
    BedDouble, ScanFace, PackageCheck
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface BookingTimelineProps {
    booking: any;
    vacated?: boolean;
}

// ── 7-step flow matching actual booking statuses ──────────────────────────────
const TIMELINE_STEPS = [
    {
        key: 'APPLIED',
        label: 'Application sent',
        icon: ClipboardList,
        description: 'Your booking request has been sent to the owner.',
        dateField: 'appliedAt',
    },
    {
        key: 'ROOM_ALLOCATED',
        label: 'Room allocated',
        icon: BedDouble,
        description: 'Owner approved and assigned your room. Pay token to reserve.',
        dateField: 'approvedAt',
    },
    {
        key: 'TOKEN_PAID',
        label: 'Token paid',
        icon: CreditCard,
        description: 'Token paid. Your bed is now reserved.',
        dateField: 'tokenPaidAt',
    },
    {
        key: 'PHYSICAL_KYC',
        label: 'Physical KYC',
        icon: ScanFace,
        description: 'Visit PG in person. Owner verifies your ID and assigns Tenant ID.',
        dateField: 'physicalVerifiedAt',
    },
    {
        key: 'AGREEMENT_SIGNED',
        label: 'Agreement signed',
        icon: ScrollText,
        description: 'Rental agreement signed digitally by both parties.',
        dateField: 'agreementSignedAt',
    },
    {
        key: 'MOVE_IN_READY',
        label: 'Final payment',
        icon: PackageCheck,
        description: 'Pay balance amount (rent + deposit − token) to activate stay.',
        dateField: 'onboardingDate', // fix: was 'moveInScheduled' — corrected to match booking object
    },
    {
        key: 'ACTIVE',
        label: 'Active tenant',
        icon: Home,
        description: "You're officially a resident. Welcome home!",
        dateField: 'activeAt',
    },
];

// ── Maps booking.status → which step index is currently active ────────────────
function getActiveIndex(status: string, roomAssigned: boolean): number {
    // Step 0 — sent, awaiting approval
    if (['APPLIED', 'PENDING_APPROVAL', 'REQUESTED'].includes(status)) return 0;

    // Step 1 — approved but room not yet assigned
    if (status === 'APPROVED' && !roomAssigned) return 1;

    // Step 2 — room assigned / token pending
    if (status === 'APPROVED_PENDING_TOKEN' || (status === 'APPROVED' && roomAssigned)) return 2;

    // Step 3 — token paid, physical visit pending
    if (status === 'ROOM_RESERVED') return 3;

    // Step 4 — physical verified, sign agreement
    if (status === 'PHYSICAL_VERIFIED') return 4;

    // Step 5 — agreement signed, final payment pending
    if (['AGREEMENT_PENDING', 'BOOKING_CONFIRMED', 'PAID', 'CASH_PAID', 'MOVE_IN_SCHEDULED'].includes(status)) return 5;

    // Step 6 — active tenant or completed
    if (['ACTIVE', 'CHECKED_IN', 'CHECKIN_CONFIRMED', 'COMPLETED'].includes(status)) return 6;

    return 0;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function BookingTimeline({ booking, vacated = false }: BookingTimelineProps) {
    const currentStatus = booking.status;
    const isRejected = currentStatus === 'REJECTED';
    const isCancelled = currentStatus === 'CANCELLED' || currentStatus === 'EXPIRED';
    const isFailed = isRejected || isCancelled;
    const isFullyActive = ['ACTIVE', 'CHECKED_IN', 'CHECKIN_CONFIRMED', 'COMPLETED'].includes(currentStatus);

    const activeIndex = getActiveIndex(currentStatus, !!booking.roomAssigned);
    const progressPct = (activeIndex / (TIMELINE_STEPS.length - 1)) * 100;

    return (
        <div className="w-full py-2 px-1 md:px-4">
            <div className="flex flex-col md:flex-row justify-between relative gap-5 md:gap-0">

                {/* ── Progress line — desktop ── */}
                <div className="hidden md:block absolute top-[18px] left-0 w-full h-0.5 bg-slate-100 -z-10 rounded-full" />
                <div
                    className={cn(
                        "hidden md:block absolute top-[18px] left-0 h-0.5 -z-10 rounded-full transition-all duration-1000",
                        vacated
                            ? "bg-slate-300 w-full"
                            : "bg-gradient-to-r from-indigo-500 to-violet-600"
                    )}
                    style={vacated ? {} : { width: `${progressPct}%` }}
                />

                {/* ── Steps ── */}
                {TIMELINE_STEPS.map((step, index) => {
                    const isCompleted = vacated
                        || index < activeIndex
                        || (isFullyActive && index === TIMELINE_STEPS.length - 1);

                    const isCurrent = !vacated && index === activeIndex && !isFailed && !isFullyActive;
                    const Icon = step.icon;

                    // Date: prefer specific field, fall back to createdAt for step 0
                    const rawDate = booking[step.dateField] ?? (index === 0 ? booking.createdAt : null);
                    const dateStr = rawDate
                        ? (() => {
                            try { return format(new Date(rawDate), "dd MMM yy"); }
                            catch { return null; }
                        })()
                        : null;

                    return (
                        <div
                            key={step.key}
                            className="flex flex-row md:flex-col items-start md:items-center gap-3 md:gap-2 flex-1 relative"
                        >
                            {/* ── Mobile vertical connector ── */}
                            {index < TIMELINE_STEPS.length - 1 && (
                                <div className="md:hidden absolute left-[17px] top-[38px] w-px h-[calc(100%-10px)] bg-slate-100 -z-10" />
                            )}
                            {index < activeIndex && !vacated && (
                                <div className="md:hidden absolute left-[17px] top-[38px] w-px h-[calc(100%-10px)] bg-gradient-to-b from-indigo-500 to-violet-600 -z-10" />
                            )}
                            {vacated && index < TIMELINE_STEPS.length - 1 && (
                                <div className="md:hidden absolute left-[17px] top-[38px] w-px h-[calc(100%-10px)] bg-slate-200 -z-10" />
                            )}

                            {/* ── Node ── */}
                            <div className={cn(
                                "relative w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-300",
                                vacated
                                    ? "bg-slate-100 text-slate-400 border border-slate-200"
                                    : isCompleted
                                    ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-100"
                                    : isCurrent
                                    ? "bg-white border-2 border-violet-600 text-violet-600 ring-4 ring-violet-100"
                                    : "bg-white border border-dashed border-slate-200 text-slate-300"
                            )}>
                                {isCompleted && !vacated
                                    ? <Check className="w-4 h-4 stroke-[2.5]" />
                                    : <Icon className="w-4 h-4" />
                                }
                                {isCurrent && (
                                    <span className="absolute inset-0 rounded-full border-2 border-violet-500 animate-ping opacity-30" />
                                )}
                            </div>

                            {/* ── Label card ── */}
                            <div className={cn(
                                "flex flex-col gap-0.5 px-2 py-1.5 rounded-xl border transition-all duration-300",
                                "w-full md:max-w-[100px] md:text-center",
                                vacated
                                    ? "bg-slate-50 border-slate-100 opacity-60"
                                    : isCurrent
                                    ? "bg-violet-50 border-violet-200 shadow-sm"
                                    : isCompleted
                                    ? "bg-indigo-50/60 border-indigo-100"
                                    : "bg-white border-slate-100 opacity-50"
                            )}>
                                <span className={cn(
                                    "text-[10px] font-bold leading-tight",
                                    vacated ? "text-slate-400"
                                    : isCurrent ? "text-violet-800"
                                    : isCompleted ? "text-indigo-800"
                                    : "text-slate-400"
                                )}>
                                    {step.label}
                                </span>
                                {dateStr && (
                                    <span className="text-[9px] text-slate-400 flex items-center md:justify-center gap-0.5 mt-0.5">
                                        <Calendar className="w-2 h-2 shrink-0" />
                                        {dateStr}
                                    </span>
                                )}
                                {isCurrent && !dateStr && (
                                    <span className="text-[9px] text-violet-500 font-bold mt-0.5">
                                        In progress
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* ── Failed / Cancelled state ── */}
                {isFailed && (
                    <div className="col-span-full mt-6 w-full p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
                        <div className="p-2 bg-red-100 rounded-full shrink-0">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-red-800">
                                Booking {isCancelled ? 'cancelled' : 'rejected'}
                            </p>
                            <p className="text-xs text-red-600 mt-0.5">
                                {booking.cancelReason
                                    || booking.rejectionReason
                                    || (isCancelled
                                        ? 'This booking has been cancelled.'
                                        : 'Your application was not accepted at this time.')}
                            </p>
                            {booking.updatedAt && (
                                <p className="text-[10px] text-red-400 mt-1">
                                    {(() => {
                                        try { return format(new Date(booking.updatedAt), "dd MMM yyyy"); }
                                        catch { return ''; }
                                    })()}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
