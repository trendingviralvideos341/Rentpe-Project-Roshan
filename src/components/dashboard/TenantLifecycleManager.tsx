"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Calendar, Home, ArrowRightLeft, CheckCircle2, XCircle, Clock, Trash2, Info, CreditCard } from "lucide-react";
import { getTenantsByCategory, confirmMoveIn, confirmMoveOut, approveMoveOutRequest } from "@/actions/tenants";
import { toast } from "sonner";
import { LucideIcon } from "lucide-react";

interface TenantLifecycleManagerProps {
    ownerId: string;
}

const CATEGORIES = [
    { id: 'UPCOMING', label: 'Upcoming Arrivals', icon: Calendar, color: 'text-blue-600 bg-blue-50' },
    { id: 'ACTIVE', label: 'In-House Tenants', icon: User, color: 'text-indigo-600 bg-indigo-50' },
    { id: 'MOVE_OUT', label: 'Move-Out Requests', icon: ArrowRightLeft, color: 'text-amber-600 bg-amber-50' },
    { id: 'PAST', label: 'Past Stays', icon: Clock, color: 'text-slate-600 bg-slate-50' },
] as const;

export function TenantLifecycleManager({ ownerId }: TenantLifecycleManagerProps) {
    const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]['id']>('ACTIVE');
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

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

    const handleConfirmMoveIn = async (id: string) => {
        if (!confirm("Confirm move-in for this tenant? This will mark the bed as OCCUPIED.")) return;
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
    };

    const handleFinalizeMoveOut = async (id: string) => {
        const deductions = prompt("Enter any deductions (e.g. damages, unpaid bills):", "0");
        if (deductions === null) return;
        
        const note = prompt("Closure note (visible to tenant):", "Final settlement cleared.");
        if (note === null) return;

        setProcessingId(id);
        try {
            await confirmMoveOut(id, parseFloat(deductions) || 0, note);
            toast.success("Tenant successfully moved out. Bed is now AVAILABLE.");
            fetchData();
        } catch (e: any) {
            toast.error(e.message || "Action failed");
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <Card className="border-none shadow-xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-6">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-2xl font-black text-slate-900">Tenant Lifecycle Management</CardTitle>
                        <CardDescription className="text-slate-500 font-medium">Manage arrivals, stay status, and departures.</CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-white border-slate-200 text-slate-600 px-3 py-1 font-bold">
                        {loading ? "Syncing..." : `${tenants.length} Records`}
                    </Badge>
                </div>
            </CardHeader>

            <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as any)} className="w-full">
                <TabsList className="flex w-full p-1 bg-slate-100 rounded-none h-auto">
                    {CATEGORIES.map((cat) => (
                        <TabsTrigger 
                            key={cat.id} 
                            value={cat.id}
                            className="flex-1 py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 transition-all gap-2 font-bold text-xs uppercase tracking-tighter"
                        >
                            <cat.icon className={`h-4 w-4 ${cat.color} rounded p-0.5`} />
                            {cat.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <CardContent className="p-0">
                    <div className="min-h-[400px]">
                        {loading ? (
                            <div className="p-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest text-xs">
                                Loading stays...
                            </div>
                        ) : tenants.length === 0 ? (
                            <div className="p-20 text-center flex flex-col items-center gap-4">
                                <Info className="h-12 w-12 text-slate-200" />
                                <p className="text-slate-400 font-bold text-sm">No records found for this stage.</p>
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
            </Tabs>
        </Card>
    );
}
