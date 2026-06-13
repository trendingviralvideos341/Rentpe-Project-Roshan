"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPlatformSettings, updatePlatformSettings, getPlatformFees, getPlatformChangeLogs, getFeeExemptions, addFeeExemption, removeFeeExemption, getRegisteredPropertiesForExemption, getActiveStudentsForExemption } from "@/actions/platform";
import { Shield, ToggleLeft, ToggleRight, IndianRupee, TrendingUp, RefreshCcw, Search, History, Database, Target, X } from "lucide-react";

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

    // Exemption data
    const [registeredProperties, setRegisteredProperties] = useState<any[]>([]);
    const [activeStudents, setActiveStudents] = useState<any[]>([]);
    const [pgSearch, setPgSearch] = useState("");
    const [studentSearch, setStudentSearch] = useState("");

    // Dialog state
    const [pgDialog, setPgDialog] = useState<any>(null);   // null = closed, object = selected PG
    const [stuDialog, setStuDialog] = useState<any>(null); // null = closed, object = selected student

    // PG exemption config (inside dialog)
    const [pgExemptOwner, setPgExemptOwner] = useState(false);
    const [pgExemptOnboarding, setPgExemptOnboarding] = useState(false);
    const [pgOnboardingFeeType, setPgOnboardingFeeType] = useState<"FLAT" | "PERCENT">("FLAT");
    const [pgOnboardingFeeValue, setPgOnboardingFeeValue] = useState<string>("");
    const [pgOwnerFeeType, setPgOwnerFeeType] = useState<"FLAT" | "PERCENT">("FLAT");
    const [pgOwnerFeeValue, setPgOwnerFeeValue] = useState<string>("");
    const [pgReason, setPgReason] = useState("");
    const [pgSaving, setPgSaving] = useState(false);

    // Student exemption config (inside dialog)
    const [stuExemptStudent, setStuExemptStudent] = useState(false);
    const [stuFeeType, setStuFeeType] = useState<"FLAT" | "PERCENT">("FLAT");
    const [stuFeeValue, setStuFeeValue] = useState<string>("");
    const [stuReason, setStuReason] = useState("");
    const [stuSaving, setStuSaving] = useState(false);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [s, f, l, ex, props, students] = await Promise.all([
                getPlatformSettings(),
                getPlatformFees(),
                getPlatformChangeLogs(),
                getFeeExemptions(),
                getRegisteredPropertiesForExemption(),
                getActiveStudentsForExemption(),
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
            setRegisteredProperties(props);
            setActiveStudents(students);
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

    // Open PG dialog
    const openPgDialog = (pg: any) => {
        const ex = exemptions.find(e => e.propertyId === pg.id);
        setPgExemptOwner(ex?.exemptOwner ?? false);
        setPgExemptOnboarding(ex?.exemptOnboardingFee ?? false);
        setPgOnboardingFeeType(ex?.customOnboardingFeeType ?? "FLAT");
        setPgOnboardingFeeValue(ex?.customOnboardingFee != null ? String(ex.customOnboardingFee) : "");
        setPgOwnerFeeType(ex?.customOwnerFeeType ?? "FLAT");
        setPgOwnerFeeValue(ex?.customOwnerFee != null ? String(ex.customOwnerFee) : "");
        setPgReason(ex?.reason ?? "");
        setPgDialog(pg);
    };

    // Open Student dialog
    const openStuDialog = (student: any) => {
        const ex = exemptions.find(e => e.userId === student.user?.id);
        setStuExemptStudent(ex?.exemptCustomer ?? false);
        setStuFeeType(ex?.customStudentFeeType ?? "FLAT");
        setStuFeeValue(ex?.customStudentFee != null ? String(ex.customStudentFee) : "");
        setStuReason(ex?.reason ?? "");
        setStuDialog(student);
    };

    const handleSavePGExemption = async () => {
        if (!pgDialog || !pgReason.trim()) { alert("Reason is required."); return; }
        setPgSaving(true);
        try {
            const old = exemptions.find(e => e.propertyId === pgDialog.id);
            if (old) await removeFeeExemption(old.id);
            if (pgExemptOwner || pgExemptOnboarding || pgOwnerFeeValue !== "" || pgOnboardingFeeValue !== "") {
                const customOwnerFee = pgOwnerFeeValue !== "" ? parseFloat(pgOwnerFeeValue) : null;
                const customOnboardingFee = pgOnboardingFeeValue !== "" ? parseFloat(pgOnboardingFeeValue) : null;
                await addFeeExemption({
                    propertyId: pgDialog.id,
                    propertyName: pgDialog.name,
                    exemptOwner: pgExemptOwner,
                    exemptOnboardingFee: pgExemptOnboarding,
                    customOnboardingFee: customOnboardingFee,
                    customOnboardingFeeType: customOnboardingFee != null ? pgOnboardingFeeType : null,
                    customOwnerFee: customOwnerFee,
                    customOwnerFeeType: customOwnerFee != null ? pgOwnerFeeType : null,
                    reason: pgReason,
                });
            }
            await fetchAll();
            setPgDialog(null);
            alert("✅ PG exemption saved.");
        } catch (e: any) { alert(`Failed: ${e.message}`); }
        finally { setPgSaving(false); }
    };

    const handleSaveStudentExemption = async () => {
        if (!stuDialog || !stuReason.trim()) { alert("Reason is required."); return; }
        setStuSaving(true);
        try {
            const old = exemptions.find(e => e.userId === stuDialog.user?.id);
            if (old) await removeFeeExemption(old.id);
            if (stuExemptStudent || stuFeeValue !== "") {
                const customFee = stuFeeValue !== "" ? parseFloat(stuFeeValue) : null;
                await addFeeExemption({
                    userId: stuDialog.user?.id,
                    propertyName: stuDialog.propertyName,
                    exemptCustomer: stuExemptStudent,
                    customStudentFee: customFee,
                    customStudentFeeType: customFee != null ? stuFeeType : null,
                    reason: stuReason,
                });
            }
            await fetchAll();
            setStuDialog(null);
            alert("✅ Student exemption saved.");
        } catch (e: any) { alert(`Failed: ${e.message}`); }
        finally { setStuSaving(false); }
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

    // Filtered PGs/Students for dropdown
    const filteredPGs = registeredProperties.filter(p => {
        const q = pgSearch.toLowerCase();
        if (!q) return true;
        return (
            p.name?.toLowerCase().includes(q) ||
            p.displayId?.toLowerCase().includes(q) ||
            p.owner?.phone?.includes(q) ||
            p.owner?.name?.toLowerCase().includes(q) ||
            p.id?.toLowerCase().includes(q)
        );
    });

    const filteredStudents = activeStudents.filter(b => {
        const q = studentSearch.toLowerCase();
        if (!q) return true;
        return (
            b.guestName?.toLowerCase().includes(q) ||
            b.guestPhone?.includes(q) ||
            b.displayId?.toLowerCase().includes(q) ||
            b.user?.displayId?.toLowerCase().includes(q) ||
            b.user?.phone?.includes(q) ||
            b.tenant?.displayId?.toLowerCase().includes(q) ||
            b.user?.name?.toLowerCase().includes(q)
        );
    });

    if (loading) return <div className="p-8 text-center animate-pulse">Loading platform settings...</div>;

    const tabs: { id: TabType; label: string }[] = [
        { id: "settings", label: "⚙️ Fee Settings" },
        { id: "data", label: `📊 Fee Data (${fees.length})` },
        { id: "log", label: `📋 Change Log (${changeLogs.length})` },
        { id: "exemptions", label: `🎯 Exemptions (${exemptions.length})` },
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

            {/* Tabs */}
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
                <div className="space-y-5">
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                        <p className="text-sm font-bold text-orange-700">🎯 Per-Property & Per-Student Custom Fee Rules</p>
                        <p className="text-xs text-orange-600 mt-1">
                            Select a PG or Student from the dropdown below to set custom fees. Set to 0 to hide the fee from their receipt.
                        </p>
                    </div>

                    {/* ── TWO DROPDOWN PANELS ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                        {/* LEFT: PG DROPDOWN */}
                        <Card className="border-2 border-orange-200">
                            <CardContent className="p-0">
                                <div className="bg-orange-600 text-white px-4 py-3 rounded-t-xl flex items-center gap-2">
                                    <span className="text-lg">🏠</span>
                                    <div>
                                        <p className="font-black text-sm">PG Properties</p>
                                        <p className="text-[10px] text-orange-200">Select a property to configure custom fees</p>
                                    </div>
                                    <span className="ml-auto bg-orange-500 text-white text-xs font-black px-2 py-1 rounded-full">{registeredProperties.length} PGs</span>
                                </div>

                                <div className="p-4 space-y-3">
                                    {/* Search */}
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                        <input
                                            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-orange-400"
                                            placeholder="Search by PG name, mobile, property ID..."
                                            value={pgSearch}
                                            onChange={e => setPgSearch(e.target.value)}
                                        />
                                    </div>

                                    {/* Dropdown */}
                                    {registeredProperties.length === 0 ? (
                                        <div className="text-center py-6 text-sm text-slate-400 bg-slate-50 rounded-lg border border-dashed">
                                            No properties found.
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Select Property</label>
                                            <select
                                                className="w-full border rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-orange-400 cursor-pointer"
                                                defaultValue=""
                                                onChange={e => {
                                                    const pg = filteredPGs.find(p => p.id === e.target.value);
                                                    if (pg) openPgDialog(pg);
                                                    e.target.value = "";
                                                }}
                                            >
                                                <option value="" disabled>-- Click to select a PG property --</option>
                                                {filteredPGs.map(pg => {
                                                    const isLive = pg.status === 'LIVE';
                                                    const hasRule = exemptions.find((ex) => ex.propertyId === pg.id);
                                                    const ref = isLive ? (pg.displayId || pg.applicationId) : (pg.applicationId || pg.displayId);
                                                    const tag = isLive ? '[✅ LIVE]' : '[⏳ Not Onboarded]';
                                                    const fee = isLive ? `Rent Fee ₹${ownerRentFeeFlat}` : `Onboarding ₹${ownerOnboardingFeeFlat}`;
                                                    return (
                                                        <option key={pg.id} value={pg.id}>
                                                            {tag} {pg.name} ({ref}) — {pg.owner?.name} | {fee}{hasRule ? ' ★ Custom Rule' : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            <p className="text-[10px] text-slate-400 mt-1">Select from dropdown to open configuration dialog</p>
                                        </div>
                                    )}

                                    {/* Quick List */}
                                    <div className="max-h-64 overflow-y-auto divide-y border rounded-lg">
                                        {filteredPGs.length === 0 ? (
                                            <div className="p-4 text-center text-sm text-slate-400">No results.</div>
                                        ) : filteredPGs.map(pg => {
                                            const isLive = pg.status === 'LIVE';
                                            const ex = exemptions.find((e) => e.propertyId === pg.id);
                                            const displayRef = isLive ? (pg.displayId || pg.applicationId) : (pg.applicationId || pg.displayId);
                                            return (
                                                <button
                                                    key={pg.id}
                                                    onClick={() => openPgDialog(pg)}
                                                    className={`w-full text-left px-4 py-3 transition-all ${isLive ? 'hover:bg-emerald-50' : 'hover:bg-amber-50'}`}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div>
                                                            <p className="font-bold text-sm text-slate-800">{pg.name}</p>
                                                            <p className="text-[10px] font-mono text-slate-400">
                                                                {displayRef} · {pg.city} · Owner: {pg.owner?.name} · {pg.owner?.phone}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400">
                                                                Submitted: {new Date(pg.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </p>
                                                            {isLive ? (
                                                                <p className="text-[10px] text-emerald-700 font-bold mt-0.5">
                                                                    💰 Rent Fee: ₹{ownerRentFeeFlat}{pg.onboardingPaidAt ? ' | Onboarding: Paid ✓' : ` | Onboarding: ₹${ownerOnboardingFeeFlat}`}
                                                                </p>
                                                            ) : (
                                                                <p className="text-[10px] text-amber-700 font-bold mt-0.5">
                                                                    💰 Onboarding Fee Due: ₹{ownerOnboardingFeeFlat} · {pg.status.replace(/_/g, ' ')}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                                            {isLive ? (
                                                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">✓ Property Live</span>
                                                            ) : (
                                                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">⏳ Not Onboarded Fully</span>
                                                            )}
                                                            {ex && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">★ Custom Rule</span>}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* RIGHT: STUDENT DROPDOWN */}
                        <Card className="border-2 border-blue-200">
                            <CardContent className="p-0">
                                <div className="bg-blue-600 text-white px-4 py-3 rounded-t-xl flex items-center gap-2">
                                    <span className="text-lg">👤</span>
                                    <div>
                                        <p className="font-black text-sm">Students / Tenants</p>
                                        <p className="text-[10px] text-blue-200">Select a student to configure custom fees</p>
                                    </div>
                                    <span className="ml-auto bg-blue-500 text-white text-xs font-black px-2 py-1 rounded-full">{activeStudents.length} students</span>
                                </div>

                                <div className="p-4 space-y-3">
                                    {/* Search */}
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                        <input
                                            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-blue-400"
                                            placeholder="Search by name, mobile, tenant ID, booking ID..."
                                            value={studentSearch}
                                            onChange={e => setStudentSearch(e.target.value)}
                                        />
                                    </div>

                                    {/* Dropdown */}
                                    {activeStudents.length === 0 ? (
                                        <div className="text-center py-6 text-sm text-slate-400 bg-slate-50 rounded-lg border border-dashed">
                                            No active students found.
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Select Student</label>
                                            <select
                                                className="w-full border rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-blue-400 cursor-pointer"
                                                defaultValue=""
                                                onChange={e => {
                                                    const stu = filteredStudents.find(s => s.id === e.target.value);
                                                    if (stu) openStuDialog(stu);
                                                    e.target.value = "";
                                                }}
                                            >
                                                <option value="" disabled>-- Click to select a student --</option>
                                                {filteredStudents.map(b => {
                                                    const hasRule = exemptions.find(ex => ex.userId === b.user?.id);
                                                    return (
                                                        <option key={b.id} value={b.id}>
                                                            {b.guestName || b.user?.name} ({b.guestPhone || b.user?.phone}){hasRule ? " ★ Custom Rule" : ""} — {b.propertyName}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            <p className="text-[10px] text-slate-400 mt-1">Select from dropdown to open configuration dialog</p>
                                        </div>
                                    )}

                                    {/* Quick List */}
                                    <div className="max-h-64 overflow-y-auto divide-y border rounded-lg">
                                        {filteredStudents.length === 0 ? (
                                            <div className="p-4 text-center text-sm text-slate-400">No results.</div>
                                        ) : filteredStudents.map(b => {
                                            const ex = exemptions.find(e => e.userId === b.user?.id);
                                            return (
                                                <button
                                                    key={b.id}
                                                    onClick={() => openStuDialog(b)}
                                                    className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-all"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div>
                                                            <p className="font-bold text-sm text-slate-800">{b.guestName || b.user?.name}</p>
                                                            <p className="text-[10px] text-slate-400">{b.guestPhone || b.user?.phone} · {b.user?.email}</p>
                                                            <p className="text-[10px] font-mono text-slate-400">Booking: {b.displayId} · PG: {b.propertyName}</p>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Active</span>
                                                            {ex && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">Custom Rule</span>}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Active Exemptions Table ── */}
                    <Card>
                        <CardContent className="p-0">
                            <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
                                <p className="font-black text-sm text-slate-700">📋 Active Custom Fee Rules ({exemptions.length})</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-muted border-b">
                                        <tr>
                                            <th className="p-3 text-left font-medium text-xs">PG / Property</th>
                                            <th className="p-3 text-left font-medium text-xs">Student</th>
                                            <th className="p-3 text-left font-medium text-xs">Owner Rules</th>
                                            <th className="p-3 text-left font-medium text-xs">Student Rules</th>
                                            <th className="p-3 text-left font-medium text-xs">Reason</th>
                                            <th className="p-3 text-left font-medium text-xs">Added On</th>
                                            <th className="p-3 text-left font-medium text-xs">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {exemptions.length === 0 ? (
                                            <tr><td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">No custom rules set. All PGs and students follow global fee settings.</td></tr>
                                        ) : exemptions.map(ex => (
                                            <tr key={ex.id} className="border-b hover:bg-muted/5">
                                                <td className="p-3 text-sm font-medium">{ex.propertyName || <span className="text-slate-400 italic text-xs">All PGs</span>}</td>
                                                <td className="p-3 font-mono text-xs">{ex.userId || <span className="text-slate-400 italic">All Students</span>}</td>
                                                <td className="p-3 space-y-1">
                                                    {ex.exemptOwner && ex.customOwnerFee === 0 && <span className="block text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">Rent Fee: FREE (hidden)</span>}
                                                    {ex.exemptOwner && ex.customOwnerFee > 0 && <span className="block text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">Rent Fee: {ex.customOwnerFeeType === "PERCENT" ? `${ex.customOwnerFee}%` : `₹${ex.customOwnerFee}`}</span>}
                                                    {ex.exemptOnboardingFee && <span className="block text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded font-bold">Onboarding: FREE</span>}
                                                    {!ex.exemptOwner && !ex.exemptOnboardingFee && <span className="text-slate-400 text-xs">—</span>}
                                                </td>
                                                <td className="p-3 space-y-1">
                                                    {ex.exemptCustomer && ex.customStudentFee === 0 && <span className="block text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">Conv. Fee: FREE (hidden)</span>}
                                                    {ex.exemptCustomer && ex.customStudentFee > 0 && <span className="block text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">Conv. Fee: {ex.customStudentFeeType === "PERCENT" ? `${ex.customStudentFee}%` : `₹${ex.customStudentFee}`}</span>}
                                                    {!ex.exemptCustomer && <span className="text-slate-400 text-xs">—</span>}
                                                </td>
                                                <td className="p-3 text-xs text-slate-600">{ex.reason}</td>
                                                <td className="p-3 text-xs text-muted-foreground">{new Date(ex.createdAt).toLocaleDateString('en-IN')}</td>
                                                <td className="p-3">
                                                    <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={async () => {
                                                        if (!confirm("Remove this custom rule?")) return;
                                                        try { await removeFeeExemption(ex.id); await fetchAll(); } catch (e: any) { alert(e.message); }
                                                    }}>Remove</Button>
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

            {/* ═══════════════════════════════════════════════
                PG DIALOG POPUP
            ═══════════════════════════════════════════════ */}
            {pgDialog && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 bg-orange-600 text-white rounded-t-2xl">
                            <div>
                                <p className="font-black text-sm">⚙️ Configure PG Fee Rule</p>
                                <p className="text-[11px] text-orange-200 font-medium mt-0.5">{pgDialog.name} · {pgDialog.displayId}</p>
                                <p className="text-[10px] text-orange-300">Owner: {pgDialog.owner?.name} · {pgDialog.owner?.phone}</p>
                            </div>
                            <button onClick={() => setPgDialog(null)} className="p-1.5 hover:bg-orange-700 rounded-lg transition-all">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="overflow-y-auto flex-1 p-5 space-y-4">
                            <p className="text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border">
                                Global: Owner Rent Fee = ₹{ownerRentFeeFlat} | Onboarding Fee = ₹{ownerOnboardingFeeFlat}
                            </p>

                            {/* Onboarding Fee Exemption */}
                            <div className="bg-white rounded-xl p-4 border border-orange-100 space-y-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={pgExemptOnboarding} onChange={e => {
                                        setPgExemptOnboarding(e.target.checked);
                                        if (e.target.checked) setPgOnboardingFeeValue("0"); else setPgOnboardingFeeValue("");
                                    }} className="w-4 h-4 accent-orange-500" />
                                    <div>
                                        <span className="text-sm font-black text-slate-800">Custom Owner Onboarding Fee</span>
                                        <span className="ml-2 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">Global: ₹{ownerOnboardingFeeFlat}</span>
                                    </div>
                                </label>
                                {pgExemptOnboarding && (
                                    <div className="ml-7 flex gap-2 items-center">
                                        <select
                                            className="border rounded-md px-2 py-1.5 text-xs bg-white"
                                            value={pgOnboardingFeeType}
                                            onChange={e => setPgOnboardingFeeType(e.target.value as any)}
                                        >
                                            <option value="FLAT">₹ Flat</option>
                                            <option value="PERCENT">% Percent</option>
                                        </select>
                                        <input
                                            type="number" min={0} step={0.5}
                                            className="border rounded-md px-2 py-1.5 text-xs w-24"
                                            placeholder={pgOnboardingFeeType === "FLAT" ? "e.g. 0" : "e.g. 0.5"}
                                            value={pgOnboardingFeeValue}
                                            onChange={e => setPgOnboardingFeeValue(e.target.value)}
                                        />
                                        <span className="text-xs text-slate-500">{pgOnboardingFeeType === "FLAT" ? "₹" : "% of rent"}</span>
                                    </div>
                                )}
                                {pgExemptOnboarding && pgOnboardingFeeValue === "0" && (
                                    <p className="text-[10px] text-emerald-600 ml-7">✅ Onboarding fee = ₹0 — Will be hidden from owner receipt.</p>
                                )}
                                {pgExemptOnboarding && pgOnboardingFeeValue !== "" && parseFloat(pgOnboardingFeeValue) > 0 && (
                                    <p className="text-[10px] text-blue-600 ml-7">ℹ️ Owner will be charged {pgOnboardingFeeType === "FLAT" ? `₹${pgOnboardingFeeValue}` : `${pgOnboardingFeeValue}% of rent`} instead of global ₹{ownerOnboardingFeeFlat}.</p>
                                )}
                            </div>

                            {/* Owner Rent Fee */}
                            <div className="bg-white rounded-xl p-4 border border-orange-100 space-y-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={pgExemptOwner} onChange={e => {
                                        setPgExemptOwner(e.target.checked);
                                        if (e.target.checked) setPgOwnerFeeValue("0"); else setPgOwnerFeeValue("");
                                    }} className="w-4 h-4 accent-orange-500" />
                                    <div>
                                        <span className="text-sm font-black text-slate-800">Custom Owner Platform Fee</span>
                                        <span className="ml-2 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">Global: ₹{ownerRentFeeFlat}</span>
                                    </div>
                                </label>
                                {pgExemptOwner && (
                                    <div className="ml-7 flex gap-2 items-center">
                                        <select className="border rounded-md px-2 py-1.5 text-xs bg-white" value={pgOwnerFeeType} onChange={e => setPgOwnerFeeType(e.target.value as any)}>
                                            <option value="FLAT">₹ Flat</option>
                                            <option value="PERCENT">% Percent</option>
                                        </select>
                                        <input
                                            type="number" min={0} step={0.5}
                                            className="border rounded-md px-2 py-1.5 text-xs w-24"
                                            placeholder={pgOwnerFeeType === "FLAT" ? "e.g. 5" : "e.g. 0.5"}
                                            value={pgOwnerFeeValue}
                                            onChange={e => setPgOwnerFeeValue(e.target.value)}
                                        />
                                        <span className="text-xs text-slate-500">{pgOwnerFeeType === "FLAT" ? "₹" : "% of rent"}</span>
                                    </div>
                                )}
                                {pgExemptOwner && pgOwnerFeeValue === "0" && (
                                    <p className="text-[10px] text-emerald-600 ml-7">✅ Owner fee = ₹0 — Will be hidden from owner receipt breakdown.</p>
                                )}
                                {pgExemptOwner && pgOwnerFeeValue !== "" && parseFloat(pgOwnerFeeValue) > 0 && (
                                    <p className="text-[10px] text-blue-600 ml-7">ℹ️ Owner will be charged {pgOwnerFeeType === "FLAT" ? `₹${pgOwnerFeeValue}` : `${pgOwnerFeeValue}% of rent`} instead of global ₹{ownerRentFeeFlat}.</p>
                                )}
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Reason *</label>
                                <input
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                                    placeholder="e.g. Early adopter discount, Special arrangement..."
                                    value={pgReason}
                                    onChange={e => setPgReason(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Footer with Save / Cancel */}
                        <div className="flex gap-3 p-4 border-t bg-slate-50 rounded-b-2xl">
                            <Button
                                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-black"
                                onClick={handleSavePGExemption}
                                disabled={pgSaving || !pgReason.trim()}
                            >
                                {pgSaving ? "Saving..." : "💾 Save Rule"}
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1 font-black"
                                onClick={() => setPgDialog(null)}
                                disabled={pgSaving}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════
                STUDENT DIALOG POPUP
            ═══════════════════════════════════════════════ */}
            {stuDialog && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 bg-blue-600 text-white rounded-t-2xl">
                            <div>
                                <p className="font-black text-sm">⚙️ Configure Student Fee Rule</p>
                                <p className="text-[11px] text-blue-200 font-medium mt-0.5">{stuDialog.guestName || stuDialog.user?.name}</p>
                                <p className="text-[10px] text-blue-300">{stuDialog.guestPhone || stuDialog.user?.phone} · Booking: {stuDialog.displayId}</p>
                                <p className="text-[10px] text-blue-300">PG: {stuDialog.propertyName}</p>
                            </div>
                            <button onClick={() => setStuDialog(null)} className="p-1.5 hover:bg-blue-700 rounded-lg transition-all">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="overflow-y-auto flex-1 p-5 space-y-4">
                            <p className="text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border">
                                Global: Student Convenience Fee = ₹{studentRentFeeFlat}
                            </p>

                            {/* Student Convenience Fee */}
                            <div className="bg-white rounded-xl p-4 border border-blue-100 space-y-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={stuExemptStudent} onChange={e => {
                                        setStuExemptStudent(e.target.checked);
                                        if (e.target.checked) setStuFeeValue("0"); else setStuFeeValue("");
                                    }} className="w-4 h-4 accent-blue-500" />
                                    <div>
                                        <span className="text-sm font-black text-slate-800">Custom Convenience Fee for Student</span>
                                        <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">Global: ₹{studentRentFeeFlat}</span>
                                    </div>
                                </label>
                                {stuExemptStudent && (
                                    <div className="ml-7 flex gap-2 items-center">
                                        <select className="border rounded-md px-2 py-1.5 text-xs bg-white" value={stuFeeType} onChange={e => setStuFeeType(e.target.value as any)}>
                                            <option value="FLAT">₹ Flat</option>
                                            <option value="PERCENT">% Percent</option>
                                        </select>
                                        <input
                                            type="number" min={0} step={0.5}
                                            className="border rounded-md px-2 py-1.5 text-xs w-24"
                                            placeholder={stuFeeType === "FLAT" ? "e.g. 0" : "e.g. 0.5"}
                                            value={stuFeeValue}
                                            onChange={e => setStuFeeValue(e.target.value)}
                                        />
                                        <span className="text-xs text-slate-500">{stuFeeType === "FLAT" ? "₹" : "% of rent"}</span>
                                    </div>
                                )}
                                {stuExemptStudent && stuFeeValue === "0" && (
                                    <p className="text-[10px] text-emerald-600 ml-7">✅ Convenience fee = ₹0 — Will be hidden from student checkout.</p>
                                )}
                                {stuExemptStudent && stuFeeValue !== "" && parseFloat(stuFeeValue) > 0 && (
                                    <p className="text-[10px] text-blue-600 ml-7">ℹ️ Student will be charged {stuFeeType === "FLAT" ? `₹${stuFeeValue}` : `${stuFeeValue}% of rent`} instead of global ₹{studentRentFeeFlat}.</p>
                                )}
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Reason *</label>
                                <input
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                                    placeholder="e.g. VIP student, special deal..."
                                    value={stuReason}
                                    onChange={e => setStuReason(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Footer with Save / Cancel */}
                        <div className="flex gap-3 p-4 border-t bg-slate-50 rounded-b-2xl">
                            <Button
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black"
                                onClick={handleSaveStudentExemption}
                                disabled={stuSaving || !stuReason.trim()}
                            >
                                {stuSaving ? "Saving..." : "💾 Save Rule"}
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1 font-black"
                                onClick={() => setStuDialog(null)}
                                disabled={stuSaving}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
