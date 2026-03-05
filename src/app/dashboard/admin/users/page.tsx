"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Ban, CheckCircle, Search, RefreshCcw, Building, ChevronDown, ChevronUp, AlertTriangle, Eye } from "lucide-react";
import { getUsers, updateUserStatus } from "@/actions/admin";
import { impersonateUser } from "@/actions/admin-auth";

// ── Block/Unblock Modal ──────────────────────────────────
function BlockModal({ user, onConfirm, onCancel }: { user: any; onConfirm: (reason: string) => void; onCancel: () => void }) {
    const [reason, setReason] = useState("");
    const isBanned = user.status === "BANNED";
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
                <div className="space-y-1">
                    <label className="text-sm font-medium">Reason *</label>
                    <textarea value={reason} onChange={e => setReason(e.target.value)}
                        placeholder={isBanned ? "Why are you restoring this account?" : "Why are you blocking this account?"}
                        className="w-full border rounded-lg p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="flex gap-2 justify-end">
                    <button onClick={onCancel} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">Cancel</button>
                    <button disabled={!reason.trim()} onClick={() => onConfirm(reason)}
                        className={`px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50 ${isBanned ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}>
                        {isBanned ? "✅ Restore Account" : "🚫 Block Account"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<"STUDENT" | "OWNER">("STUDENT");
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("ALL");
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const [blockTarget, setBlockTarget] = useState<any | null>(null);
    const [processing, setProcessing] = useState(false);

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
            fetchUsers();
        } catch {
            alert("Failed to update user status");
        } finally {
            setProcessing(false);
            setBlockTarget(null);
        }
    }

    async function handleImpersonate(userId: string) {
        if (!confirm("Are you sure you want to login as this user?")) return;
        setProcessing(true);
        try {
            const url = await impersonateUser(userId);
            window.location.href = url;
        } catch (e: any) {
            alert(e.message || "Failed to impersonate");
        } finally {
            setProcessing(false);
        }
    }

    // Fix: match both USER and STUDENT roles to Student tab
    const studentCount = users.filter(u => u.role === "STUDENT" || u.role === "USER").length;
    const ownerCount = users.filter(u => u.role === "OWNER").length;

    const filtered = users
        .filter(u => tab === "STUDENT" ? (u.role === "STUDENT" || u.role === "USER") : u.role === "OWNER")
        .filter(u => filterStatus === "ALL" || u.status === filterStatus)
        .filter(u =>
            (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase()) ||
            (u.id || "").includes(search)
        );

    return (
        <div className="space-y-6">
            {blockTarget && <BlockModal user={blockTarget} onConfirm={handleBlockConfirm} onCancel={() => setBlockTarget(null)} />}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold">User Management</h1>
                    <p className="text-muted-foreground">Manage students and owners. Block or unblock accounts.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            {/* Colored Tabs */}
            <div className="flex gap-2">
                <Button
                    onClick={() => setTab("STUDENT")}
                    className={tab === "STUDENT" ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-white border border-blue-300 text-blue-700 hover:bg-blue-50"}
                >
                    🎓 Students ({studentCount})
                </Button>
                <Button
                    onClick={() => setTab("OWNER")}
                    className={tab === "OWNER" ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-white border border-purple-300 text-purple-700 hover:bg-purple-50"}
                >
                    🏠 Owners ({ownerCount})
                </Button>
            </div>

            {/* Filters */}
            <div className="flex gap-4 items-center">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-10" placeholder="Search by name, email, or ID..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="border rounded-md p-2 bg-background text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="ALL">All Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="BANNED">Blocked</option>
                </select>
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted border-b">
                                <tr>
                                    <th className="p-4 text-left font-medium">ID</th>
                                    <th className="p-4 text-left font-medium">Name</th>
                                    <th className="p-4 text-left font-medium">Email / Phone</th>
                                    <th className="p-4 text-left font-medium">{tab === "OWNER" ? "PGs / Properties" : "Bookings"}</th>
                                    <th className="p-4 text-left font-medium">Status & History</th>
                                    <th className="p-4 text-left font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {loading ? (
                                    <tr><td colSpan={6} className="p-8 text-center animate-pulse">Loading platform users...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No users found.</td></tr>
                                ) : (
                                    filtered.map(user => {
                                        const isExpanded = expandedUser === user.id;
                                        return (
                                            <tr key={user.id} className={`hover:bg-muted/5 ${user.status === "BANNED" ? "bg-red-50" : ""}`}>
                                                <td className="p-4 font-mono text-xs">{user.displayId || user.id.slice(0, 8)}</td>
                                                <td className="p-4">
                                                    <div className={`font-medium ${user.status === "BANNED" ? "text-red-600 line-through" : ""}`}>{user.name}</div>
                                                    <div className="text-[10px] text-muted-foreground">Joined: {new Date(user.createdAt).toLocaleDateString()}</div>
                                                </td>
                                                <td className="p-4 text-sm">
                                                    <div>{user.email}</div>
                                                    <div className="text-xs text-muted-foreground">{user.phone || "No Phone"}</div>
                                                </td>

                                                {/* PG/Bookings Info Column */}
                                                <td className="p-4">
                                                    {tab === "OWNER" ? (
                                                        <div>
                                                            {user.properties && user.properties.length > 0 ? (
                                                                <div className="space-y-1">
                                                                    {user.properties.slice(0, isExpanded ? undefined : 2).map((p: any) => (
                                                                        <div key={p.id} className="bg-purple-50 border border-purple-200 rounded p-1.5 text-[11px]">
                                                                            <div className="font-bold text-purple-800 flex items-center gap-1">
                                                                                <Building className="h-3 w-3" /> {p.name}
                                                                            </div>
                                                                            <div className="text-purple-600 truncate" title={p.address}>{p.city} — {p.address}</div>
                                                                            <div className="text-purple-500  mt-0.5">
                                                                                {p.rooms?.length || 0} rooms
                                                                                {p.rooms?.length > 0 && (
                                                                                    <span className="ml-1">(₹{Math.min(...p.rooms.map((r: any) => r.price))}–₹{Math.max(...p.rooms.map((r: any) => r.price))})</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                    {user.properties.length > 2 && (
                                                                        <button
                                                                            onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                                                                            className="text-[10px] text-purple-600 hover:underline flex items-center gap-1"
                                                                        >
                                                                            {isExpanded ? <>Show less <ChevronUp className="h-3 w-3" /></> : <>{user.properties.length - 2} more <ChevronDown className="h-3 w-3" /></>}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground italic">No properties</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            {user.bookings && user.bookings.length > 0 ? (
                                                                <div className="space-y-1">
                                                                    {user.bookings.map((b: any) => (
                                                                        <div key={b.id} className={`text-[11px] p-1 rounded border ${b.status === "PAID" ? "bg-green-50 border-green-200" : b.status === "REJECTED" ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
                                                                            <div className="font-medium">{b.propertyName}</div>
                                                                            <div className="flex justify-between">
                                                                                <span className={`font-bold ${b.status === "PAID" ? "text-green-700" : b.status === "REJECTED" ? "text-red-700" : "text-gray-700"}`}>
                                                                                    {b.status === "PAID" ? "✅ Paid" : b.status === "REJECTED" ? "❌ Rejected" : b.status === "APPROVED_PAYMENT_PENDING" ? "⏳ Payment Pending" : "⏳ Awaiting Approval"}
                                                                                </span>
                                                                                <span>{b.amount}</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground italic">No bookings</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="p-4">
                                                    {user.status === "BANNED" ? (
                                                        <span className="px-2 py-1 rounded text-[10px] font-bold bg-red-100 text-red-800 uppercase">🚫 Blocked</span>
                                                    ) : (
                                                        <span className="px-2 py-1 rounded text-[10px] font-bold bg-green-100 text-green-800 uppercase">✅ Active</span>
                                                    )}
                                                    {user.actionNotes && user.actionNotes.length > 0 && (
                                                        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                                                            {user.actionNotes.slice(0, 3).map((note: any) => (
                                                                <div key={note.id} className={`text-[10px] p-1.5 rounded border ${note.action === "BANNED" ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"}`}>
                                                                    <div className="font-bold">{note.action === "BANNED" ? "🚫 Blocked" : "✅ Unblocked"}</div>
                                                                    <div className="truncate" title={note.reason}>Reason: {note.reason}</div>
                                                                    <div className="text-muted-foreground">{new Date(note.timestamp).toLocaleDateString()}</div>
                                                                </div>
                                                            ))}
                                                            {user.actionNotes.length > 3 && (
                                                                <div className="text-[10px] text-muted-foreground italic">+{user.actionNotes.length - 3} more...</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-col gap-2">
                                                        <Button size="sm" variant="outline" className="h-8 text-[11px] border-blue-200 text-blue-700 hover:bg-blue-50" disabled={processing} onClick={() => handleImpersonate(user.id)}>
                                                            <Eye className="h-3 w-3 mr-1" /> Login As...
                                                        </Button>

                                                        {user.status === "BANNED" ? (
                                                            <Button size="sm" variant="outline" className="h-8 text-[11px] border-green-300 text-green-700 hover:bg-green-50" disabled={processing} onClick={() => setBlockTarget(user)}>
                                                                <CheckCircle className="h-3 w-3 mr-1" /> Unblock
                                                            </Button>
                                                        ) : (
                                                            <Button size="sm" variant="destructive" className="h-8 text-[11px]" disabled={processing} onClick={() => setBlockTarget(user)}>
                                                                <Ban className="h-3 w-3 mr-1" /> Block
                                                            </Button>
                                                        )}
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
