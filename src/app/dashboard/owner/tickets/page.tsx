"use client";

import { useEffect, useState, useTransition } from "react";
import {
    getOwnerTickets, getOwnerRaisedTickets, createOwnerTicket,
    replyToTicket, updateTicketStatus, escalateTicketToAdmin
} from "@/actions/ops";
import {
    Wrench, CreditCard, Building, ShieldCheck, Plus, Send, Clock,
    CheckCircle2, Activity, AlertCircle, Loader2, MessageCircle,
    ChevronDown, ChevronRight, ArrowUpRight, X, Users
} from "lucide-react";

const OWNER_ISSUE_CATEGORIES = [
    { key: "Payment Settlement", emoji: "💰", description: "Payout delays, settlement queries" },
    { key: "Tenant Dispute Escalation", emoji: "⚖️", description: "Unresolved tenant conflicts" },
    { key: "Platform / Dashboard Bug", emoji: "🖥️", description: "Dashboard issues, app bugs" },
    { key: "Payout Issue", emoji: "💸", description: "Missing or incorrect payout" },
    { key: "Listing / Property Issue", emoji: "🏢", description: "Property approval, listing problems" },
    { key: "Other", emoji: "📦", description: "Any other issue" },
];

const STATUS_STYLES: Record<string, string> = {
    OPEN: "bg-green-100 text-green-800",
    ACKNOWLEDGED: "bg-blue-100 text-blue-800",
    IN_PROGRESS: "bg-yellow-100 text-yellow-800",
    RESOLVED: "bg-emerald-100 text-emerald-800",
    CLOSED: "bg-slate-100 text-slate-600",
    ESCALATED: "bg-purple-100 text-purple-800",
};

const STATUS_FLOW = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED"] as const;

const PRIORITY_BADGE: Record<string, string> = {
    URGENT: "bg-red-100 text-red-700",
    HIGH: "bg-orange-100 text-orange-700",
    MEDIUM: "bg-amber-100 text-amber-700",
    LOW: "bg-slate-100 text-slate-600",
};

