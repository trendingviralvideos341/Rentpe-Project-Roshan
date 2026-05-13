'use client';

import { useState, useTransition } from 'react';
import {
    X, IndianRupee, Receipt, Home, AlertTriangle,
    ChevronRight, Plus, Trash2, CheckCircle, Loader2
} from 'lucide-react';
import { initiateMoveOut } from '@/actions/tenants';
import { toast } from 'sonner';

interface DeductionLine {
    id: string;
    description: string;
    amount: string;
}

interface Props {
    tenant: any;
    onClose: () => void;
    onSuccess: () => void;
}

/** Calculate pro-rata rent for the final (partial) month */
function calcProRata(monthlyRent: number, moveOutDay: number): number {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return Math.round((monthlyRent / daysInMonth) * moveOutDay);
}

/** Parse rent amount safely */
function parseRent(rent: any): number {
    if (typeof rent === 'number') return rent;
    return parseFloat(String(rent).replace(/[^0-9.]/g, '')) || 0;
}

export function SettlementModal({ tenant, onClose, onSuccess }: Props) {
    const [step, setStep] = useState<1 | 2 | 3>(1); // 1=summary, 2=deductions, 3=receipt
    const [deductions, setDeductions] = useState<DeductionLine[]>([]);
    const [notes, setNotes] = useState('');
    const [isPending, startTransition] = useTransition();

    const today = new Date();
    const moveOutDay = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const monthlyRent = parseRent(tenant.rentAmount ?? tenant.rent);

    // Current month rent record
    const currentMonthLabel = today.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    const currentMonthRecord = tenant.rentRecords?.find((r: any) => r.month === currentMonthLabel);
    const isCurrentMonthPaid = currentMonthRecord?.paid ?? false;

    // Pro-rata: only charge for days stayed this month
    const proRataRent = calcProRata(monthlyRent, moveOutDay);

    // Unpaid previous months (excluding current month)
    const prevUnpaidRent = (tenant.rentRecords || [])
        .filter((r: any) => r.month !== currentMonthLabel && !r.paid)
        .reduce((acc: number, r: any) => acc + (Number(r.amount) || 0), 0);

    // Security deposit (assume 1 month rent if not available from billing profile)
    const securityDeposit = monthlyRent;

    // Total deduction amount
    const totalDeductionAmt = deductions.reduce((acc, d) => acc + (parseFloat(d.amount) || 0), 0);

    // What tenant owes for this month
    const thisMonthOwed = isCurrentMonthPaid ? 0 : proRataRent;

    // Total tenant owes
    const totalTenantOwes = prevUnpaidRent + thisMonthOwed;

    // Net refund after deducting from security deposit
    const netRefund = securityDeposit - totalTenantOwes - totalDeductionAmt;

    // net > 0 → owner pays tenant | net < 0 → tenant pays owner | net = 0 → clear
    const ownerPaysRefund = netRefund > 0;
    const tenantOwesMore = netRefund < 0;
    const cleared = netRefund === 0;

    const addDeduction = () => setDeductions(prev => [...prev, {
        id: Date.now().toString(),
        description: '',
        amount: ''
    }]);

    const removeDeduction = (id: string) =>
        setDeductions(prev => prev.filter(d => d.id !== id));

    const updateDeduction = (id: string, field: 'description' | 'amount', val: string) =>
        setDeductions(prev => prev.map(d => d.id === id ? { ...d, [field]: val } : d));

    const handleFinalize = () => {
        if (!notes.trim()) { toast.error('Please add a settlement note.'); return; }
        const totalDeductions = totalDeductionAmt;
        const combinedNote = [
            notes,
            deductions.length > 0 ? `Deductions: ${deductions.map(d => `${d.description} ₹${d.amount}`).join(', ')}` : '',
        ].filter(Boolean).join(' | ');

        startTransition(async () => {
            try {
                await initiateMoveOut(tenant.id, totalDeductions + totalTenantOwes, combinedNote);
                toast.success('Move-out finalized. Room is now available.');
                setStep(3);
                onSuccess();
            } catch (e: any) {
                toast.error(e.message || 'Failed to finalize move-out.');
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="bg-white w-full md:max-w-lg md:rounded-3xl rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                    <div>
                        <h2 className="font-black text-slate-900 text-lg">Move-Out & Settlement</h2>
                        <p className="text-xs text-slate-500 mt-0.5">{tenant.name} · {tenant.roomNumber}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Step indicators */}
                <div className="flex items-center gap-0 border-b border-slate-100 shrink-0">
                    {['Summary', 'Deductions', 'Finalize'].map((s, i) => (
                        <div key={s} className={`flex-1 py-2.5 text-center text-[10px] font-black uppercase tracking-widest transition-all ${
                            step === i + 1 ? 'bg-indigo-600 text-white' : step > i + 1 ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400 bg-white'
                        }`}>
                            {i + 1}. {s}
                        </div>
                    ))}
                </div>

                {/* Scrollable content */}
                <div className="overflow-y-auto flex-1 p-5 space-y-4">

                    {/* ── STEP 1: Summary ── */}
                    {step === 1 && (
                        <>
                            {/* Rent this month */}
                            <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Rent — {currentMonthLabel}</p>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600">Full month rent</span>
                                    <span className="font-black text-slate-900">₹{monthlyRent.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600">Days stayed this month <span className="text-indigo-600 font-bold">({moveOutDay}/{daysInMonth} days)</span></span>
                                    <span className="font-black text-indigo-700">₹{proRataRent.toLocaleString('en-IN')}</span>
                                </div>
                                <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${isCurrentMonthPaid ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                                    <span className="text-xs font-black">{isCurrentMonthPaid ? '✅ Rent Paid (pro-rata will be refunded)' : '⚠️ Pro-rata rent due'}</span>
                                    <span className={`font-black text-sm ${isCurrentMonthPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                                        {isCurrentMonthPaid ? `-₹${(monthlyRent - proRataRent).toLocaleString('en-IN')}` : `₹${proRataRent.toLocaleString('en-IN')}`}
                                    </span>
                                </div>
                            </div>

                            {/* Previous unpaid rent */}
                            {prevUnpaidRent > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                                    <p className="text-xs font-black uppercase tracking-widest text-red-500 mb-2">Previous Unpaid Rent</p>
                                    {(tenant.rentRecords || []).filter((r: any) => r.month !== currentMonthLabel && !r.paid).map((r: any) => (
                                        <div key={r.id} className="flex justify-between text-sm">
                                            <span className="text-red-700">{r.month}</span>
                                            <span className="font-black text-red-900">₹{Number(r.amount).toLocaleString('en-IN')}</span>
                                        </div>
                                    ))}
                                    <div className="border-t border-red-200 mt-2 pt-2 flex justify-between text-sm font-black text-red-800">
                                        <span>Total Unpaid</span>
                                        <span>₹{prevUnpaidRent.toLocaleString('en-IN')}</span>
                                    </div>
                                </div>
                            )}

                            {/* Security deposit */}
                            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                                <p className="text-xs font-black uppercase tracking-widest text-indigo-500 mb-2">Security Deposit</p>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-indigo-700">Auto-fetched from billing profile</span>
                                    <span className="font-black text-indigo-900 text-lg">₹{securityDeposit.toLocaleString('en-IN')}</span>
                                </div>
                                <p className="text-[10px] text-indigo-400 mt-1">= 1 month rent. Deductions will be applied below.</p>
                            </div>

                            {/* Preliminary total */}
                            <div className="bg-slate-900 rounded-2xl p-4 space-y-2">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Preliminary Settlement</p>
                                <div className="flex justify-between text-sm text-slate-300">
                                    <span>Security Deposit</span>
                                    <span>+ ₹{securityDeposit.toLocaleString('en-IN')}</span>
                                </div>
                                {totalTenantOwes > 0 && (
                                    <div className="flex justify-between text-sm text-red-400">
                                        <span>Rent Dues</span>
                                        <span>- ₹{totalTenantOwes.toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                {isCurrentMonthPaid && (
                                    <div className="flex justify-between text-sm text-emerald-400">
                                        <span>Over-paid rent (refund)</span>
                                        <span>+ ₹{(monthlyRent - proRataRent).toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                <div className="border-t border-slate-700 pt-2 flex justify-between font-black">
                                    <span className="text-white">Before Deductions</span>
                                    <span className={`text-lg ${netRefund >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {netRefund >= 0 ? '+' : '-'}₹{Math.abs(netRefund).toLocaleString('en-IN')}
                                    </span>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── STEP 2: Deductions ── */}
                    {step === 2 && (
                        <>
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-sm text-amber-800 font-medium">
                                    Add any damage deductions or charges to be applied against the security deposit. Leave empty if none.
                                </p>
                            </div>

                            <div className="space-y-3">
                                {deductions.map((d, i) => (
                                    <div key={d.id} className="flex gap-2 items-start bg-slate-50 rounded-2xl p-3">
                                        <div className="flex-1 space-y-2">
                                            <input
                                                placeholder={`e.g. Broken AC, Wall damage...`}
                                                value={d.description}
                                                onChange={e => updateDeduction(d.id, 'description', e.target.value)}
                                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                            />
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-slate-500">₹</span>
                                                <input
                                                    type="number"
                                                    placeholder="Amount"
                                                    value={d.amount}
                                                    onChange={e => updateDeduction(d.id, 'amount', e.target.value)}
                                                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                />
                                            </div>
                                        </div>
                                        <button onClick={() => removeDeduction(d.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl mt-1">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={addDeduction}
                                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-sm font-black text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-4 h-4" /> Add Deduction
                                </button>
                            </div>

                            {/* Settlement notes */}
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Settlement Note *</label>
                                <textarea
                                    rows={3}
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="e.g. Room vacated in good condition. Security deposit refunded after deductions."
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                                />
                            </div>

                            {/* Final settlement summary */}
                            <div className="bg-slate-900 rounded-2xl p-4 space-y-2">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Final Settlement</p>
                                <div className="flex justify-between text-sm text-slate-300">
                                    <span>Security Deposit</span>
                                    <span>₹{securityDeposit.toLocaleString('en-IN')}</span>
                                </div>
                                {totalTenantOwes > 0 && (
                                    <div className="flex justify-between text-sm text-red-400">
                                        <span>Rent Dues</span>
                                        <span>- ₹{totalTenantOwes.toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                {isCurrentMonthPaid && (
                                    <div className="flex justify-between text-sm text-emerald-400">
                                        <span>Rent Overpay Refund</span>
                                        <span>+ ₹{(monthlyRent - proRataRent).toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                {totalDeductionAmt > 0 && (
                                    <div className="flex justify-between text-sm text-amber-400">
                                        <span>Deductions ({deductions.length} items)</span>
                                        <span>- ₹{totalDeductionAmt.toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                <div className="border-t border-slate-700 pt-2 flex justify-between font-black">
                                    <span className="text-white">
                                        {ownerPaysRefund ? '🏦 Refund to Tenant' : tenantOwesMore ? '💰 Tenant Owes' : '✅ Settlement Cleared'}
                                    </span>
                                    <span className={`text-xl ${ownerPaysRefund ? 'text-emerald-400' : tenantOwesMore ? 'text-red-400' : 'text-slate-400'}`}>
                                        ₹{Math.abs(netRefund).toLocaleString('en-IN')}
                                    </span>
                                </div>

                                {ownerPaysRefund && (
                                    <div className="bg-emerald-900/30 rounded-xl p-2.5 mt-1">
                                        <p className="text-[10px] text-emerald-300 font-medium">
                                            💡 Refund Info: For refunds, you (owner) will initiate a transfer to the tenant&apos;s bank account / UPI ID. Tenant&apos;s registered UPI: <strong>{tenant.phone}</strong> (collect bank details if UPI not available).
                                        </p>
                                    </div>
                                )}
                                {tenantOwesMore && (
                                    <div className="bg-red-900/30 rounded-xl p-2.5 mt-1">
                                        <p className="text-[10px] text-red-300 font-medium">
                                            ⚠️ After finalizing, a payment request will be sent to the tenant to pay ₹{Math.abs(netRefund).toLocaleString('en-IN')} before move-out is confirmed.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* ── STEP 3: Receipt ── */}
                    {step === 3 && (
                        <div className="text-center space-y-5 py-4">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle className="w-8 h-8 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900">Move-Out Complete!</h3>
                                <p className="text-sm text-slate-500 mt-1">Room is now released and marked as available.</p>
                            </div>

                            {/* Receipt Summary */}
                            <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-3 border border-slate-200">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Settlement Receipt</p>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Tenant</span>
                                    <span className="font-black text-slate-900">{tenant.name}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Room</span>
                                    <span className="font-black text-slate-900">{tenant.roomNumber}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Move-out Date</span>
                                    <span className="font-black text-slate-900">{today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Security Deposit</span>
                                    <span className="font-black">₹{securityDeposit.toLocaleString('en-IN')}</span>
                                </div>
                                {totalTenantOwes > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Rent Dues Adjusted</span>
                                        <span className="font-black text-red-600">- ₹{totalTenantOwes.toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                {totalDeductionAmt > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Deductions</span>
                                        <span className="font-black text-amber-600">- ₹{totalDeductionAmt.toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                <div className="border-t border-slate-200 pt-2 flex justify-between font-black">
                                    <span>{ownerPaysRefund ? 'Refund to Tenant' : tenantOwesMore ? 'Tenant Owes' : 'Cleared'}</span>
                                    <span className={ownerPaysRefund ? 'text-emerald-700' : tenantOwesMore ? 'text-red-700' : 'text-slate-600'}>
                                        ₹{Math.abs(netRefund).toLocaleString('en-IN')}
                                    </span>
                                </div>
                                {deductions.length > 0 && (
                                    <div className="border-t border-slate-200 pt-2 space-y-1">
                                        <p className="text-[10px] font-black uppercase text-slate-400">Deduction Breakdown</p>
                                        {deductions.map((d, i) => (
                                            <div key={d.id} className="flex justify-between text-xs text-slate-600">
                                                <span>{d.description || `Item ${i + 1}`}</span>
                                                <span>₹{(parseFloat(d.amount) || 0).toLocaleString('en-IN')}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {ownerPaysRefund && (
                                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-left">
                                    <p className="text-xs font-black text-blue-700 uppercase tracking-widest mb-1">🏦 Next Step: Process Refund</p>
                                    <p className="text-sm text-blue-800">
                                        Transfer <strong>₹{netRefund.toLocaleString('en-IN')}</strong> to tenant via UPI/bank transfer using their registered phone number <strong>{tenant.phone}</strong>.
                                    </p>
                                    <p className="text-[10px] text-blue-500 mt-1">Tip: Ask the tenant to share their UPI ID or bank details if not yet collected.</p>
                                </div>
                            )}
                            {tenantOwesMore && (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left">
                                    <p className="text-xs font-black text-amber-700 uppercase tracking-widest mb-1">💰 Payment Request Sent</p>
                                    <p className="text-sm text-amber-800">
                                        The tenant will receive a payment request for <strong>₹{Math.abs(netRefund).toLocaleString('en-IN')}</strong> in their Vacating Notice dashboard.
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={onClose}
                                className="w-full py-3 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all"
                            >
                                Done ✓
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer navigation */}
                {step < 3 && (
                    <div className="px-5 pb-5 pt-3 border-t border-slate-100 shrink-0 flex gap-3">
                        {step > 1 && (
                            <button
                                onClick={() => setStep(prev => (prev - 1) as any)}
                                className="px-5 py-3 rounded-2xl border border-slate-200 font-black text-sm text-slate-600 hover:bg-slate-50 transition-all"
                            >
                                ← Back
                            </button>
                        )}
                        {step === 1 && (
                            <button
                                onClick={() => setStep(2)}
                                className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                            >
                                Add Deductions & Finalize <ChevronRight className="w-4 h-4" />
                            </button>
                        )}
                        {step === 2 && (
                            <button
                                onClick={handleFinalize}
                                disabled={isPending || !notes.trim()}
                                className="flex-1 py-3 bg-gradient-to-r from-rose-600 to-orange-600 text-white font-black text-sm rounded-2xl disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-200"
                            >
                                {isPending
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                                    : <><Home className="w-4 h-4" /> Finalize & Vacate</>
                                }
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
