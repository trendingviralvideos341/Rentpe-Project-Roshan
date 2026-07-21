"use client";

import { Fragment, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, PlusCircle, ClipboardCheck, Eye, Loader2 } from "lucide-react";
import { getTenantsPaginated, getTenantStats, markRentAsPaid, markRentAsUnpaid, unblockTenant, generateNextRentRecord } from "@/actions/tenants";
import { ownerFileVacatingNotice } from "@/actions/tenancy";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SettlementModal } from "@/components/dashboard/SettlementModal";

function formatToDDMMYYYY(dateStr: string | null | undefined): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
    }
    const parts = dateStr.trim().split(/\s+/);
    if (parts.length === 3) {
        const dd = parts[0].padStart(2, '0');
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthIdx = monthNames.indexOf(parts[1]);
        if (monthIdx !== -1) {
            const mm = String(monthIdx + 1).padStart(2, '0');
            const yyyy = parts[2];
            return `${dd}-${mm}-${yyyy}`;
        }
    }
    return dateStr;
}

function formatMonthLabel(m: string): string {
    if (!m) return '';
    const [y, mo] = m.split('-');
    if (!y || !mo) return m;
    return new Date(Number(y), Number(mo) - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

function formatToDDMonthYYYY(dateStr: string | null | undefined): string {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const month = monthNames[d.getMonth()];
        const yyyy = d.getFullYear();
        return `${dd} ${month} ${yyyy}`;
    }
    return formatToDDMMYYYY(dateStr);
}

export function TenantsContainer() {
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterType, setFilterType] = useState("ALL");
    const [filterProperty, setFilterProperty] = useState("ALL");
    const [filterPayment, setFilterPayment] = useState("ALL");
    const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
    const [blockNotes, setBlockNotes] = useState<Record<string, string>>({});
    const [unblockNotes, setUnblockNotes] = useState<Record<string, string>>({});
    const [payNotes, setPayNotes] = useState<Record<string, string>>({});
    const [showPayNote, setShowPayNote] = useState<Record<string, boolean>>({});
    const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
    const [showGenerateRent, setShowGenerateRent] = useState<Record<string, boolean>>({});
    const [generateMonth, setGenerateMonth] = useState<Record<string, string>>({});
    const [showMoveOut, setShowMoveOut] = useState<any>(null); // tenant object or null
    const [viewingChecklist, setViewingChecklist] = useState<any>(null);
    const [viewingDetails, setViewingDetails] = useState<any>(null);
    const [historyYear, setHistoryYear] = useState<string>("ALL");
    const [historyMonth, setHistoryMonth] = useState<string>("ALL");
    const [initiatingMoveOut, setInitiatingMoveOut] = useState<any>(null);
    const [moveOutReason, setMoveOutReason] = useState("");
    const [moveOutDate, setMoveOutDate] = useState("");
    const [initiatingNoticeBusy, setInitiatingNoticeBusy] = useState(false);

    const [mainTab, setMainTab] = useState<'ACTIVE_DIRECTORY' | 'VACATED_DIRECTORY'>('ACTIVE_DIRECTORY');
    const [activeTab, setActiveTab] = useState<'ACTIVE' | 'UPCOMING_MOVE_IN' | 'UPCOMING_VACATE' | 'CHECKED_OUT'>('ACTIVE');
    const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
    const [filterMonth, setFilterMonth] = useState((new Date().getMonth() + 1).toString());
    const [offset, setOffset] = useState(0);
    const [total, setTotal] = useState(0);
    const limit = 25;
    const [stats, setStats] = useState({ active: 0, upcoming: 0, checkedOut: 0, upcomingVacate: 0 });
    const currentMonth = `${filterYear}-${String(filterMonth).padStart(2, '0')}`;

    const handleMainTabChange = (tab: 'ACTIVE_DIRECTORY' | 'VACATED_DIRECTORY') => {
        setMainTab(tab);
        if (tab === 'ACTIVE_DIRECTORY') {
            setActiveTab('ACTIVE');
        } else {
            setActiveTab('CHECKED_OUT');
        }
    };

    const fetchStats = async () => {
        try { setStats(await getTenantStats()); }
        catch (e) { console.error(e); }
    };

    const fetchTenants = async (reset = false) => {
        if (reset) setLoading(true);
        try {
            const currentOffset = reset ? 0 : offset;
            const res = await getTenantsPaginated({
                limit,
                offset: currentOffset,
                activeTab,
                filterProperty,
                filterType,
                filterPayment,
                search,
                currentMonth
            });
            if (reset) {
                setTenants(res.data || []);
            } else {
                setTenants(prev => [...prev, ...(res.data || [])]);
            }
            setOffset(currentOffset + limit);
            setTotal(res.total || 0);
        }
        catch (e) { console.error(e); }
        finally { if (reset) setLoading(false); }
    };

    useEffect(() => { fetchStats(); }, []);

    useEffect(() => { fetchTenants(true); }, [activeTab, search, filterProperty, filterType, filterPayment, filterYear, filterMonth]);

    useEffect(() => {
        if (!viewingDetails) {
            setHistoryYear("ALL");
            setHistoryMonth("ALL");
        }
    }, [viewingDetails]);

    const toggleHistory = (id: string) => {
        setExpandedHistory(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleMarkPaid = async (recordId: string, tenantId: string) => {
        const note = payNotes[tenantId]?.trim();
        if (!note) { toast.error("Please enter a note before marking as paid."); return; }
        try {
            await markRentAsPaid(recordId, 'CASH', note);
            setPayNotes(p => ({ ...p, [tenantId]: "" }));
            setShowPayNote(p => ({ ...p, [tenantId]: false }));
            toast.success("Rent marked as Paid.");
            await fetchTenants();
        } catch { toast.error("Failed to mark rent as paid."); }
    };

    const handleMarkUnpaid = (recordId: string, tenantId: string) => {
        const note = payNotes[tenantId]?.trim();
        if (!note) { toast.error("Please enter a note before reversing payment."); return; }
        toast("Reverse this payment to UNPAID?", {
            action: {
                label: "Confirm",
                onClick: async () => {
                    try {
                        await markRentAsUnpaid(recordId, 'OTHER', note);
                        setPayNotes(p => ({ ...p, [tenantId]: "" }));
                        setShowPayNote(p => ({ ...p, [tenantId]: false }));
                        toast.success("Rent reversed to Unpaid.");
                        await fetchTenants();
                    } catch { toast.error("Failed to mark rent as unpaid."); }
                }
            }
        });
    };

    const handleBlock = async (tenantId: string) => {
        toast.error("Emergency blocking is deprecated for legal compliance. Please use the formal 'Initiate Move-Out' pipeline to evict a tenant.");
    };

    const handleUnblock = async (tenantId: string) => {
        const note = unblockNotes[tenantId]?.trim();
        if (!note) { toast.error("Please enter a reason before unblocking this tenant."); return; }
        try {
            await unblockTenant(tenantId, note);
            setUnblockNotes(p => { const n = { ...p }; delete n[tenantId]; return n; });
            toast.success("Tenant unblocked and reactivated.");
            await fetchTenants();
        } catch { toast.error("Failed to unblock tenant."); }
    };

    const handleGenerateRent = async (tenantId: string) => {
        const month = generateMonth[tenantId] || currentMonth;
        try {
            await generateNextRentRecord(tenantId, month);
            setShowGenerateRent(p => ({ ...p, [tenantId]: false }));
            toast.success(`Rent invoice generated for ${month}`);
            await fetchTenants();
        } catch (e: any) {
            toast.error(e.message || "Failed to generate rent.");
        }
    };

    const handleInitiateNotice = async () => {
        if (!initiatingMoveOut) return;
        if (!moveOutDate) { toast.error("Please select a target move-out date."); return; }
        if (!moveOutReason.trim()) { toast.error("Please enter a mandatory reason for the move-out notice."); return; }
        setInitiatingNoticeBusy(true);
        try {
            await ownerFileVacatingNotice({
                tenantId: initiatingMoveOut.id,
                plannedMoveOut: moveOutDate,
                reason: moveOutReason
            });
            toast.success("Move-out notice initiated successfully! Tenant notified.");
            setInitiatingMoveOut(null);
            setMoveOutReason("");
            setMoveOutDate("");
            await fetchTenants();
        } catch (e: any) {
            toast.error(e.message || "Failed to initiate move-out notice.");
        } finally {
            setInitiatingNoticeBusy(false);
        }
    };

    // Move-out is now handled entirely by SettlementModal

    const getFoodDetails = (tenant: any) => {
        const foodType = tenant.property?.foodType;
        const foodPrice = tenant.booking?.foodPriceApplied || tenant.property?.foodPricePerMonth || 0;
        const foodSelected = tenant.booking?.foodSelected;

        if (foodType === 'INCLUDED') {
            return "Yes (Included in Rent)";
        }
        if (foodType === 'NOT_AVAILABLE') {
            return "No (Not Available)";
        }
        if (foodType === 'OPTIONAL') {
            if (foodSelected) {
                return `Yes (₹${foodPrice}/month, Charged Separately by Owner)`;
            } else {
                return `No (Optional, ₹${foodPrice}/month)`;
            }
        }
        return "—";
    };

    const properties = Array.from(new Set(tenants.map(t => t.property?.name).filter(Boolean)));

    const filteredTenants = tenants;

    const unpaidCount = 0; // Stats could include unpaid count, or we ignore it since it's paginated. We'll leave it as 0 to avoid iterating over all.

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Tenants Directory</h1>
                    <p className="text-muted-foreground">Manage your property residents and rent history.</p>
                </div>
                <div className="flex gap-2 items-center">
                    <span className="text-sm text-muted-foreground">Total: <strong>{total}</strong></span>
                    {unpaidCount > 0 && <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">{unpaidCount} Unpaid</span>}
                </div>
            </div>

            <div className="flex bg-slate-100/80 rounded-xl p-1 gap-2 border border-slate-200">
                <button
                    onClick={() => handleMainTabChange('ACTIVE_DIRECTORY')}
                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all duration-200 border-2 ${mainTab === 'ACTIVE_DIRECTORY' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-700 border-slate-200 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:shadow'}`}
                >
                    Active Tenants
                </button>
                <button
                    onClick={() => handleMainTabChange('VACATED_DIRECTORY')}
                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all duration-200 border-2 ${mainTab === 'VACATED_DIRECTORY' ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-700 border-slate-200 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:shadow'}`}
                >
                    Vacated Tenants
                </button>
            </div>

            {mainTab === 'ACTIVE_DIRECTORY' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card 
                        className={`cursor-pointer transition-all duration-200 border-2 hover:-translate-y-0.5 hover:shadow-lg ${activeTab === 'ACTIVE' ? 'bg-indigo-600 border-indigo-600 shadow-md text-white' : 'bg-white border-indigo-300 shadow-sm hover:border-indigo-400 hover:bg-indigo-50/50'}`}
                        onClick={() => setActiveTab('ACTIVE')}
                    >
                        <CardContent className="p-4">
                            <p className={`text-xs font-bold uppercase tracking-wider ${activeTab === 'ACTIVE' ? 'text-indigo-100' : 'text-indigo-600'}`}>Active Tenants</p>
                            <p className={`text-2xl font-black mt-1 ${activeTab === 'ACTIVE' ? 'text-white' : 'text-indigo-900'}`}>
                                {stats.active}
                            </p>
                            <p className={`text-[10px] mt-1 ${activeTab === 'ACTIVE' ? 'text-indigo-200' : 'text-indigo-500'}`}>Currently residing</p>
                        </CardContent>
                    </Card>
                    <Card 
                        className={`cursor-pointer transition-all duration-200 border-2 hover:-translate-y-0.5 hover:shadow-lg ${activeTab === 'UPCOMING_MOVE_IN' ? 'bg-emerald-600 border-emerald-600 shadow-md text-white' : 'bg-white border-emerald-300 shadow-sm hover:border-emerald-400 hover:bg-emerald-50/50'}`}
                        onClick={() => setActiveTab('UPCOMING_MOVE_IN')}
                    >
                        <CardContent className="p-4">
                            <p className={`text-xs font-bold uppercase tracking-wider ${activeTab === 'UPCOMING_MOVE_IN' ? 'text-emerald-100' : 'text-emerald-600'}`}>Upcoming Move In</p>
                            <p className={`text-2xl font-black mt-1 ${activeTab === 'UPCOMING_MOVE_IN' ? 'text-white' : 'text-emerald-900'}`}>
                                {stats.upcoming}
                            </p>
                            <p className={`text-[10px] mt-1 ${activeTab === 'UPCOMING_MOVE_IN' ? 'text-emerald-200' : 'text-emerald-500'}`}>All upcoming move-ins</p>
                        </CardContent>
                    </Card>
                    <Card 
                        className={`cursor-pointer transition-all duration-200 border-2 hover:-translate-y-0.5 hover:shadow-lg ${activeTab === 'UPCOMING_VACATE' ? 'bg-amber-500 border-amber-500 shadow-md text-white' : 'bg-white border-amber-300 shadow-sm hover:border-amber-400 hover:bg-amber-50/50'}`}
                        onClick={() => setActiveTab('UPCOMING_VACATE')}
                    >
                        <CardContent className="p-4">
                            <p className={`text-xs font-bold uppercase tracking-wider ${activeTab === 'UPCOMING_VACATE' ? 'text-amber-100' : 'text-amber-600'}`}>Upcoming Vacate</p>
                            <p className={`text-2xl font-black mt-1 ${activeTab === 'UPCOMING_VACATE' ? 'text-white' : 'text-amber-900'}`}>
                                {stats.upcomingVacate || 0}
                            </p>
                            <p className={`text-[10px] mt-1 ${activeTab === 'UPCOMING_VACATE' ? 'text-amber-100' : 'text-amber-500'}`}>All upcoming vacates</p>
                        </CardContent>
                    </Card>
                </div>
            )}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px]">
                            <Input placeholder="Search by name, room, or ID..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <select className="border rounded-full px-4 py-2 bg-background text-sm font-semibold" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                        <select className="border rounded-full px-4 py-2 bg-background text-sm font-semibold" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                            {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].filter(m => {
                                const currentYear = new Date().getFullYear();
                                const currentMonth = new Date().getMonth() + 1;
                                return !(Number(filterYear) === currentYear && Number(m) > currentMonth);
                            }).map((m, i) => {
                                const name = new Date(2000, Number(m) - 1, 1).toLocaleString('en-IN', { month: 'short' });
                                return <option key={m} value={Number(m).toString()}>{name}</option>
                            })}
                        </select>
                        <select className="border rounded-md p-2 bg-background text-sm" value={filterProperty} onChange={e => setFilterProperty(e.target.value)}>
                            <option value="ALL">All Properties (PGs)</option>
                            {properties.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                        <select className="border rounded-md p-2 bg-background text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
                            <option value="ALL">All Room Types</option>
                            <option value="Single Sharing">Single Sharing</option>
                            <option value="Double Sharing">Double Sharing</option>
                            <option value="Three Sharing">Three Sharing</option>
                            <option value="Four Sharing">Four Sharing</option>
                        </select>
                        <select className="border rounded-md p-2 bg-background text-sm" value={filterPayment} onChange={e => setFilterPayment(e.target.value)}>
                            <option value="ALL">All Active Tenants</option>
                            <option value="PAID">Rent Paid (This Month)</option>
                            <option value="UNPAID">Rent Unpaid (This Month)</option>
                            <option value="BLOCKED">Blocked Tenants</option>
                            <option value="VACATED_FILTER">✓ Vacated Tenants</option>
                            <option value="DEBT_FILTER">⚠️ Tenants with Dues</option>
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* ── Mobile Cards ── */}
            <div className="md:hidden space-y-3">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                        <p className="text-center text-indigo-600 font-bold animate-pulse">Loading tenants...</p>
                    </div>
                ) : filteredTenants.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center space-y-3 shadow-inner">
                        <p className="text-slate-500 font-black text-lg">NO Tenants available in these records</p>
                        <p className="text-xs text-slate-400">Try adjusting your filters or search terms.</p>
                    </div>
                ) : filteredTenants.map(t => {
                    const latestRent = t.rentRecords.find((r: any) => r.month === currentMonth);
                    const isPaid = latestRent?.paid ?? false;
                    const isBlocked = t.status === "Blocked";
                    const isCheckedOut = t.status === "Checked Out";
                    return (
                        <div key={t.id} className={`bg-white border rounded-2xl p-4 shadow-sm space-y-3 ${
                            isBlocked ? "border-l-4 border-l-red-400" : isPaid ? "border-l-4 border-l-green-400" : "border-l-4 border-l-amber-400"}`}>
                            <div className="flex justify-between items-start gap-2">
                                <div>
                                    <p className={`font-black text-sm ${isBlocked ? "text-red-500" : isCheckedOut ? "text-slate-500 italic" : ""}`}>{t.name}</p>
                                    <p className="text-[10px] font-mono text-purple-600">{t.displayId}</p>
                                    <p className="text-[10px] text-indigo-600 font-bold">{t.property?.name}</p>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-[10px] font-black ${
                                    isBlocked ? "bg-red-100 text-red-700" :
                                    (isCheckedOut && t.settlementRecord?.tenantDebt > 0) ? "bg-red-100 text-red-700" :
                                    isCheckedOut ? "bg-slate-100 text-slate-600" :
                                    isPaid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                    {isBlocked ? "🚫 Blocked" : (isCheckedOut && t.settlementRecord?.tenantDebt > 0) ? `⚠️ Owed: ₹${t.settlementRecord.tenantDebt}` : isCheckedOut ? "🏠 Out" : isPaid ? "✅ Paid" : "❌ Unpaid"}
                                </span>
                            </div>
                            <div className="text-xs text-slate-600 space-y-1">
                                <p>🛏 {t.roomNumber} ({t.roomType})</p>
                                <p>💰 ₹{t.rentAmount}/month</p>
                                <p>📅 Move-in: {formatToDDMonthYYYY(t.startDate || t.moveInDate)}</p>
                                {activeTab === 'CHECKED_OUT' && <p>🏠 Vacated: {formatToDDMonthYYYY(t.actualMoveOutDate || t.expectedMoveOutDate)}</p>}
                                {activeTab === 'UPCOMING_MOVE_IN' && <p>📅 Upcoming Move-in: {formatToDDMonthYYYY(t.startDate || t.moveInDate)}</p>}
                                {activeTab === 'UPCOMING_VACATE' && <p>👋 Vacating: {formatToDDMonthYYYY(t.expectedMoveOutDate)}</p>}
                                {/* Permanent ID badges — industry standard for ops transparency */}
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[9px] font-black px-2 py-0.5 rounded-full font-mono">
                                        🔖 Tenant: {t.displayId}
                                    </span>
                                    {t.booking?.displayId && (
                                        <span className="inline-flex items-center gap-1 bg-violet-50 border border-violet-200 text-violet-700 text-[9px] font-black px-2 py-0.5 rounded-full font-mono">
                                            📋 Booking: {t.booking.displayId}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {!isBlocked && !isCheckedOut && (
                                <div className="flex gap-2 flex-wrap">
                                    <Button size="sm" variant="outline" className="text-xs flex-1 border-indigo-300 text-indigo-700"
                                        onClick={() => setViewingDetails(t)}>
                                        👁 Details
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-xs flex-1 border-rose-300 text-rose-700"
                                        onClick={() => { setInitiatingMoveOut(t); setMoveOutDate(new Date().toISOString().split('T')[0]); }}>
                                        🚶 Move Out
                                    </Button>
                                </div>
                             )}
                            {showPayNote[t.id] && latestRent && (
                                <div className="space-y-2 pt-2 border-t">
                                    <input className="w-full border rounded-lg p-2 text-xs" placeholder="Note (mandatory)..."
                                        value={payNotes[t.id] || ""}
                                        onChange={e => setPayNotes(p => ({ ...p, [t.id]: e.target.value }))} />
                                    <div className="flex gap-2">
                                        {!isPaid && (
                                            <Button size="sm" className="bg-green-600 flex-1 text-xs" onClick={() => handleMarkPaid(latestRent.id, t.id)}>Confirm Paid</Button>
                                        )}
                                        {isPaid && (
                                            <Button size="sm" variant="outline" className="border-red-300 text-red-600 flex-1 text-xs" onClick={() => handleMarkUnpaid(latestRent.id, t.id)}>Confirm Reverse</Button>
                                        )}
                                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowPayNote(p => ({ ...p, [t.id]: false }))}>✕</Button>
                                    </div>
                                </div>
                            )}
                            {isBlocked && (
                                <div className="space-y-2 pt-2 border-t">
                                    <input className="w-full border rounded-lg p-2 text-xs" placeholder="Unblock reason..."
                                        value={unblockNotes[t.id] || ""}
                                        onChange={e => setUnblockNotes(p => ({ ...p, [t.id]: e.target.value }))} />
                                    <Button size="sm" variant="outline" className="w-full text-xs border-green-300 text-green-700"
                                        onClick={() => handleUnblock(t.id)}>✅ Unblock</Button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Desktop Table ── */}
            <div className="hidden md:block">
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted border-b">
                                <tr>
                                    <th className="p-4 text-left font-medium">Tenant ID</th>
                                    <th className="p-4 text-left font-medium">Booking ID</th>
                                    <th className="p-4 text-left font-medium">Name & PG</th>
                                    <th className="p-4 text-left font-medium">Room</th>
                                    <th className="p-4 text-left font-medium">Checked In Date</th>
                                    {activeTab === 'CHECKED_OUT' && <th className="p-4 text-left font-medium">Vacated Date</th>}
                                    {activeTab === 'UPCOMING_MOVE_IN' && <th className="p-4 text-left font-medium">Upcoming Move-In Date</th>}
                                    {activeTab === 'UPCOMING_VACATE' && <th className="p-4 text-left font-medium">Upcoming Vacate Date</th>}
                                    <th className="p-4 text-left font-medium">Monthly Rent</th>
                                    <th className="p-4 text-left font-medium">{formatMonthLabel(currentMonth)} Status</th>
                                    <th className="p-4 text-left font-medium">Status & History</th>
                                    <th className="p-4 text-left font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={activeTab === 'ACTIVE' ? 9 : 10} className="p-12 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                                                <p className="text-indigo-600 font-bold animate-pulse">Loading tenants...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredTenants.length === 0 ? (
                                    <tr>
                                        <td colSpan={activeTab === 'ACTIVE' ? 9 : 10} className="p-12 text-center bg-slate-50">
                                            <div className="space-y-2">
                                                <p className="text-slate-500 font-black text-lg">NO Tenants available in these records</p>
                                                <p className="text-sm text-slate-400">Try adjusting your filters or search terms.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredTenants.map(t => {
                                    const latestRent = t.rentRecords.find((r: any) => r.month === currentMonth);
                                    const isPaid = latestRent?.paid ?? false;
                                    const isBlocked = t.status === "Blocked";
                                    const isCheckedOut = t.status === "Checked Out";
                                    const historyExpanded = expandedHistory.has(t.id);

                                    return (
                                        <Fragment key={t.id}>
                                        <tr className={`border-b hover:bg-muted/5 ${isCheckedOut ? "bg-slate-50 opacity-80" : isBlocked ? "bg-red-50" : ""}`}>
                                            <td className="p-4">
                                                <div className="font-mono text-xs text-purple-700 font-black">{t.displayId}</div>
                                            </td>
                                            <td className="p-4">
                                                {t.booking?.displayId ? (
                                                    <div className="font-mono text-xs text-indigo-700 font-black">{t.booking.displayId}</div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400">—</span>
                                                )}
                                            </td>
                                                <td className="p-4">
                                                    <div className={`font-medium ${isCheckedOut ? "text-slate-500 italic" : isBlocked ? "text-red-500" : ""}`}>{t.name}</div>
                                                    <div className="text-[10px] text-indigo-600 font-bold uppercase">{t.property?.name || "Unknown PG"}</div>
                                                    <div className="text-xs text-muted-foreground">{t.phone}</div>
                                                </td>
                                                <td className="p-4 text-sm">{t.roomNumber} <span className="text-xs text-muted-foreground">({t.roomType})</span></td>
                                                <td className="p-4 text-sm">{formatToDDMMYYYY(t.startDate || t.moveInDate)}</td>
                                                {activeTab === 'CHECKED_OUT' && <td className="p-4 text-sm font-semibold text-slate-600">{formatToDDMonthYYYY(t.actualMoveOutDate || t.expectedMoveOutDate)}</td>}
                                                {activeTab === 'UPCOMING_MOVE_IN' && <td className="p-4 text-sm font-semibold text-emerald-600">{formatToDDMonthYYYY(t.startDate || t.moveInDate)}</td>}
                                                {activeTab === 'UPCOMING_VACATE' && <td className="p-4 text-sm font-semibold text-amber-600">{formatToDDMonthYYYY(t.expectedMoveOutDate)}</td>}
                                                <td className="p-4 font-bold">
                                                    ₹{t.rentAmount || t.rent || 0}
                                                </td>

                                                {/* Payment Status */}
                                                <td className="p-4">
                                                    {isCheckedOut ? (
                                                        <div className="space-y-1">
                                                            {t.settlementRecord?.tenantDebt > 0 ? (
                                                                <span className="text-xs text-red-700 font-black uppercase tracking-wider bg-red-50 border border-red-200 px-2 py-1 rounded-full whitespace-nowrap">⚠️ Owed: ₹{t.settlementRecord.tenantDebt.toLocaleString('en-IN')}</span>
                                                            ) : (
                                                                <span className="text-xs text-teal-700 font-black uppercase tracking-wider bg-teal-50 border border-teal-200 px-2 py-1 rounded-full">✓ Vacated</span>
                                                            )}
                                                            {t.vacateNote && (
                                                                <details className="mt-1">
                                                                    <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-slate-600 font-bold">View Settlement ▾</summary>
                                                                    <pre className="text-[9px] text-slate-600 bg-slate-50 border rounded-lg p-2 mt-1 whitespace-pre-wrap max-w-xs max-h-32 overflow-y-auto font-mono">{t.vacateNote}</pre>
                                                                </details>
                                                            )}
                                                        </div>
                                                    ) : isBlocked ? (
                                                        <span className="text-xs text-red-500 font-bold uppercase tracking-wider">🚫 Blocked</span>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${isPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                                                                {isPaid ? <><CheckCircle className="h-3 w-3" /> Paid</> : <><XCircle className="h-3 w-3" /> Unpaid</>}
                                                            </span>
                                                            {latestRent && (
                                                                <div>
                                                                    {showPayNote[t.id] && (
                                                                        <div className="mt-1 space-y-1">
                                                                            <Input className="h-7 text-xs" placeholder="Mandatory note..."
                                                                                value={payNotes[t.id] || ""}
                                                                                onChange={e => setPayNotes(p => ({ ...p, [t.id]: e.target.value }))} />
                                                                            <div className="flex gap-1">
                                                                                {!isPaid && (
                                                                                    <Button size="sm" className="h-6 text-[10px] bg-green-600 hover:bg-green-700" onClick={() => handleMarkPaid(latestRent.id, t.id)}>✓ Mark Paid</Button>
                                                                                )}
                                                                                
                                                                                <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setShowPayNote(p => ({ ...p, [t.id]: false }))}>✕</Button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {!showPayNote[t.id] && !isPaid && (
                                                                        <Button size="sm" variant="outline" className="h-6 text-[10px] mt-1" onClick={() => setShowPayNote(p => ({ ...p, [t.id]: true }))}>
                                                                            ✓ Mark Paid
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Status & History */}
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isCheckedOut ? "bg-slate-100 text-slate-600" : isBlocked ? "bg-red-100 text-red-800" : t.status === 'Upcoming' ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                                                            {isCheckedOut ? "Checked Out" : isBlocked ? "Blocked" : t.status === 'Upcoming' ? "Upcoming" : "Active"}
                                                        </span>
                                                        {t.actionNotes?.length > 0 && (
                                                            <button onClick={() => toggleHistory(t.id)} className="text-muted-foreground hover:text-foreground">
                                                                {historyExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                            </button>
                                                        )}
                                                    </div>
                                                    {historyExpanded && t.actionNotes?.length > 0 && (
                                                        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                                                            {t.actionNotes.map((note: any, i: number) => (
                                                                <div key={i} className={`text-[9px] p-1.5 rounded border ${
                                                                    note.action === 'MOVED_OUT' ? "bg-slate-50 border-slate-200 text-slate-700" :
                                                                    note.action === 'BLOCKED' ? "bg-red-50 border-red-200 text-red-700" :
                                                                    note.action === 'UNBLOCKED' ? "bg-green-50 border-green-200 text-green-700" :
                                                                    note.action === 'PAYMENT_MARKED_PAID' ? "bg-blue-50 border-blue-200 text-blue-700" :
                                                                    "bg-gray-50 border-gray-200 text-gray-700"}`}>
                                                                    <div className="font-bold uppercase">
                                                                        {note.action === 'MOVED_OUT' ? "🏠 Moved Out" : note.action === 'BLOCKED' ? "🚫 Blocked" : note.action === 'UNBLOCKED' ? "✅ Unblocked" : note.action === 'PAYMENT_MARKED_PAID' ? "💰 Paid" : note.action === 'PAYMENT_MARKED_UNPAID' ? "↩ Unpaid" : note.action}
                                                                    </div>
                                                                    <div>Note: {note.reason}</div>
                                                                    <div className="text-[8px] opacity-70">{new Date(note.timestamp).toLocaleString('en-IN')}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Actions column */}
                                                <td className="p-4 text-center">
                                                    <div className="flex flex-col gap-1 items-center">
                                                        <>
                                                            <Button size="sm" variant="outline"
                                                                className="h-7 text-[10px] w-full border-indigo-400 text-indigo-700 hover:bg-indigo-50"
                                                                onClick={() => setViewingDetails(t)}>
                                                                👁 View Details
                                                            </Button>
                                                            {!isBlocked && (
                                                                <Button size="sm" variant="outline"
                                                                    className="h-7 text-[10px] w-full mt-1 border-rose-400 text-rose-700 hover:bg-rose-50"
                                                                    onClick={() => { setInitiatingMoveOut(t); setMoveOutDate(new Date().toISOString().split('T')[0]); }}>
                                                                    🚶 Initiate Move-Out
                                                                </Button>
                                                            )}
                                                        </>
                                                        {t.booking?.moveInChecklist && (
                                                            <Button size="sm" variant="outline"
                                                                className="h-7 text-[10px] w-full mt-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                                                onClick={() => setViewingChecklist(t)}>
                                                                <ClipboardCheck className="mr-1 h-3.5 w-3.5" /> Checklist
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Rent History Expandable */}
                                            {expandedTenant === t.id && (
                                                <tr className="bg-blue-50/30">
                                                    <td colSpan={8} className="p-4">
                                                        <div className="text-sm font-bold mb-2">📋 Full Rent History</div>
                                                        <div className="grid grid-cols-4 gap-2">
                                                            {t.rentRecords.map((r: any) => (
                                                                <div key={r.id} className={`p-2 rounded border text-xs ${r.paid ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                                                                    <div className="font-bold">{formatMonthLabel(r.month)}</div>
                                                                    <div>{r.paid ? `✅ Paid on ${r.paidOn}` : "❌ Unpaid"}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
            {tenants.length < total && (
                <div className="flex justify-center mt-6">
                    <Button variant="outline" onClick={() => fetchTenants(false)} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Load More ({tenants.length} of {total})
                    </Button>
                </div>
            )}
            </div>

            {/* ── Settlement Modal (replaces old simple dialog) ── */}
            {showMoveOut && (
                <SettlementModal
                    tenant={showMoveOut}
                    onClose={() => setShowMoveOut(null)}
                    onSuccess={() => { setShowMoveOut(null); fetchTenants(); }}
                />
            )}

            {/* View Checklist Dialog */}
            <Dialog open={!!viewingChecklist} onOpenChange={(open) => !open && setViewingChecklist(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                            Move-in Checklist
                        </DialogTitle>
                        <DialogDescription>
                            Reviewing checklist for <strong>{viewingChecklist?.name}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
                        {(() => {
                            if (!viewingChecklist?.booking?.moveInChecklist) return null;
                            let items = [];
                            try {
                                items = typeof viewingChecklist.booking.moveInChecklist.items === 'string' 
                                    ? JSON.parse(viewingChecklist.booking.moveInChecklist.items) 
                                    : viewingChecklist.booking.moveInChecklist.items;
                            } catch (e) { console.error(e); }

                            if (!items || items.length === 0) return <p className="text-center text-muted-foreground py-8">No items recorded.</p>;

                            return items.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 text-sm">
                                    <span className="font-medium">{item.task}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.status === 'COMPLETED' ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                                        {item.status}
                                    </span>
                                </div>
                            ));
                        })()}
                    </div>

                    <DialogFooter>
                        <Button onClick={() => setViewingChecklist(null)} className="w-full">Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Student Details Dialog */}
            <Dialog open={!!viewingDetails} onOpenChange={(open) => !open && setViewingDetails(null)}>
                <DialogContent className="max-w-4xl md:max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0">
                    {/* Premium glassmorphism header */}
                    {viewingDetails && (() => {
                        const isActive = viewingDetails.status === 'Active';
                        const isBlocked = viewingDetails.status === 'Blocked';
                        const isCheckedOut = viewingDetails.status === 'Checked Out';
                        const isUpcoming = viewingDetails.status === 'Upcoming';
                        const latestRentRecord = viewingDetails.rentRecords?.find((r: any) => r.month === currentMonth);
                        const isOverdue = !latestRentRecord?.paid && isActive;
                        const initials = viewingDetails.name?.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase() || 'T';
                        const statusBadge = isBlocked
                            ? { label: '🚫 Blocked', cls: 'bg-red-100 text-red-700 border-red-200' }
                            : isCheckedOut
                            ? { label: '🏠 Checked Out', cls: 'bg-slate-100 text-slate-600 border-slate-200' }
                            : isUpcoming
                            ? { label: '⏳ Upcoming', cls: 'bg-amber-100 text-amber-700 border-amber-200' }
                            : isOverdue
                            ? { label: '🔴 Overdue', cls: 'bg-red-100 text-red-700 border-red-200' }
                            : { label: '✅ Active', cls: 'bg-green-100 text-green-700 border-green-200' };
                        return (
                            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-6 pt-6 pb-4 rounded-t-xl">
                                <DialogHeader>
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 via-purple-500 to-blue-600 flex items-center justify-center text-white text-xl font-black shadow-lg ring-2 ring-white/20 flex-shrink-0">
                                            {initials}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <DialogTitle className="text-xl font-black text-white truncate">{viewingDetails.name}</DialogTitle>
                                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black border ${statusBadge.cls}`}>
                                                    {statusBadge.label}
                                                </span>
                                                <span className="inline-flex items-center gap-1 bg-purple-900/60 border border-purple-500/30 text-purple-300 text-[9px] font-black px-2.5 py-0.5 rounded-full font-mono">
                                                    🟣 {viewingDetails.displayId || '—'}
                                                </span>
                                                {viewingDetails.booking?.displayId && (
                                                    <span className="inline-flex items-center gap-1 bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 text-[9px] font-black px-2.5 py-0.5 rounded-full font-mono">
                                                        🔵 {viewingDetails.booking.displayId}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <DialogDescription className="text-indigo-300 text-xs mt-2">
                                        {viewingDetails.property?.name || 'Unknown Property'} · Room {viewingDetails.roomNumber} · ₹{viewingDetails.rentAmount || viewingDetails.rent}/month
                                    </DialogDescription>
                                </DialogHeader>
                            </div>
                        );
                    })()}

                    {viewingDetails && (
                        <div className="px-6 pt-4 pb-2">
                        <Tabs defaultValue="tenant-info" className="w-full">
                            <TabsList className="grid w-full grid-cols-3 mb-6 bg-slate-100 p-1 rounded-xl">
                                <TabsTrigger value="tenant-info" className="rounded-lg">Tenant Information</TabsTrigger>
                                <TabsTrigger value="booking-stay" className="rounded-lg">Booking &amp; Stay</TabsTrigger>
                                <TabsTrigger value="paid-history" className="rounded-lg">Tenant Paid History</TabsTrigger>
                            </TabsList>

                            {/* Tab 1: Tenant Information */}
                            <TabsContent value="tenant-info" className="space-y-4">
                                <div className="border rounded-2xl p-6 bg-slate-50 space-y-4 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
                                        👤 Tenant Details
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Full Name</p>
                                            <p className="font-black text-slate-900 text-base">{viewingDetails.name}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">User Permanent ID</p>
                                            <p className="font-mono text-purple-700 font-bold text-base">{viewingDetails.user?.displayId || '—'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">DOB (Date of Birth)</p>
                                            <p className="font-bold text-slate-900 text-base">{viewingDetails.user?.dob ? new Date(viewingDetails.user.dob).toLocaleDateString() : '—'}</p>
                                        </div>
                                        <div className="space-y-1 md:col-span-2">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Phone Number</p>
                                            <p className="text-slate-800 text-base font-bold flex items-center gap-1.5">
                                                📞 {viewingDetails.phone}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Tab 2: Booking & Stay */}
                            <TabsContent value="booking-stay" className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Property Details */}
                                    <div className="border border-indigo-100 rounded-2xl p-6 bg-indigo-50/30 space-y-4 shadow-sm">
                                        <h3 className="text-base font-bold text-indigo-950 border-b border-indigo-100 pb-2">
                                            🏢 Property Details
                                        </h3>
                                        <div className="space-y-3 text-sm">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase text-indigo-400 tracking-wider">PG Name</p>
                                                <p className="font-black text-indigo-900 text-base">{viewingDetails.property?.name || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase text-indigo-400 tracking-wider">Address</p>
                                                <p className="text-slate-700 leading-relaxed font-semibold">
                                                    {viewingDetails.property?.address || '—'}
                                                    {viewingDetails.property?.city ? `, ${viewingDetails.property.city}` : ''}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase text-indigo-400 tracking-wider">Property Code / ID</p>
                                                <p className="font-mono text-indigo-800 font-bold">{viewingDetails.property?.displayId || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase text-indigo-400 tracking-wider">Owner / Manager</p>
                                                <p className="font-bold text-indigo-900">{viewingDetails.property?.owner?.name || viewingDetails.property?.ownerName || '—'}</p>
                                                <p className="text-xs text-indigo-700 font-mono mt-0.5">{viewingDetails.property?.owner?.phone || '—'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tenant Stay Details */}
                                    <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/50 space-y-4 shadow-sm">
                                        <h3 className="text-base font-bold text-slate-800 border-b pb-2">
                                            📋 Tenant Stay Details
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div className="col-span-2">
                                                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Assigned Room</p>
                                                <p className="font-bold text-slate-900">
                                                    {viewingDetails.roomNumber} ({viewingDetails.roomType})
                                                </p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1.5">Booking &amp; Tenant References</p>
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black px-3 py-1.5 rounded-full font-mono shadow-sm">
                                                        🔵 Booking ID: {viewingDetails.booking?.displayId || viewingDetails.bookingId || '—'}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1.5 bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-black px-3 py-1.5 rounded-full font-mono shadow-sm">
                                                        🟣 Tenant ID: {viewingDetails.displayId || '—'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Check-out Date</p>
                                                <p className="font-semibold text-slate-900">
                                                    {viewingDetails.expectedMoveOutDate || 'Active Stay'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Monthly Rent</p>
                                                <p className="font-bold text-slate-900">₹{viewingDetails.rentAmount || viewingDetails.rent}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Deposit Amount</p>
                                                <p className="font-bold text-slate-900">₹{viewingDetails.billingProfile?.securityDeposit || viewingDetails.booking?.depositAmount || '—'}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Food Opted</p>
                                                <p className="font-bold text-slate-900">
                                                    {getFoodDetails(viewingDetails)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Tab 3: Tenant Paid History */}
                            <TabsContent value="paid-history" className="space-y-4">
                                <div className="border rounded-2xl p-6 bg-slate-50 space-y-4 shadow-sm">
                                    {/* GST Disclaimer */}
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
                                        <span className="text-amber-500 text-base leading-none mt-0.5 flex-shrink-0">ℹ️</span>
                                        <p className="text-[11px] text-amber-800 font-semibold leading-relaxed">
                                            <strong>GST Note:</strong> GST @ 18% applicable on platform service fees only. Rent payments are GST-exempt under residential letting provisions (Notification No. 12/2017-Central Tax).
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap justify-between items-center gap-4 border-b pb-4">
                                        <h3 className="text-base font-bold text-slate-800">
                                            💰 Payment History Ledger
                                        </h3>
                                        {/* Year and Month filters */}
                                        <div className="flex gap-2">
                                            <select 
                                                className="border rounded-lg p-1.5 bg-white text-xs font-semibold text-slate-700 shadow-sm"
                                                value={historyYear}
                                                onChange={(e) => setHistoryYear(e.target.value)}
                                            >
                                                <option value="ALL">All Years</option>
                                                {Array.from(new Set((viewingDetails.rentRecords || []).map((r: any) => r.month.split('-')[0]))).sort().map((y: any) => (
                                                    <option key={y} value={y}>{y}</option>
                                                ))}
                                            </select>
                                            <select 
                                                className="border rounded-lg p-1.5 bg-white text-xs font-semibold text-slate-700 shadow-sm"
                                                value={historyMonth}
                                                onChange={(e) => setHistoryMonth(e.target.value)}
                                            >
                                                <option value="ALL">All Months</option>
                                                {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((m) => {
                                                    const name = new Date(2000, Number(m) - 1, 1).toLocaleString('en-IN', { month: 'short' });
                                                    return <option key={m} value={m}>{name}</option>
                                                })}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Table of rent invoices / records */}
                                    <div className="overflow-x-auto border rounded-xl bg-white shadow-inner">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 border-b">
                                                <tr>
                                                    <th className="p-3 text-left font-bold text-slate-600 text-xs">Rent Paid Date</th>
                                                    <th className="p-3 text-left font-bold text-slate-600 text-xs">Description</th>
                                                    <th className="p-3 text-left font-bold text-slate-600 text-xs">Type</th>
                                                    <th className="p-3 text-left font-bold text-slate-600 text-xs">Amount</th>
                                                    <th className="p-3 text-left font-bold text-slate-600 text-xs">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    const filtered = (viewingDetails.rentRecords || []).filter((r: any) => {
                                                        const [y, m] = r.month.split('-');
                                                        const matchYear = historyYear === "ALL" || y === historyYear;
                                                        const matchMonth = historyMonth === "ALL" || m === historyMonth;
                                                        return matchYear && matchMonth;
                                                    });

                                                    if (filtered.length === 0) {
                                                        return (
                                                            <tr>
                                                                <td colSpan={5} className="p-6 text-center text-xs text-slate-400 italic">
                                                                    No payment records match the selected filters.
                                                                </td>
                                                            </tr>
                                                        );
                                                    }

                                                    return filtered.map((r: any) => {
                                                        let pType = "—";
                                                        if (r.note?.includes("Method: ONLINE") || r.note?.includes("admin_online_")) {
                                                            pType = "Online";
                                                        } else if (r.note?.includes("Method: CASH") || r.note?.includes("admin_cash_")) {
                                                            pType = "Cash";
                                                        } else {
                                                            const invoice = viewingDetails.billingProfile?.invoices?.find((inv: any) => inv.month === r.month);
                                                            if (invoice?.paymentMethod) {
                                                                pType = invoice.paymentMethod === 'ONLINE' ? 'Online' : invoice.paymentMethod === 'CASH' ? 'Cash' : 'Bank Transfer';
                                                            }
                                                        }

                                                        return (
                                                            <tr key={r.id} className="border-b last:border-b-0 hover:bg-slate-50/50">
                                                                <td className="p-3 font-semibold text-slate-700">
                                                                    {r.paidOn || (r.paid ? "Yes" : "—")}
                                                                </td>
                                                                <td className="p-3 font-bold text-slate-900">
                                                                    Rent — {formatMonthLabel(r.month)}
                                                                </td>
                                                                <td className="p-3 font-medium text-slate-600">
                                                                    {pType}
                                                                </td>
                                                                <td className="p-3 font-bold text-slate-900">
                                                                    ₹{r.amount?.toLocaleString('en-IN')}
                                                                </td>
                                                                <td className="p-3">
                                                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                                        r.paid ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
                                                                    }`}>
                                                                        {r.paid ? 'Paid' : 'Unpaid'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    });
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                        </div>
                    )}

                    {/* ── Color Legend ── */}
                    <div className="mx-6 mb-4 border border-slate-100 rounded-2xl bg-gradient-to-r from-slate-50 to-white px-5 py-4">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2.5">Color System Legend</p>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-2">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
                                <span className="text-[9px] text-slate-600 font-bold">Green = Active / Paid</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
                                <span className="text-[9px] text-slate-600 font-bold">Amber = Pending</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                                <span className="text-[9px] text-slate-600 font-bold">Red = Overdue / Blocked</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 flex-shrink-0" />
                                <span className="text-[9px] text-slate-600 font-bold">Purple = Tenant / User IDs</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 flex-shrink-0" />
                                <span className="text-[9px] text-slate-600 font-bold">Indigo = Booking / Property</span>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="px-6 pb-6">
                        <Button onClick={() => setViewingDetails(null)} className="w-full bg-gradient-to-r from-slate-900 to-indigo-950 text-white hover:from-slate-800 hover:to-indigo-900 font-black tracking-wide">Close Profile</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Initiate Move-Out Dialog */}
            <Dialog open={!!initiatingMoveOut} onOpenChange={(open) => !open && setInitiatingMoveOut(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            🚶 Initiate Move-Out Request
                        </DialogTitle>
                        <DialogDescription>
                            Initiate a move-out notice for this tenant. This will notify the student and create a notice in the Vacating Notices tab.
                        </DialogDescription>
                    </DialogHeader>

                    {initiatingMoveOut && (
                        <div className="space-y-4 pt-4">
                            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
                                <p className="text-sm font-black text-rose-800">You are initiating move-out for:</p>
                                <p className="text-base font-black text-slate-950 mt-1">{initiatingMoveOut.name}</p>
                                <p className="text-xs text-slate-500 mt-0.5">Room {initiatingMoveOut.roomNumber} · {initiatingMoveOut.property?.name}</p>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-500">Planned Move-Out Date</label>
                                <Input 
                                    type="date" 
                                    value={moveOutDate} 
                                    onChange={e => setMoveOutDate(e.target.value)} 
                                    className="w-full"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-500">Reason for Move-Out (Mandatory)</label>
                                <textarea
                                    rows={3}
                                    value={moveOutReason}
                                    onChange={e => setMoveOutReason(e.target.value)}
                                    placeholder="e.g. Completed academic year, requested eviction, lease expiration."
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none font-medium text-slate-800"
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex gap-2">
                        <Button 
                            variant="outline" 
                            onClick={() => setInitiatingMoveOut(null)} 
                            disabled={initiatingNoticeBusy} 
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleInitiateNotice} 
                            disabled={initiatingNoticeBusy || !moveOutReason.trim() || !moveOutDate}
                            className="flex-1 bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center gap-1.5"
                        >
                            {initiatingNoticeBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Initiate Move-Out'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
