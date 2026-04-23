'use client';

import { Check, AlertCircle, Clock, Calendar, Home, GraduationCap, ClipboardList, ShieldCheck, PackageOpen, CreditCard, ScrollText, BedDouble } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface BookingTimelineProps {
    booking: any;
}

const TIMELINE_STEPS = [
    {
        key: 'APPLIED',
        label: 'Application Sent',
        icon: ClipboardList,
        description: 'Your booking request has been sent to the owner.',
        dateField: 'appliedAt',
    },
    {
        key: 'APPROVED',
        label: 'Owner Approved',
        icon: Check,
        description: 'Owner has reviewed and approved your application.',
        dateField: 'approvedAt',
    },
    {
        key: 'ROOM_ALLOCATED',
        label: 'Room Allocated',
        icon: BedDouble,
        description: 'Your room and bed have been assigned.',
        dateField: 'approvedAt',
    },
    {
        key: 'PAYMENT_DONE',
        label: 'Payment Done',
        icon: CreditCard,
        description: 'Rent, deposit & commissions paid successfully.',
        dateField: 'paidAt',
    },
    {
        key: 'AGREEMENT_SIGNED',
        label: 'Agreement Signed',
        icon: ScrollText,
        description: 'Digital rental agreement signed & verified.',
        dateField: 'agreementSignedAt',
    },
    {
        key: 'MOVE_IN_SCHEDULED',
        label: 'Move-in Scheduled',
        icon: Calendar,
        description: 'Your move-in date has been confirmed.',
        dateField: 'moveInScheduled',
    },
    {
        key: 'ACTIVE',
        label: 'Active Tenant',
        icon: Home,
        description: "You're officially a resident. Welcome home!",
        dateField: 'activeAt',
    },
    {
        key: 'VACATING',
        label: 'Vacating',
        icon: PackageOpen,
        description: 'Move-out process initiated. Please complete the checkout.',
        dateField: 'vacatingAt',
    },
    {
        key: 'COMPLETED',
        label: 'Stay Completed',
        icon: GraduationCap,
        description: 'Your tenancy has been completed successfully.',
        dateField: 'completedAt',
    },
];

