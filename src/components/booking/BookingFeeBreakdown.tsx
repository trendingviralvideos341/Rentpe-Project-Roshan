"use client";

import { AlertTriangle, Info, Receipt } from "lucide-react";

interface BookingFeeBreakdownProps {
    rent: number;
    depositAmount: number;
    depositMonths: number;
    platformFee: number;
    tokenAmount?: number;
    showGstNote?: boolean;
}

export function BookingFeeBreakdown({
    rent, depositAmount, depositMonths, platformFee, tokenAmount, showGstNote = true
}: BookingFeeBreakdownProps) {
    const totalPayable = rent + depositAmount + (tokenAmount || 0);

    return (
        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-950 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-300" />
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300">Payment Breakdown</span>
            </div>

            {/* Breakdown */}
            <div className="px-4 py-3 space-y-2.5">
                {/* Rent */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-800">Monthly Rent</p>
                        <p className="text-[10px] text-slate-400">First month payment</p>
                    </div>
                    <span className="text-sm font-black text-slate-900">₹{rent.toLocaleString('en-IN')}</span>
                </div>

                {/* Security Deposit */}
                <div className="flex items-center justify-between border-t border-dashed border-slate-100 pt-2.5">
                    <div>
                        <p className="text-sm font-bold text-emerald-700">Security Deposit</p>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">{depositMonths} Month{depositMonths > 1 ? 's' : ''} Rent</span>
                            <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">✓ Refundable</span>
                        </div>
                    </div>
                    <span className="text-sm font-black text-emerald-700">₹{depositAmount.toLocaleString('en-IN')}</span>
                </div>

                {/* Token Amount if applicable */}
                {tokenAmount && tokenAmount > 0 && (
                    <div className="flex items-center justify-between border-t border-dashed border-slate-100 pt-2.5">
                        <div>
                            <p className="text-sm font-bold text-blue-700">Token Amount</p>
                            <span className="text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">✗ Non-refundable</span>
                        </div>
                        <span className="text-sm font-black text-blue-700">₹{tokenAmount.toLocaleString('en-IN')}</span>
                    </div>
                )}



                {/* Total */}
                <div className="border-t-2 border-slate-900 pt-3 mt-1 flex items-center justify-between">
                    <div>
                        <p className="text-base font-black text-slate-900">Total Payable Now</p>
                        <p className="text-[10px] text-slate-400">Inclusive of all charges</p>
                    </div>
                    <span className="text-xl font-black text-slate-900">₹{totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
            </div>

            {/* Notices */}
            <div className="px-4 pb-4 space-y-2">
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                    <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-emerald-700 font-semibold leading-relaxed">
                        <strong>Deposit is refundable</strong> within 30 days of vacating. Deductions only for documented property damage — not normal wear & tear. (Model Tenancy Act 2021)
                    </p>
                </div>

                {showGstNote && (
                    <div className="flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-xl p-3">
                        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                            PG accommodation rent may be GST-exempt if monthly rent ≤ ₹20,000 and stay ≥ 90 days (CBIC Circular, effective July 15, 2024). Convenience fees attract 18% GST separately.
                            <br />
                            <em>Convenience fee may vary from time to time. Updated charges will be communicated 7 days in advance.</em>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
