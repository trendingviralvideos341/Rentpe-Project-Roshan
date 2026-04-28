"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPlatformSettings, updatePlatformSettings, getPlatformFees, getPlatformChangeLogs, getFeeExemptions, addFeeExemption, removeFeeExemption } from "@/actions/platform";
import { Shield, ToggleLeft, ToggleRight, IndianRupee, TrendingUp, RefreshCcw, Search, History, Database, Target } from "lucide-react";

function calcFee(amount: number, flat: number, pct: number) {
    return Math.max(flat, (amount * pct) / 100);
}

type TabType = "settings" | "data" | "log" | "exemptions";

export default function PlatformFeesPage() {
    const [activeTab, setActiveTab] = useState<TabType>("settings");
    const [settings, setSettings] = useState<any>(null);
    const [fees, setFees] = useState<any[]>([]);
    const [changeLogs, setChangeLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [previewAmount, setPreviewAmount] = useState(5000);
    const [search, setSearch] = useState("");
    const [filterPG, setFilterPG] = useState("ALL");

    // Local editable state
    const [feesEnabled, setFeesEnabled] = useState(false);
    const [allowCashPayment, setAllowCashPayment] = useState(false);
    const [studentRentFeeFlat, setStudentRentFeeFlat] = useState(9);
    const [ownerRentFeeFlat, setOwnerRentFeeFlat] = useState(9);
    const [ownerOnboardingFeeFlat, setOwnerOnboardingFeeFlat] = useState(99);
    const [exemptions, setExemptions] = useState<any[]>([]);
    const [exPG, setExPG] = useState("");
    const [exUserId, setExUserId] = useState("");
    const [exCustomer, setExCustomer] = useState(false);
    const [exOwner, setExOwner] = useState(false);
    const [exReason, setExReason] = useState("");
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [allPGs, setAllPGs] = useState<string[]>([]);
    const [exSaving, setExSaving] = useState(false);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [s, f, l, ex] = await Promise.all([
                getPlatformSettings(),
                getPlatformFees(),
                getPlatformChangeLogs(),
                getFeeExemptions(),
            ]);
            setSettings(s);
            setFeesEnabled(s.feesEnabled);
            setAllowCashPayment(s.allowCashPayment ?? false);
            setStudentRentFeeFlat(s.studentRentFeeFlat);
            setOwnerRentFeeFlat(s.ownerRentFeeFlat);
            setOwnerOnboardingFeeFlat(s.ownerOnboardingFeeFlat);
            setFees(f);
            setChangeLogs(l);
            setExemptions(ex);
            // Collect unique PGs from fee records
            const pgs = Array.from(new Set(f.map((fee: any) => fee.booking?.propertyName).filter(Boolean))) as string[];
            setAllPGs(pgs);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchAll(); }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updatePlatformSettings({ feesEnabled, allowCashPayment, studentRentFeeFlat, ownerRentFeeFlat, ownerOnboardingFeeFlat });
            await fetchAll();
            alert("✅ Platform fee settings saved successfully.");
        } catch (e: any) { alert(`Failed: ${e.message}`); }
        finally { setSaving(false); }
    };

    // Live preview calculations
    const customerFee = feesEnabled ? studentRentFeeFlat : 0;
    const totalCharged = previewAmount + customerFee;
    const ownerFee = feesEnabled ? ownerRentFeeFlat : 0;
    const ownerNet = previewAmount - ownerFee;
    const platformEarned = customerFee + ownerFee;

    // Data tab filters
    const uniquePGs = Array.from(new Set(fees.map(f => f.booking?.propertyName).filter(Boolean)));
    const filteredFees = fees.filter(f => {
        const matchPG = filterPG === "ALL" || f.booking?.propertyName === filterPG;
        const matchSearch = !search ||
            f.booking?.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
            f.booking?.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
            f.booking?.displayId?.toLowerCase().includes(search.toLowerCase()) ||
            f.booking?.propertyName?.toLowerCase().includes(search.toLowerCase());
        return matchPG && matchSearch;
    });

    const totalEarned = filteredFees.reduce((s, f) => s + (f.platformEarned || 0), 0);
    const totalCustomerFees = filteredFees.reduce((s, f) => s + (f.customerFee || 0), 0);
    const totalOwnerFees = filteredFees.reduce((s, f) => s + (f.ownerFee || 0), 0);

    if (loading) return <div className="p-8 text-center animate-pulse">Loading platform settings...</div>;

    const tabs: { id: TabType; label: string; icon: any }[] = [
        { id: "settings", label: "⚙️ Fee Settings", icon: Shield },
        { id: "data", label: `📊 Fee Data (${fees.length})`, icon: Database },
        { id: "log", label: `📋 Change Log (${changeLogs.length})`, icon: History },
        { id: "exemptions", label: `🎯 Exemptions (${exemptions.length})`, icon: Target },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Shield className="h-7 w-7 text-purple-600" /> Platform Fees
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Commission model — <strong>invisible to users and owners</strong>. Only you can see and control this.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
                    <RefreshCcw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            {/* Wallet Balance */}
            <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
                <CardContent className="p-5 flex items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-full">
                        <IndianRupee className="h-6 w-6 text-purple-700" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground font-medium">Platform Wallet Balance</p>
                        <p className="text-3xl font-bold text-purple-700">₹{(settings?.platformWalletBalance ?? 0).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Total accumulated platform earnings from all transactions</p>
                    </div>
                </CardContent>
            </Card>

            {/* Colored Tabs */}
            <div className="flex gap-2 flex-wrap">
                {tabs.map(t => (
                    <Button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={activeTab === t.id
                            ? t.id === "settings" ? "bg-purple-600 hover:bg-purple-700 text-white"
                                : t.id === "data" ? "bg-blue-600 hover:bg-blue-700 text-white"
                                    : t.id === "exemptions" ? "bg-orange-600 hover:bg-orange-700 text-white"
                                        : "bg-green-600 hover:bg-green-700 text-white"
                            : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}
                    >
                        {t.label}
                    </Button>
                ))}
            </div>

            {/* ── SETTINGS TAB ── */}
            {activeTab === "settings" && (
                <div className="space-y-4 max-w-3xl">
                    {/* Master Toggle */}
                    <Card className={`border-2 ${feesEnabled ? "border-green-400 bg-green-50" : "border-gray-200"}`}>
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold">Platform Fees Master Switch</h2>
                                    <p className="text-sm text-muted-foreground">
                                        {feesEnabled ? "✅ Fees are ENABLED — commission is being collected on payments" : "⭕ Fees are DISABLED — no commission collected (default)"}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setFeesEnabled(!feesEnabled)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all ${feesEnabled ? "bg-green-600 text-white" : "bg-gray-200 text-gray-600"}`}
                                >
                                    {feesEnabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                                    {feesEnabled ? "ON" : "OFF"}
                                </button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Cash Payment Toggle */}
                    <Card className={`border-2 ${allowCashPayment ? "border-orange-400 bg-orange-50" : "border-gray-200"}`}>
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold flex items-center gap-2">💵 During Booking Cash Payment</h2>
                                    <p className="text-sm text-muted-foreground">
                                        {allowCashPayment
                                            ? "✅ ENABLED — Students see \"Pay Cash at Property\" option on payment page"
                                            : "⭕ DISABLED — Students can only pay Online (default). Enable to allow cash at property."}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setAllowCashPayment(!allowCashPayment)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all ${allowCashPayment ? "bg-orange-500 text-white" : "bg-gray-200 text-gray-600"}`}
                                >
                                    {allowCashPayment ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                                    {allowCashPayment ? "ON" : "OFF"}
                                </button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Fee Configuration */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="border-blue-200">
                            <CardContent className="p-5 space-y-3">
                                <h3 className="font-bold text-blue-800">👤 Customer (Student) Rent Fee</h3>
                                <p className="text-xs text-muted-foreground">Added ON TOP of monthly rent payment.</p>
                                <div>
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Flat Fee (₹)</label>
                                    <input type="number" className="w-full border rounded-md p-2 text-sm mt-1" value={studentRentFeeFlat} min={0} step={1} onChange={e => setStudentRentFeeFlat(parseFloat(e.target.value) || 0)} />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-orange-200">
                            <CardContent className="p-5 space-y-3">
                                <h3 className="font-bold text-orange-800">🏠 Owner Rent Fee</h3>
                                <p className="text-xs text-muted-foreground">Deducted FROM the rent the owner receives.</p>
                                <div>
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Flat Fee (₹)</label>
                                    <input type="number" className="w-full border rounded-md p-2 text-sm mt-1" value={ownerRentFeeFlat} min={0} step={1} onChange={e => setOwnerRentFeeFlat(parseFloat(e.target.value) || 0)} />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-green-200">
                            <CardContent className="p-5 space-y-3">
                                <h3 className="font-bold text-green-800">🚀 Owner Onboarding Fee</h3>
                                <p className="text-xs text-muted-foreground">Paid once per property activation.</p>
                                <div>
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Flat Fee (₹)</label>
                                    <input type="number" className="w-full border rounded-md p-2 text-sm mt-1" value={ownerOnboardingFeeFlat} min={0} step={1} onChange={e => setOwnerOnboardingFeeFlat(parseFloat(e.target.value) || 0)} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Live Preview */}
                    <Card className="border-2 border-indigo-200 bg-indigo-50">
                        <CardContent className="p-5 space-y-4">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-indigo-600" />
                                <h3 className="font-bold text-indigo-800">Live Fee Preview</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-sm font-medium whitespace-nowrap">Rent Amount (₹)</label>
                                <input type="number" className="border rounded-md p-2 text-sm w-36" value={previewAmount} min={100} step={100} onChange={e => setPreviewAmount(parseFloat(e.target.value) || 0)} />
                            </div>
                            {feesEnabled ? (
                                <div className="grid grid-cols-3 gap-3 text-sm">
                                    {[
                                        { label: "Rent Amount", value: `₹${previewAmount.toFixed(2)}`, color: "" },
                                        { label: "Customer Fee Added", value: `+₹${customerFee.toFixed(2)}`, color: "blue" },
                                        { label: "Customer Pays Total", value: `₹${totalCharged.toFixed(2)}`, color: "green" },
                                        { label: "Owner Fee Deducted", value: `-₹${ownerFee.toFixed(2)}`, color: "orange" },
                                        { label: "Owner Receives", value: `₹${ownerNet.toFixed(2)}`, color: "" },
                                        { label: "Platform Earns", value: `₹${platformEarned.toFixed(2)}`, color: "purple" },
                                    ].map(({ label, value, color }) => (
                                        <div key={label} className={`rounded-lg p-3 border ${color ? `bg-${color}-50 border-${color}-200` : "bg-white"}`}>
                                            <p className={`text-xs ${color ? `text-${color}-600` : "text-muted-foreground"}`}>{label}</p>
                                            <p className={`font-bold text-lg ${color ? `text-${color}-700` : ""}`}>{value}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4 text-muted-foreground text-sm">Enable fees above to see the preview.</div>
                            )}
                        </CardContent>
                    </Card>

                    <Button className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold py-3" onClick={handleSave} disabled={saving}>
                        {saving ? "Saving..." : "💾 Save Platform Fee Settings"}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">⚠️ Changes take effect immediately on the next payment.</p>
                </div>
            )}

            {/* ── DATA TAB ── */}
            {activeTab === "data" && (
                <div className="space-y-4">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { label: "Total Platform Earned", value: `₹${totalEarned.toFixed(2)}`, color: "purple" },
                            { label: "From Customer Fees", value: `₹${totalCustomerFees.toFixed(2)}`, color: "blue" },
                            { label: "From Owner Fees", value: `₹${totalOwnerFees.toFixed(2)}`, color: "orange" },
                        ].map(({ label, value, color }) => (
                            <div key={label} className={`p-4 rounded-xl border-2 bg-${color}-50 border-${color}-200`}>
                                <div className={`text-2xl font-bold text-${color}-700`}>{value}</div>
                                <div className={`text-sm font-medium text-${color}-600`}>{label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="flex gap-3 items-center">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-10" placeholder="Search by user, email, booking ID, PG name..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <select className="border rounded-md p-2 bg-background text-sm" value={filterPG} onChange={e => setFilterPG(e.target.value)}>
                            <option value="ALL">All PGs</option>
                            {uniquePGs.map(pg => <option key={pg} value={pg}>{pg}</option>)}
                        </select>
                    </div>

                    {/* Table */}
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-muted border-b">
                                        <tr>
                                            <th className="p-4 text-left font-medium">Booking ID</th>
                                            <th className="p-4 text-left font-medium">User</th>
                                            <th className="p-4 text-left font-medium">PG / Property</th>
                                            <th className="p-4 text-left font-medium">Gross Rent</th>
                                            <th className="p-4 text-left font-medium">Customer Fee</th>
                                            <th className="p-4 text-left font-medium">Owner Fee</th>
                                            <th className="p-4 text-left font-medium">Platform Earned</th>
                                            <th className="p-4 text-left font-medium">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredFees.length === 0 ? (
                                            <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No fee records found. Fees are collected when a booking payment is made with fees enabled.</td></tr>
                                        ) : filteredFees.map(f => (
                                            <tr key={f.id} className="border-b hover:bg-muted/5">
                                                <td className="p-4 font-mono text-xs">{f.booking?.displayId || "—"}</td>
                                                <td className="p-4">
                                                    <div className="font-medium text-sm">{f.booking?.user?.name || "—"}</div>
                                                    <div className="text-xs text-muted-foreground">{f.booking?.user?.email}</div>
                                                    <div className="text-[10px] font-mono text-muted-foreground">{f.booking?.user?.displayId}</div>
                                                </td>
                                                <td className="p-4 text-sm font-medium">{f.booking?.propertyName || "—"}</td>
                                                <td className="p-4 font-bold">₹{f.grossAmount?.toFixed(2)}</td>
                                                <td className="p-4 text-blue-700 font-medium">+₹{f.customerFee?.toFixed(2)}</td>
                                                <td className="p-4 text-orange-700 font-medium">-₹{f.ownerFee?.toFixed(2)}</td>
                                                <td className="p-4">
                                                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded font-bold text-sm">₹{f.platformEarned?.toFixed(2)}</span>
                                                </td>
                                                <td className="p-4 text-xs text-muted-foreground">
                                                    {new Date(f.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ── CHANGE LOG TAB ── */}
            {activeTab === "log" && (
                <Card>
                    <CardContent className="p-0">
                        <div className="p-4 bg-green-50 border-b border-green-200">
                            <p className="text-sm font-bold text-green-700">📋 Platform Fee Settings Change Log — All changes made by admins</p>
                        </div>
                        <table className="w-full">
                            <thead className="bg-muted border-b">
                                <tr>
                                    <th className="p-4 text-left font-medium">Action</th>
                                    <th className="p-4 text-left font-medium">Details</th>
                                    <th className="p-4 text-left font-medium">Performed By</th>
                                    <th className="p-4 text-left font-medium">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody>
                                {changeLogs.length === 0 ? (
                                    <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No changes logged yet.</td></tr>
                                ) : changeLogs.map(log => (
                                    <tr key={log.id} className="border-b hover:bg-muted/5">
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${log.actionType === 'PLATFORM_SETTINGS_UPDATED' || log.actionType === 'UPDATE' ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}`}>
                                                {log.actionType}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm">{log.description}</td>
                                        <td className="p-4 text-xs font-mono text-muted-foreground">{log.actorId}</td>
                                        <td className="p-4 text-xs text-muted-foreground font-mono">
                                            🕐 {new Date(log.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}
            {/* ── EXEMPTIONS TAB ── */}
            {activeTab === "exemptions" && (
                <div className="space-y-4">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <p className="text-sm font-bold text-orange-700">🎯 Fee Exemptions — Choose specific PGs or Users to exempt from platform fees</p>
                        <p className="text-xs text-orange-600 mt-1">Exemptions override the global fee settings. Leave PG or User blank to apply to all.</p>
                    </div>

                    {/* Add Exemption Form */}
                    <Card className="border-orange-200">
                        <CardContent className="p-5 space-y-4">
                            <h3 className="font-bold text-orange-800">➕ Add New Exemption</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">PG / Property (leave blank = all PGs)</label>
                                    <select className="w-full border rounded-md p-2 bg-background text-sm" value={exPG} onChange={e => setExPG(e.target.value)}>
                                        <option value="">— All PGs —</option>
                                        {allPGs.map(pg => <option key={pg} value={pg}>{pg}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">User ID (leave blank = all users)</label>
                                    <input className="w-full border rounded-md p-2 text-sm" placeholder="User ID or leave blank for all" value={exUserId} onChange={e => setExUserId(e.target.value)} />
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={exCustomer} onChange={e => setExCustomer(e.target.checked)} className="w-4 h-4" />
                                    <span className="text-sm font-medium text-blue-700">Exempt Customer Fee</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={exOwner} onChange={e => setExOwner(e.target.checked)} className="w-4 h-4" />
                                    <span className="text-sm font-medium text-orange-700">Exempt Owner Fee</span>
                                </label>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Reason <span className="text-red-500">*</span></label>
                                <input className="w-full border rounded-md p-2 text-sm" placeholder="e.g. Special arrangement, Early adopter, etc." value={exReason} onChange={e => setExReason(e.target.value)} />
                            </div>
                            <Button
                                className="bg-orange-600 hover:bg-orange-700 text-white"
                                disabled={exSaving || (!exCustomer && !exOwner) || !exReason.trim()}
                                onClick={async () => {
                                    if (!exReason.trim()) { alert("Reason is required."); return; }
                                    setExSaving(true);
                                    try {
                                        await addFeeExemption({ userId: exUserId || undefined, propertyName: exPG || undefined, exemptCustomer: exCustomer, exemptOwner: exOwner, reason: exReason });
                                        setExPG(""); setExUserId(""); setExCustomer(false); setExOwner(false); setExReason("");
                                        await fetchAll();
                                    } catch (e: any) { alert(`Failed: ${e.message}`); }
                                    finally { setExSaving(false); }
                                }}
                            >
                                {exSaving ? "Adding..." : "➕ Add Exemption"}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Exemptions Table */}
                    <Card>
                        <CardContent className="p-0">
                            <table className="w-full">
                                <thead className="bg-muted border-b">
                                    <tr>
                                        <th className="p-4 text-left font-medium">PG / Property</th>
                                        <th className="p-4 text-left font-medium">User ID</th>
                                        <th className="p-4 text-left font-medium">Customer Fee</th>
                                        <th className="p-4 text-left font-medium">Owner Fee</th>
                                        <th className="p-4 text-left font-medium">Reason</th>
                                        <th className="p-4 text-left font-medium">Added On</th>
                                        <th className="p-4 text-left font-medium">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {exemptions.length === 0 ? (
                                        <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No exemptions set. All users and PGs follow the global fee settings.</td></tr>
                                    ) : exemptions.map(ex => (
                                        <tr key={ex.id} className="border-b hover:bg-muted/5">
                                            <td className="p-4 font-medium text-sm">{ex.propertyName || <span className="text-muted-foreground italic">All PGs</span>}</td>
                                            <td className="p-4 font-mono text-xs">{ex.userId || <span className="text-muted-foreground italic">All Users</span>}</td>
                                            <td className="p-4">
                                                {ex.exemptCustomer ? <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">✅ Exempt</span> : <span className="text-muted-foreground text-xs">Not exempt</span>}
                                            </td>
                                            <td className="p-4">
                                                {ex.exemptOwner ? <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-bold">✅ Exempt</span> : <span className="text-muted-foreground text-xs">Not exempt</span>}
                                            </td>
                                            <td className="p-4 text-sm">{ex.reason}</td>
                                            <td className="p-4 text-xs text-muted-foreground">{new Date(ex.createdAt).toLocaleDateString('en-IN')}</td>
                                            <td className="p-4">
                                                <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={async () => {
                                                    if (!confirm("Remove this exemption?")) return;
                                                    try { await removeFeeExemption(ex.id); await fetchAll(); } catch (e: any) { alert(e.message); }
                                                }}>Remove</Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
