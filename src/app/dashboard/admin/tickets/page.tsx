"use client";

import { useEffect, useState } from "react";
import { getAllTickets, replyToTicket, updateTicketStatus, resolveTicket } from "@/actions/ops";
import {
    CheckCircle2, Clock, AlertCircle, Send, Filter, Users, Building,
    ShieldCheck, Loader2, ChevronDown, ChevronRight, ArrowUpRight,
    MessageCircle, Activity
} from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
    OPEN: "bg-green-100 text-green-800 border-green-200",
    ACKNOWLEDGED: "bg-blue-100 text-blue-800 border-blue-200",
    IN_PROGRESS: "bg-yellow-100 text-yellow-800 border-yellow-200",
    RESOLVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
    CLOSED: "bg-slate-100 text-slate-600 border-slate-200",
    ESCALATED: "bg-purple-100 text-purple-800 border-purple-200",
};

const PRIORITY_BADGE: Record<string, string> = {
    URGENT: "bg-red-100 text-red-700 border-red-200",
    HIGH: "bg-orange-100 text-orange-700 border-orange-200",
    MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
    LOW: "bg-slate-100 text-slate-600 border-slate-200",
};

const SLA_HOURS: Record<string, number> = { URGENT: 4, HIGH: 24, MEDIUM: 72, LOW: 168 };

function getSLAStatus(ticket: any) {
    if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") return null;
    const hours = SLA_HOURS[ticket.priority];
    if (!hours) return null;
    const deadlineMs = new Date(ticket.createdAt).getTime() + hours * 3600000;
    const remaining = (deadlineMs - Date.now()) / 3600000;
    if (remaining < 0) return { label: "BREACHED", cls: "bg-red-100 text-red-700 border-red-200" };
    if (remaining < hours * 0.3) return { label: "WARNING", cls: "bg-orange-100 text-orange-700 border-orange-200" };
    return { label: "ON TIME", cls: "bg-green-100 text-green-700 border-green-200" };
}

