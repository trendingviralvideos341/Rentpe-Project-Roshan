"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, Calendar, Home, ArrowRightLeft, CheckCircle2, Clock, Info, History, ArrowUp, ArrowDown, Loader2, Shield, FileText, AlertTriangle } from "lucide-react";
import { getTenantsByCategory, confirmMoveIn, confirmMoveOut, approveMoveOutRequest } from "@/actions/tenants";
import { countersignAgreement } from "@/actions/bookings";
import { getTenantMovementLog } from "@/actions/ownerRentCollection";
import { toast } from "sonner";

interface TenantLifecycleManagerProps {
    ownerId: string;
}

const CATEGORIES = [
    { id: 'AGREEMENTS', label: 'Sign Agreements', icon: Shield,        bg: 'bg-violet-50',  text: 'text-violet-700' },
    { id: 'UPCOMING',   label: 'Arrivals',        icon: Calendar,       bg: 'bg-blue-50',    text: 'text-blue-700' },
    { id: 'ACTIVE',     label: 'In-House',        icon: User,           bg: 'bg-indigo-50',  text: 'text-indigo-700' },
    { id: 'MOVE_OUT',   label: 'Move-Out',        icon: ArrowRightLeft, bg: 'bg-amber-50',   text: 'text-amber-700' },
    { id: 'PAST',       label: 'Past Stays',      icon: Clock,          bg: 'bg-slate-50',   text: 'text-slate-600' },
    { id: 'LOG',        label: 'History',         icon: History,        bg: 'bg-purple-50',  text: 'text-purple-700' },
] as const;

