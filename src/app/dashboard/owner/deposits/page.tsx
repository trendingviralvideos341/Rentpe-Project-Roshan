'use client';

import { useEffect, useState, useTransition } from 'react';
import {
    getOwnerDeposits,
    getOwnerOverdueDepositCount,
    processDepositSettlement,
    type SettlementDeductions
} from '@/actions/ownerRentCollection';
import { toast } from 'sonner';
import {
    Shield, Loader2, X, AlertCircle, Receipt, Printer,
    CheckCircle2, Clock, AlertTriangle, ChevronRight,
    Home, Zap, FileText, DollarSign, Check, Info
} from 'lucide-react';

// ── Status Config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
    PENDING:              { label: 'Pending Collection',  cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    PAID:                 { label: 'Held (Active)',        cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    REFUND_PENDING:       { label: 'Refund Pending',      cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    REFUND_OVERDUE:       { label: '⚠️ Overdue',           cls: 'bg-red-100 text-red-700 border-red-200' },
    REFUNDED:             { label: 'Refunded',             cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    PARTIALLY_REFUNDED:   { label: 'Part Refunded',        cls: 'bg-teal-100 text-teal-700 border-teal-200' },
    FORFEITED:            { label: 'Forfeited',            cls: 'bg-rose-100 text-rose-700 border-rose-200' },
    REFUNDED_VIA_WITHHOLDING: { label: 'Via Withholding', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
};

// ── Receipt Modal ─────────────────────────────────────────────────────────────
function ReceiptModal({ dep, onClose }: { dep: any; onClose: () => void }) {
    const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
    const collectedDate = dep.collectedOn
        ? new Date(dep.collectedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';
    const isPaid = ['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FORFEITED', 'REFUND_OVERDUE'].includes(dep.status);
    const receiptNo = `DEP-${dep.id.slice(-6).toUpperCase()}`;
    const statusLabel = STATUS_CONFIG[dep.status]?.label || dep.status;
    const roomParts = (dep.roomAssigned || '').split('—');
    const roomDisplay = roomParts[0]?.replace(/room/i, '').trim() || dep.roomNumber || '—';
    const bedDisplay = roomParts[1]?.replace(/bed/i, '').trim() || null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md my-4 overflow-y-auto max-h-[92vh] print:shadow-none print:max-h-none animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white relative overflow-hidden print:bg-indigo-700">
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
                    <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full" />
                    <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-xl transition-all z-10 print:hidden">
                        <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3 mb-3 relative z-10">
                        <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-indigo-200">Security Deposit Receipt</p>
                            <p className="font-black text-lg">{receiptNo}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 relative z-10">
                        {isPaid ? (
                            <span className="flex items-center gap-1.5 bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 text-xs font-black px-3 py-1 rounded-full">
                                <CheckCircle2 className="w-3 h-3" /> {statusLabel}
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 bg-amber-500/30 border border-amber-400/40 text-amber-100 text-xs font-black px-3 py-1 rounded-full">
                                <Clock className="w-3 h-3" /> Pending Collection
                            </span>
                        )}
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex gap-3">
                        <div className="flex-1 bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Room</p>
                            <p className="text-sm font-black text-slate-800">{roomDisplay}</p>
                        </div>
                        {bedDisplay && (
                            <div className="flex-1 bg-slate-50 rounded-xl p-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Bed</p>
                                <p className="text-sm font-black text-slate-800">{bedDisplay}</p>
                            </div>
                        )}
                        <div className="flex-1 bg-indigo-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-0.5">Deposit</p>
                            <p className="text-sm font-black text-indigo-800">{fmt(dep.amount)}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Date Collected</p>
                            <p className="text-sm font-black text-slate-700">{collectedDate}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Payment Mode</p>
                            <p className="text-sm font-black text-slate-700">{dep.paymentMethod || '—'}</p>
                        </div>
                    </div>

                    {dep.refundAmount !== null && dep.refundAmount !== undefined && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Refund Processed</p>
                            <p className="font-black text-emerald-700 text-lg">{fmt(dep.refundAmount)}</p>
                            {dep.deductionReason && <p className="text-xs text-emerald-600">{dep.deductionReason}</p>}
                        </div>
                    )}

                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1.5 text-[10px] text-slate-500 leading-relaxed">
                        <p className="font-bold text-slate-700 uppercase tracking-wider text-[9px]">Terms of Deposit Refund</p>
                        <p>1. This deposit is held by the property owner and is refundable at vacating, subject to lease terms.</p>
                        <p>2. Deductions may apply for unpaid utilities, rent arrears, notice period defaults, or damages beyond normal wear and tear.</p>
                        <p>3. Photo sharing and damage assessment is handled directly between owner and tenant. RentPe is a facilitator.</p>
                        <p className="text-[9px] italic text-slate-400 mt-1">Computer-generated receipt. No signature required.</p>
                    </div>

                    <p className="text-center text-[10px] text-slate-300 font-bold tracking-wider uppercase">
                        RentPe Ecosystem • PropTech OS for Modern Living • support@rentpe.in
                    </p>

                    <div className="flex gap-3 print:hidden">
                        <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm rounded-2xl transition-all">
                            <Printer className="w-4 h-4" /> Print / PDF
                        </button>
                        <button onClick={onClose} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl transition-all">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Settlement Wizard ─────────────────────────────────────────────────────────
const STEPS = [
    { id: 1, title: 'Room Inspection', icon: Home },
    { id: 2, title: 'Deduction Breakdown', icon: DollarSign },
    { id: 3, title: 'Confirm & Settle', icon: Check },
];

const INSPECTION_ITEMS = [
    { key: 'walls', label: 'Walls & Paint', icon: '🏠' },
    { key: 'floor', label: 'Flooring', icon: '🪟' },
    { key: 'bathroom', label: 'Bathroom / Plumbing', icon: '🚿' },
    { key: 'furniture', label: 'Furniture & Fixtures', icon: '🪑' },
    { key: 'appliances', label: 'Appliances & Electronics', icon: '📺' },
    { key: 'electrical', label: 'Electrical & Switches', icon: '⚡' },
    { key: 'cleanliness', label: 'General Cleanliness', icon: '🧹' },
];

function SettlementWizard({ dep, onClose, onSuccess }: { dep: any; onClose: () => void; onSuccess: () => void }) {
    const [step, setStep] = useState(1);
    const [inspection, setInspection] = useState<Record<string, 'good' | 'damaged' | 'missing'>>({});
    const [deductions, setDeductions] = useState<SettlementDeductions>({
        damages: 0, utilities: 0, unpaidRent: 0, noticePeriod: 0, other: 0, notes: ''
    });
    const [isPending, startTransition] = useTransition();
    const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

    const totalDed = (deductions.damages || 0) + (deductions.utilities || 0) + (deductions.unpaidRent || 0) + (deductions.noticePeriod || 0) + (deductions.other || 0);
    const refund = Math.max(0, dep.amount - totalDed);
    const hasIssues = Object.values(inspection).some(v => v !== 'good');

    const handleSubmit = () => {
        startTransition(async () => {
            try {
                const action = totalDed === 0 ? 'REFUNDED' : refund > 0 ? 'PARTIALLY_REFUNDED' : 'FORFEITED';
                await processDepositSettlement(dep.id, action, deductions);
                toast.success('Settlement processed successfully! Tenant has been notified via email.');
                onSuccess();
                onClose();
            } catch (e: any) {
                toast.error(e.message || 'Settlement failed. Please try again.');
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl my-4 animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-gradient-to-r from-slate-900 to-indigo-900 p-6 rounded-t-3xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20" />
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-xl transition-all z-10">
                        <X className="w-4 h-4 text-white" />
                    </button>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1">
                            <Shield className="w-5 h-5 text-indigo-300" />
                            <p className="text-xs font-black uppercase tracking-widest text-indigo-300">Settlement Wizard</p>
                        </div>
                        <h2 className="text-xl font-black text-white">{dep.tenantName}</h2>
                        <p className="text-indigo-300 text-sm mt-0.5">Deposit: {fmt(dep.amount)} · Room {dep.roomNumber}</p>
                    </div>
                </div>

                {/* Step Indicators */}
                <div className="px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        {STEPS.map((s, idx) => {
                            const Icon = s.icon;
                            const isActive = step === s.id;
                            const isDone = step > s.id;
                            return (
                                <div key={s.id} className="flex items-center gap-2 flex-1">
                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-indigo-600 text-white' : isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                        {isDone ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                                        <span className="text-xs font-black hidden sm:block">{s.title}</span>
                                    </div>
                                    {idx < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Step Content */}
                <div className="p-6">

                    {/* STEP 1: Room Inspection */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-black text-slate-900 text-base">Room Inspection Checklist</h3>
                                <p className="text-slate-500 text-sm mt-0.5">Mark the condition of each area. Damaged/missing items will help you specify deductions in the next step.</p>
                                <div className="mt-2 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
                                    <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-blue-700">RentPe does not store photos. You may share evidence directly with the tenant via WhatsApp/email if needed.</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {INSPECTION_ITEMS.map(item => {
                                    const val = inspection[item.key] || 'good';
                                    return (
                                        <div key={item.key} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all">
                                            <span className="text-xl w-8">{item.icon}</span>
                                            <p className="flex-1 font-bold text-slate-800 text-sm">{item.label}</p>
                                            <div className="flex gap-1">
                                                {(['good', 'damaged', 'missing'] as const).map(opt => (
                                                    <button
                                                        key={opt}
                                                        onClick={() => setInspection(prev => ({ ...prev, [item.key]: opt }))}
                                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all border ${
                                                            val === opt
                                                                ? opt === 'good' ? 'bg-emerald-500 text-white border-emerald-500'
                                                                : opt === 'damaged' ? 'bg-amber-500 text-white border-amber-500'
                                                                : 'bg-red-500 text-white border-red-500'
                                                                : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                                        }`}
                                                    >
                                                        {opt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {hasIssues && (
                                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-700">You have marked some items as Damaged or Missing. You can specify the deduction amounts in the next step.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 2: Deduction Breakdown */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-black text-slate-900 text-base">Enter Deduction Amounts</h3>
                                <p className="text-slate-500 text-sm mt-0.5">Leave at ₹0 for categories with no deduction. The refund amount is calculated automatically.</p>
                            </div>
                            <div className="space-y-3">
                                {[
                                    { key: 'damages', label: 'Room Damage Deductions', icon: <Home className="w-4 h-4 text-red-500" />, desc: 'Walls, floor, furniture, appliances damage' },
                                    { key: 'utilities', label: 'Unpaid Utility Bills', icon: <Zap className="w-4 h-4 text-amber-500" />, desc: 'Electricity, water, maintenance dues' },
                                    { key: 'unpaidRent', label: 'Unpaid Rent Arrears', icon: <DollarSign className="w-4 h-4 text-orange-500" />, desc: 'Pending rent not cleared' },
                                    { key: 'noticePeriod', label: 'Notice Period Default', icon: <FileText className="w-4 h-4 text-purple-500" />, desc: 'Left without proper notice (as per agreement)' },
                                    { key: 'other', label: 'Other Deductions', icon: <FileText className="w-4 h-4 text-slate-500" />, desc: 'Any other valid deduction' },
                                ].map(field => (
                                    <div key={field.key} className="bg-slate-50 rounded-2xl p-4">
                                        <div className="flex items-start gap-3 mb-2">
                                            <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm">{field.icon}</div>
                                            <div className="flex-1">
                                                <p className="font-black text-slate-800 text-sm">{field.label}</p>
                                                <p className="text-slate-400 text-xs">{field.desc}</p>
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-black text-sm">₹</span>
                                            <input
                                                type="number"
                                                min="0"
                                                max={dep.amount}
                                                value={(deductions as any)[field.key] || ''}
                                                onChange={e => setDeductions(prev => ({ ...prev, [field.key]: parseFloat(e.target.value) || 0 }))}
                                                placeholder="0"
                                                className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Notes to Tenant (Optional)</label>
                                <textarea
                                    rows={2}
                                    value={deductions.notes}
                                    onChange={e => setDeductions(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Any additional explanation for the deductions..."
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-slate-700"
                                />
                            </div>

                            {/* Live Calculation Preview */}
                            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-4">
                                <p className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-3">Live Calculation</p>
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex justify-between"><span className="text-slate-600">Original Deposit</span><span className="font-black text-slate-900">{fmt(dep.amount)}</span></div>
                                    {totalDed > 0 && <div className="flex justify-between"><span className="text-red-500">Total Deductions</span><span className="font-black text-red-600">− {fmt(totalDed)}</span></div>}
                                    <div className="flex justify-between border-t border-indigo-200 pt-2 mt-2">
                                        <span className={`font-black text-base ${refund > 0 ? 'text-emerald-700' : 'text-red-600'}`}>Refund to Tenant</span>
                                        <span className={`font-black text-lg ${refund > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(refund)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Final Confirm */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <h3 className="font-black text-slate-900 text-base">Confirm Settlement</h3>

                            <div className="bg-gradient-to-br from-slate-50 to-indigo-50 rounded-2xl p-5 space-y-3">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center">
                                        <Shield className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-900">{dep.tenantName}</p>
                                        <p className="text-xs text-slate-400">Room {dep.roomNumber}</p>
                                    </div>
                                </div>

                                <table className="w-full text-sm">
                                    <tbody className="space-y-2">
                                        <tr>
                                            <td className="py-1.5 text-slate-500">Original Deposit</td>
                                            <td className="text-right font-black text-slate-900">{fmt(dep.amount)}</td>
                                        </tr>
                                        {(deductions.damages || 0) > 0 && <tr><td className="py-1 text-red-500 text-xs">− Room Damages</td><td className="text-right font-bold text-red-600 text-xs">{fmt(deductions.damages)}</td></tr>}
                                        {(deductions.utilities || 0) > 0 && <tr><td className="py-1 text-red-500 text-xs">− Utilities</td><td className="text-right font-bold text-red-600 text-xs">{fmt(deductions.utilities)}</td></tr>}
                                        {(deductions.unpaidRent || 0) > 0 && <tr><td className="py-1 text-red-500 text-xs">− Unpaid Rent</td><td className="text-right font-bold text-red-600 text-xs">{fmt(deductions.unpaidRent)}</td></tr>}
                                        {(deductions.noticePeriod || 0) > 0 && <tr><td className="py-1 text-red-500 text-xs">− Notice Period</td><td className="text-right font-bold text-red-600 text-xs">{fmt(deductions.noticePeriod)}</td></tr>}
                                        {(deductions.other || 0) > 0 && <tr><td className="py-1 text-red-500 text-xs">− Other</td><td className="text-right font-bold text-red-600 text-xs">{fmt(deductions.other)}</td></tr>}
                                        <tr>
                                            <td colSpan={2}><div className="border-t border-slate-200 my-2" /></td>
                                        </tr>
                                        <tr>
                                            <td className={`font-black text-base ${refund > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                                {refund > 0 ? '✅ Refund to Tenant' : '❌ Forfeited (No Refund)'}
                                            </td>
                                            <td className={`text-right font-black text-xl ${refund > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(refund)}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                {deductions.notes && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-2">
                                        <p className="text-xs text-amber-700"><strong>Your Note:</strong> {deductions.notes}</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
                                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-blue-700">The tenant will receive an email with this breakdown. If they dispute it, they can raise a case from their dashboard within 15 days.</p>
                            </div>

                            {totalDed >= dep.amount && (
                                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-red-700"><strong>Full Forfeiture:</strong> The entire deposit will be forfeited. The tenant will receive ₹0. This action is logged and cannot be undone.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="px-6 pb-6 flex gap-3">
                    {step > 1 && (
                        <button onClick={() => setStep(s => s - 1)} className="flex-1 py-3.5 border-2 border-slate-200 text-slate-700 font-black text-sm rounded-2xl hover:border-slate-300 transition-all">
                            ← Back
                        </button>
                    )}
                    {step < 3 ? (
                        <button onClick={() => setStep(s => s + 1)} className="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm rounded-2xl hover:shadow-lg hover:shadow-indigo-500/25 transition-all">
                            Next Step →
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={isPending}
                            className={`flex-1 py-3.5 font-black text-sm rounded-2xl text-white disabled:opacity-50 transition-all shadow-lg ${
                                refund > 0 ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:shadow-emerald-500/25' : 'bg-gradient-to-r from-red-600 to-rose-600 hover:shadow-red-500/25'
                            }`}
                        >
                            {isPending ? (
                                <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Processing...</span>
                            ) : (
                                refund > 0 ? `✅ Confirm Refund ${fmt(refund)}` : '❌ Confirm Forfeiture'
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DepositsPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [receiptDep, setReceiptDep] = useState<any>(null);
    const [settleDep, setSettleDep] = useState<any>(null);
    const [overdueInfo, setOverdueInfo] = useState<{ count: number; totalAmount: number; deposits: any[] }>({ count: 0, totalAmount: 0, deposits: [] });

    const reload = () => {
        setLoading(true);
        Promise.all([
            getOwnerDeposits(),
            getOwnerOverdueDepositCount(),
        ]).then(([depositsData, overdueData]) => {
            setData(depositsData);
            setOverdueInfo(overdueData);
            setLoading(false);
        });
    };

    useEffect(() => { reload(); }, []);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
    );

    const { deposits, summary } = data;
    const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">

            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-6 pt-10 pb-20 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute -left-10 bottom-0 w-48 h-48 bg-purple-500/20 rounded-full blur-2xl" />
                <div className="max-w-5xl mx-auto relative z-10">
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <Shield className="w-8 h-8" /> Security Deposits
                    </h1>
                    <p className="text-indigo-200 text-sm font-medium mt-1">Manage tenant security deposits · Settle with the 3-step wizard</p>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 -mt-12 relative z-10 space-y-6">

                {/* ⚠️ Overdue Warning Banner — Component 3 */}
                {overdueInfo.count > 0 && (
                    <div className="bg-gradient-to-r from-red-600 to-rose-600 rounded-2xl p-5 shadow-xl shadow-red-500/20 flex items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-black text-base">⚠️ Action Required: Overdue Deposit Refunds</p>
                            <p className="text-red-100 text-sm mt-1">
                                You have <strong>{overdueInfo.count}</strong> overdue deposit refund{overdueInfo.count > 1 ? 's' : ''} totalling <strong>{fmt(overdueInfo.totalAmount)}</strong>.
                                Future rent payouts from RentPe will be adjusted automatically to settle these balances.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {overdueInfo.deposits.slice(0, 3).map((d: any) => (
                                    <span key={d.depositId} className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full border border-white/30">
                                        {d.tenantName} · {fmt(d.amount)}
                                    </span>
                                ))}
                                {overdueInfo.count > 3 && <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full border border-white/30">+{overdueInfo.count - 3} more</span>}
                            </div>
                        </div>
                    </div>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Total Deposits Held', val: fmt(summary.totalHeld), sub: `${deposits.filter((d: any) => d.status === 'PAID').length} active`, color: 'from-blue-500 to-indigo-600' },
                        { label: 'Pending Refund', val: `${summary.refundPending}`, sub: 'need processing', color: 'from-amber-500 to-orange-500' },
                        { label: 'Refunded This Month', val: fmt(summary.refundedThisMonth), sub: 'processed', color: 'from-emerald-500 to-teal-600' },
                    ].map(card => (
                        <div key={card.label} className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100 overflow-hidden relative">
                            <div className={`absolute -right-4 -top-4 w-16 h-16 bg-gradient-to-br ${card.color} rounded-full opacity-10`} />
                            <p className="text-xl md:text-2xl font-black text-slate-900">{card.val}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{card.label}</p>
                            <p className="text-xs text-slate-300 mt-0.5">{card.sub}</p>
                        </div>
                    ))}
                </div>

                {/* Deposits Table */}
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="font-black text-slate-900">All Security Deposits</h2>
                        <span className="text-xs text-slate-400 font-medium">Newest first</span>
                    </div>

                    {deposits.length === 0 ? (
                        <div className="py-16 text-center">
                            <Shield className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                            <p className="font-black text-slate-400">No security deposits found</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/50">
                                            {['#', 'Tenant', 'Room', 'Deposit', 'Date', 'Mode', 'Status', 'Action'].map(h => (
                                                <th key={h} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {deposits.map((dep: any, idx: number) => {
                                            const sc = STATUS_CONFIG[dep.status] || STATUS_CONFIG.PENDING;
                                            const collDate = dep.collectedOn
                                                ? new Date(dep.collectedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                : '—';
                                            return (
                                                <tr key={dep.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-4 py-4 text-xs font-black text-slate-300">#{deposits.length - idx}</td>
                                                    <td className="px-4 py-4">
                                                        <p className="font-black text-slate-900 text-sm">{dep.tenantName}</p>
                                                        <p className="text-xs text-slate-400">{dep.tenantPhone}</p>
                                                        {dep.bookingDisplayId && <p className="text-[10px] font-mono text-slate-300">{dep.bookingDisplayId}</p>}
                                                    </td>
                                                    <td className="px-4 py-4 text-sm font-bold text-slate-600">{dep.roomNumber}</td>
                                                    <td className="px-4 py-4">
                                                        <p className="font-black text-slate-900">₹{dep.amount.toLocaleString('en-IN')}</p>
                                                        {dep.refundAmount != null && <p className="text-xs text-emerald-600">Refund: ₹{dep.refundAmount.toLocaleString('en-IN')}</p>}
                                                    </td>
                                                    <td className="px-4 py-4 text-xs text-slate-500 font-medium whitespace-nowrap">{collDate}</td>
                                                    <td className="px-4 py-4 text-xs font-bold text-slate-500">{dep.paymentMethod || '—'}</td>
                                                    <td className="px-4 py-4">
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase ${sc.cls}`}>{sc.label}</span>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex gap-2 flex-wrap">
                                                            <button
                                                                onClick={() => setReceiptDep(dep)}
                                                                id={`receipt-btn-${dep.id}`}
                                                                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-black rounded-lg hover:bg-indigo-100 transition-all border border-indigo-200 flex items-center gap-1"
                                                            >
                                                                <Receipt className="w-3 h-3" /> Receipt
                                                            </button>
                                                            {dep.status === 'PAID' && (
                                                                <button
                                                                    onClick={() => setSettleDep(dep)}
                                                                    id={`settle-btn-${dep.id}`}
                                                                    className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-black rounded-lg hover:shadow-lg hover:shadow-emerald-500/25 transition-all flex items-center gap-1"
                                                                >
                                                                    <Check className="w-3 h-3" /> Settle
                                                                </button>
                                                            )}
                                                            {dep.status === 'REFUND_OVERDUE' && (
                                                                <button
                                                                    onClick={() => setSettleDep(dep)}
                                                                    id={`overdue-settle-btn-${dep.id}`}
                                                                    className="px-3 py-1.5 bg-gradient-to-r from-red-600 to-rose-600 text-white text-xs font-black rounded-lg hover:shadow-lg transition-all flex items-center gap-1 animate-pulse"
                                                                >
                                                                    <AlertTriangle className="w-3 h-3" /> Settle Now
                                                                </button>
                                                            )}
                                                            {['REFUNDED', 'PARTIALLY_REFUNDED', 'FORFEITED', 'REFUNDED_VIA_WITHHOLDING'].includes(dep.status) && (
                                                                <span className="text-xs text-slate-400 font-medium self-center">Processed ✓</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="md:hidden divide-y divide-slate-100">
                                {deposits.map((dep: any, idx: number) => {
                                    const sc = STATUS_CONFIG[dep.status] || STATUS_CONFIG.PENDING;
                                    const collDate = dep.collectedOn
                                        ? new Date(dep.collectedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                        : '—';
                                    return (
                                        <div key={dep.id} className="p-4 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-black text-slate-900">{dep.tenantName}</p>
                                                    <p className="text-xs text-slate-400">Room {dep.roomNumber} · {collDate}</p>
                                                    {dep.paymentMethod && <p className="text-xs text-slate-400">{dep.paymentMethod}</p>}
                                                </div>
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${sc.cls} h-fit`}>{sc.label}</span>
                                            </div>
                                            <p className="font-black text-slate-800 text-lg">₹{dep.amount.toLocaleString('en-IN')}</p>
                                            <div className="flex gap-2 flex-wrap">
                                                <button onClick={() => setReceiptDep(dep)} id={`mob-receipt-${dep.id}`} className="flex-1 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-200 text-xs font-black rounded-xl flex items-center justify-center gap-1">
                                                    <Receipt className="w-3 h-3" /> Receipt
                                                </button>
                                                {(dep.status === 'PAID' || dep.status === 'REFUND_OVERDUE') && (
                                                    <button onClick={() => setSettleDep(dep)} id={`mob-settle-${dep.id}`} className={`flex-1 py-2.5 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1 ${dep.status === 'REFUND_OVERDUE' ? 'bg-gradient-to-r from-red-600 to-rose-600' : 'bg-gradient-to-r from-emerald-600 to-teal-600'}`}>
                                                        <Check className="w-3 h-3" /> {dep.status === 'REFUND_OVERDUE' ? 'Settle Now!' : 'Settle'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Modals */}
            {receiptDep && <ReceiptModal dep={receiptDep} onClose={() => setReceiptDep(null)} />}
            {settleDep && (
                <SettlementWizard
                    dep={settleDep}
                    onClose={() => setSettleDep(null)}
                    onSuccess={reload}
                />
            )}
        </div>
    );
}
