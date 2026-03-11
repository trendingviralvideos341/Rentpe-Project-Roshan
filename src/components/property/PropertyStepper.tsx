'use client';

import { Check, Clock, ShieldCheck, CreditCard, ExternalLink, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PropertyStepperProps {
    status: string;
    adminNotes?: string | null;
}

const steps = [
    { id: 'SUBMITTED', label: 'Submitted', icon: Clock, desc: 'Awaiting initial review' },
    { id: 'VERIFYING', label: 'Verifying', icon: ShieldCheck, desc: 'Documents checking' },
    { id: 'PAYMENT', label: 'Payment', icon: CreditCard, desc: 'Onboarding fee' },
    { id: 'LIVE', label: 'Live', icon: ExternalLink, desc: 'Property is visible' },
];

const STATUS_MESSAGES: Record<string, { label: string; color: string; bg: string; border: string }> = {
    PENDING_APPROVAL: { label: '⏳ Verification in Progress', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300' },
    PAYMENT_PENDING: { label: '💳 Verification Success! Pay Fee to go Live', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-400' },
    LIVE: { label: '✅ Property is Live and Booking', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    REJECTED: { label: '❌ Property Rejected', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300' },
};

export function PropertyStepper({ status, adminNotes }: PropertyStepperProps) {
    const getActiveIndex = (s: string) => {
        if (s === 'PENDING_APPROVAL') {
            // If there are admin notes with [REUPLOAD], it's still in verification but flagged
            return 1;
        }
        if (s === 'PAYMENT_PENDING') return 2;
        if (s === 'LIVE') return 3;
        if (s === 'REJECTED') return 1; // Show at verification step
        return 0;
    };

    const getStepStatus = (stepIndex: number, activeIndex: number, currentStatus: string) => {
        if (stepIndex < activeIndex) return 'completed';
        if (stepIndex === activeIndex) {
            if (currentStatus === 'REJECTED') return 'error';
            if (currentStatus === 'PENDING_APPROVAL' && adminNotes?.includes('[REUPLOAD')) return 'warning';
            return 'active';
        }
        return 'pending';
    };

    const activeIndex = getActiveIndex(status);
    const statusMsg = STATUS_MESSAGES[status];
    const isReupload = status === 'PENDING_APPROVAL' && adminNotes?.includes('[REUPLOAD');

    return (
        <div className="w-full space-y-6">
            {/* Status Banner */}
            <div className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all",
                isReupload ? "bg-red-50 border-red-200" : (statusMsg?.bg || "bg-slate-50"),
                isReupload ? "border-red-300" : (statusMsg?.border || "border-slate-200")
            )}>
                {isReupload ? (
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600 animate-pulse" />
                        <span className="font-bold text-sm text-red-700 uppercase tracking-tight">Action Required: Document Re-upload Requested</span>
                    </div>
                ) : (
                    <span className={cn("font-bold text-sm uppercase tracking-tight", statusMsg?.color || "text-slate-600")}>
                        {statusMsg?.label || status}
                    </span>
                )}
            </div>

            {/* Stepper */}
            <div className="px-2">
                <div className="flex items-center justify-between relative">
                    {/* Background Line */}
                    <div className="absolute top-5 left-0 w-full h-0.5 bg-slate-100 -z-10 rounded-full" />
                    
                    {/* Progress Line */}
                    <div
                        className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-purple-600 to-indigo-600 transition-all duration-700 -z-10 rounded-full"
                        style={{ width: `${(Math.min(activeIndex, steps.length - 1) / (steps.length - 1)) * 100}%` }}
                    />

                    {steps.map((step, i) => {
                        const Icon = step.icon;
                        const stepStatus = getStepStatus(i, activeIndex, status);

                        return (
                            <div key={step.id} className="flex flex-col items-center gap-2 group min-w-[70px]">
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-300 relative",
                                    stepStatus === 'completed' ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-200' :
                                    stepStatus === 'active' ? 'bg-white border-purple-600 text-purple-600 shadow-md scale-110 ring-4 ring-purple-100' :
                                    stepStatus === 'warning' ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-200 animate-bounce' :
                                    stepStatus === 'error' ? 'bg-red-500 border-red-500 text-white' :
                                    'bg-white border-slate-200 text-slate-300'
                                )}>
                                    {stepStatus === 'completed' ? <Check className="h-5 w-5 stroke-[3]" /> : <Icon className="h-5 w-5" />}
                                    
                                    {stepStatus === 'active' && (
                                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-purple-600 rounded-full animate-ping opacity-60" />
                                    )}
                                    {stepStatus === 'warning' && (
                                        <AlertTriangle className="absolute -top-2 -right-2 h-5 w-5 text-amber-600 fill-white" />
                                    )}
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className={cn(
                                        "text-[10px] font-black uppercase tracking-tight text-center leading-none",
                                        stepStatus === 'active' ? 'text-purple-700' :
                                        stepStatus === 'completed' ? 'text-purple-600' :
                                        stepStatus === 'warning' ? 'text-amber-700' :
                                        stepStatus === 'error' ? 'text-red-600' :
                                        'text-slate-400'
                                    )}>
                                        {step.label}
                                    </span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {step.desc}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
