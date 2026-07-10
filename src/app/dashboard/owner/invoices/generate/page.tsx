'use client';

import { useEffect, useState, useTransition } from 'react';
import { getTenantsForBulkInvoice, generateBulkInvoices } from '@/actions/ownerRentCollection';
import { unwrap } from '@/lib/safe-action';
import { toast } from 'sonner';
import { Receipt, Loader2, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';

function getCurrentMonth() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

type Step = 1 | 2 | 3;

export default function GenerateInvoicesPage() {
    const [step, setStep] = useState<Step>(1);
    const [month, setMonth] = useState(getCurrentMonth());
    const [tenants, setTenants] = useState<any[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [isPending, startTransition] = useTransition();

    const loadTenants = async () => {
        setLoading(true);
        try {
            const data = await getTenantsForBulkInvoice(month);
            setTenants(data);
            // Pre-select tenants without invoices
            setSelected(new Set(data.filter((t: any) => !t.hasInvoice).map((t: any) => t.tenantId)));
        } catch (e: any) {
            toast.error(e.message || 'Failed to load tenants');
        } finally {
            setLoading(false);
            setStep(2);
        }
    };

    const handleGenerate = () => {
        startTransition(async () => {
            try {
                const res = await unwrap(generateBulkInvoices(month, Array.from(selected)));
                setResults(res);
                setStep(3);
                const created = res.filter(r => r.status === 'CREATED').length;
                toast.success(`${created} invoice${created !== 1 ? 's' : ''} generated successfully!`);
            } catch (e: any) {
                toast.error(e.message || 'Generation failed');
            }
        });
    };

    const totalAmount = tenants
        .filter(t => selected.has(t.tenantId))
        .reduce((s, t) => s + t.rent, 0);

    const eligibleTenants = tenants.filter(t => !t.hasInvoice);
    const alreadyGenerated = tenants.filter(t => t.hasInvoice);

    const monthLabel = new Date(`${month}-01`).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-6 pt-10 pb-20 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="max-w-4xl mx-auto relative z-10">
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <Receipt className="w-8 h-8" /> Bulk Invoice Generator
                    </h1>
                    <p className="text-indigo-200 text-sm font-medium mt-1">Generate rent invoices for all active tenants</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 -mt-12 relative z-10 space-y-6">
                {/* Progress Steps */}
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-5">
                    <div className="flex items-center justify-between">
                        {[
                            { num: 1, label: 'Select Month' },
                            { num: 2, label: 'Preview Tenants' },
                            { num: 3, label: 'Generated' },
                        ].map((s, i) => (
                            <div key={s.num} className="flex items-center flex-1">
                                <div className="flex flex-col items-center">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${step >= s.num ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-100 text-slate-400'}`}>
                                        {step > s.num ? <CheckCircle2 className="w-5 h-5" /> : s.num}
                                    </div>
                                    <p className={`text-[10px] font-black uppercase tracking-wider mt-2 ${step >= s.num ? 'text-indigo-600' : 'text-slate-400'}`}>{s.label}</p>
                                </div>
                                {i < 2 && (
                                    <div className={`flex-1 h-0.5 mx-2 transition-all ${step > s.num ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* STEP 1 */}
                {step === 1 && (
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center space-y-6">
                        <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
                            <Receipt className="w-10 h-10 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900">Select Billing Month</h2>
                            <p className="text-slate-500 text-sm mt-2">Choose the month for which you want to generate invoices</p>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Month / Year</label>
                            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                                className="w-full max-w-xs border border-slate-200 rounded-2xl px-4 py-3 text-center text-lg font-black focus:outline-none focus:ring-2 focus:ring-indigo-500 mx-auto" />
                        </div>
                        <button onClick={loadTenants} disabled={loading}
                            className="w-full max-w-xs mx-auto py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:shadow-xl">
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
                            {loading ? 'Loading...' : 'Preview Invoices →'}
                        </button>
                    </div>
                )}

                {/* STEP 2 */}
                {step === 2 && (
                    <div className="space-y-4">
                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100 text-center">
                                <p className="text-2xl font-black text-slate-900">{selected.size}</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Selected</p>
                            </div>
                            <div className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100 text-center">
                                <p className="text-xl font-black text-slate-900">₹{totalAmount.toLocaleString('en-IN')}</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Total Amount</p>
                            </div>
                            <div className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100 text-center">
                                <p className="text-2xl font-black text-amber-600">{alreadyGenerated.length}</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Already Exists</p>
                            </div>
                        </div>

                        {/* Tenant Table */}
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                                <h2 className="font-black text-slate-900">Tenants — {monthLabel}</h2>
                                <div className="flex gap-2">
                                    <button onClick={() => setSelected(new Set(eligibleTenants.map(t => t.tenantId)))}
                                        className="px-3 py-1.5 text-xs font-black text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                                        Select All
                                    </button>
                                    <button onClick={() => setSelected(new Set())}
                                        className="px-3 py-1.5 text-xs font-black text-slate-500 hover:bg-slate-100 rounded-lg transition-all">
                                        Deselect All
                                    </button>
                                </div>
                            </div>

                            {tenants.length === 0 ? (
                                <div className="py-12 text-center">
                                    <p className="text-slate-400 font-black">No active tenants found</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {tenants.map(t => (
                                        <div key={t.tenantId} className={`p-4 flex items-center gap-4 transition-colors ${t.hasInvoice ? 'opacity-60 bg-slate-50/50' : 'hover:bg-indigo-50/30'}`}>
                                            <input
                                                type="checkbox"
                                                checked={selected.has(t.tenantId)}
                                                disabled={t.hasInvoice}
                                                onChange={e => {
                                                    const s = new Set(selected);
                                                    if (e.target.checked) s.add(t.tenantId);
                                                    else s.delete(t.tenantId);
                                                    setSelected(s);
                                                }}
                                                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <div className="flex-1">
                                                <p className="font-black text-slate-900">{t.tenantName}</p>
                                                <p className="text-xs text-slate-400">Room {t.room}</p>
                                            </div>
                                            <p className="font-black text-slate-800">₹{t.rent.toLocaleString('en-IN')}</p>
                                            {t.hasInvoice && (
                                                <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-black rounded-full border border-amber-200">
                                                    {t.existingStatus}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setStep(1)}
                                className="px-6 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-50 transition-all">
                                ← Back
                            </button>
                            <button onClick={handleGenerate} disabled={isPending || selected.size === 0}
                                className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Receipt className="w-5 h-5" />}
                                {isPending ? 'Generating...' : `Generate ${selected.size} Invoice${selected.size !== 1 ? 's' : ''} →`}
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3 */}
                {step === 3 && (
                    <div className="space-y-4">
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center">
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                            </div>
                            <h2 className="text-xl font-black text-slate-900">Invoices Generated!</h2>
                            <p className="text-slate-500 text-sm mt-2">
                                {results.filter(r => r.status === 'CREATED').length} invoices created for {monthLabel}
                            </p>
                            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                                <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-100">
                                    <p className="text-2xl font-black text-emerald-700">{results.filter(r => r.status === 'CREATED').length}</p>
                                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Created</p>
                                </div>
                                <div className="bg-amber-50 rounded-2xl p-3 border border-amber-100">
                                    <p className="text-2xl font-black text-amber-700">{results.filter(r => r.status === 'SKIPPED').length}</p>
                                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-600">Skipped</p>
                                </div>
                                <div className="bg-red-50 rounded-2xl p-3 border border-red-100">
                                    <p className="text-2xl font-black text-red-700">{results.filter(r => r.status === 'ERROR').length}</p>
                                    <p className="text-[10px] font-black uppercase tracking-wider text-red-600">Errors</p>
                                </div>
                            </div>
                        </div>

                        <button onClick={() => { setStep(1); setResults([]); }}
                            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-200">
                            Generate for Another Month →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
