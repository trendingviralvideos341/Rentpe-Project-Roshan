'use client';

import { useState, useTransition } from 'react';
import { X, Home, AlertTriangle, ChevronRight, Plus, Trash2, CheckCircle, Loader2, Banknote, CreditCard } from 'lucide-react';
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
    const tenantDisplayId    = tenant.displayId    || tenant.id?.slice(0, 10) || '—';
    const bookingDisplayId   = tenant.bookingDisplayId || '—';
    const roomId             = tenant.roomId        || '—';
    const bedId              = tenant.bedId         || '—';
    const roomType           = tenant.roomType      || '—';

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

    return (
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
                                    ['Booking ID',   bookingDisplayId],
                                    ['Name',         tenant.name],
                                    ['Phone',        tenant.phone],
                                    ['Room No.',     tenant.roomNumber],
                                    ['Room Type',    roomType],
                                    ['Room ID',      roomId],
                                    ['Bed ID',       bedId],
                                    ['Move-out',     today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })],
                                ].map(([k, v]) => (
                                    <div key={k} className="flex justify-between text-sm">
                                        <span className="text-slate-500">{k}</span>
                                        <span className={`font-black text-slate-900 font-mono text-xs ${['Tenant ID','Booking ID','Room ID','Bed ID'].includes(k as string) ? 'text-indigo-700' : ''}`}>{v}</span>
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
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto animate-bounce">
                                <CheckCircle className="w-10 h-10 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900">Vacating Completed!</h3>
                                <p className="text-sm text-emerald-700 font-medium mt-1">Successfully vacated & settled ✓</p>
                                <p className="text-xs text-slate-400 mt-1">Room is released and marked as available.</p>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2 border border-slate-200">
                                <p className="text-xs font-black uppercase text-slate-500">Settlement Receipt</p>
                                {/* Identity fields */}
                                {[
                                    ['Tenant ID',  tenantDisplayId],
                                    ['Booking ID', bookingDisplayId],
                                    ['Tenant',     tenant.name],
                                    ['Room No.',   tenant.roomNumber],
                                    ['Room Type',  roomType],
                                    ['Room ID',    roomId],
                                    ['Bed ID',     bedId],
                                    ['Move-out',   today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })],
                                    ['Security Deposit', `₹${securityDeposit.toLocaleString('en-IN')}`],
                                ].map(([k, v]) => (
                                    <div key={k} className="flex justify-between text-sm">
                                        <span className="text-slate-500">{k}</span>
                                        <span className={`font-black text-slate-900 font-mono text-xs ${['Tenant ID','Booking ID','Room ID','Bed ID'].includes(k as string) ? 'text-indigo-700' : ''}`}>{v}</span>
                                    </div>
                                ))}
                                {totalTenantOwes > 0 && <div className="flex justify-between text-sm"><span className="text-slate-500">Rent Adjusted</span><span className="font-black text-red-600">- ₹{totalTenantOwes.toLocaleString('en-IN')}</span></div>}
                                {deductions.length > 0 && (
                                    <div className="border-t border-slate-200 pt-2 space-y-1">
                                        <p className="text-[10px] font-black uppercase text-slate-400">Damage Deductions</p>
                                        {deductions.map((d, i) => (
                                            <div key={d.id} className="flex justify-between text-xs">
                                                <span className="text-slate-600">{d.description || `Item ${i + 1}`}</span>
                                                <span className="font-black text-amber-600">- ₹{(parseFloat(d.amount) || 0).toLocaleString('en-IN')}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between font-black text-amber-700 text-sm pt-1 border-t border-amber-100">
                                            <span>Total Deductions</span><span>- ₹{totalDeductionAmt.toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>
                                )}
                                <div className="border-t border-slate-200 pt-2 flex justify-between font-black">
                                    <span>{ownerPaysRefund ? 'Refund to Tenant' : tenantOwesMore ? 'Tenant Paid Owner' : 'Cleared'}</span>
                                    <span className={ownerPaysRefund ? 'text-emerald-700' : tenantOwesMore ? 'text-amber-700' : 'text-slate-600'}>₹{Math.abs(netRefund).toLocaleString('en-IN')}</span>
                                </div>
                            </div>

                            {ownerPaysRefund && (
                                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-left">
                                    <p className="text-xs font-black text-blue-700 uppercase mb-1">🏦 Next: Process Refund</p>
                                    <p className="text-sm text-blue-800">Transfer <strong>₹{netRefund.toLocaleString('en-IN')}</strong> to tenant via UPI to <strong>{tenant.phone}</strong>.</p>
                                </div>
                            )}
                            {tenantOwesMore && (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left">
                                    <p className="text-xs font-black text-amber-700 uppercase mb-1">💰 Payment Collected</p>
                                    <p className="text-sm text-amber-800">You collected <strong>₹{Math.abs(netRefund).toLocaleString('en-IN')}</strong> from the tenant.</p>
                                </div>
                            )}

                            <button onClick={onClose} className="w-full py-3 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all">Done ✓</button>
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
                                className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                                Finalize <ChevronRight className="w-4 h-4" />
                            </button>
                            <button onClick={() => setStep(1)}
                                className="flex-1 py-3 bg-indigo-600 text-white font-black text-sm rounded-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                                ← Back
                            </button>
                        </>)}
                        {step === 3 && (<>
                            <button onClick={handleCompleteVacate} disabled={isPending}
                                className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-sm rounded-2xl disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200">
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
    );
}
