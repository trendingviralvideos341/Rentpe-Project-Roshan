'use client';

import { Check, Clock, Shield, CreditCard, FileText, UserCheck, Home, AlertCircle } from "lucide-react";

interface BookingStepperProps {
    status: string;
    reservationExpiresAt?: string | null;
}

const steps = [
    { id: 'REQUESTED', label: 'Requested', icon: Clock, desc: 'Awaiting owner review' },
    { id: 'TOKEN', label: 'Token Pay', icon: CreditCard, desc: 'Pay token to reserve' },
    { id: 'RESERVED', label: 'Room Reserved', icon: Home, desc: 'Room locked for you' },
    { id: 'KYC', label: 'KYC Verify', icon: UserCheck, desc: 'Upload documents' },
    { id: 'AGREEMENT', label: 'Agreement', icon: FileText, desc: 'Sign rental agreement' },
    { id: 'CONFIRMED', label: 'Confirmed', icon: Check, desc: 'Booking confirmed!' },
];

const STATUS_MESSAGES: Record<string, { label: string; color: string; bg: string; border: string }> = {
    PENDING_APPROVAL: { label: '⏳ Awaiting Owner Approval', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300' },
    WAITLISTED: { label: '📋 You\'re on the Waitlist', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-300' },
    APPROVED_PENDING_TOKEN: { label: '💳 Action Required: Pay Token to Reserve Room', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-400' },
    ROOM_RESERVED: { label: '🏠 Room Reserved — Upload KYC Documents', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-300' },
    KYC_PENDING: { label: '📄 KYC Pending — Please Upload Your Documents', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300' },
    KYC_FAILED: { label: '❌ KYC Failed — Please Re-upload Documents', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-400' },
    AGREEMENT_PENDING: { label: '✍️ Please Sign Your Rental Agreement', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-400' },
    BOOKING_CONFIRMED: { label: '✅ Booking Confirmed! Get Ready to Move In', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300' },
    CHECKED_IN: { label: '🏡 You\'re Checked In — Welcome Home!', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-300' },
    REJECTED: { label: '❌ Booking Rejected', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300' },
    CANCELLED: { label: '🚫 Booking Cancelled', color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-300' },
    EXPIRED: { label: '⏰ Reservation Expired — Please Re-apply', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-400' },
    // Legacy support
    APPROVED_KYC_PENDING: { label: '📄 Upload KYC Documents', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300' },
    PAID: { label: '✅ Payment Complete', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300' },
    CASH_PAID: { label: '✅ Cash Payment Recorded', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300' },
};

export function BookingStepper({ status, reservationExpiresAt }: BookingStepperProps) {
    const getActiveIndex = (s: string) => {
        if (s === 'PENDING_APPROVAL' || s === 'WAITLISTED') return 0;
        if (s === 'APPROVED_PENDING_TOKEN') return 1;
        if (s === 'ROOM_RESERVED' || s === 'TOKEN_PAID') return 2;
        if (s === 'KYC_PENDING' || s === 'KYC_FAILED' || s === 'APPROVED_KYC_PENDING' || s === 'APPROVED_PAYMENT_PENDING' || s === 'PAID' || s === 'CASH_PAID') return 3;
        if (s === 'AGREEMENT_PENDING' || s === 'KYC_VERIFIED') return 4;
        if (s === 'BOOKING_CONFIRMED' || s === 'CONFIRMED' || s === 'CHECKED_IN') return 5;
        return 0;
    };

    const getStepStatus = (stepIndex: number, activeIndex: number, status: string) => {
        if (stepIndex < activeIndex) return 'completed';
        if (stepIndex === activeIndex) {
            if (status === 'KYC_FAILED') return 'error';
            if (status === 'REJECTED' || status === 'EXPIRED' || status === 'CANCELLED') return 'error';
            return 'active';
        }
        return 'pending';
    };

    const activeIndex = getActiveIndex(status);
    const statusMsg = STATUS_MESSAGES[status];

    // Reservation countdown
    let countdown = '';
    if (reservationExpiresAt && (status === 'ROOM_RESERVED' || status === 'KYC_PENDING')) {
        const expiry = new Date(reservationExpiresAt);
        const now = new Date();
        const diff = Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        countdown = diff > 0 ? `${diff} day${diff !== 1 ? 's' : ''} left to complete KYC` : 'KYC deadline passed!';
    }

    const isTerminal = ['REJECTED', 'CANCELLED', 'EXPIRED'].includes(status);

    return (
        <div className="w-full space-y-4">
            {/* Status Banner */}
            {statusMsg && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 ${statusMsg.bg} ${statusMsg.border}`}>
                    <span className={`font-bold text-sm ${statusMsg.color}`}>{statusMsg.label}</span>
                    {countdown && (
                        <span className="ml-auto text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {countdown}
                        </span>
                    )}
                </div>
            )}

            {/* Stepper */}
            {!isTerminal && (
                <div className="w-full py-4">
                    <div className="flex items-center justify-between relative">
                        {/* Background line */}
                        <div className="absolute top-5 left-0 w-full h-0.5 bg-gray-200 -z-10" />
                        {/* Progress line */}
                        <div
                            className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-purple-600 to-indigo-600 transition-all duration-700 -z-10"
                            style={{ width: activeIndex >= steps.length - 1 ? '100%' : `${(activeIndex / (steps.length - 1)) * 100}%` }}
                        />

                        {steps.map((step, i) => {
                            const Icon = step.icon;
                            const stepStatus = getStepStatus(i, activeIndex, status);

                            return (
                                <div key={step.id} className="flex flex-col items-center gap-2 group min-w-[60px]">
                                    <div className={`
                                        w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 relative
                                        ${stepStatus === 'completed' ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-200' :
                                            stepStatus === 'active' ? 'bg-white border-purple-600 text-purple-600 shadow-md scale-110 ring-4 ring-purple-100' :
                                            stepStatus === 'error' ? 'bg-red-500 border-red-500 text-white' :
                                            'bg-white border-gray-200 text-gray-300'}
                                    `}>
                                        {stepStatus === 'completed' ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                                        {stepStatus === 'active' && (
                                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-purple-600 rounded-full animate-ping opacity-60" />
                                        )}
                                    </div>
                                    <span className={`text-[9px] font-black uppercase tracking-tight text-center max-w-[60px] leading-tight
                                        ${stepStatus === 'active' ? 'text-purple-700' :
                                          stepStatus === 'completed' ? 'text-purple-600' :
                                          stepStatus === 'error' ? 'text-red-600' :
                                          'text-gray-400'}`}>
                                        {step.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
