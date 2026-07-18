"use client";

import { useEffect, useState } from "react";
import { getAllTickets, replyToTicket, updateTicketStatus, resolveTicket, adminRouteTicket, updateTicketPriority } from "@/actions/ops";
import { createRefundFromTicket } from "@/actions/adminPhase2";
import {
    CheckCircle2, Clock, AlertCircle, Send, Filter, Users, Building,
    ShieldCheck, Loader2, ChevronDown, ChevronRight, ArrowUpRight,
    MessageCircle, Activity, ReceiptText, X
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
    UNASSIGNED: "bg-slate-100 text-slate-500 border-slate-200",
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

    // Refund modal state
    const [refundModal, setRefundModal] = useState<{ open: boolean; ticket: any | null }>({
        open: false, ticket: null
    });
    const [refundForm, setRefundForm] = useState({
        bookingId:         "",
        amount:            "",
        reason:            "",
        refundType:        "PARTIAL" as "PARTIAL" | "FULL",
        refundPlatformFee: false,
        platformFeeAmount: "",
        gstAmount:         "",
        applyOwnerPenalty: false,
        ownerPenalty:      "",
    });
    const [refundSubmitting, setRefundSubmitting] = useState(false);
    const [refundSuccess, setRefundSuccess] = useState<string | null>(null);
    const [refundError, setRefundError]   = useState<string | null>(null);

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

    const openRefundModal = (ticket: any) => {
        setRefundModal({ open: true, ticket });
        setRefundForm({ bookingId: "", amount: "", reason: "", refundType: "PARTIAL",
            refundPlatformFee: false, platformFeeAmount: "", gstAmount: "",
            applyOwnerPenalty: false, ownerPenalty: "" });
        setRefundSuccess(null);
        setRefundError(null);
    };

    const submitRefund = async () => {
        if (!refundModal.ticket) return;
        if (!refundForm.bookingId.trim()) { setRefundError("Booking ID is required."); return; }
        if (!refundForm.amount || Number(refundForm.amount) <= 0) { setRefundError("Enter a valid refund amount."); return; }
        if (!refundForm.reason.trim()) { setRefundError("Please provide a reason."); return; }

        setRefundSubmitting(true);
        setRefundError(null);
        try {
            const result = await createRefundFromTicket({
                ticketId:           refundModal.ticket.id,
                bookingId:          refundForm.bookingId.trim(),
                amount:             Number(refundForm.amount),
                reason:             refundForm.reason.trim(),
                refundType:         refundForm.refundType,
                refundPlatformFee:  refundForm.refundPlatformFee,
                platformFeeAmount:  refundForm.refundPlatformFee ? Number(refundForm.platformFeeAmount) : 0,
                gstAmount:          refundForm.refundPlatformFee ? Number(refundForm.gstAmount) : 0,
                ownerPenalty:       refundForm.applyOwnerPenalty ? Number(refundForm.ownerPenalty) : 0,
                ownerPenaltyOwnerId: refundForm.applyOwnerPenalty ? (refundModal.ticket.ownerId || undefined) : undefined,
            });
            setRefundSuccess(`✅ Refund request ${(result.refund as any).displayId} created successfully! It will appear in the Refund Management tab.`);
        } catch (err: any) {
            setRefundError(err.message || "Failed to create refund request.");
        } finally {
            setRefundSubmitting(false);
        }
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

            {/* ── REFUND MODAL ──────────────────────────────────────────────── */}
            {refundModal.open && refundModal.ticket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-background border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b">
                            <div>
                                <h2 className="font-black text-base">🧾 Create Refund Request</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Linked to ticket: <span className="font-mono font-bold text-indigo-600">{refundModal.ticket.displayId}</span>
                                </p>
                            </div>
                            <button onClick={() => setRefundModal({ open: false, ticket: null })}
                                className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 space-y-4">
                            {refundSuccess ? (
                                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-semibold text-emerald-800">
                                    {refundSuccess}
                                    <div className="mt-3">
                                        <button onClick={() => setRefundModal({ open: false, ticket: null })}
                                            className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors">
                                            Close
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Booking ID */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-muted-foreground uppercase">Booking ID *</label>
                                        <input type="text"
                                            placeholder="Paste or type booking ID here (RP-B-XXXXX)"
                                            value={refundForm.bookingId}
                                            onChange={e => setRefundForm(p => ({ ...p, bookingId: e.target.value }))}
                                            className="w-full border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                                        />
                                    </div>

                                    {/* Refund Amount */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-muted-foreground uppercase">Refund Amount (₹) *</label>
                                            <input type="number" min="1" placeholder="e.g. 5000"
                                                value={refundForm.amount}
                                                onChange={e => setRefundForm(p => ({ ...p, amount: e.target.value }))}
                                                className="w-full border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-muted-foreground uppercase">Refund Type</label>
                                            <select value={refundForm.refundType}
                                                onChange={e => setRefundForm(p => ({ ...p, refundType: e.target.value as any }))}
                                                className="w-full border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                                <option value="PARTIAL">Partial</option>
                                                <option value="FULL">Full</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Reason */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-muted-foreground uppercase">Reason / Description *</label>
                                        <textarea rows={3} placeholder="Briefly explain the reason for this refund..."
                                            value={refundForm.reason}
                                            onChange={e => setRefundForm(p => ({ ...p, reason: e.target.value }))}
                                            className="w-full border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                                        />
                                    </div>

                                    {/* Platform Fee Toggle */}
                                    <div className="p-3 rounded-xl border bg-blue-50/60 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-black text-blue-800">Refund Convenience Fee &amp; GST?</p>
                                                <p className="text-[10px] text-blue-600 mt-0.5">Toggles reversal of RentPe platform fee + CGST/SGST. Will deduct from platform wallet &amp; issue a GST Credit Note (CN/26-27/XXXX).</p>
                                            </div>
                                            <button type="button"
                                                onClick={() => setRefundForm(p => ({ ...p, refundPlatformFee: !p.refundPlatformFee }))}
                                                className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ml-3 ${refundForm.refundPlatformFee ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${refundForm.refundPlatformFee ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                        {refundForm.refundPlatformFee && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-blue-700 uppercase">Platform Fee (₹)</label>
                                                    <input type="number" min="0" placeholder="e.g. 499"
                                                        value={refundForm.platformFeeAmount}
                                                        onChange={e => setRefundForm(p => ({ ...p, platformFeeAmount: e.target.value }))}
                                                        className="w-full border border-blue-200 rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-blue-700 uppercase">GST Amount (₹) (CGST+SGST)</label>
                                                    <input type="number" min="0" placeholder="e.g. 89.82"
                                                        value={refundForm.gstAmount}
                                                        onChange={e => setRefundForm(p => ({ ...p, gstAmount: e.target.value }))}
                                                        className="w-full border border-blue-200 rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Owner MDR Penalty Toggle */}
                                    <div className="p-3 rounded-xl border bg-orange-50/60 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-black text-orange-800">Apply 2% MDR Penalty to Owner?</p>
                                                <p className="text-[10px] text-orange-600 mt-0.5">Debits 2% Razorpay gateway fee loss from the owner's next payout. Use when the dispute is owner-caused.</p>
                                            </div>
                                            <button type="button"
                                                onClick={() => setRefundForm(p => ({ ...p, applyOwnerPenalty: !p.applyOwnerPenalty }))}
                                                className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ml-3 ${refundForm.applyOwnerPenalty ? 'bg-orange-600' : 'bg-slate-300'}`}>
                                                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${refundForm.applyOwnerPenalty ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                        {refundForm.applyOwnerPenalty && (
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-orange-700 uppercase">MDR Penalty Amount (₹) (2% of original payment)</label>
                                                <input type="number" min="0" placeholder="e.g. 118 (2% of ₹5900)"
                                                    value={refundForm.ownerPenalty}
                                                    onChange={e => setRefundForm(p => ({ ...p, ownerPenalty: e.target.value }))}
                                                    className="w-full border border-orange-200 rounded-lg px-2.5 py-2 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-orange-400"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Error */}
                                    {refundError && (
                                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
                                            ⚠️ {refundError}
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-2 justify-end pt-1">
                                        <button onClick={() => setRefundModal({ open: false, ticket: null })}
                                            className="px-4 py-2 text-xs font-bold border rounded-xl hover:bg-muted transition-colors">
                                            Cancel
                                        </button>
                                        <button onClick={submitRefund} disabled={refundSubmitting}
                                            className="px-5 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-50 transition-colors flex items-center gap-1.5">
                                            {refundSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ReceiptText className="h-3.5 w-3.5" />}
                                            {refundSubmitting ? "Creating..." : "Create Refund Request"}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

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
                        {["UNASSIGNED", "URGENT", "HIGH", "MEDIUM", "LOW"].map(p => (
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
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        {/* Left Column: Ticket Info */}
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <span className="text-3xl p-2 bg-slate-100 rounded-xl shrink-0">
                                                {ticket.raisedByRole === "USER" ? "👤" : "🏠"}
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
                                                    <span>By: <strong>{ticket.user?.name || "Unknown"}</strong> {ticket.user?.email && `(${ticket.user.email})`}</span>
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
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${STATUS_STYLES[ticket.status] || "bg-gray-100 text-gray-700"}`}>
                                                    {ticket.status.replace("_", " ")}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${PRIORITY_BADGE[ticket.priority] || "bg-gray-100"}`}>
                                                    {ticket.priority}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${ticket.targetTeam === "ADMIN" ? "bg-red-50 text-red-700 border-red-200" : "bg-orange-50 text-orange-700 border-orange-200"}`}>
                                                    📢 Assigned: {ticket.targetTeam}
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
                                                {/* Chevron */}
                                                <div className="p-1 bg-slate-50 hover:bg-slate-100 rounded-lg ml-1 border">
                                                    {isExpanded ? <ChevronDown className="h-3 w-3 text-slate-500" /> : <ChevronRight className="h-3 w-3 text-slate-500" />}
                                                </div>
                                            </div>
                                        </div>
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
                                                <p className="text-xs font-bold uppercase text-muted-foreground mt-2">Set Priority</p>
                                                <div className="flex gap-2 flex-wrap">
                                                    {["UNASSIGNED", "LOW", "MEDIUM", "HIGH", "URGENT"].map(p => (
                                                        <button key={p} onClick={async () => {
                                                            await updateTicketPriority(ticket.id, p as any);
                                                            fetchAll();
                                                        }}
                                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${ticket.priority === p ? "bg-indigo-600 text-white border-indigo-600" : "bg-background hover:bg-muted"}`}>
                                                            {p}
                                                        </button>
                                                    ))}
                                                </div>
                                                <input type="text" placeholder="Add admin note (optional)..."
                                                    value={noteText[ticket.id] || ""}
                                                    onChange={e => setNoteText(p => ({ ...p, [ticket.id]: e.target.value }))}
                                                    className="w-full border rounded-xl px-3 py-2 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                />
                                                <div className="pt-2 border-t mt-2 flex items-center gap-2 flex-wrap">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Route Team:</span>
                                                    <button onClick={async () => {
                                                        const target = ticket.targetTeam === "ADMIN" ? "OWNER" : "ADMIN";
                                                        if (confirm(`Change route team for this ticket to ${target}?`)) {
                                                            await adminRouteTicket(ticket.id, target);
                                                            fetchAll();
                                                        }
                                                    }} className="px-2 py-1 bg-white hover:bg-slate-100 border text-[10px] font-bold rounded-lg transition-all text-slate-700 flex items-center gap-1 shadow-sm">
                                                        🔁 Change routing to {ticket.targetTeam === "ADMIN" ? "OWNER" : "ADMIN"}
                                                    </button>
                                                    {/* ── CREATE REFUND REQUEST BUTTON ── */}
                                                    <button onClick={() => openRefundModal(ticket)}
                                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg border border-emerald-700 transition-all flex items-center gap-1.5 shadow-sm ml-auto">
                                                        <ReceiptText className="h-3 w-3" />
                                                        Create Refund Request
                                                    </button>
                                                </div>
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