export default function OwnerTicketsPage() {
    const [tab, setTab] = useState<"tenant" | "myissues">("tenant");
    const [tenantTickets, setTenantTickets] = useState<any[]>([]);
    const [ownTickets, setOwnTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [replyText, setReplyText] = useState<Record<string, string>>({});
    const [noteText, setNoteText] = useState<Record<string, string>>({});
    const [showCreate, setShowCreate] = useState(false);
    const [newCategory, setNewCategory] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [newPriority, setNewPriority] = useState("MEDIUM");
    const [creating, setCreating] = useState(false);
    const [_, startTransition] = useTransition();
    const [sendingReply, setSendingReply] = useState<Record<string, boolean>>({});

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [t, o] = await Promise.all([getOwnerTickets(), getOwnerRaisedTickets()]);
            setTenantTickets(t);
            setOwnTickets(o);
        } catch { }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchAll(); }, []);

    const handleReply = async (id: string) => {
        const msg = replyText[id]?.trim();
        if (!msg) return;
        setSendingReply(p => ({ ...p, [id]: true }));
        try { await replyToTicket(id, msg); setReplyText(p => ({ ...p, [id]: "" })); await fetchAll(); }
        catch { alert("Failed to send reply."); }
        finally { setSendingReply(p => ({ ...p, [id]: false })); }
    };

    const handleStatus = async (id: string, status: any, note?: string) => {
        try { await updateTicketStatus(id, status, note); fetchAll(); }
        catch { alert("Failed to update status."); }
    };

    const handleEscalate = async (id: string) => {
        if (!confirm("Escalate this ticket to RentPe Admin?")) return;
        try { await escalateTicketToAdmin(id); fetchAll(); }
        catch { alert("Failed to escalate."); }
    };

    const handleCreateOwn = () => {
        if (!newCategory || !newDescription.trim()) return;
        setCreating(true);
        startTransition(async () => {
            try {
                await createOwnerTicket({ category: newCategory, description: newDescription, priority: newPriority });
                setNewCategory(""); setNewDescription(""); setNewPriority("MEDIUM"); setShowCreate(false);
                fetchAll();
            } catch { alert("Failed to create ticket."); }
            finally { setCreating(false); }
        });
    };

    const openTenantCount = tenantTickets.filter(t => t.status === "OPEN" || t.status === "ACKNOWLEDGED" || t.status === "IN_PROGRESS").length;
    const openOwnCount = ownTickets.filter(t => t.status === "OPEN" || t.status === "IN_PROGRESS").length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Support Tickets</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">Manage tenant issues and raise your own tickets to RentPe Admin.</p>
                </div>
                {tab === "myissues" && (
                    <button onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all">
                        <Plus className="h-4 w-4" /> New Issue
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
                <button onClick={() => setTab("tenant")}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${tab === "tenant" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>
                    <Users className="h-4 w-4" /> Tenant Tickets {openTenantCount > 0 && <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full">{openTenantCount}</span>}
                </button>
                <button onClick={() => setTab("myissues")}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${tab === "myissues" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>
                    <ShieldCheck className="h-4 w-4" /> My Issues {openOwnCount > 0 && <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded-full">{openOwnCount}</span>}
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : (
                <>
                    {/* ── Tab: Tenant Tickets ──────────────────────────── */}
                    {tab === "tenant" && (
                        <div className="space-y-4">
                            {tenantTickets.length === 0 ? (
                                <div className="py-16 text-center border-2 border-dashed rounded-2xl text-muted-foreground">
                                    <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                                    <p className="font-semibold">No tenant tickets</p>
                                    <p className="text-sm mt-1">When students raise maintenance or booking issues, they&apos;ll appear here.</p>
                                </div>
                            ) : tenantTickets.map(ticket => {
                                const replies = JSON.parse(ticket.replies || "[]");
                                const isExpanded = expanded === ticket.id;
                                const currentIdx = STATUS_FLOW.indexOf(ticket.status as any);
                                const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;

                                return (
                                    <div key={ticket.id} className={`border rounded-2xl overflow-hidden bg-card ${ticket.priority === "URGENT" ? "border-red-300" : ""}`}>
                                        <div className="p-4 cursor-pointer hover:bg-muted/30" onClick={() => setExpanded(isExpanded ? null : ticket.id)}>
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                {/* Left Column: Ticket Info */}
                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                    <span className="text-3xl p-2 bg-slate-100 rounded-xl shrink-0">
                                                        {ticket.category.includes("Food") ? "🍲" : ticket.category.includes("Maintenance") ? "🔧" : ticket.category.includes("Cleanliness") ? "🧹" : "📋"}
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                                {ticket.displayId}
                                                            </span>
                                                            <span className="font-black text-sm text-slate-800">{ticket.category}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-600 font-semibold mt-1.5 line-clamp-1">{ticket.description}</p>
                                                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                                                            <span>By: <strong>{ticket.user?.name || "Tenant"}</strong></span>
                                                            {ticket.property?.name && (
                                                                <>
                                                                    <span>·</span>
                                                                    <Building className="h-3 w-3 inline text-slate-400" />
                                                                    <span>{ticket.property.name}</span>
                                                                </>
                                                            )}
                                                            {replies.length > 0 && (
                                                                <>
                                                                    <span>·</span>
                                                                    <MessageCircle className="h-3 w-3 inline text-slate-400" />
                                                                    <span>{replies.length} replies</span>
                                                                </>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Right Column: Badges, Date, Toggle */}
                                                <div className="flex items-start sm:items-end flex-col gap-2 shrink-0">
                                                    {/* Date & Time */}
                                                    <span className="text-xs font-semibold text-slate-500 bg-slate-50 border px-2.5 py-1 rounded-lg">
                                                        📅 {new Date(ticket.createdAt).toLocaleString("en-IN", {
                                                            day: "2-digit",
                                                            month: "short",
                                                            year: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                            hour12: true
                                                        })}
                                                    </span>

                                                    {/* Badges Row */}
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${STATUS_STYLES[ticket.status] || "bg-gray-100 text-gray-700"}`}>
                                                            {ticket.status.replace("_", " ")}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${PRIORITY_BADGE[ticket.priority] || "bg-gray-100 text-gray-600"}`}>
                                                            {ticket.priority}
                                                        </span>
                                                        {(() => {
                                                            const parsedReplies = JSON.parse(ticket.replies || "[]");
                                                            const lastReply = parsedReplies[parsedReplies.length - 1];
                                                            const isReplyReceived = 
                                                                ticket.status !== "RESOLVED" && 
                                                                ticket.status !== "CLOSED" && 
                                                                lastReply && 
                                                                lastReply.sender === "USER";
                                                            
                                                            if (isReplyReceived) {
                                                                return (
                                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse flex items-center gap-1">
                                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-ping"></span>
                                                                        Reply Received
                                                                    </span>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                        {/* Chevron */}
                                                        <div className="p-1 bg-slate-50 hover:bg-slate-100 rounded-lg ml-1 border">
                                                            {isExpanded ? <ChevronDown className="h-3 w-3 text-slate-500" /> : <ChevronRight className="h-3 w-3 text-slate-500" />}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="border-t px-4 pb-4 pt-3 space-y-3">
                                                <div className="p-3 rounded-xl bg-muted/40 border text-sm">{ticket.description}</div>

                                                {/* Action Buttons */}
                                                {ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
                                                    <div className="flex gap-2 flex-wrap">
                                                        {nextStatus && (
                                                            <button onClick={() => handleStatus(ticket.id, nextStatus, noteText[ticket.id])}
                                                                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-1">
                                                                <Activity className="h-3 w-3" /> Mark {nextStatus.replace("_", " ")}
                                                            </button>
                                                        )}
                                                        <button onClick={() => handleStatus(ticket.id, "RESOLVED", noteText[ticket.id])}
                                                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-1">
                                                            <CheckCircle2 className="h-3 w-3" /> Resolve
                                                        </button>
                                                        {ticket.status !== "ESCALATED" && (
                                                            <button onClick={() => handleEscalate(ticket.id)}
                                                                className="px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 flex items-center gap-1">
                                                                <ArrowUpRight className="h-3 w-3" /> Escalate to Admin
                                                            </button>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Resolution note */}
                                                {ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
                                                    <input
                                                        type="text"
                                                        placeholder="Add a resolution/note (optional)..."
                                                        value={noteText[ticket.id] || ""}
                                                        onChange={e => setNoteText(p => ({ ...p, [ticket.id]: e.target.value }))}
                                                        className="w-full border rounded-xl px-3 py-2 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                    />
                                                )}

                                                {/* Conversations */}
                                                {replies.length > 0 && (
                                                    <div className="space-y-2">
                                                        <p className="text-xs font-bold uppercase text-muted-foreground">Conversation</p>
                                                        {replies.map((r: any, idx: number) => (
                                                            <div key={idx} className={`p-3 rounded-xl text-xs ${r.sender === "OWNER" ? "bg-indigo-50 border border-indigo-100 ml-4" : "bg-slate-50 border border-slate-100 mr-4"}`}>
                                                                <div className="flex justify-between mb-1">
                                                                    <span className="font-bold">{r.sender === "OWNER" ? "You" : r.senderName || "Tenant"}</span>
                                                                    <span className="opacity-60">{new Date(r.timestamp).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                                                                </div>
                                                                <p>{r.message}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Reply */}
                                                {ticket.status !== "CLOSED" && (
                                                    <div className="pt-4 border-t space-y-2 bg-slate-50/50 p-4 rounded-xl border mt-3">
                                                        <div className="flex justify-between items-center">
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                                New Reply
                                                            </label>
                                                            <span className="text-[10px] text-slate-400">
                                                                {replyText[ticket.id]?.length || 0} / 1000 characters
                                                            </span>
                                                        </div>
                                                        <div className="relative flex gap-2">
                                                            <textarea
                                                                placeholder="Type your reply to tenant here..."
                                                                value={replyText[ticket.id] || ""}
                                                                onChange={(e) => {
                                                                    if (e.target.value.length <= 1000) {
                                                                        setReplyText(p => ({ ...p, [ticket.id]: e.target.value }));
                                                                    }
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter" && !e.shiftKey) {
                                                                        e.preventDefault();
                                                                        handleReply(ticket.id);
                                                                    }
                                                                }}
                                                                disabled={sendingReply[ticket.id]}
                                                                rows={2}
                                                                className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-inner disabled:bg-slate-100"
                                                            />
                                                            <button
                                                                onClick={() => handleReply(ticket.id)}
                                                                disabled={!replyText[ticket.id]?.trim() || sendingReply[ticket.id]}
                                                                className="self-end px-3 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-40 transition-all shadow-md hover:shadow-lg flex items-center justify-center h-[46px] w-[46px]"
                                                            >
                                                                {sendingReply[ticket.id] ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <Send className="h-4 w-4" />
                                                                )}
                                                            </button>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400">
                                                            💡 Press <kbd className="bg-slate-100 px-1 rounded font-mono">Enter</kbd> to send, <kbd className="bg-slate-100 px-1 rounded font-mono">Shift+Enter</kbd> for a new line.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ── Tab: My Issues ───────────────────────────────── */}
                    {tab === "myissues" && (
                        <div className="space-y-4">
                            {/* Create Form */}
                            {showCreate && (
                                <div className="border rounded-2xl bg-card overflow-hidden">
                                    <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
                                        <div>
                                            <h3 className="font-bold">Raise Issue to RentPe Admin</h3>
                                            <p className="text-xs text-muted-foreground mt-0.5">Your ticket goes directly to the RentPe team.</p>
                                        </div>
                                        <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-white/60 rounded-xl"><X className="h-4 w-4" /></button>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold mb-2">Category *</label>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {OWNER_ISSUE_CATEGORIES.map(cat => (
                                                    <button key={cat.key} onClick={() => setNewCategory(cat.key)}
                                                        className={`p-3 rounded-xl border-2 text-left transition-all ${newCategory === cat.key ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-200"}`}>
                                                        <span className="text-lg mr-1">{cat.emoji}</span>
                                                        <span className="text-xs font-bold">{cat.key}</span>
                                                        <p className="text-[10px] text-muted-foreground mt-1">{cat.description}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold mb-2">Description *</label>
                                            <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)}
                                                placeholder="Describe your issue in detail..."
                                                rows={4}
                                                className="w-full border rounded-xl px-4 py-3 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold mb-2">Priority</label>
                                            <div className="flex gap-2">
                                                {["LOW", "MEDIUM", "HIGH", "URGENT"].map(p => (
                                                    <button key={p} onClick={() => setNewPriority(p)}
                                                        className={`px-3 py-1.5 text-xs rounded-lg border-2 font-bold transition-all ${newPriority === p ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200"}`}>
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-2 border-t">
                                            <button onClick={handleCreateOwn} disabled={creating || !newCategory || !newDescription.trim()}
                                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl disabled:opacity-40 transition-all flex items-center gap-2">
                                                {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : "Submit Issue"}
                                            </button>
                                            <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 bg-muted font-bold text-sm rounded-xl">Cancel</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {ownTickets.length === 0 && !showCreate ? (
                                <div className="py-16 text-center border-2 border-dashed rounded-2xl text-muted-foreground">
                                    <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                                    <p className="font-semibold">No issues raised yet</p>
                                    <p className="text-sm mt-1">Raise issues like payout delays, disputes, or platform bugs to the RentPe admin team.</p>
                                    <button onClick={() => setShowCreate(true)} className="mt-4 px-5 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700">
                                        <Plus className="h-4 w-4 inline mr-1" /> Raise an Issue
                                    </button>
                                </div>
                            ) : ownTickets.map(ticket => {
                                const replies = JSON.parse(ticket.replies || "[]");
                                const isExpanded = expanded === ticket.id;
                                return (
                                    <div key={ticket.id} className={`border rounded-2xl overflow-hidden bg-card ${ticket.status === "RESOLVED" ? "opacity-60" : ""}`}>
                                        <div className="p-4 cursor-pointer hover:bg-muted/30" onClick={() => setExpanded(isExpanded ? null : ticket.id)}>
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                {/* Left Column: Ticket Info */}
                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                    <span className="text-3xl p-2 bg-slate-100 rounded-xl shrink-0">📋</span>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                                {ticket.displayId}
                                                            </span>
                                                            <span className="font-black text-sm text-slate-800">{ticket.category}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-600 font-semibold mt-1.5 line-clamp-1">{ticket.description}</p>
                                                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                                                            {ticket.property?.name && (
                                                                <>
                                                                    <Building className="h-3 w-3 inline text-slate-400" />
                                                                    <span>{ticket.property.name}</span>
                                                                    <span>·</span>
                                                                </>
                                                            )}
                                                            {replies.length > 0 && (
                                                                <>
                                                                    <MessageCircle className="h-3 w-3 inline text-slate-400" />
                                                                    <span>{replies.length} replies</span>
                                                                </>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Right Column: Badges, Date, Toggle */}
                                                <div className="flex items-start sm:items-end flex-col gap-2 shrink-0">
                                                    {/* Date & Time */}
                                                    <span className="text-xs font-semibold text-slate-500 bg-slate-50 border px-2.5 py-1 rounded-lg">
                                                        📅 {new Date(ticket.createdAt).toLocaleString("en-IN", {
                                                            day: "2-digit",
                                                            month: "short",
                                                            year: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                            hour12: true
                                                        })}
                                                    </span>

                                                    {/* Badges Row */}
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${STATUS_STYLES[ticket.status] || "bg-gray-100 text-gray-700"}`}>
                                                            {ticket.status.replace("_", " ")}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">→ RentPe Admin</span>
                                                        {(() => {
                                                            const parsedReplies = JSON.parse(ticket.replies || "[]");
                                                            const lastReply = parsedReplies[parsedReplies.length - 1];
                                                            const isReplyReceived = 
                                                                ticket.status !== "RESOLVED" && 
                                                                ticket.status !== "CLOSED" && 
                                                                lastReply && 
                                                                lastReply.sender === "ADMIN";
                                                            
                                                            if (isReplyReceived) {
                                                                return (
                                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse flex items-center gap-1">
                                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-ping"></span>
                                                                        Reply Received
                                                                    </span>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                        {/* Chevron */}
                                                        <div className="p-1 bg-slate-50 hover:bg-slate-100 rounded-lg ml-1 border">
                                                            {isExpanded ? <ChevronDown className="h-3 w-3 text-slate-500" /> : <ChevronRight className="h-3 w-3 text-slate-500" />}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="border-t px-4 pb-4 pt-3 space-y-3">
                                                <div className="p-3 rounded-xl bg-muted/40 border text-sm">{ticket.description}</div>

                                                {ticket.adminNote && (
                                                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs">
                                                        <p className="font-bold text-blue-700 mb-1">Admin Note</p>
                                                        <p>{ticket.adminNote}</p>
                                                    </div>
                                                )}

                                                {replies.length > 0 && (
                                                    <div className="space-y-2">
                                                        <p className="text-xs font-bold uppercase text-muted-foreground">Conversation</p>
                                                        {replies.map((r: any, idx: number) => (
                                                            <div key={idx} className={`p-3 rounded-xl text-xs ${r.sender === "OWNER" ? "bg-indigo-50 border border-indigo-100 ml-4" : "bg-blue-50 border border-blue-100 mr-4"}`}>
                                                                <div className="flex justify-between mb-1">
                                                                    <span className="font-bold">{r.sender === "OWNER" ? "You" : r.senderName || "RentPe Admin"}</span>
                                                                    <span className="opacity-60">{new Date(r.timestamp).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                                                                </div>
                                                                <p>{r.message}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
                                                    <div className="pt-4 border-t space-y-2 bg-slate-50/50 p-4 rounded-xl border mt-3">
                                                        <div className="flex justify-between items-center">
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                                New Reply
                                                            </label>
                                                            <span className="text-[10px] text-slate-400">
                                                                {replyText[ticket.id]?.length || 0} / 1000 characters
                                                            </span>
                                                        </div>
                                                        <div className="relative flex gap-2">
                                                            <textarea
                                                                placeholder="Type your follow up to admin here..."
                                                                value={replyText[ticket.id] || ""}
                                                                onChange={(e) => {
                                                                    if (e.target.value.length <= 1000) {
                                                                        setReplyText(p => ({ ...p, [ticket.id]: e.target.value }));
                                                                    }
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter" && !e.shiftKey) {
                                                                        e.preventDefault();
                                                                        handleReply(ticket.id);
                                                                    }
                                                                }}
                                                                disabled={sendingReply[ticket.id]}
                                                                rows={2}
                                                                className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-inner disabled:bg-slate-100"
                                                            />
                                                            <button
                                                                onClick={() => handleReply(ticket.id)}
                                                                disabled={!replyText[ticket.id]?.trim() || sendingReply[ticket.id]}
                                                                className="self-end px-3 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-40 transition-all shadow-md hover:shadow-lg flex items-center justify-center h-[46px] w-[46px]"
                                                            >
                                                                {sendingReply[ticket.id] ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <Send className="h-4 w-4" />
                                                                )}
                                                            </button>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400">
                                                            💡 Press <kbd className="bg-slate-100 px-1 rounded font-mono">Enter</kbd> to send, <kbd className="bg-slate-100 px-1 rounded font-mono">Shift+Enter</kbd> for a new line.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
