"use client";

import { useState, useEffect } from "react";
import { getCommissionConfigs, updateCommissionConfig } from "@/actions/adminPhase2";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Percent, Plus, RefreshCcw, History, X } from "lucide-react";

const PROPERTY_TYPES = ["DEFAULT", "PG", "HOSTEL", "FLAT"];

export default function CommissionPage() {
    const [configs, setConfigs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ propertyType: "DEFAULT", feePercent: 5, flatFee: "", notes: "" });
    const [saving, setSaving] = useState(false);

    const fetchConfigs = async () => {
        setLoading(true);
        try {
            const data = await getCommissionConfigs();
            setConfigs(data);
        } catch { toast.error("Failed to load configs"); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchConfigs(); }, []);

    const handleSave = async () => {
        if (form.feePercent < 0 || form.feePercent > 50) { toast.error("Commission must be 0–50%"); return; }
        setSaving(true);
        try {
            await updateCommissionConfig({
                propertyType: form.propertyType,
                feePercent: Number(form.feePercent),
                flatFee: form.flatFee ? Number(form.flatFee) : undefined,
                effectiveFrom: new Date(),
                notes: form.notes,
            });
            toast.success(`${form.propertyType} commission updated to ${form.feePercent}%!`);
            setShowForm(false);
            setForm({ propertyType: "DEFAULT", feePercent: 5, flatFee: "", notes: "" });
            fetchConfigs();
        } catch (e: any) { toast.error(e.message || "Save failed"); }
        finally { setSaving(false); }
    };

    // Active configs per property type
    const activeConfigs = configs.filter(c => c.isActive);
    const historyConfigs = configs.filter(c => !c.isActive);

    return (
        <div className="space-y-4 md:space-y-6 pb-20 md:pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
                        <Percent className="h-7 w-7 text-violet-600" /> Commission Configuration
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Configure platform commission rates by property type</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchConfigs} disabled={loading}>
                        <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                    </Button>
                    <Button className="bg-violet-600 hover:bg-violet-700" onClick={() => setShowForm(true)}>
                        <Plus className="h-4 w-4 mr-2" /> Update Rate
                    </Button>
                </div>
            </div>

            {/* Active Rates — Big Cards */}
            <div>
                <h2 className="text-xs font-black uppercase text-slate-500 mb-3">Current Active Rates</h2>
                {loading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />)}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                        {PROPERTY_TYPES.map(type => {
                            const config = activeConfigs.find(c => c.propertyType === type);
                            return (
                                <Card key={type} className="border-2 border-violet-100 hover:border-violet-300 transition-colors cursor-pointer"
                                    onClick={() => { setForm({ propertyType: type, feePercent: config?.feePercent || 5, flatFee: config?.flatFee || "", notes: "" }); setShowForm(true); }}>
                                    <CardContent className="p-5">
                                        <p className="text-3xl font-black text-violet-700">
                                            {config ? `${config.feePercent}%` : "—"}
                                        </p>
                                        <p className="font-bold text-sm text-slate-700 mt-1">{type}</p>
                                        {config?.flatFee && (
                                            <p className="text-xs text-muted-foreground">+ ₹{config.flatFee} flat</p>
                                        )}
                                        <Badge className="mt-2 text-xs border-0 bg-violet-100 text-violet-700">Active</Badge>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Info Box */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
                <p className="font-bold mb-1">⚠️ How Commission Works</p>
                <p>When a booking is confirmed, the platform earns the configured % from the gross rent amount. Owner receives the net amount (gross − commission). Click any card above to update its rate.</p>
            </div>

            {/* History Table */}
            {historyConfigs.length > 0 && (
                <div>
                    <h2 className="text-xs font-black uppercase text-slate-500 mb-3 flex items-center gap-2">
                        <History className="h-3.5 w-3.5" /> Rate Change History
                    </h2>
                    <div className="bg-white rounded-2xl border overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    {["Property Type", "Rate", "Flat Fee", "Effective From", "Notes"].map(h => (
                                        <th key={h} className="text-left px-4 py-3 text-xs font-black uppercase text-slate-400">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {historyConfigs.map(c => (
                                    <tr key={c.id} className="opacity-60">
                                        <td className="px-4 py-3 font-medium">{c.propertyType}</td>
                                        <td className="px-4 py-3">{c.feePercent}%</td>
                                        <td className="px-4 py-3">{c.flatFee ? `₹${c.flatFee}` : "—"}</td>
                                        <td className="px-4 py-3 text-xs">{new Date(c.effectiveFrom).toLocaleDateString('en-IN')}</td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground">{c.notes || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Update Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-6">
                    <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 space-y-5">
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-lg">Update Commission Rate</h3>
                            <button onClick={() => setShowForm(false)} className="p-1.5 rounded-full hover:bg-slate-100"><X className="h-5 w-5" /></button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1.5">Property Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {PROPERTY_TYPES.map(t => (
                                        <button key={t} onClick={() => setForm(f => ({ ...f, propertyType: t }))}
                                            className={`py-2 rounded-xl text-sm font-bold border transition-all ${form.propertyType === t ? "bg-violet-600 text-white border-transparent" : "border-slate-200 text-slate-600 hover:border-violet-300"}`}>
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1.5">Commission % (0–50)</label>
                                <div className="flex items-center gap-3">
                                    <input type="range" min={0} max={50} step={0.5} className="flex-1 accent-violet-600"
                                        value={form.feePercent}
                                        onChange={e => setForm(f => ({ ...f, feePercent: Number(e.target.value) }))} />
                                    <span className="text-2xl font-black text-violet-700 w-16 text-right">{form.feePercent}%</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1.5">Flat Fee (₹) — Optional</label>
                                <input type="number" className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                                    placeholder="e.g. 500" min={0}
                                    value={form.flatFee}
                                    onChange={e => setForm(f => ({ ...f, flatFee: e.target.value }))} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1.5">Notes (Optional)</label>
                                <input className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                                    placeholder="e.g. Q4 2025 rate adjustment"
                                    value={form.notes}
                                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                            <Button className="flex-1 bg-violet-600 hover:bg-violet-700" disabled={saving} onClick={handleSave}>
                                {saving ? "Saving..." : `Set ${form.feePercent}% for ${form.propertyType}`}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