export function TenantLifecycleManager({ ownerId }: TenantLifecycleManagerProps) {
    const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]['id']>('AGREEMENTS');
    const [tenants, setTenants] = useState<any[]>([]);
    const [pendingAgreements, setPendingAgreements] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Move-out modal state
    const [moveOutModal, setMoveOutModal] = useState<{ id: string } | null>(null);
    const [deductions, setDeductions] = useState("0");
    const [closureNote, setClosureNote] = useState("Final settlement cleared.");

    const fetchData = useCallback(async () => {
        if (activeCategory === 'LOG') return;
        setLoading(true);
        try {
            if (activeCategory === 'AGREEMENTS') {
                // Fetch bookings where tenant signed but owner hasn't countersigned yet
                const { getPendingCountersignBookings } = await import('@/actions/bookings');
                const data = await getPendingCountersignBookings();
                setPendingAgreements(data);
            } else {
                const data = await getTenantsByCategory(ownerId, activeCategory as Exclude<typeof activeCategory, 'LOG' | 'AGREEMENTS'>);
                setTenants(data);
            }
        } catch (e) {
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    }, [ownerId, activeCategory]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleConfirmMoveIn = (id: string) => {
        toast("Confirm move-in for this tenant?", {
            description: "This marks the bed as OCCUPIED.",
            action: {
                label: "Confirm",
                onClick: async () => {
                    setProcessingId(id);
                    try {
                        await confirmMoveIn(id);
                        toast.success("Move-in confirmed!");
                        fetchData();
                    } catch (e: any) {
                        toast.error(e.message || "Action failed");
                    } finally {
                        setProcessingId(null);
                    }
                },
            },
        });
    };

    const handleCountersign = (bookingId: string, tenantName: string) => {
        toast(`Countersign agreement for ${tenantName}?`, {
            description: 'Your name will be recorded as the authorized signatory. This is legally binding.',
            action: {
                label: 'Countersign Now',
                onClick: async () => {
                    setProcessingId(bookingId);
                    try {
                        const result = await countersignAgreement(bookingId);
                        toast.success(`✅ Agreement countersigned by ${result.countersignedBy}`);
                        fetchData();
                    } catch (e: any) {
                        toast.error(e.message || 'Countersign failed');
                    } finally {
                        setProcessingId(null);
                    }
                },
            },
        });
    };

    const handleFinalizeMoveOut = (id: string) => {
        setDeductions("0");
        setClosureNote("Final settlement cleared.");
        setMoveOutModal({ id });
    };

    const confirmMoveOutAction = async () => {
        if (!moveOutModal) return;
        setProcessingId(moveOutModal.id);
        try {
            await confirmMoveOut(moveOutModal.id, parseFloat(deductions) || 0, closureNote);
            toast.success("Tenant moved out. Bed is now AVAILABLE.");
            setMoveOutModal(null);
            fetchData();
        } catch (e: any) {
            toast.error(e.message || "Action failed");
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <Card className="border-none shadow-xl bg-white overflow-hidden">
            <CardHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-xl font-black text-slate-900">
                            Tenant Lifecycle
                        </CardTitle>
                        <CardDescription className="text-slate-400 text-sm mt-0.5">
                            Manage arrivals, stays and departures.
                        </CardDescription>
                    </div>
                    <span className="text-xs font-bold bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full">
                        {loading ? "Syncing..." : `${tenants.length} Records`}
                    </span>
                </div>
            </CardHeader>

            <div className="w-full">
                {/* Custom pill tab buttons — colored, fully labeled, no Tabs component */}
                <div className="flex flex-wrap gap-2 px-4 py-3 border-b bg-white">
                    {CATEGORIES.map((cat) => {
                        const isActive = activeCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id as any)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all border ${
                                    isActive
                                        ? `${cat.bg} ${cat.text} border-current shadow-sm scale-[1.02]`
                                        : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-slate-600'
                                }`}
                            >
                                <cat.icon className="h-3.5 w-3.5 shrink-0" />
                                <span>{cat.label}</span>
                            </button>
                        );
                    })}
                </div>

                <CardContent className="p-0">
                    <div className="min-h-[400px]">
                        {activeCategory === 'LOG' ? (
                            <TenantLogInline ownerId={ownerId} />
                        ) : activeCategory === 'AGREEMENTS' ? (
                            loading ? (
                                <div className="p-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest text-xs">Loading agreements...</div>
                            ) : pendingAgreements.length === 0 ? (
                                <div className="py-16 text-center flex flex-col items-center gap-3">
                                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                                        <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                                    </div>
                                    <p className="text-slate-400 text-sm font-medium">No pending agreements — all up to date!</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {/* Blinking banner */}
                                    <div className="px-6 py-3 bg-violet-50 border-b border-violet-100 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-violet-500 animate-ping inline-block"></span>
                                        <p className="text-xs font-black text-violet-700">{pendingAgreements.length} agreement{pendingAgreements.length > 1 ? 's' : ''} awaiting your countersignature</p>
                                    </div>
                                    {pendingAgreements.map((b: any) => (
                                        <div key={b.id} className="px-6 py-4 flex items-start justify-between gap-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex items-start gap-4">
                                                <div className="h-11 w-11 rounded-xl bg-violet-100 flex items-center justify-center font-black text-violet-700 text-base shrink-0">
                                                    {b.guestName?.charAt(0)?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-900 text-sm">{b.guestName}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase">{b.displayId}</p>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">{b.propertyName}</span>
                                                        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-bold">{b.roomAssigned || 'Room TBD'}</span>
                                                        <span className="text-[10px] bg-violet-50 text-violet-600 px-2 py-0.5 rounded font-bold">
                                                            Signed: {b.agreementSignedAt ? new Date(b.agreementSignedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 mt-1 font-mono">Ref: {b.agreementId || b.displayId}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2 shrink-0 items-end">
                                                <Button
                                                    size="sm"
                                                    className="bg-violet-600 hover:bg-violet-700 text-white font-black h-9 px-4 text-[11px] shadow-md shadow-violet-200"
                                                    disabled={processingId === b.id}
                                                    onClick={() => handleCountersign(b.id, b.guestName)}
                                                >
                                                    <Shield className="h-3.5 w-3.5 mr-1.5" />
                                                    {processingId === b.id ? 'Signing...' : 'Countersign'}
                                                </Button>
                                                <p className="text-[9px] text-slate-400 font-bold text-right">Your name will be recorded</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : loading ? (
                            <div className="p-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest text-xs">
                                Loading stays...
                            </div>
                        ) : tenants.length === 0 ? (
                            <div className="py-16 text-center flex flex-col items-center gap-3">
                                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                                    <Info className="h-6 w-6 text-slate-300" />
                                </div>
                                <p className="text-slate-400 text-sm font-medium">
                                    No records for this stage
                                </p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="hover:bg-transparent border-slate-100">
                                        <TableHead className="font-black text-slate-400 text-[10px] uppercase tracking-widest px-6 h-12">Tenant</TableHead>
                                        <TableHead className="font-black text-slate-400 text-[10px] uppercase tracking-widest h-12">Stay Info</TableHead>
                                        <TableHead className="font-black text-slate-400 text-[10px] uppercase tracking-widest h-12 text-right px-6">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tenants.map((tenant) => (
                                        <TableRow key={tenant.id} className="hover:bg-slate-50/50 border-slate-100 group">
                                            <TableCell className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm">
                                                        {tenant.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-slate-800 text-sm leading-none">{tenant.name}</p>
                                                        <div className="flex gap-1.5 mt-1">
                                                            <span className="text-[9px] text-slate-400 font-bold uppercase border border-slate-200 px-1 rounded">{tenant.displayId}</span>
                                                            {tenant.booking?.displayId && (
                                                                <span className="text-[9px] text-indigo-400 font-bold uppercase border border-indigo-100 px-1 rounded">Ref: {tenant.booking.displayId}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                                        <Home className="h-3 w-3 text-indigo-500" /> {tenant.roomNumber} ({tenant.roomType})
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
                                                        <Calendar className="h-3 w-3" /> Since {new Date(tenant.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right px-6">
                                                <div className="flex justify-end gap-2">
                                                    {activeCategory === 'UPCOMING' && (
                                                        <Button
                                                            size="sm"
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-[11px] shadow-sm"
                                                            disabled={processingId === tenant.id}
                                                            onClick={() => handleConfirmMoveIn(tenant.id)}
                                                        >
                                                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                                            {processingId === tenant.id ? "Processing..." : "Confirm Move-in"}
                                                        </Button>
                                                    )}
                                                    {activeCategory === 'ACTIVE' && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 text-[11px] font-bold border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
                                                            disabled={processingId === tenant.id}
                                                            onClick={() => handleFinalizeMoveOut(tenant.id)}
                                                        >
                                                            <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
                                                            Trigger Move-out
                                                        </Button>
                                                    )}
                                                    {activeCategory === 'MOVE_OUT' && (
                                                        <Button
                                                            size="sm"
                                                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-8 text-[11px] shadow-sm"
                                                            disabled={processingId === tenant.id}
                                                            onClick={() => handleFinalizeMoveOut(tenant.id)}
                                                        >
                                                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                                            Finalize Settlement
                                                        </Button>
                                                    )}
                                                    {activeCategory === 'PAST' && (
                                                        <Button variant="ghost" size="sm" className="h-8 text-[11px] font-bold text-slate-400 cursor-default">
                                                            Stay Completed
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </CardContent>
            </div>

            {/* Move-out modal */}
            {moveOutModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
                    <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-4 shadow-2xl">
                        <h3 className="font-black text-lg text-slate-900">Finalize Move-Out</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                                    Damage / Deductions (₹)
                                </label>
                                <input
                                    type="number"
                                    value={deductions}
                                    onChange={e => setDeductions(e.target.value)}
                                    className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                                    Closure note (visible to tenant)
                                </label>
                                <textarea
                                    value={closureNote}
                                    onChange={e => setClosureNote(e.target.value)}
                                    className="w-full border rounded-xl p-3 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-amber-300"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setMoveOutModal(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 bg-amber-600 hover:bg-amber-700"
                                disabled={!!processingId}
                                onClick={confirmMoveOutAction}
                            >
                                {processingId ? "Processing..." : "Finalize Settlement"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
}

// ── Inline History sub-component ────────────────────────────────────────────
function getMonthOptions() {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
            value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            label: d.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
        });
    }
    return months;
}

export function TenantLogInline({ ownerId }: { ownerId: string }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedProperty, setSelectedProperty] = useState('');
    const [eventFilter, setEventFilter] = useState<'ALL' | 'MOVE_IN' | 'MOVE_OUT'>('ALL');
    const months = getMonthOptions();

    const reload = (property?: string, month?: string) => {
        setLoading(true);
        getTenantMovementLog(property || undefined, month || undefined).then(result => {
            setData(result);
            setLoading(false);
        });
    };

    useEffect(() => { reload(selectedProperty, selectedMonth); }, [selectedProperty, selectedMonth]);

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>;

    const { summary, properties } = data || { summary: { moveIns: 0, moveOuts: 0, netChange: 0 }, properties: [] };
    const filteredEvents = (data?.events || []).filter((e: any) => eventFilter === 'ALL' || e.type === eventFilter);

    return (
        <div className="p-4 space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Move-Ins', val: summary.moveIns, icon: ArrowUp, color: 'text-emerald-500' },
                    { label: 'Move-Outs', val: summary.moveOuts, icon: ArrowDown, color: 'text-red-500' },
                    { label: 'Net Change', val: summary.netChange >= 0 ? `+${summary.netChange}` : summary.netChange, icon: summary.netChange >= 0 ? ArrowUp : ArrowDown, color: summary.netChange >= 0 ? 'text-emerald-500' : 'text-red-500' },
                ].map(card => (
                    <div key={card.label} className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100">
                        <card.icon className={`w-4 h-4 ${card.color} mx-auto mb-1`} />
                        <p className="text-xl font-black text-slate-900">{card.val}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{card.label}</p>
                    </div>
                ))}
            </div>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
                <select value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none">
                    <option value="">All Properties</option>
                    {properties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none">
                    <option value="">All Time</option>
                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-xl">
                    {(['ALL', 'MOVE_IN', 'MOVE_OUT'] as const).map(f => (
                        <button key={f} onClick={() => setEventFilter(f)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${eventFilter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>
                            {f.replace('_', '-')}
                        </button>
                    ))}
                </div>
            </div>
            {/* Timeline */}
            {filteredEvents.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                    <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="font-bold">No movement events found</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredEvents.map((event: any) => (
                        <div key={event.id} className={`flex items-center gap-3 p-3 rounded-xl border ${event.type === 'MOVE_IN' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                            <span className="text-lg">{event.type === 'MOVE_IN' ? '🟢' : '🔴'}</span>
                            <div className="flex-1">
                                <p className="font-black text-slate-900 text-sm">{event.tenantName}</p>
                                <p className="text-xs text-slate-500">Room {event.roomNumber} · {event.propertyName}</p>
                            </div>
                            <p className="text-xs font-bold text-slate-600">{new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
