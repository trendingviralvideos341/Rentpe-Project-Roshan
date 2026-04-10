"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, Calendar, Home, ArrowRightLeft, CheckCircle2, Clock, Info } from "lucide-react";
import { getTenantsByCategory, confirmMoveIn, confirmMoveOut, approveMoveOutRequest } from "@/actions/tenants";
import { toast } from "sonner";

interface TenantLifecycleManagerProps {
    ownerId: string;
}

const CATEGORIES = [
    { id: 'UPCOMING', label: 'Arrivals',   icon: Calendar,       bg: 'bg-blue-50',   text: 'text-blue-700' },
    { id: 'ACTIVE',   label: 'In-House',   icon: User,           bg: 'bg-indigo-50', text: 'text-indigo-700' },
    { id: 'MOVE_OUT', label: 'Move-Out',   icon: ArrowRightLeft, bg: 'bg-amber-50',  text: 'text-amber-700' },
    { id: 'PAST',     label: 'Past Stays', icon: Clock,          bg: 'bg-slate-50',  text: 'text-slate-600' },
] as const;

export function TenantLifecycleManager({ ownerId }: TenantLifecycleManagerProps) {
    const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]['id']>('ACTIVE');
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Move-out modal state
    const [moveOutModal, setMoveOutModal] = useState<{ id: string } | null>(null);
    const [deductions, setDeductions] = useState("0");
    const [closureNote, setClosureNote] = useState("Final settlement cleared.");

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getTenantsByCategory(ownerId, activeCategory);
            setTenants(data);
        } catch (e) {
            toast.error("Failed to load tenants");
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
                        {loading ? (
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
                                                        <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">{tenant.displayId}</p>
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
