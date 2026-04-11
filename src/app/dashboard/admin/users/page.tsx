"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Ban, CheckCircle, Search, RefreshCcw, Building, ChevronDown, ChevronUp, AlertTriangle, Eye, Star, X, Ghost } from "lucide-react";
import { getUsers, updateUserStatus, updateUserPoints } from "@/actions/admin";
import { impersonateUser } from "@/actions/admin-auth";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Points Modal ──────────────────────────────────────
function PointsModal({ user, onConfirm, onCancel }: { user: any; onConfirm: (points: number, reason: string) => void; onCancel: () => void }) {
    const [points, setPoints] = useState(user.loyaltyPoints || 0);
    const [reason, setReason] = useState("");
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-indigo-100">
                        <Star className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">Manage Loyalty Points</h3>
                        <p className="text-sm text-muted-foreground">{user.name} · Currently: {user.loyaltyPoints || 0} Points</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-muted-foreground uppercase text-[10px] font-black">New Points Balance</label>
                        <Input type="number" value={points} onChange={e => setPoints(parseInt(e.target.value) || 0)} className="font-black text-xl h-14 border-2 border-indigo-100 focus:border-indigo-500 rounded-xl" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-muted-foreground uppercase text-[10px] font-black">Reason for Adjustment *</label>
                        <textarea value={reason} onChange={e => setReason(e.target.value)}
                            placeholder="e.g., Reward for on-time payment, manual correction, etc."
                            className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm resize-none h-24 focus:outline-none focus:border-indigo-500 transition-all" />
                    </div>
                </div>
                <div className="flex gap-3 justify-end pt-4">
                    <button onClick={onCancel} className="px-8 py-2.5 text-xs font-black bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-full transition-all active:scale-95 shadow-sm uppercase tracking-widest">
                        CANCEL
                    </button>
                    <button disabled={!reason.trim()} onClick={() => onConfirm(points, reason)}
                        className="px-8 py-2.5 text-xs rounded-full text-white font-black bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" /> Save Adjustments
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Block/Unblock Modal ──────────────────────────────────
function BlockModal({ user, onConfirm, onCancel }: { user: any; onConfirm: (reason: string) => void; onCancel: () => void }) {
    const [reason, setReason] = useState("");
    const isBanned = user.status === "BANNED";
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${isBanned ? "bg-green-100" : "bg-red-100"}`}>
                        <AlertTriangle className={`h-5 w-5 ${isBanned ? "text-green-600" : "text-red-600"}`} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">{isBanned ? "Unblock" : "Block"} Account</h3>
                        <p className="text-sm text-muted-foreground">{user.name} · {user.email}</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Reason for Action *</label>
                        <textarea value={reason} onChange={e => setReason(e.target.value)}
                            placeholder={isBanned ? "Why are you restoring this account?" : "Why are you blocking this account?"}
                            className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm resize-none h-28 focus:outline-none focus:border-red-500 focus:bg-red-50/10 transition-all font-medium" />
                    </div>
                </div>
                <div className="flex gap-3 justify-end pt-4">
                    <button onClick={onCancel} className="px-8 py-3 text-xs font-black bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-full transition-all active:scale-95 shadow-sm uppercase tracking-widest">
                        CANCEL
                    </button>
                    <button disabled={!reason.trim()} onClick={() => onConfirm(reason)}
                        className={cn(
                            "px-8 py-2.5 text-xs rounded-full text-white font-black transition-all flex items-center gap-2 shadow-lg",
                            isBanned 
                                ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" 
                                : "bg-red-600 hover:bg-red-700 shadow-red-200"
                        )}>
                        {isBanned ? <CheckCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                        {isBanned ? "Restore Account" : "Block Account"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Impersonate (God Mode) Modal ─────────────────────────
function ImpersonateModal({ user, onConfirm, onCancel }: { user: any; onConfirm: (reason: string) => void; onCancel: () => void }) {
    const [reason, setReason] = useState("");
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-gray-900 border-4 border-red-600 rounded-3xl p-8 w-full max-w-lg shadow-[0_0_50px_rgba(220,38,38,0.3)] space-y-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent"></div>
                
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-red-100 animate-pulse">
                        <Ghost className="h-8 w-8 text-red-600" />
                    </div>
                    <div>
                        <h3 className="font-black text-2xl text-slate-900 tracking-tight">Enter God Mode</h3>
                        <p className="text-sm font-bold text-red-600 uppercase tracking-widest">Target: {user.name}</p>
                    </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase">
                        <AlertTriangle className="h-4 w-4" /> Security Notice
                    </div>
                    <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                        You are about to impersonate another user. This action grants full access to their private data and dashboard. 
                        <strong> This session will be tied to your Admin ID for audit trailing.</strong>
                    </p>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-1">Justification for Access *</label>
                    <textarea 
                        autoFocus
                        value={reason} 
                        onChange={e => setReason(e.target.value)}
                        placeholder="e.g., Troubleshooting rent receipt generation error... (Min 5 chars)"
                        className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm resize-none h-32 focus:outline-none focus:border-red-600 focus:bg-red-50/5 transition-all font-bold placeholder:font-normal" 
                    />
                </div>

                <div className="flex gap-4 pt-2">
                    <button onClick={onCancel} className="flex-1 py-4 text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl transition-all uppercase tracking-widest">
                        ABORT
                    </button>
                    <button 
                        disabled={reason.trim().length < 5} 
                        onClick={() => onConfirm(reason)}
                        className="flex-2 px-8 py-4 text-xs rounded-2xl text-white font-black bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl shadow-red-200 uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                        Initiate God Mode <ArrowRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminUsersPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const routerRole = searchParams.get("role");
    const routerStatus = searchParams.get("status");
    
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<string>(routerRole || (routerStatus === "SUSPENDED" ? "SUSPENDED" : "ALL"));
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState(routerStatus || "ALL");
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const [blockTarget, setBlockTarget] = useState<any | null>(null);
    const [pointsTarget, setPointsTarget] = useState<any | null>(null);
    const [impersonateTarget, setImpersonateTarget] = useState<any | null>(null);
    const [processing, setProcessing] = useState(false);

    // Sync tab with URL params
    useEffect(() => {
        if (routerRole) setTab(routerRole);
        else if (routerStatus === "SUSPENDED") setTab("SUSPENDED");
        else setTab("ALL");
        
        if (routerStatus) setFilterStatus(routerStatus);
        else setFilterStatus("ALL");
    }, [routerRole, routerStatus]);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getUsers();
            setUsers(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    async function handleBlockConfirm(reason: string) {
        if (!blockTarget) return;
        setProcessing(true);
        try {
            const newStatus = blockTarget.status === "BANNED" ? "ACTIVE" : "BANNED";
            await updateUserStatus(blockTarget.id, newStatus, reason);
            toast.success(newStatus === "BANNED" ? "User blocked successfully." : "User account restored.");
            fetchUsers();
        } catch {
            toast.error("Failed to update user status.");
        } finally {
            setProcessing(false);
            setBlockTarget(null);
        }
    }

    async function handlePointsConfirm(points: number, reason: string) {
        if (!pointsTarget) return;
        setProcessing(true);
        try {
            await updateUserPoints(pointsTarget.id, points, reason);
            toast.success("Loyalty points updated successfully.");
            fetchUsers();
        } catch {
            toast.error("Failed to update points.");
        } finally {
            setProcessing(false);
            setPointsTarget(null);
        }
    }

    async function handleImpersonateConfirm(reason: string) {
        if (!impersonateTarget) return;
        setProcessing(true);
        try {
            const url = await impersonateUser(impersonateTarget.id, reason);
            window.location.href = url;
        } catch (e: any) {
            toast.error(e.message || "Failed to impersonate user.");
        } finally {
            setProcessing(false);
            setImpersonateTarget(null);
        }
    }

    const handleImpersonate = (user: any) => {
        setImpersonateTarget(user);
    };

    const counts = {
        ALL: users.length,
        STUDENT: users.filter(u => u.role === "STUDENT" || u.role === "USER").length,
        OWNER: users.filter(u => u.role === "OWNER").length,
        EMPLOYEE: users.filter(u => ["ADMIN", "ONBOARDER", "VERIFIER"].includes(u.role)).length,
        SUSPENDED: users.filter(u => u.status === "BANNED" || u.status === "SUSPENDED").length,
    };

    const filtered = users
        .filter(u => {
            if (tab === "ALL") return true;
            if (tab === "STUDENT") return u.role === "STUDENT" || u.role === "USER";
            if (tab === "OWNER") return u.role === "OWNER";
            if (tab === "EMPLOYEE") return ["ADMIN", "ONBOARDER", "VERIFIER"].includes(u.role);
            if (tab === "SUSPENDED") return u.status === "BANNED" || u.status === "SUSPENDED";
            return true;
        })
        .filter(u => filterStatus === "ALL" || u.status === filterStatus)
        .filter(u =>
            (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase()) ||
            (u.id || "").includes(search)
        );

    return (
        <div className="space-y-6">
            {blockTarget && <BlockModal user={blockTarget} onConfirm={handleBlockConfirm} onCancel={() => setBlockTarget(null)} />}
            {pointsTarget && <PointsModal user={pointsTarget} onConfirm={handlePointsConfirm} onCancel={() => setPointsTarget(null)} />}
            {impersonateTarget && <ImpersonateModal user={impersonateTarget} onConfirm={handleImpersonateConfirm} onCancel={() => setImpersonateTarget(null)} />}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold">User Management</h1>
                    <p className="text-muted-foreground">Manage students, owners and employees. Secure oversight of all platform accounts.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            {/* Expanded Tabs */}
            <div className="flex gap-2 flex-wrap">
                {[
                    { id: "ALL", label: "All Users", color: "slate" },
                    { id: "STUDENT", label: "Students", color: "blue" },
                    { id: "OWNER", label: "Owners", color: "purple" },
                    { id: "EMPLOYEE", label: "Employees", color: "teal" },
                    { id: "SUSPENDED", label: "Suspended", color: "red" },
                ].map(t => (
                    <Button
                        key={t.id}
                        onClick={() => {
                            setTab(t.id);
                            const params = new URLSearchParams(window.location.search);
                            if (t.id === "ALL") params.delete("role");
                            else if (t.id === "SUSPENDED") { params.delete("role"); params.set("status", "SUSPENDED"); }
                            else { params.set("role", t.id); params.delete("status"); }
                            router.push(`/dashboard/admin/users?${params.toString()}`);
                        }}
                        variant={tab === t.id ? "default" : "outline"}
                        className={cn(
                            "h-9 px-4 rounded-full text-xs font-bold transition-all",
                            tab === t.id ? "" : `border-${t.color}-200 text-${t.color}-600 hover:bg-${t.color}-50`
                        )}
                    >
                        {t.label} ({counts[t.id as keyof typeof counts]})
                    </Button>
                ))}
            </div>

            {/* Filters */}
            <div className="flex gap-4 items-center">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-10 h-11 rounded-xl shadow-sm" placeholder="Search by name, email, or ID..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="border rounded-xl p-2 bg-background text-sm h-11 px-4 shadow-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="ALL">All Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="BANNED">Blocked</option>
                    <option value="SUSPENDED">Suspended</option>
                </select>
            </div>

            {/* Table */}
            <Card className="rounded-2xl shadow-sm border-slate-200 overflow-hidden">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="p-4 text-left text-xs font-black uppercase text-slate-500">User Identity</th>
                                    <th className="p-4 text-left text-xs font-black uppercase text-slate-500">Role & Access</th>
                                    <th className="p-4 text-left text-xs font-black uppercase text-slate-500">Contact</th>
                                    <th className="p-4 text-left text-xs font-black uppercase text-slate-500">{tab === "OWNER" ? "Properties" : "History"}</th>
                                    <th className="p-4 text-left text-xs font-black uppercase text-slate-500">Status</th>
                                    <th className="p-4 text-right text-xs font-black uppercase text-slate-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan={6} className="p-20 text-center animate-pulse text-slate-400">Loading platform users...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={6} className="p-20 text-center text-muted-foreground">No users found in this category.</td></tr>
                                ) : (
                                    filtered.map(user => {
                                        const isBanned = user.status === "BANNED" || user.status === "SUSPENDED";
                                        return (
                                            <tr key={user.id} className={`hover:bg-slate-50/50 transition-colors ${isBanned ? "bg-red-50/30" : ""}`}>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 uppercase">
                                                            {user.name?.charAt(0) || "U"}
                                                        </div>
                                                        <div>
                                                            <Link href={`/dashboard/admin/users/${user.id}`} className="font-bold text-slate-900 hover:text-blue-600 transition-colors flex items-center gap-1">
                                                                {user.name} <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                                                            </Link>
                                                            <div className="text-[10px] font-mono text-slate-400">{user.displayId || user.id.slice(0, 8)}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                                                        user.role === "OWNER" ? "bg-purple-100 text-purple-700 border-purple-200" :
                                                        ["ADMIN", "ONBOARDER", "VERIFIER"].includes(user.role) ? "bg-teal-100 text-teal-700 border-teal-200" :
                                                        "bg-blue-100 text-blue-700 border-blue-200"
                                                    )}>
                                                        {user.role}
                                                    </span>
                                                    <div className="text-[10px] text-slate-400 mt-1">Member since {new Date(user.createdAt).toLocaleDateString()}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-sm text-slate-600">{user.email}</div>
                                                    <div className="text-xs font-medium text-slate-500">{user.phone || "—"}</div>
                                                </td>
                                                <td className="p-4">
                                                    {user.role === "OWNER" ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-slate-700">{user.properties?.length || 0}</span>
                                                            <span className="text-[10px] uppercase text-slate-400 font-bold">Listings</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-slate-700">{user.bookings?.length || 0}</span>
                                                            <span className="text-[10px] uppercase text-slate-400 font-bold">Bookings</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {isBanned ? (
                                                        <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-red-100 text-red-700 border border-red-200 uppercase tracking-tighter">Suspended</span>
                                                    ) : (
                                                        <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-green-100 text-green-700 border border-green-200 uppercase tracking-tighter">Active</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Link href={`/dashboard/admin/users/${user.id}`} title="View Detailed Profile">
                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        </Link>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-orange-600 hover:bg-orange-50" onClick={() => setPointsTarget(user)} title="Manage Loyalty Points">
                                                            <Star className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => handleImpersonate(user)} title="God Mode: Impersonate User">
                                                            <Ghost className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => setBlockTarget(user)} title={isBanned ? "Restore Account" : "Block Account"}>
                                                            <Ban className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
