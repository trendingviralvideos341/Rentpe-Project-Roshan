'use client';

import { useState, useTransition } from 'react';
import { X, Home, AlertTriangle, ChevronRight, Plus, Trash2, CheckCircle, Loader2, Banknote, CreditCard, FileDown, Eye, Printer } from 'lucide-react';
import { initiateMoveOut } from '@/actions/tenants';
import { toast } from 'sonner';

interface DeductionLine { id: string; description: string; amount: string; }
interface Props { tenant: any; onClose: () => void; onSuccess: () => void; }

function calcProRata(monthlyRent: number, moveOutDay: number): number {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return Math.round((monthlyRent / daysInMonth) * moveOutDay);
}
function parseRent(rent: any): number {
    if (typeof rent === 'number') return rent;
    return parseFloat(String(rent).replace(/[^0-9.]/g, '')) || 0;
}

export function SettlementModal({ tenant, onClose, onSuccess }: Props) {
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
    const [deductions, setDeductions] = useState<DeductionLine[]>([]);
    const [notes, setNotes] = useState('');
    const [isPending, startTransition] = useTransition();
    const [showPdf, setShowPdf] = useState(false);

    const today = new Date();
    const moveOutDay = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const monthlyRent = parseRent(tenant.rentAmount ?? tenant.rent);
    const currentMonthLabel = today.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    const currentMonthRecord = tenant.rentRecords?.find((r: any) => r.month === currentMonthLabel);
    const isCurrentMonthPaid = currentMonthRecord?.paid ?? false;
    const proRataRent = calcProRata(monthlyRent, moveOutDay);
    const prevUnpaidRent = (tenant.rentRecords || [])
        .filter((r: any) => r.month !== currentMonthLabel && !r.paid)
        .reduce((acc: number, r: any) => acc + (Number(r.amount) || 0), 0);
    // Use real security deposit from billing profile if available
    const securityDeposit = tenant.securityDeposit ?? monthlyRent;
    const totalDeductionAmt = deductions.reduce((acc, d) => acc + (parseFloat(d.amount) || 0), 0);
    const thisMonthOwed = isCurrentMonthPaid ? 0 : proRataRent;
    const totalTenantOwes = prevUnpaidRent + thisMonthOwed;
    const netRefund = securityDeposit - totalTenantOwes - totalDeductionAmt;
    const ownerPaysRefund = netRefund > 0;
    const tenantOwesMore = netRefund < 0;

    // Convenience aliases for IDs
    const tenantDisplayId  = tenant.displayId    || tenant.id?.slice(0, 10) || '—';
    const noticeDisplayId  = tenant.noticeDisplayId || '—';
    const bedNo            = tenant.bedNo          || (tenant.bedId ? `${tenant.roomNumber}-?` : '—');
    const roomType         = tenant.roomType       || '—';

    const addDeduction = () => setDeductions(p => [...p, { id: Date.now().toString(), description: '', amount: '' }]);
    const removeDeduction = (id: string) => setDeductions(p => p.filter(d => d.id !== id));
    const updateDeduction = (id: string, field: 'description' | 'amount', val: string) =>
        setDeductions(p => p.map(d => d.id === id ? { ...d, [field]: val } : d));

    const handleCompleteVacate = () => {
        const combinedNote = [notes, deductions.length > 0 ? `Deductions: ${deductions.map(d => `${d.description} ₹${d.amount}`).join(', ')}` : ''].filter(Boolean).join(' | ');
        startTransition(async () => {
            try {
                await initiateMoveOut(tenant.id, totalDeductionAmt + totalTenantOwes, combinedNote);
                toast.success('Vacating completed successfully!');
                setStep(4);
                onSuccess();
            } catch (e: any) { toast.error(e.message || 'Failed to finalize move-out.'); }
        });
    };

    const STEP_LABELS = ['Summary', 'Deductions', 'Finalize'];

    // Shared: dark settlement card
    const SettlementCard = () => (
        <div className="bg-slate-900 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Settlement Breakdown</p>
            <div className="flex justify-between text-sm text-slate-300"><span>Security Deposit</span><span>₹{securityDeposit.toLocaleString('en-IN')}</span></div>
            {totalTenantOwes > 0 && <div className="flex justify-between text-sm text-red-400"><span>Rent Dues</span><span>- ₹{totalTenantOwes.toLocaleString('en-IN')}</span></div>}
            {isCurrentMonthPaid && <div className="flex justify-between text-sm text-emerald-400"><span>Rent Overpay Refund</span><span>+ ₹{(monthlyRent - proRataRent).toLocaleString('en-IN')}</span></div>}
            {deductions.length > 0 && (
                <div className="pt-1 space-y-1 border-t border-slate-700">
                    <p className="text-[10px] font-black uppercase text-amber-400">Damage Deductions</p>
                    {deductions.map((d, i) => (
                        <div key={d.id} className="flex justify-between text-xs">
                            <span className="text-slate-400">{d.description || `Item ${i + 1}`}</span>
                            <span className="font-black text-amber-400">- ₹{(parseFloat(d.amount) || 0).toLocaleString('en-IN')}</span>
                        </div>
                    ))}
                    <div className="flex justify-between text-sm font-black text-amber-400 pt-1 border-t border-slate-700">
                        <span>Total Deductions</span><span>- ₹{totalDeductionAmt.toLocaleString('en-IN')}</span>
                    </div>
                </div>
            )}
            <div className="border-t border-slate-700 pt-2 flex justify-between font-black">
                <span className="text-white">{ownerPaysRefund ? '🏦 Refund to Tenant' : tenantOwesMore ? '💰 Tenant Owes' : '✅ Cleared'}</span>
                <span className={`text-xl ${ownerPaysRefund ? 'text-emerald-400' : tenantOwesMore ? 'text-red-400' : 'text-slate-400'}`}>
                    ₹{Math.abs(netRefund).toLocaleString('en-IN')}
                </span>
            </div>
        </div>
    );

    return (<>
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="bg-white w-full md:max-w-lg md:rounded-3xl rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                    <div>
                        <h2 className="font-black text-slate-900 text-lg">Move-Out & Settlement</h2>
                        <p className="text-xs text-slate-500 mt-0.5">{tenant.name} · {tenant.roomNumber} · <span className="font-mono text-indigo-500">{tenantDisplayId}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X className="w-5 h-5 text-slate-500" /></button>
                </div>

                {/* Step Tabs — only shown for steps 1–3 */}
                {step < 4 && (
                    <div className="flex border-b border-slate-100 shrink-0">
                        {STEP_LABELS.map((s, i) => (
                            <div key={s} className={`flex-1 py-2.5 text-center text-[10px] font-black uppercase tracking-widest transition-all ${
                                step === i + 1 ? 'bg-indigo-600 text-white' : step > i + 1 ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400 bg-white'
                            }`}>{i + 1}. {s}</div>
                        ))}
                    </div>
                )}

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-5 space-y-4">

                    {/* ── Step 1: Summary ── */}
                    {step === 1 && (<>
                        <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Rent — {currentMonthLabel}</p>
                            <div className="flex justify-between"><span className="text-sm text-slate-600">Full month rent</span><span className="font-black">₹{monthlyRent.toLocaleString('en-IN')}</span></div>
                            <div className="flex justify-between"><span className="text-sm text-slate-600">Days stayed <span className="text-indigo-600 font-bold">({moveOutDay}/{daysInMonth})</span></span><span className="font-black text-indigo-700">₹{proRataRent.toLocaleString('en-IN')}</span></div>
                            <div className={`flex justify-between rounded-xl px-3 py-2 ${isCurrentMonthPaid ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                                <span className="text-xs font-black">{isCurrentMonthPaid ? '✅ Paid — pro-rata refundable' : '⚠️ Pro-rata due'}</span>
                                <span className={`font-black text-sm ${isCurrentMonthPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    {isCurrentMonthPaid ? `-₹${(monthlyRent - proRataRent).toLocaleString('en-IN')}` : `₹${proRataRent.toLocaleString('en-IN')}`}
                                </span>
                            </div>
                        </div>
                        {prevUnpaidRent > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                                <p className="text-xs font-black uppercase text-red-500 mb-2">Previous Unpaid Rent</p>
                                {(tenant.rentRecords || []).filter((r: any) => r.month !== currentMonthLabel && !r.paid).map((r: any) => (
                                    <div key={r.id} className="flex justify-between text-sm">
                                        <span className="text-red-700">{r.month}</span><span className="font-black text-red-900">₹{Number(r.amount).toLocaleString('en-IN')}</span>
                                    </div>
                                ))}
                                <div className="border-t border-red-200 mt-2 pt-2 flex justify-between font-black text-red-800 text-sm">
                                    <span>Total Unpaid</span><span>₹{prevUnpaidRent.toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        )}
                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                            <p className="text-xs font-black uppercase text-indigo-500 mb-2">Security Deposit</p>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-indigo-700">1 month rent</span>
                                <span className="font-black text-indigo-900 text-lg">₹{securityDeposit.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-4 space-y-2">
                            <p className="text-xs font-black uppercase text-slate-400">Preliminary Settlement</p>
                            <div className="flex justify-between text-sm text-slate-300"><span>Security Deposit</span><span>+ ₹{securityDeposit.toLocaleString('en-IN')}</span></div>
                            {totalTenantOwes > 0 && <div className="flex justify-between text-sm text-red-400"><span>Rent Dues</span><span>- ₹{totalTenantOwes.toLocaleString('en-IN')}</span></div>}
                            {isCurrentMonthPaid && <div className="flex justify-between text-sm text-emerald-400"><span>Overpaid refund</span><span>+ ₹{(monthlyRent - proRataRent).toLocaleString('en-IN')}</span></div>}
                            <div className="border-t border-slate-700 pt-2 flex justify-between font-black">
                                <span className="text-white">Before Deductions</span>
                                <span className={`text-lg ${netRefund >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{netRefund >= 0 ? '+' : '-'}₹{Math.abs(netRefund).toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    </>)}

                    {/* ── Step 2: Deductions ── */}
                    {step === 2 && (<>
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-800 font-medium">Add damage deductions against the security deposit. Leave empty if none.</p>
                        </div>
                        <div className="space-y-3">
                            {deductions.map((d) => (
                                <div key={d.id} className="flex gap-2 items-start bg-slate-50 rounded-2xl p-3">
                                    <div className="flex-1 space-y-2">
                                        <input placeholder="e.g. Broken AC, Wall damage..." value={d.description}
                                            onChange={e => updateDeduction(d.id, 'description', e.target.value)}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-slate-500">₹</span>
                                            <input type="number" placeholder="Amount" value={d.amount}
                                                onChange={e => updateDeduction(d.id, 'amount', e.target.value)}
                                                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                        </div>
                                    </div>
                                    <button onClick={() => removeDeduction(d.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl mt-1"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            ))}
                            <button onClick={addDeduction} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-sm font-black text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-2">
                                <Plus className="w-4 h-4" /> Add Deduction
                            </button>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Settlement Note (optional)</label>
                            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                                placeholder="e.g. Room vacated in good condition."
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
                        </div>
                        <SettlementCard />
                    </>)}

                    {/* ── Step 3: Finalize Review ── */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
                                <p className="text-xs font-black uppercase text-indigo-600 mb-1">📋 Full Settlement Review</p>
                                <p className="text-sm text-indigo-800">Review all details carefully before completing.</p>
                            </div>

                            {/* Tenant info */}
                            <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                                <p className="text-xs font-black uppercase text-slate-400 mb-1">Tenant Info</p>
                                {[
                                    ['Tenant ID',    tenantDisplayId],
                                    ['Notice ID',    noticeDisplayId],
                                    ['Name',         tenant.name],
                                    ['Phone',        tenant.phone],
                                    ['Room No.',     tenant.roomNumber],
                                    ['Bed No.',      bedNo],
                                    ['Room Type',    roomType],
                                    ['Move-out',     today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })],
                                ].map(([k, v]) => (
                                    <div key={k} className="flex justify-between text-sm">
                                        <span className="text-slate-500">{k}</span>
                                        <span className={`font-black text-slate-900 font-mono text-xs ${['Tenant ID','Notice ID'].includes(k as string) ? 'text-indigo-700' : ''}`}>{v}</span>
                                    </div>
                                ))}
                            </div>

                            <SettlementCard />

                            {/* Payment direction */}
                            {ownerPaysRefund && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
                                    <p className="text-xs font-black text-emerald-700 uppercase flex items-center gap-1"><Banknote className="w-4 h-4" /> You Pay Tenant — ₹{netRefund.toLocaleString('en-IN')}</p>
                                    <p className="text-sm text-emerald-800">After completing, transfer <strong>₹{netRefund.toLocaleString('en-IN')}</strong> to tenant via UPI or bank transfer.</p>
                                    <div className="bg-white rounded-xl p-3 border border-emerald-100">
                                        <p className="text-[10px] font-black uppercase text-slate-400">Tenant's Phone (UPI)</p>
                                        <p className="font-black text-slate-900">{tenant.phone}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Ask tenant for UPI ID or bank details if needed.</p>
                                    </div>
                                </div>
                            )}
                            {tenantOwesMore && (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
                                    <p className="text-xs font-black text-amber-700 uppercase flex items-center gap-1"><CreditCard className="w-4 h-4" /> Tenant Pays You — ₹{Math.abs(netRefund).toLocaleString('en-IN')}</p>
                                    <p className="text-sm text-amber-800">Collect <strong>₹{Math.abs(netRefund).toLocaleString('en-IN')}</strong> from tenant before or at move-out.</p>
                                    <div className="bg-white rounded-xl p-3 border border-amber-100">
                                        <p className="text-[10px] font-black uppercase text-slate-400">Collect via</p>
                                        <p className="font-black text-slate-900">Cash · UPI · Bank Transfer</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Verify payment before clicking Complete.</p>
                                    </div>
                                </div>
                            )}
                            {!ownerPaysRefund && !tenantOwesMore && (
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                                    <p className="text-xs font-black text-slate-700 uppercase">✅ Settlement Cleared</p>
                                    <p className="text-sm text-slate-600 mt-1">No outstanding payments. Fully balanced.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Step 4: Completed ── */}
                    {step === 4 && (
                        <div className="text-center space-y-5 py-4">
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle className="w-10 h-10 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900">Vacating Completed!</h3>
                                <p className="text-sm text-emerald-700 font-medium mt-1">Successfully vacated & settled ✓</p>
                                <p className="text-xs text-slate-400 mt-1">Room is released and marked as available.</p>
                            </div>
                            {/* Quick summary */}
                            <div className="bg-slate-50 rounded-2xl p-4 text-left border border-slate-200 space-y-2">
                                {[
                                    ['Tenant ID', tenantDisplayId], ['Notice ID', noticeDisplayId],
                                    ['Tenant', tenant.name], ['Phone', tenant.phone],
                                    ['Room', tenant.roomNumber], ['Bed', bedNo],
                                    ['Security Deposit', `₹${securityDeposit.toLocaleString('en-IN')}`],
                                    ['Final', `${ownerPaysRefund ? 'Refund' : tenantOwesMore ? 'Tenant Paid' : 'Cleared'} ₹${Math.abs(netRefund).toLocaleString('en-IN')}`],
                                ].map(([k, v]) => (
                                    <div key={k} className="flex justify-between text-sm">
                                        <span className="text-slate-500">{k}</span>
                                        <span className={`font-black text-xs font-mono ${['Tenant ID','Notice ID'].includes(k as string) ? 'text-indigo-700' : 'text-slate-900'}`}>{v}</span>
                                    </div>
                                ))}
                            </div>
                            {ownerPaysRefund && (
                                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-left">
                                    <p className="text-xs font-black text-blue-700 uppercase mb-1">🏦 Next: Process Refund</p>
                                    <p className="text-sm text-blue-800">Transfer <strong>₹{netRefund.toLocaleString('en-IN')}</strong> to <strong>{tenant.phone}</strong>.</p>
                                </div>
                            )}
                            {tenantOwesMore && (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left">
                                    <p className="text-xs font-black text-amber-700 uppercase mb-1">💰 Payment Collected</p>
                                    <p className="text-sm text-amber-800">Collected <strong>₹{Math.abs(netRefund).toLocaleString('en-IN')}</strong> from tenant.</p>
                                </div>
                            )}
                            <div className="flex gap-3">
                                <button onClick={() => setShowPdf(true)}
                                    className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                                    <Eye className="w-4 h-4" /> View Receipt
                                </button>
                                <button onClick={onClose} className="flex-1 py-3 bg-slate-900 text-white font-black text-sm rounded-2xl hover:bg-slate-800 transition-all">Done ✓</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer navigation */}
                {step < 4 && (
                    <div className="px-5 pb-5 pt-3 border-t border-slate-100 shrink-0 flex gap-3">
                        {step === 1 && (
                            <button onClick={() => setStep(2)}
                                className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                                Add Deductions <ChevronRight className="w-4 h-4" />
                            </button>
                        )}
                        {step === 2 && (<>
                            <button onClick={() => setStep(3)}
                                className="flex-1 py-3 bg-gradient-to-r from-rose-600 to-orange-600 text-white font-black text-sm rounded-2xl hover:from-rose-700 hover:to-orange-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-200">
                                Finalize <ChevronRight className="w-4 h-4" />
                            </button>
                            <button onClick={() => setStep(1)}
                                className="flex-1 py-3 bg-indigo-600 text-white font-black text-sm rounded-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                                ← Back
                            </button>
                        </>)}
                        {step === 3 && (<>
                            <button onClick={handleCompleteVacate} disabled={isPending}
                                className="flex-1 py-3 bg-gradient-to-r from-rose-600 to-orange-600 text-white font-black text-sm rounded-2xl disabled:opacity-50 hover:from-rose-700 hover:to-orange-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-200">
                                {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <><Home className="w-4 h-4" /> Complete Vacate & Payment</>}
                            </button>
                            <button onClick={() => setStep(2)} disabled={isPending}
                                className="flex-1 py-3 bg-indigo-600 text-white font-black text-sm rounded-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                                ← Back
                            </button>
                        </>)}
                    </div>
                )}
            </div>
        </div>

        {/* ── PDF Receipt Viewer Modal ── */}
        {showPdf && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
                    {/* PDF Modal Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                        <div>
                            <h2 className="font-black text-slate-900 text-lg">Settlement Receipt</h2>
                            <p className="text-xs text-slate-500 mt-0.5">Official Move-Out & Settlement Document</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    const receiptHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Settlement Receipt - ${tenant.name}</title><style>
                                    body{font-family:Arial,sans-serif;padding:32px;color:#1e293b;max-width:600px;margin:0 auto}
                                    .header{text-align:center;border-bottom:3px solid #4f46e5;padding-bottom:16px;margin-bottom:24px}
                                    .logo{font-size:22px;font-weight:900;color:#4f46e5;letter-spacing:-1px}
                                    .title{font-size:16px;font-weight:700;color:#64748b;margin-top:4px}
                                    .section{margin-bottom:20px}
                                    .section-title{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
                                    .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
                                    .row .label{color:#64748b}
                                    .row .value{font-weight:700;color:#1e293b;font-family:monospace}
                                    .row .value.id{color:#4f46e5}
                                    .deduction{color:#d97706 !important}
                                    .final{display:flex;justify-content:space-between;padding:12px 16px;background:#f8fafc;border-radius:12px;font-weight:900;font-size:16px;margin-top:16px}
                                    .final.refund .amount{color:#059669}
                                    .final.owes .amount{color:#d97706}
                                    .footer{text-align:center;margin-top:32px;padding-top:16px;border-top:1px dashed #e2e8f0;font-size:10px;color:#94a3b8}
                                    .stamp{display:inline-block;border:2px solid #059669;color:#059669;padding:6px 16px;border-radius:8px;font-weight:900;font-size:12px;margin-top:12px;letter-spacing:2px}
                                    @media print{body{padding:16px}button{display:none}}
                                    </style></head><body>
                                    <div class="header">
                                        <div class="logo">RentPe</div>
                                        <div class="title">Move-Out & Settlement Receipt</div>
                                    </div>
                                    <div class="section">
                                        <div class="section-title">Tenant Information</div>
                                        <div class="row"><span class="label">Tenant ID</span><span class="value id">${tenantDisplayId}</span></div>
                                        <div class="row"><span class="label">Notice ID</span><span class="value id">${noticeDisplayId}</span></div>
                                        <div class="row"><span class="label">Name</span><span class="value">${tenant.name}</span></div>
                                        <div class="row"><span class="label">Phone</span><span class="value">${tenant.phone || '—'}</span></div>
                                        <div class="row"><span class="label">Room Number</span><span class="value">${tenant.roomNumber || '—'}</span></div>
                                        <div class="row"><span class="label">Bed Number</span><span class="value">${bedNo}</span></div>
                                        <div class="row"><span class="label">Room Type</span><span class="value">${roomType}</span></div>
                                        <div class="row"><span class="label">Move-Out Date</span><span class="value">${today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
                                    </div>
                                    <div class="section">
                                        <div class="section-title">Financial Settlement</div>
                                        <div class="row"><span class="label">Security Deposit Held</span><span class="value">₹${securityDeposit.toLocaleString('en-IN')}</span></div>
                                        ${totalTenantOwes > 0 ? `<div class="row"><span class="label">Pro-rata / Unpaid Rent</span><span class="value deduction">- ₹${totalTenantOwes.toLocaleString('en-IN')}</span></div>` : ''}
                                        ${isCurrentMonthPaid ? `<div class="row"><span class="label">Overpaid Rent Refund</span><span class="value" style="color:#059669">+ ₹${(monthlyRent - proRataRent).toLocaleString('en-IN')}</span></div>` : ''}
                                        ${deductions.map((d, i) => `<div class="row"><span class="label">${d.description || `Deduction ${i + 1}`}</span><span class="value deduction">- ₹${(parseFloat(d.amount) || 0).toLocaleString('en-IN')}</span></div>`).join('')}
                                        ${deductions.length > 0 ? `<div class="row"><span class="label"><strong>Total Deductions</strong></span><span class="value deduction"><strong>- ₹${totalDeductionAmt.toLocaleString('en-IN')}</strong></span></div>` : ''}
                                    </div>
                                    <div class="final ${ownerPaysRefund ? 'refund' : 'owes'}">
                                        <span>${ownerPaysRefund ? '🏦 Refund to Tenant' : tenantOwesMore ? '💰 Tenant Paid Owner' : '✅ Settlement Cleared'}</span>
                                        <span class="amount">₹${Math.abs(netRefund).toLocaleString('en-IN')}</span>
                                    </div>
                                    <div class="footer">
                                        <div>Generated by RentPe · ${today.toLocaleString('en-IN')}</div>
                                        <div class="stamp">SETTLEMENT COMPLETE</div>
                                        <div style="margin-top:8px">This is a system-generated receipt. No signature required.</div>
                                    </div>
                                    </body></html>`;
                                    const win = window.open('', '_blank');
                                    if (win) { win.document.write(receiptHtml); win.document.close(); win.print(); }
                                }}
                                className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-all flex items-center gap-1.5 text-xs font-black"
                            >
                                <FileDown className="w-4 h-4" /> Download
                            </button>
                            <button onClick={() => setShowPdf(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                    </div>

                    {/* Receipt Content */}
                    <div className="overflow-y-auto flex-1 p-6 space-y-5">
                        {/* Tenant Info Section */}
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Tenant Information</p>
                            <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                                {[
                                    ['Tenant ID', tenantDisplayId, true],
                                    ['Notice ID', noticeDisplayId, true],
                                    ['Name', tenant.name, false],
                                    ['Phone', tenant.phone || '—', false],
                                    ['Room Number', tenant.roomNumber || '—', false],
                                    ['Bed Number', bedNo, false],
                                    ['Room Type', roomType, false],
                                    ['Move-Out Date', today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), false],
                                ].map(([k, v, isId]) => (
                                    <div key={k as string} className="flex justify-between text-sm border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
                                        <span className="text-slate-500">{k as string}</span>
                                        <span className={`font-black font-mono text-xs ${isId ? 'text-indigo-700' : 'text-slate-900'}`}>{v as string}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Financial Section */}
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Financial Settlement</p>
                            <div className="bg-slate-900 rounded-2xl p-4 space-y-2">
                                <div className="flex justify-between text-sm text-slate-300">
                                    <span>Security Deposit Held</span>
                                    <span className="font-black text-white">₹{securityDeposit.toLocaleString('en-IN')}</span>
                                </div>
                                {totalTenantOwes > 0 && (
                                    <div className="flex justify-between text-sm text-red-400">
                                        <span>Pro-rata / Unpaid Rent</span>
                                        <span className="font-black">- ₹{totalTenantOwes.toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                {isCurrentMonthPaid && (
                                    <div className="flex justify-between text-sm text-emerald-400">
                                        <span>Overpaid Rent Refund</span>
                                        <span className="font-black">+ ₹{(monthlyRent - proRataRent).toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                {deductions.length > 0 && (
                                    <div className="border-t border-slate-700 pt-2 space-y-1">
                                        <p className="text-[10px] font-black uppercase text-amber-400">Damage Deductions</p>
                                        {deductions.map((d, i) => (
                                            <div key={d.id} className="flex justify-between text-xs">
                                                <span className="text-slate-400">{d.description || `Item ${i + 1}`}</span>
                                                <span className="font-black text-amber-400">- ₹{(parseFloat(d.amount) || 0).toLocaleString('en-IN')}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between text-sm font-black text-amber-400 pt-1 border-t border-slate-700">
                                            <span>Total Deductions</span><span>- ₹{totalDeductionAmt.toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>
                                )}
                                <div className={`border-t border-slate-700 pt-2 flex justify-between font-black text-xl ${ownerPaysRefund ? 'text-emerald-400' : tenantOwesMore ? 'text-amber-400' : 'text-slate-400'}`}>
                                    <span className="text-white text-sm">{ownerPaysRefund ? '🏦 Refund to Tenant' : tenantOwesMore ? '💰 Tenant Paid Owner' : '✅ Cleared'}</span>
                                    <span>₹{Math.abs(netRefund).toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer stamp */}
                        <div className="text-center py-4 border-t border-dashed border-slate-200">
                            <p className="text-[10px] text-slate-400">Generated by RentPe · {today.toLocaleString('en-IN')}</p>
                            <span className="inline-block mt-2 border-2 border-emerald-500 text-emerald-700 font-black text-xs px-4 py-1 rounded-lg tracking-widest">SETTLEMENT COMPLETE</span>
                            <p className="text-[10px] text-slate-400 mt-1">System-generated receipt. No signature required.</p>
                        </div>
                    </div>

                    {/* PDF Modal Footer */}
                    <div className="px-6 pb-5 pt-3 border-t border-slate-100 shrink-0 flex gap-3">
                        <button
                            onClick={() => {
                                const receiptHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Settlement - ${tenant.name}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#1e293b;max-width:600px;margin:0 auto}.header{text-align:center;border-bottom:3px solid #4f46e5;padding-bottom:16px;margin-bottom:24px}.logo{font-size:22px;font-weight:900;color:#4f46e5}.title{font-size:14px;color:#64748b;margin-top:4px}.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px}.row .label{color:#64748b}.row .value{font-weight:700;font-family:monospace}.id{color:#4f46e5}.ded{color:#d97706}.final{display:flex;justify-content:space-between;padding:12px;background:#f8fafc;border-radius:8px;font-weight:900;font-size:16px;margin-top:16px}.footer{text-align:center;margin-top:24px;font-size:10px;color:#94a3b8}</style></head><body>
                                <div class="header"><div class="logo">RentPe</div><div class="title">Move-Out & Settlement Receipt</div></div>
                                ${[['Tenant ID', tenantDisplayId, 'id'], ['Notice ID', noticeDisplayId, 'id'], ['Name', tenant.name, ''], ['Phone', tenant.phone || '—', ''], ['Room', tenant.roomNumber || '—', ''], ['Bed', bedNo, ''], ['Room Type', roomType, ''], ['Move-Out', today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), '']].map(([l, v, cls]) => `<div class="row"><span class="label">${l}</span><span class="value ${cls}">${v}</span></div>`).join('')}
                                <div class="row"><span class="label">Security Deposit</span><span class="value">₹${securityDeposit.toLocaleString('en-IN')}</span></div>
                                ${totalTenantOwes > 0 ? `<div class="row"><span class="label">Rent Due</span><span class="value ded">- ₹${totalTenantOwes.toLocaleString('en-IN')}</span></div>` : ''}
                                ${deductions.map((d, i) => `<div class="row"><span class="label">${d.description || `Deduction ${i + 1}`}</span><span class="value ded">- ₹${(parseFloat(d.amount) || 0).toLocaleString('en-IN')}</span></div>`).join('')}
                                <div class="final"><span>${ownerPaysRefund ? 'Refund to Tenant' : tenantOwesMore ? 'Tenant Paid Owner' : 'Cleared'}</span><span>₹${Math.abs(netRefund).toLocaleString('en-IN')}</span></div>
                                <div class="footer">RentPe · ${today.toLocaleString('en-IN')} · SETTLEMENT COMPLETE</div>
                                </body></html>`;
                                const win = window.open('', '_blank');
                                if (win) { win.document.write(receiptHtml); win.document.close(); win.print(); }
                            }}
                            className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                        >
                            <FileDown className="w-4 h-4" /> Download PDF
                        </button>
                        <button onClick={() => setShowPdf(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 font-black text-sm rounded-2xl hover:bg-slate-200 transition-all">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )}
    </>);
}