export default function AdminTicketsPage() {
    const [tab, setTab] = useState<"student" | "owner" | "all">("all");
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [priorityFilter, setPriorityFilter] = useState("ALL");
    const [expanded, setExpanded] = useState<string | null>(null);
    const [replyText, setReplyText] = useState<Record<string, string>>({});
    const [noteText, setNoteText] = useState<Record<string, string>>({});
    const [sendingReply, setSendingReply] = useState<Record<string, boolean>>({});

    const fetchAll = async () => {
        setLoading(true);
        try { setTickets(await getAllTickets()); } catch { }
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

    const handleStatus = async (id: string, status: any) => {
        try { await updateTicketStatus(id, status, noteText[id]); setNoteText(p => ({ ...p, [id]: "" })); fetchAll(); }
        catch { alert("Failed to update."); }
    };

    const studentTickets = tickets.filter(t => t.raisedByRole === "USER" && t.targetTeam === "ADMIN");
    const ownerTickets = tickets.filter(t => t.raisedByRole === "OWNER" || t.raisedByRole === "STAFF");

    const baseList = tab === "student" ? studentTickets : tab === "owner" ? ownerTickets : tickets;

    let filtered = baseList;
    if (statusFilter !== "ALL") filtered = filtered.filter(t => t.status === statusFilter);
    if (priorityFilter !== "ALL") filtered = filtered.filter(t => t.priority === priorityFilter);

    const openCount = tickets.filter(t => t.status === "OPEN").length;
    const studentOpen = studentTickets.filter(t => t.status === "OPEN").length;
    const ownerOpen = ownerTickets.filter(t => t.status === "OPEN").length;

    return (
        <div className="space-y-6">
            {/* Header + Stats */}
            <div>
                <h1 className="text-3xl font-bold">Support Tickets</h1>
                <p className="text-muted-foreground text-sm mt-0.5">Full platform visibility — all tickets from students and owners.</p>
            </div>

            {/* Stat Row */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {[
                    { label: "Total", val: tickets.length, color: "text-foreground", filter: () => { setTab("all"); setStatusFilter("ALL"); } },
                    { label: "Open", val: openCount, color: "text-green-600", filter: () => { setTab("all"); setStatusFilter("OPEN"); } },
                    { label: "From Students", val: studentTickets.length, color: "text-blue-600", filter: () => { setTab("student"); setStatusFilter("ALL"); } },
                    { label: "Student Open", val: studentOpen, color: "text-blue-700", filter: () => { setTab("student"); setStatusFilter("OPEN"); } },
                    { label: "From Owners", val: ownerTickets.length, color: "text-orange-600", filter: () => { setTab("owner"); setStatusFilter("ALL"); } },
                    { label: "Owner Open", val: ownerOpen, color: "text-orange-700", filter: () => { setTab("owner"); setStatusFilter("OPEN"); } },
                ].map(s => (
                    <div key={s.label} onClick={s.filter}
                        className="border rounded-xl p-3 text-center cursor-pointer hover:shadow-md transition-shadow bg-card">
                        <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex gap-1 bg-muted rounded-xl p-1">
                    {[
                        { key: "all", label: `All (${tickets.length})` },
                        { key: "student", label: `Students (${studentTickets.length})` },
                        { key: "owner", label: `Owners (${ownerTickets.length})` },
                    ].map(t => (
                        <button key={t.key} onClick={() => { setTab(t.key as any); setStatusFilter("ALL"); setPriorityFilter("ALL"); }}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.key ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Filters */}
                <div className="flex gap-2 flex-wrap">
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                        className="border rounded-lg px-2 py-1.5 text-xs bg-background font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400">
                        <option value="ALL">All Status</option>
                        {["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CLOSED", "ESCALATED"].map(s => (
                            <option key={s} value={s}>{s.replace("_", " ")}</option>
                        ))}
                    </select>
                    <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
                        className="border rounded-lg px-2 py-1.5 text-xs bg-background font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400">
                        <option value="ALL">All Priority</option>
                        {["URGENT", "HIGH", "MEDIUM", "LOW"].map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                    {(statusFilter !== "ALL" || priorityFilter !== "ALL") && (
                        <button onClick={() => { setStatusFilter("ALL"); setPriorityFilter("ALL"); }}
                            className="px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-lg font-medium">Clear Filters</button>
                    )}
                </div>
            </div>

            {/* Ticket List */}
            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed rounded-2xl text-muted-foreground">
                    <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="font-semibold">No tickets match the current filters.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(ticket => {
                        const replies = JSON.parse(ticket.replies || "[]");
                        const sla = getSLAStatus(ticket);
                        const isExpanded = expanded === ticket.id;

                        return (
                            <div key={ticket.id} className={`border rounded-2xl overflow-hidden bg-card ${ticket.status === "RESOLVED" || ticket.status === "CLOSED" ? "opacity-60" : ""}`}>
                                {/* Collapsed Header */}
                                <div className="p-4 cursor-pointer hover:bg-muted/30" onClick={() => setExpanded(isExpanded ? null : ticket.id)}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-sm">{ticket.category}</span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${STATUS_STYLES[ticket.status] || "bg-gray-100 text-gray-700"}`}>
                                                    {ticket.status.replace("_", " ")}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${PRIORITY_BADGE[ticket.priority] || "bg-gray-100"}`}>
                                                    {ticket.priority}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ticket.raisedByRole === "USER" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}>
                                                    {ticket.raisedByRole === "USER" ? "👤 Student" : "🏠 Owner"}
                                                </span>
                                                {sla && <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${sla.cls}`}>{sla.label}</span>}
                                                {(() => {
                                                    const parsedReplies = JSON.parse(ticket.replies || "[]");
                                                    const lastReply = parsedReplies[parsedReplies.length - 1];
                                                    const isReplyReceived = 
                                                        ticket.status !== "RESOLVED" && 
                                                        ticket.status !== "CLOSED" && 
                                                        lastReply && 
                                                        lastReply.sender !== "ADMIN";
                                                    
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
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{ticket.description}</p>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                <span className="font-mono">{ticket.displayId}</span> · <strong>{ticket.user?.name || "Unknown"}</strong>
                                                {ticket.user?.email && ` (${ticket.user.email})`}
                                                {ticket.property?.name && ` · ${ticket.property.name}`}
                                                · {new Date(ticket.createdAt).toLocaleDateString("en-IN")}
                                                {replies.length > 0 && ` · 💬 ${replies.length}`}
                                            </p>
                                        </div>
                                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
                                    </div>
                                </div>

                                {/* Expanded */}
                                {isExpanded && (
                                    <div className="border-t px-4 pb-4 pt-3 space-y-3">
                                        <div className="p-3 rounded-xl bg-muted/40 border text-sm">{ticket.description}</div>

                                        {/* Admin Controls */}
                                        {ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
                                            <div className="p-3 rounded-xl border bg-slate-50 space-y-2">
                                                <p className="text-xs font-bold uppercase text-muted-foreground">Admin Actions</p>
                                                <div className="flex gap-2 flex-wrap">
                                                    {["ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CLOSED"].map(s => (
                                                        <button key={s} onClick={() => handleStatus(ticket.id, s)}
                                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${ticket.status === s ? "bg-indigo-600 text-white border-indigo-600" : "bg-background hover:bg-muted"}`}>
                                                            {s.replace("_", " ")}
                                                        </button>
                                                    ))}
                                                </div>
                                                <input type="text" placeholder="Add admin note (optional)..."
                                                    value={noteText[ticket.id] || ""}
                                                    onChange={e => setNoteText(p => ({ ...p, [ticket.id]: e.target.value }))}
                                                    className="w-full border rounded-xl px-3 py-2 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                />
                                            </div>
                                        )}

                                        {/* Notes */}
                                        {(ticket.ownerNote || ticket.adminNote) && (
                                            <div className="space-y-2">
                                                {ticket.ownerNote && (
                                                    <div className="p-3 rounded-xl bg-orange-50 border border-orange-100 text-xs">
                                                        <p className="font-bold text-orange-700 mb-1">Owner Note</p><p>{ticket.ownerNote}</p>
                                                    </div>
                                                )}
                                                {ticket.adminNote && (
                                                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs">
                                                        <p className="font-bold text-blue-700 mb-1">Admin Note</p><p>{ticket.adminNote}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Conversation */}
                                        {replies.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-xs font-bold uppercase text-muted-foreground">Conversation ({replies.length})</p>
                                                {replies.map((r: any, idx: number) => (
                                                    <div key={idx} className={`p-3 rounded-xl text-xs ${r.sender === "ADMIN" ? "bg-indigo-50 border border-indigo-100 ml-6" : r.sender === "OWNER" ? "bg-orange-50 border border-orange-100 mr-6" : "bg-slate-50 border border-slate-100 mr-6"}`}>
                                                        <div className="flex justify-between mb-1">
                                                            <span className="font-bold">{r.sender === "ADMIN" ? "Admin (You)" : r.senderName || (r.sender === "OWNER" ? "Owner" : "Student")}</span>
                                                            <span className="opacity-60">{new Date(r.timestamp).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                                                        </div>
                                                        <p>{r.message}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Reply */}
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
                                                    placeholder="Type your admin reply here..."
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
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
