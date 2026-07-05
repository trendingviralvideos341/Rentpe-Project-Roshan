'use client';

import { Check, Clock, ShieldCheck, CreditCard, ExternalLink, AlertTriangle, Home, Eye, FileText, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";

interface PropertyStepperProps {
    status: string;
    adminNotes?: string | null;
}

const steps = [
    { id: 'SUBMITTED', label: 'Submitted', icon: Clock, desc: 'Step 1' },
    { id: 'APPROVED_INIT', label: 'Verifying Docs', icon: FileText, desc: 'Step 2' },
    { id: 'AUDITED', label: 'Verified', icon: ShieldCheck, desc: 'Step 3' },
    { id: 'BANK_DETAILS', label: 'Bank Details', icon: Landmark, desc: 'Step 4' },
    { id: 'PAYMENT', label: 'Payment', icon: CreditCard, desc: 'Step 5' },
    { id: 'LIVE', label: 'Live', icon: ExternalLink, desc: 'Step 6' },
];

const STATUS_MESSAGES: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
    DRAFT: { label: 'Draft', color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', icon: Home },
    PENDING_VERIFICATION: { label: 'Awaiting Rentpe Team Verification', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300', icon: Clock },
    VERIFYING_DOCUMENTS: { label: 'Under Review', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300', icon: Eye },
    CORRECTED: { label: 'Documents Re-submitted. Awaiting review', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300', icon: Clock },
    NEEDS_CORRECTION: { label: 'Action Required: Fix Documents', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300', icon: AlertTriangle },
    VERIFIED_SUCCESSFULLY: { label: 'Documents Verified. Waiting for Team Approval', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-400', icon: ShieldCheck },
    APPROVED_PAYMENT_VERIFIED: { label: 'Payment Received. Awaiting Final Activation', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300', icon: ShieldCheck },
    APPROVED_PENDING_PAYMENT: { label: 'Verification Success! Pay Fee to go Live', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-400', icon: CreditCard },
    APPROVED: { label: 'Property is Live', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: ShieldCheck },
    LIVE: { label: 'Property is Live', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: ShieldCheck },
    SUSPENDED: { label: 'Property Suspended', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300', icon: AlertTriangle },
    REJECTED: { label: 'Property Rejected', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300', icon: AlertTriangle },
    AWAITING_BANK_DETAILS: { label: 'Bank Details Required', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-300', icon: CreditCard },
    BANK_DETAILS_SUBMITTED: { label: 'Bank Details Submitted', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-300', icon: CreditCard },
    BANK_DETAILS_VERIFIED: { label: 'Bank Details Verified', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300', icon: ShieldCheck },
};

export function PropertyStepper({ status, adminNotes }: PropertyStepperProps) {
    const getActiveIndex = (s: string) => {
        if (s === 'DRAFT') return -1;
        if (s === 'PENDING_VERIFICATION') return 0; 
        if (s === 'VERIFYING_DOCUMENTS') return 1; 
        if (s === 'VERIFIED_SUCCESSFULLY') return 2;
        if (s === 'AWAITING_BANK_DETAILS' || s === 'BANK_DETAILS_SUBMITTED') return 3;
        if (s === 'BANK_DETAILS_VERIFIED' || s === 'APPROVED_PENDING_PAYMENT' || s === 'APPROVED_PAYMENT_VERIFIED') return 4;
        if (s === 'APPROVED' || s === 'LIVE') return 5;
        if (s === 'NEEDS_CORRECTION' || s === 'CORRECTED') return 1; 
        if (s === 'REJECTED' || s === 'SUSPENDED') return 0;
        return 0;
    };

    const getStepStatus = (stepIndex: number, activeIndex: number, currentStatus: string) => {
        if (stepIndex < activeIndex) return 'completed';
        if (stepIndex === activeIndex) {
            if ((currentStatus === 'APPROVED' || currentStatus === 'LIVE') && stepIndex === 6) return 'completed'; // Terminal state is completed
            if (currentStatus === 'APPROVED_PAYMENT_VERIFIED' && stepIndex === 5) return 'completed';
            if (currentStatus === 'SUSPENDED' || currentStatus === 'REJECTED') return 'error';
            if (currentStatus === 'NEEDS_CORRECTION' || adminNotes?.includes('[REUPLOAD')) return 'warning';
            return 'active';
        }
        return 'pending';
    };

    const activeIndex = getActiveIndex(status);
    const statusMsg = STATUS_MESSAGES[status];
    const isReupload = status === 'NEEDS_CORRECTION' || adminNotes?.includes('[REUPLOAD');
    const Icon = statusMsg?.icon || Clock;

    return (
        <div className="w-full space-y-8">
            {/* Status Banner - Minimalist Text Style */}
            <div className="flex items-center justify-center py-2 transition-all">
                {isReupload ? (
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-red-600 animate-pulse" />
                        <span className="font-black text-base text-red-800 tracking-tight">Action Required: Document Re-upload Requested</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <Icon className={cn("h-5 w-5", statusMsg?.color)} />
                        <span className={cn("font-black text-base tracking-tight", statusMsg?.color || "text-slate-600")}>
                            {statusMsg?.label || status}
                        </span>
                    </div>
                )}
            </div>

            {/* Stepper */}
            <div className="px-1">
                <div className="flex items-center justify-between relative h-24">
                    {/* Progress Lines Container - Absolutely centered under icons */}
                    <div className="absolute top-5 left-[7.14%] w-[85.71%] h-1.5 -z-10">
                        {/* Background Line */}
                        <div className="absolute inset-0 bg-slate-100 rounded-full shadow-inner" />
                        
                        {/* Progress Line */}
                        <div
                            className="absolute top-0 left-0 h-full bg-emerald-500 transition-all duration-1000 ease-out rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                            style={{ width: `${(Math.min(activeIndex, steps.length - 1) / (steps.length - 1)) * 100}%` }}
                        />
                    </div>

                    {steps.map((step, i) => {
                        const StepIcon = step.icon;
                        const stepStatus = getStepStatus(i, activeIndex, status);

                        return (
                            <div key={step.id} className="flex flex-col items-center flex-1 relative h-full">
                                <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 relative z-20 shadow-sm",
                                    stepStatus === 'completed' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100' :
                                    stepStatus === 'active' ? 'bg-white text-orange-600 ring-4 ring-orange-50 scale-110 animate-pulse' :
                                    stepStatus === 'warning' ? 'bg-orange-500 text-white shadow-md shadow-orange-100 animate-pulse' :
                                    stepStatus === 'error' ? 'bg-red-500 text-white' :
                                    'bg-white text-slate-300 border-2 border-slate-100'
                                )}>
                                    {stepStatus === 'completed' ? (
                                        <Check className="h-6 w-6 stroke-[4] animate-in zoom-in-50 duration-300" />
                                    ) : (
                                        <StepIcon className="h-6 w-6" />
                                    )}
                                    
                                    {stepStatus === 'active' && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-600 rounded-full animate-ping opacity-60 border-2 border-white" />
                                    )}
                                    {stepStatus === 'warning' && (
                                        <AlertTriangle className="absolute -top-2 -right-2 h-6 w-6 text-orange-700 fill-white drop-shadow-sm" />
                                    )}
                                </div>
                                <div className="absolute top-14 left-1/2 -translate-x-1/2 w-[60px] flex flex-col items-center pointer-events-none">
                                    <span className={cn(
                                        "text-[8px] font-black uppercase tracking-tighter text-center leading-[1.1] break-words",
                                        stepStatus === 'active' ? 'text-orange-800 scale-110' :
                                        stepStatus === 'completed' ? 'text-emerald-700 font-bold' :
                                        stepStatus === 'warning' ? 'text-orange-900 border-b border-orange-200' :
                                        stepStatus === 'error' ? 'text-red-700' :
                                        'text-slate-400 opacity-70'
                                    )}>
                                        {step.label}
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


