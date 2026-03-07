'use client';

import { Check, Clock, Shield, CreditCard, FileText, UserCheck } from "lucide-react";

interface BookingStepperProps {
    status: string;
}

const steps = [
    { id: 'RES_PENDING', label: 'Requested', icon: Clock },
    { id: 'KYC', label: 'KYC Verify', icon: UserCheck },
    { id: 'AGREEMENT', label: 'Agreement', icon: FileText },
    { id: 'CONFIRMED', label: 'Confirmed', icon: Check },
];

export function BookingStepper({ status }: BookingStepperProps) {
    // Determine active index based on complex status mapping
    const getActiveIndex = (s: string) => {
        if (s === 'PENDING_APPROVAL' || s === 'RES_PENDING') return 0;
        if (s === 'KYC_PENDING' || s === 'KYC_UNDER_REVIEW' || s === 'APPROVED_KYC_PENDING' || s === 'APPROVED_PAYMENT_PENDING' || s === 'TOKEN_PAYMENT_PENDING' || s === 'RESERVED' || s === 'PAID' || s === 'CASH_PAID') return 1;
        if (s === 'AGREEMENT_PENDING') return 2;
        if (s === 'CONFIRMED' || s === 'CHECKED_IN') return 3;
        return 0;
    };

    const activeIndex = getActiveIndex(status);

    return (
        <div className="w-full py-6">
            <div className="flex items-center justify-between relative">
                {/* Connector Line */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 -translate-y-1/2 -z-10" />
                <div
                    className="absolute top-1/2 left-0 h-0.5 bg-purple-600 transition-all duration-500 -translate-y-1/2 -z-10"
                    style={{ width: `${(activeIndex / (steps.length - 1)) * 100}%` }}
                />

                {steps.map((step, i) => {
                    const Icon = step.icon;
                    const isCompleted = i < activeIndex;
                    const isActive = i === activeIndex;

                    return (
                        <div key={step.id} className="flex flex-col items-center group">
                            <div
                                className={`
                                    w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                                    ${isCompleted ? 'bg-purple-600 border-purple-600 text-white shadow-lg' :
                                        isActive ? 'bg-white border-purple-600 text-purple-600 shadow-md scale-110' :
                                            'bg-white border-gray-300 text-gray-400'}
                                `}
                            >
                                {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                            </div>
                            <span
                                className={`
                                    absolute -bottom-6 text-[10px] font-bold uppercase tracking-tighter whitespace-nowrap transition-colors
                                    ${isActive ? 'text-purple-700' : isCompleted ? 'text-purple-600' : 'text-gray-400'}
                                `}
                            >
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