export function BookingTimeline({ booking }: BookingTimelineProps) {
    const currentStatus = booking.status;
    const isRejected = currentStatus === 'REJECTED';

    const getActiveIndex = (status: string) => {
        // Step 0 — Application
        if (status === 'APPLIED' || status === 'PENDING_APPROVAL' || status === 'REQUESTED') return 0;
        // Step 1 — Owner Approved (no room yet)
        if (status === 'APPROVED_PENDING_TOKEN') return 1;
        // Step 2 — Room Allocated / KYC stage
        if (
            status === 'APPROVED' ||
            status === 'ROOM_RESERVED' ||
            status === 'KYC_PENDING' ||
            status === 'APPROVED_KYC_PENDING' ||
            status === 'KYC_FAILED' ||
            status === 'AGREEMENT_PENDING'
        ) return 2;
        // Step 3 — Payment
        if (status === 'PAID' || status === 'CASH_PAID') return 3;
        // Step 4 — Agreement Signed
        if (status === 'BOOKING_CONFIRMED') return 4;
        // Step 5 — Move-in Scheduled
        if (status === 'MOVE_IN_SCHEDULED') return 5;
        // Step 6 — Active
        if (status === 'ACTIVE' || status === 'CHECKED_IN') return 6;
        // Step 7 — Vacating
        if (status === 'VACATING') return 7;
        // Step 8 — Completed
        if (status === 'COMPLETED' || status === 'CHECKED_OUT') return 8;
        return 0;
    };

    const activeIndex = getActiveIndex(currentStatus);

    return (
        <div className="w-full py-6 px-2 md:px-4">
            <div className="flex flex-col md:flex-row justify-between relative gap-6 md:gap-0">
                {/* Connecting Lines (Desktop only) */}
                <div className="hidden md:block absolute top-[22px] left-0 w-full h-0.5 bg-slate-200 -z-10" />
                <div
                    className="hidden md:block absolute top-[22px] left-0 h-0.5 bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-1000 -z-10 shadow-[0_0_10px_rgba(79,70,229,0.3)]"
                    style={{ width: `${(activeIndex / (TIMELINE_STEPS.length - 1)) * 100}%` }}
                />

                {/* Timeline Steps */}
                {TIMELINE_STEPS.map((step, index) => {
                    const isCompleted = index < activeIndex || (currentStatus === 'COMPLETED' && index === TIMELINE_STEPS.length - 1);
                    const isCurrent = index === activeIndex && !isRejected;
                    const isUpcoming = index > activeIndex;
                    const Icon = step.icon;
                    const dateVal = booking[step.dateField] || (index === 0 ? booking.createdAt : null);

                    return (
                        <div key={step.key} className="flex flex-row md:flex-col items-start md:items-center gap-3 md:gap-2 flex-1 relative group">
                            {/* Connector Line (Mobile only) */}
                            {index < TIMELINE_STEPS.length - 1 && (
                                <div className="md:hidden absolute left-[22px] top-[44px] w-0.5 h-[calc(100%-20px)] bg-slate-200 -z-10" />
                            )}
                            {index < activeIndex && (
                                <div className="md:hidden absolute left-[22px] top-[44px] w-0.5 h-[calc(100%-20px)] bg-gradient-to-b from-indigo-600 to-purple-600 shadow-[0_0_10px_rgba(79,70,229,0.3)] -z-10" />
                            )}

                            {/* Node Icon */}
                            <div className={cn(
                                "relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-500 shrink-0",
                                isCompleted ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200 scale-110" :
                                isCurrent ? "bg-white border-2 border-purple-600 text-purple-600 ring-4 ring-purple-100 scale-125" :
                                "bg-white border-2 border-dashed border-slate-300 text-slate-400"
                            )}>
                                {isCompleted ? <Check className="w-5 h-5 stroke-[3]" /> : <Icon className="w-5 h-5" />}

                                {isCurrent && (
                                    <span className="absolute inset-0 rounded-full border-2 border-purple-600 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] opacity-40" />
                                )}
                            </div>

                            {/* Content Card */}
                            <div className={cn(
                                "flex flex-col gap-1 p-2 md:p-3 rounded-xl border transition-all duration-300 w-full md:max-w-[140px] md:text-center",
                                isCurrent ? "bg-white/80 backdrop-blur-md border-purple-200 shadow-xl shadow-purple-500/10 -translate-y-1" :
                                isCompleted ? "bg-indigo-50/50 border-indigo-100" :
                                "bg-slate-50 border-slate-100 opacity-50"
                            )}>
                                <span className={cn(
                                    "text-[10px] md:text-xs font-black uppercase tracking-tight leading-tight",
                                    isCurrent ? "text-purple-900" : isCompleted ? "text-indigo-900" : "text-slate-500"
                                )}>
                                    {step.label}
                                </span>

                                {dateVal && (
                                    <span className="text-[9px] md:text-[10px] font-bold text-slate-500 flex items-center md:justify-center gap-1">
                                        <Clock className="w-2.5 h-2.5" />
                                        {format(new Date(dateVal), "dd MMM yyyy, HH:mm")}
                                    </span>
                                )}

                                <p className="text-[9px] md:hidden lg:block text-slate-400 font-medium leading-relaxed">
                                    {step.description}
                                </p>
                            </div>
                        </div>
                    );
                })}

                {/* Rejected State */}
                {isRejected && (
                    <div className="col-span-full mt-4 p-4 rounded-2xl bg-red-50 border-2 border-red-200 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="p-2 bg-red-100 rounded-full">
                            <AlertCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-red-900 uppercase tracking-widest">Booking Rejected</h3>
                            <p className="text-xs text-red-700 font-medium mt-1">
                                {booking.rejectionReason || booking.cancelReason || 'Your application was unfortunately not accepted at this time.'}
                            </p>
                            <p className="text-[10px] text-red-600 italic mt-2">
                                Dated: {booking.rejectedAt ? format(new Date(booking.rejectedAt), "dd MMM yyyy, HH:mm") : format(new Date(booking.updatedAt), "dd MMM yyyy, HH:mm")}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
