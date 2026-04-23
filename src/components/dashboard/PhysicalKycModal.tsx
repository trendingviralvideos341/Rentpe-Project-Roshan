"use client";

import { useState } from "react";
import { AlertTriangle, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PhysicalKycModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    tenantName: string;
}

export function PhysicalKycModal({ isOpen, onClose, onConfirm, tenantName }: PhysicalKycModalProps) {
    const [confirming, setConfirming] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setConfirming(true);
        try {
            await onConfirm();
        } finally {
            setConfirming(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 pt-6 pb-5 text-white relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-white/20 rounded-xl">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-black tracking-tight">Physical Verification Reminder</h2>
                    </div>
                    <p className="text-white/80 text-sm font-medium">For: <strong className="text-white">{tenantName}</strong></p>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    <p className="text-sm font-bold text-slate-700">Before confirming check-in, please ensure you have:</p>

                    <ul className="space-y-2.5">
                        {[
                            "Verified the tenant's original government-issued ID\n(Aadhaar / Passport / Driving Licence / Pan Card)",
                            "Collected a physical copy or photo of their ID",
                            "Completed local police tenant verification (Form C)\nas required by your state",
                            "Confirmed tenant details match your records",
                        ].map((item, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                                <span className="w-5 h-5 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                                    {i + 1}
                                </span>
                                <span className="leading-relaxed whitespace-pre-line">{item}</span>
                            </li>
                        ))}
                    </ul>

                    {/* Disclaimer */}
                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-700 leading-relaxed font-medium">
                            <strong>⚠️ PG / Hostel tenant verification is the sole responsibility of the property owner/operator</strong> as per local government and police regulations. <strong>RentPe is a technology facilitator only</strong> and holds no liability for verification compliance.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex gap-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 h-12 rounded-2xl font-bold border-2 border-slate-200 text-slate-600 hover:bg-slate-50"
                        disabled={confirming}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={confirming}
                        className="flex-1 h-12 rounded-2xl font-black bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-100 disabled:opacity-50 text-xs"
                    >
                        {confirming ? (
                            <span className="flex items-center gap-2">
                                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                Confirming...
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4" />
                                Yes, I have verified — Confirm Check In
                            </span>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
