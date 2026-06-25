"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPlatformSettings, updatePlatformSettings, getPlatformFees, getPlatformChangeLogs, getFeeExemptions, addFeeExemption, removeFeeExemption, getRegisteredPropertiesForExemption, getActiveStudentsForExemption } from "@/actions/platform";
import { uploadPrivateDocumentAction, getSignedDocumentUrlAction } from "@/actions/uploads";
import { Shield, ToggleLeft, ToggleRight, IndianRupee, TrendingUp, RefreshCcw, Search, History, Database, Target, X, FileText, UploadCloud, CheckCircle, AlertCircle } from "lucide-react";

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
    const [tokenFeesEnabled, setTokenFeesEnabled] = useState(false);
    const [studentTokenFeeFlat, setStudentTokenFeeFlat] = useState(0);
    const [ownerTokenFeeFlat, setOwnerTokenFeeFlat] = useState(0);
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
    const [pgExemptOwnerToken, setPgExemptOwnerToken] = useState(false);
    const [pgExemptTds, setPgExemptTds] = useState(false);
    const [pgTdsCertificateFile, setPgTdsCertificateFile] = useState<File | null>(null);
    const [pgTdsCertificateUrl, setPgTdsCertificateUrl] = useState<string | null>(null);
    const [pgTdsExemptionReason, setPgTdsExemptionReason] = useState("");
    const [pgUploadingTds, setPgUploadingTds] = useState(false);
    const [pgSaving, setPgSaving] = useState(false);

    // Student exemption config (inside dialog)
    const [stuExemptStudent, setStuExemptStudent] = useState(false);
    const [stuFeeType, setStuFeeType] = useState<"FLAT" | "PERCENT">("FLAT");
    const [stuFeeValue, setStuFeeValue] = useState<string>("");
    const [stuReason, setStuReason] = useState("");
    const [stuExemptToken, setStuExemptToken] = useState(false);
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
            setTokenFeesEnabled((s as any).tokenFeesEnabled ?? false);
            setStudentTokenFeeFlat((s as any).studentTokenFeeFlat ?? 0);
            setOwnerTokenFeeFlat((s as any).ownerTokenFeeFlat ?? 0);
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
            await updatePlatformSettings({ feesEnabled, allowCashPayment, studentRentFeeFlat, ownerRentFeeFlat, ownerOnboardingFeeFlat, tokenFeesEnabled, studentTokenFeeFlat: studentTokenFeeFlat, ownerTokenFeeFlat: ownerTokenFeeFlat } as any);
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
        setPgExemptOwnerToken(ex?.exemptOwnerToken ?? false);
        setPgExemptTds(ex?.exemptTds ?? false);
        setPgTdsCertificateUrl(ex?.tdsCertificateUrl ?? null);
        setPgTdsCertificateFile(null);
        setPgTdsExemptionReason(ex?.tdsExemptionReason ?? "");
        setPgDialog(pg);
    };

    // Open Student dialog
    const openStuDialog = (student: any) => {
        const ex = exemptions.find(e => e.userId === student.user?.id);
        setStuExemptStudent(ex?.exemptCustomer ?? false);
        setStuFeeType(ex?.customStudentFeeType ?? "FLAT");
        setStuFeeValue(ex?.customStudentFee != null ? String(ex.customStudentFee) : "");
        setStuReason(ex?.reason ?? "");
        setStuExemptToken(ex?.exemptStudentToken ?? false);
        setStuDialog(student);
    };

    const handleSavePGExemption = async () => {
        if (!pgDialog || !pgReason.trim()) { alert("Reason is required."); return; }

        if (pgExemptTds) {
            if (!pgTdsCertificateFile && !pgTdsCertificateUrl) {
                alert("Nil/Lower TDS Exemption Certificate is mandatory.");
                return;
            }
            if (!pgTdsExemptionReason.trim()) {
                alert("Explanation notes explaining the TDS exemption are mandatory.");
                return;
            }
        }

        setPgSaving(true);
        try {
            let finalTdsCertUrl = pgTdsCertificateUrl;

            // Upload TDS Certificate if a new one is selected
            if (pgExemptTds && pgTdsCertificateFile) {
                setPgUploadingTds(true);
                try {
                    const formData = new FormData();
                    formData.append("file", pgTdsCertificateFile);
                    formData.append("fileName", pgTdsCertificateFile.name);
                    formData.append("mimeType", pgTdsCertificateFile.type);

                    const result = await uploadPrivateDocumentAction(formData);
                    if (result && result.success) {
                        finalTdsCertUrl = result.url;
                    } else {
                        throw new Error("Private file upload returned no success flag.");
                    }
                } catch (uploadErr: any) {
                    alert(`Private Certificate Upload Error: ${uploadErr.message}`);
                    setPgSaving(false);
                    setPgUploadingTds(false);
                    return;
                } finally {
                    setPgUploadingTds(false);
                }
            }

            const old = exemptions.find(e => e.propertyId === pgDialog.id);
            if (old) await removeFeeExemption(old.id);

            const shouldSaveRule =
                pgExemptOwner ||
                pgExemptOnboarding ||
                pgOwnerFeeValue !== "" ||
                pgOnboardingFeeValue !== "" ||
                pgExemptOwnerToken ||
                pgExemptTds;

            if (shouldSaveRule) {
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
                    exemptOwnerToken: pgExemptOwnerToken,
                    exemptTds: pgExemptTds,
                    tdsCertificateUrl: pgExemptTds ? finalTdsCertUrl : null,
                    tdsExemptionReason: pgExemptTds ? pgTdsExemptionReason : null,
                    reason: pgReason,
                } as any);
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
            if (stuExemptStudent || stuFeeValue !== "" || stuExemptToken) {
                const customFee = stuFeeValue !== "" ? parseFloat(stuFeeValue) : null;
                await addFeeExemption({
                    userId: stuDialog.user?.id,
                    propertyName: stuDialog.propertyName,
                    exemptCustomer: stuExemptStudent,
                    customStudentFee: customFee,
                    customStudentFeeType: customFee != null ? stuFeeType : null,
                    exemptStudentToken: stuExemptToken,
                    reason: stuReason,
                } as any);
            }
            await fetchAll();
            setStuDialog(null);
            alert("✅ Student exemption saved.");
        } catch (e: any) { alert(`Failed: ${e.message}`); }
        finally { setStuSaving(false); }
    };

    // Live preview calculations (with GST 18% exclusive + TDS 1%)
    const customerFee    = feesEnabled ? studentRentFeeFlat : 0;
    const gstPreview     = feesEnabled ? Math.round(customerFee * 0.18 * 100) / 100 : 0;
    const totalCharged   = previewAmount + customerFee + gstPreview;
    const ownerFee       = feesEnabled ? ownerRentFeeFlat : 0;
    const gstOnOwner     = feesEnabled ? Math.round(ownerFee * 0.18 * 100) / 100 : 0;
    const tdsPreview     = feesEnabled ? Math.round(previewAmount * 0.01 * 100) / 100 : 0;
    const ownerNet       = previewAmount - ownerFee - gstOnOwner - tdsPreview;
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
    const totalGstCollected = filteredFees.reduce((s, f) => s + ((f.gstOnStudentFee || 0) + (f.gstOnOwnerFee || 0)), 0);
    const totalTdsDeducted = filteredFees.reduce((s, f) => s + (f.tdsAmount || 0), 0);

    // Export URL helpers
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [exportFrom, setExportFrom] = useState(currentMonth);
    const [exportTo, setExportTo] = useState(currentMonth);

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

                    {/* Token Payment Fees Toggle */}
                    <Card className={`border-2 ${tokenFeesEnabled ? "border-yellow-400 bg-yellow-50" : "border-gray-200"}`}>
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold flex items-center gap-2">🪙 Token Payment Fees</h2>
                                    <p className="text-sm text-muted-foreground">
                                        {tokenFeesEnabled
                                            ? "✅ ENABLED — Platform charges fees on ₹1,000 token payments too"
                                            : "⭕ DISABLED — No extra fees charged on token payments (default)"}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setTokenFeesEnabled(!tokenFeesEnabled)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all ${tokenFeesEnabled ? "bg-yellow-500 text-white" : "bg-gray-200 text-gray-600"}`}
                                >
                                    {tokenFeesEnabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                                    {tokenFeesEnabled ? "ON" : "OFF"}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
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
                        <Card className="border-yellow-200">
                            <CardContent className="p-5 space-y-3">
                                <h3 className="font-bold text-yellow-800">🪙 Student Token Fee</h3>
                                <p className="text-xs text-muted-foreground">Added on top of ₹1,000 token payment by student.</p>
                                <div>
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Flat Fee (₹)</label>
                                    <input type="number" className="w-full border rounded-md p-2 text-sm mt-1" value={studentTokenFeeFlat} min={0} step={1} onChange={e => setStudentTokenFeeFlat(parseFloat(e.target.value) || 0)} />
                                </div>
                                {!tokenFeesEnabled && <p className="text-xs text-amber-600">⚠️ Token Fees toggle is OFF</p>}
                            </CardContent>
                        </Card>
                        <Card className="border-red-200">
                            <CardContent className="p-5 space-y-3">
                                <h3 className="font-bold text-red-800">🏠 Owner Token Fee</h3>
                                <p className="text-xs text-muted-foreground">Deducted when admin releases token payout to owner.</p>
                                <div>
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Flat Fee (₹)</label>
                                    <input type="number" className="w-full border rounded-md p-2 text-sm mt-1" value={ownerTokenFeeFlat} min={0} step={1} onChange={e => setOwnerTokenFeeFlat(parseFloat(e.target.value) || 0)} />
                                </div>
                                {!tokenFeesEnabled && <p className="text-xs text-amber-600">⚠️ Token Fees toggle is OFF</p>}
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
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                    {[
                                        { label: "Base Rent",            value: `₹${previewAmount.toFixed(2)}`,    color: "" },
                                        { label: "Convenience Fee",      value: `+₹${customerFee.toFixed(2)}`,    color: "blue" },
                                        { label: "GST on Fee (18%)",     value: `+₹${gstPreview.toFixed(2)}`,     color: "indigo" },
                                        { label: "Student Pays Total",   value: `₹${totalCharged.toFixed(2)}`,    color: "green" },
                                        { label: "Owner Commission",     value: `-₹${ownerFee.toFixed(2)}`,       color: "orange" },
                                        { label: "GST on Commission",    value: `-₹${gstOnOwner.toFixed(2)}`,     color: "orange" },
                                        { label: "TDS @ 1% (Sec 194-O)",value: `-₹${tdsPreview.toFixed(2)}`,     color: "red" },
                                        { label: "Owner Net Payout",     value: `₹${ownerNet.toFixed(2)}`,        color: "" },
                                        { label: "Platform Earns",       value: `₹${platformEarned.toFixed(2)}`,  color: "purple" },
                                        { label: "GST to Remit (Govt)", value: `₹${(gstPreview + gstOnOwner).toFixed(2)}`, color: "" },
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
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                            { label: "Platform Earned",    value: `₹${totalEarned.toFixed(2)}`,         color: "purple" },
                            { label: "From Student Fees",  value: `₹${totalCustomerFees.toFixed(2)}`,   color: "blue" },
                            { label: "From Owner Fees",    value: `₹${totalOwnerFees.toFixed(2)}`,      color: "orange" },
                            { label: "GST Collected",      value: `₹${totalGstCollected.toFixed(2)}`,   color: "indigo" },
                            { label: "TDS Deducted",       value: `₹${totalTdsDeducted.toFixed(2)}`,    color: "red" },
                        ].map(({ label, value, color }) => (
                            <div key={label} className={`p-4 rounded-xl border-2 bg-${color}-50 border-${color}-200`}>
                                <div className={`text-xl font-bold text-${color}-700`}>{value}</div>
                                <div className={`text-xs font-medium text-${color}-600`}>{label}</div>
                            </div>
                        ))}
                    </div>
                    {/* Export Tax Report */}
                    <div className="flex flex-wrap gap-3 items-center p-4 bg-gray-50 border rounded-xl">
                        <span className="text-sm font-bold text-gray-700">📤 Export Tax Report:</span>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-500">From:</label>
                            <input type="month" className="border rounded px-2 py-1 text-sm" value={exportFrom} onChange={e => setExportFrom(e.target.value)} />
                            <label className="text-xs text-gray-500">To:</label>
                            <input type="month" className="border rounded px-2 py-1 text-sm" value={exportTo} onChange={e => setExportTo(e.target.value)} />
                        </div>
                        <a
                            href={`/api/receipts/admin/export?from=${exportFrom}&to=${exportTo}&format=csv`}
                            download
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg"
                        >
                            ⬇️ Download CSV (Excel)
                        </a>
                        <a
                            href={`/api/receipts/admin/export?from=${exportFrom}&to=${exportTo}&format=pdf`}
                            download
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg"
                        >
                            ⬇️ Download PDF
                        </a>
                        <span className="text-xs text-gray-400">Share CSV with your CA for GSTR-1 and TDS filing</span>
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
                                            <th className="p-3 text-left font-medium text-xs">Booking ID</th>
                                            <th className="p-3 text-left font-medium text-xs">User</th>
                                            <th className="p-3 text-left font-medium text-xs">PG / Property</th>
                                            <th className="p-3 text-left font-medium text-xs">Gross Rent</th>
                                            <th className="p-3 text-left font-medium text-xs">Student Fee</th>
                                            <th className="p-3 text-left font-medium text-xs">Owner Fee</th>
                                            <th className="p-3 text-left font-medium text-xs text-indigo-700">GST (18%)</th>
                                            <th className="p-3 text-left font-medium text-xs text-red-700">TDS 1%</th>
                                            <th className="p-3 text-left font-medium text-xs">Platform Earned</th>
                                            <th className="p-3 text-left font-medium text-xs">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredFees.length === 0 ? (
                                            <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No fee records found. Fees are collected when a booking payment is made with fees enabled.</td></tr>
                                        ) : filteredFees.map(f => (
                                            <tr key={f.id} className="border-b hover:bg-muted/5">
                                                <td className="p-3 font-mono text-xs">{f.booking?.displayId || "—"}</td>
                                                <td className="p-3">
                                                    <div className="font-medium text-sm">{f.booking?.user?.name || "—"}</div>
                                                    <div className="text-xs text-muted-foreground">{f.booking?.user?.email}</div>
                                                    <div className="text-[10px] font-mono text-muted-foreground">{f.booking?.user?.displayId}</div>
                                                </td>
                                                <td className="p-3 text-sm font-medium">{f.booking?.propertyName || "—"}</td>
                                                <td className="p-3 font-bold text-sm">₹{f.grossAmount?.toFixed(2)}</td>
                                                <td className="p-3 text-blue-700 font-medium text-sm">+₹{f.customerFee?.toFixed(2)}</td>
                                                <td className="p-3 text-orange-700 font-medium text-sm">-₹{f.ownerFee?.toFixed(2)}</td>
                                                <td className="p-3 text-indigo-700 font-medium text-sm">
                                                    ₹{((f.gstOnStudentFee || 0) + (f.gstOnOwnerFee || 0)).toFixed(2)}
                                                    <div className="text-[10px] text-indigo-400">CGST+SGST</div>
                                                </td>
                                                <td className="p-3 text-red-600 font-medium text-sm">-₹{(f.tdsAmount || 0).toFixed(2)}</td>
                                                <td className="p-3">
                                                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded font-bold text-sm">₹{f.platformEarned?.toFixed(2)}</span>
                                                </td>
                                                <td className="p-3 text-xs text-muted-foreground">
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
                                                    {ex.exemptTds && (
                                                        <div className="flex flex-col gap-0.5 mt-0.5">
                                                            <span className="inline-block text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-bold">TDS: Exempt (Waived)</span>
                                                            {ex.tdsCertificateUrl && (
                                                                <button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        try {
                                                                            const url = await getSignedDocumentUrlAction(ex.tdsCertificateUrl);
                                                                            window.open(url, "_blank");
                                                                        } catch (err: any) {
                                                                            alert("Error: " + err.message);
                                                                        }
                                                                    }}
                                                                    className="text-[9px] text-red-700 hover:underline text-left font-bold flex items-center gap-0.5"
                                                                >
                                                                    📂 View Cert
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                    {!ex.exemptOwner && !ex.exemptOnboardingFee && !ex.exemptTds && <span className="text-slate-400 text-xs">—</span>}
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

                            {/* Owner Token Fee Exemption */}
                            <div className="bg-white rounded-xl p-4 border border-yellow-100 space-y-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={pgExemptOwnerToken} onChange={e => setPgExemptOwnerToken(e.target.checked)} className="w-4 h-4 accent-yellow-500" />
                                    <div>
                                        <span className="text-sm font-black text-slate-800">Exempt from Token Payment Fee</span>
                                        <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold">Global: ₹{ownerTokenFeeFlat}</span>
                                    </div>
                                </label>
                                {pgExemptOwnerToken && (
                                    <p className="text-[10px] text-emerald-600 ml-7">✅ Owner will NOT be charged any platform fee on token payouts for this PG.</p>
                                )}
                            </div>

                            {/* TDS Exemption (Section 194-O) */}
                            <div className={`rounded-xl p-4 border transition-all ${pgExemptTds ? "bg-red-50/35 border-red-200" : "bg-white border-slate-200"}`}>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={pgExemptTds} 
                                        onChange={e => setPgExemptTds(e.target.checked)} 
                                        className="w-4 h-4 accent-red-600" 
                                    />
                                    <div>
                                        <span className="text-sm font-black text-slate-850 flex items-center gap-1.5">
                                            ⚠️ TDS Exemption (Section 194-O)
                                        </span>
                                        <span className="text-[10px] text-slate-500 block font-semibold">Waive 1% TDS deduction on owner payouts</span>
                                    </div>
                                </label>

                                {pgExemptTds && (
                                    <div className="mt-4 ml-7 space-y-4 border-l-2 border-red-300 pl-4">
                                        {/* Certificate File Uploader */}
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold uppercase text-slate-650 flex items-center gap-1">
                                                Lower/Nil TDS Certificate * <span className="text-red-500 font-bold">(Max 5MB)</span>
                                            </label>
                                            
                                            {/* File Picker / Existing File Link */}
                                            {pgTdsCertificateUrl && !pgTdsCertificateFile ? (
                                                <div className="bg-emerald-50 border border-emerald-250 rounded-lg p-2.5 flex items-center justify-between shadow-sm">
                                                    <div className="flex items-center gap-2 text-xs font-black text-emerald-800">
                                                        <FileText className="h-4 w-4 text-emerald-600" />
                                                        <span>Certificate on Record</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button 
                                                            type="button"
                                                            onClick={async () => {
                                                                try {
                                                                    const url = await getSignedDocumentUrlAction(pgTdsCertificateUrl);
                                                                    window.open(url, "_blank");
                                                                } catch (err: any) {
                                                                    alert("Failed to view certificate: " + err.message);
                                                                }
                                                            }}
                                                            className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded transition-all shadow-sm"
                                                        >
                                                            View
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => setPgTdsCertificateUrl(null)}
                                                            className="text-[10px] bg-red-650 hover:bg-red-750 text-white font-bold px-2.5 py-1 rounded transition-all shadow-sm"
                                                        >
                                                            Replace
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className="relative border-2 border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center hover:bg-slate-50 transition-all cursor-pointer">
                                                        <input 
                                                            type="file" 
                                                            accept=".pdf,image/jpeg,image/png,image/webp"
                                                            onChange={e => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    if (file.size > 5 * 1024 * 1024) {
                                                                        alert("❌ File size exceeds 5MB limit. Please choose a smaller file.");
                                                                        e.target.value = "";
                                                                        setPgTdsCertificateFile(null);
                                                                    } else {
                                                                        setPgTdsCertificateFile(file);
                                                                    }
                                                                }
                                                            }}
                                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                        />
                                                        <UploadCloud className="h-6 w-6 text-slate-400 mb-1" />
                                                        <p className="text-xs text-slate-650 font-bold text-center">
                                                            {pgTdsCertificateFile ? pgTdsCertificateFile.name : "Click or drag certificate here"}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400">PDF, JPG, PNG up to 5MB</p>
                                                    </div>
                                                    {pgTdsCertificateFile && (
                                                        <div className="flex items-center justify-between text-xs text-slate-650 bg-slate-50 p-2 rounded border shadow-sm">
                                                            <span className="truncate max-w-[200px] font-bold">{pgTdsCertificateFile.name}</span>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => setPgTdsCertificateFile(null)} 
                                                                className="text-red-500 font-bold hover:underline"
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Notes for Exemption */}
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold uppercase text-slate-600 block">
                                                TDS Exemption Notes/Explanation *
                                            </label>
                                            <textarea 
                                                rows={2}
                                                placeholder="Explain why this property is TDS-exempt (e.g. Certificate No, lower deduction rate, special section)..."
                                                className="w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-red-400 bg-white"
                                                value={pgTdsExemptionReason}
                                                onChange={e => setPgTdsExemptionReason(e.target.value)}
                                            />
                                        </div>
                                    </div>
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
                                disabled={
                                    pgSaving || 
                                    pgUploadingTds ||
                                    !pgReason.trim() || 
                                    (pgExemptTds && (
                                        !pgTdsExemptionReason.trim() || 
                                        (!pgTdsCertificateFile && !pgTdsCertificateUrl)
                                    ))
                                }
                            >
                                {pgSaving ? (pgUploadingTds ? "Uploading..." : "Saving...") : "💾 Save Rule"}
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1 font-black"
                                onClick={() => setPgDialog(null)}
                                disabled={pgSaving || pgUploadingTds}
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

                            {/* Student Token Fee Exemption */}
                            <div className="bg-white rounded-xl p-4 border border-yellow-100 space-y-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={stuExemptToken} onChange={e => setStuExemptToken(e.target.checked)} className="w-4 h-4 accent-yellow-500" />
                                    <div>
                                        <span className="text-sm font-black text-slate-800">Exempt from Token Payment Fee</span>
                                        <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold">Global: ₹{studentTokenFeeFlat}</span>
                                    </div>
                                </label>
                                {stuExemptToken && (
                                    <p className="text-[10px] text-emerald-600 ml-7">✅ Student will NOT be charged any platform fee on their token payment.</p>
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
