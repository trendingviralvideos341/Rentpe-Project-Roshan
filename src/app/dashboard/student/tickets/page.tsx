"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { getStudentTickets, createStudentTicket, replyToTicket, checkStudentHasActiveProperty } from "@/actions/ops";
import {
    ChevronDown, ChevronRight,
    Plus, Send, X, Building, AlertCircle,
    ImagePlus, Loader2, MessageCircle, ArrowLeft, Shield
} from "lucide-react";


// ─── Category definitions with subcategories and routing ─────────────────────
const STUDENT_CATEGORIES = [
    {
        key: "Maintenance",
        label: "Maintenance",
        emoji: "🔧",
        routesTo: "OWNER",
        routeLabel: "→ Property Management",
        color: "orange",
        description: "Room/property repair issues",
        subcategories: ["Electrical", "Plumbing", "Furniture", "Cleanliness", "WiFi / Internet", "Water / Electricity", "Security", "Noise", "Other Maintenance"],
    },
    {
        key: "Booking Issue",
        label: "Booking Issue",
        emoji: "📅",
        routesTo: "OWNER",
        routeLabel: "→ Property Management",
        color: "orange",
        description: "Room assignment, check-in, date issues",
        subcategories: ["Wrong Room Assigned", "Check-in Date Issue", "Booking Not Updated", "Room Not Ready", "Other Booking Issue"],
    },
    {
        key: "Room Issue",
        label: "Room / Facility",
        emoji: "🏠",
        routesTo: "OWNER",
        routeLabel: "→ Property Management",
        color: "orange",
        description: "Room condition, amenities, common areas",
        subcategories: ["Bed / Mattress", "Bathroom", "Locker / Storage", "Common Area", "Parking", "Other Room Issue"],
    },
    {
        key: "Billing",
        label: "Billing",
        emoji: "💳",
        routesTo: "ADMIN",
        routeLabel: "→ RentPe Support Team",
        color: "blue",
        description: "Invoice, payment, overcharge issues",
        subcategories: ["Incorrect Invoice", "Overcharged", "Missing Payment Record", "Receipt Issue", "Other Billing Issue"],
    },
    {
        key: "Refund Request",
        label: "Refund Request",
        emoji: "💸",
        routesTo: "ADMIN",
        routeLabel: "→ RentPe Support Team",
        color: "blue",
        description: "Request for money back",
        subcategories: ["Deposit Refund", "Cancellation Refund", "Overcharge Refund", "Token Refund", "Other Refund"],
    },
    {
        key: "KYC",
        label: "KYC Issue",
        emoji: "🪪",
        routesTo: "ADMIN",
        routeLabel: "→ RentPe Support Team",
        color: "blue",
        description: "Document verification issue",
        subcategories: ["Document Rejected", "Verification Pending", "Wrong Status", "Re-upload Issue", "Other KYC Issue"],
    },
    {
        key: "Platform Issue",
        label: "Platform / App",
        emoji: "📱",
        routesTo: "ADMIN",
        routeLabel: "→ RentPe Support Team",
        color: "blue",
        description: "App bugs, login, account problems",
        subcategories: ["Can't Login", "App Crashing", "Feature Not Working", "Data Incorrect", "Other Platform Issue"],
    },
    {
        key: "Other",
        label: "Other",
        emoji: "📦",
        routesTo: "ADMIN",
        routeLabel: "→ RentPe Support Team",
        color: "blue",
        description: "Anything else",
        subcategories: [],
    },
];

const STATUS_STYLES: Record<string, string> = {
    OPEN: "bg-green-100 text-green-800",
    ACKNOWLEDGED: "bg-blue-100 text-blue-800",
    IN_PROGRESS: "bg-yellow-100 text-yellow-800",
    RESOLVED: "bg-emerald-100 text-emerald-800",
    CLOSED: "bg-slate-100 text-slate-600",
    ESCALATED: "bg-purple-100 text-purple-800",
};

export default function StudentTicketsPage() {
    const [tab, setTab] = useState<"my" | "raise">("my");
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [description, setDescription] = useState("");
    const [creating, setCreating] = useState(false);
    const [replyText, setReplyText] = useState<Record<string, string>>({});
    const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
    const [uploadedImages, setUploadedImages] = useState<{ file: File; preview: string }[]>([]);
    const imgInputRef = useRef<HTMLInputElement>(null);
    const [isPending, startTransition] = useTransition();
    const [sendingReply, setSendingReply] = useState<Record<string, boolean>>({});
    const [hasActiveProperty, setHasActiveProperty] = useState(false);

    const activeCat = STUDENT_CATEGORIES.find((c) => c.key === selectedCategory);

    const fetchTickets = async () => {
        setLoading(true);
        try { 
            setTickets(await getStudentTickets());
            setHasActiveProperty(await checkStudentHasActiveProperty());
        } catch { }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchTickets(); }, []);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const validFiles = files.filter(f => {
            const isValidType = ['image/jpeg', 'image/png', 'image/webp'].includes(f.type);
            const isValidSize = f.size <= 5 * 1024 * 1024;
            if (!isValidType) alert(`${f.name} is not a valid image format (only JPG, PNG, WEBP).`);
            else if (!isValidSize) alert(`${f.name} is too large (max 5MB).`);
            return isValidType && isValidSize;
        });
        const filesToAdd = validFiles.slice(0, 3 - uploadedImages.length);
        setUploadedImages((prev) => [...prev, ...filesToAdd.map((f) => ({ file: f, preview: URL.createObjectURL(f) }))]);
        e.target.value = "";
    };

    const handleCreate = () => {
        if (!description.trim() || !selectedCategory) return;
        setCreating(true);
        startTransition(async () => {
            try {
                const fullDescription = description.trim();
                await createStudentTicket({ category: selectedCategory, description: fullDescription });
                setDescription(""); setSelectedCategory("");
                uploadedImages.forEach((img) => URL.revokeObjectURL(img.preview));
                setUploadedImages([]);
                setTab("my");
                fetchTickets();
            } catch { alert("Failed to create ticket."); }
            finally { setCreating(false); }
        });
    };

    const handleReply = async (id: string) => {
        const msg = replyText[id]?.trim();
        if (!msg) return;
        setSendingReply(p => ({ ...p, [id]: true }));
        try {
            await replyToTicket(id, msg);
            setReplyText((prev) => ({ ...prev, [id]: "" }));
            await fetchTickets();
        } catch { alert("Failed to send reply."); }
        finally { setSendingReply(p => ({ ...p, [id]: false })); }
    };

    const getSLAStatus = (ticket: any) => {
        return null;
    };

    const openCount = tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS" || t.status === "ACKNOWLEDGED").length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Support Tickets</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Raise issues — automatically routed to the right team.
                        {openCount > 0 && <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">{openCount} open</span>}
                    </p>
                </div>
                <button
                    onClick={() => setTab(tab === "raise" ? "my" : "raise")}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm"
                >
                    {tab === "raise" ? <><ArrowLeft className="h-4 w-4" /> My Tickets</> : <><Plus className="h-4 w-4" /> New Ticket</>}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
                {[{ key: "my", label: `My Tickets (${tickets.length})` }, { key: "raise", label: "＋ Raise Ticket" }].map((t) => (
                    <button key={t.key} onClick={() => setTab(t.key as any)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.key ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── TAB: My Tickets ─────────────────────────────────── */}
            {tab === "my" && (
                <div className="space-y-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                    ) : tickets.length === 0 ? (
                        <div className="py-16 text-center border-2 border-dashed rounded-2xl text-muted-foreground">
                            <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                            <p className="font-semibold">No tickets yet</p>
                            <p className="text-sm mt-1">Click <strong>New Ticket</strong> to raise your first issue.</p>
                        </div>
                    ) : tickets.map((ticket) => {
                        const cat = STUDENT_CATEGORIES.find((c) => c.key === ticket.category);
                        const replies = JSON.parse(ticket.replies || "[]");
                        const sla = getSLAStatus(ticket);
                        const isExpanded = expandedTicket === ticket.id;

                        return (
                            <div key={ticket.id} className={`border rounded-2xl overflow-hidden bg-card transition-all ${ticket.status === "RESOLVED" || ticket.status === "CLOSED" ? "opacity-60" : ""}`}>
                                <div className="p-4 cursor-pointer hover:bg-muted/30" onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        {/* Left Column: Ticket Info */}
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <span className="text-3xl p-2 bg-slate-100 rounded-xl shrink-0">{cat?.emoji || "📋"}</span>
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
                                                        </>
                                                    )}
                                                    {replies.length > 0 && (
                                                        <>
                                                            <span>·</span>
                                                            <MessageCircle className="h-3 w-3 inline text-slate-400" />
                                                            <span>{replies.length} {replies.length === 1 ? "reply" : "replies"}</span>
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
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${cat?.color === "orange" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                                                    {cat?.routeLabel || ""}
                                                </span>
                                                {(() => {
                                                    const parsedReplies = JSON.parse(ticket.replies || "[]");
                                                    const lastReply = parsedReplies[parsedReplies.length - 1];
                                                    const isReplyReceived = 
                                                        ticket.status !== "RESOLVED" && 
                                                        ticket.status !== "CLOSED" && 
                                                        lastReply && 
                                                        lastReply.sender !== "USER";
                                                    
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

                                        {/* Conversation Thread */}
                                        {replies.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-xs font-bold uppercase text-muted-foreground">Conversation</p>
                                                {replies.map((r: any, idx: number) => (
                                                    <div key={idx} className={`p-3 rounded-xl text-xs ${r.sender === "USER" ? "bg-indigo-50 border border-indigo-100 ml-4" : r.sender === "OWNER" ? "bg-orange-50 border border-orange-100 mr-4" : "bg-blue-50 border border-blue-100 mr-4"}`}>
                                                        <div className="flex justify-between mb-1">
                                                            <span className="font-bold">{r.sender === "USER" ? "You" : r.senderName || (r.sender === "OWNER" ? "Property Management" : "RentPe Support Team")}</span>
                                                            <span className="opacity-60">{new Date(r.timestamp).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                                                        </div>
                                                        <p>{r.message}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Owner/Admin notes */}
                                        {(ticket.ownerNote || ticket.adminNote) && (
                                            <div className="space-y-2">
                                                {ticket.ownerNote && (
                                                    <div className="p-3 rounded-xl bg-orange-50 border border-orange-100 text-xs">
                                                        <p className="font-bold text-orange-700 uppercase mb-1">Property Management Note</p>
                                                        <p>{ticket.ownerNote}</p>
                                                    </div>
                                                )}
                                                {ticket.adminNote && (
                                                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs">
                                                        <p className="font-bold text-blue-700 uppercase mb-1">Support Team Note</p>
                                                        <p>{ticket.adminNote}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Reply Input */}
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
                                                        placeholder="Type your reply here..."
                                                        value={replyText[ticket.id] || ""}
                                                        onChange={(e) => {
                                                            if (e.target.value.length <= 1000) {
                                                                setReplyText((prev) => ({ ...prev, [ticket.id]: e.target.value }));
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

            {/* ── TAB: Raise Ticket ───────────────────────────────── */}
            {tab === "raise" && (
                <div className="border rounded-2xl overflow-hidden bg-card">
                    <div className="p-5 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
                        <h2 className="font-bold text-lg">Raise a New Support Ticket</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">Select a category — your ticket is automatically routed to the right team.</p>
                    </div>
                    <div className="p-5 space-y-6">
                        {/* Category Selector */}
                        <div>
                            <label className="block text-sm font-bold mb-3">1. What&apos;s your issue about?</label>

                            <div className="mb-2">
                                {hasActiveProperty && (
                                    <>
                                        <p className="text-xs font-semibold text-orange-700 flex items-center gap-1 mb-2">
                                            <Building className="h-3 w-3" /> Property Issues — routed to Property Management
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                                            {STUDENT_CATEGORIES.filter(c => c.routesTo === "OWNER").map(cat => (
                                                <button key={cat.key} onClick={() => { setSelectedCategory(cat.key); }}
                                                    className={`p-3 rounded-xl border-2 text-left transition-all ${selectedCategory === cat.key ? "border-orange-500 bg-orange-50" : "border-slate-200 hover:border-orange-200 hover:bg-orange-50/50"}`}>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xl">{cat.emoji}</span>
                                                        <span className="font-bold text-sm">{cat.label}</span>
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground">{cat.description}</p>
                                                    <span className="inline-block mt-1.5 px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full">{cat.routeLabel}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}

                                <p className="text-xs font-semibold text-blue-700 flex items-center gap-1 mb-2">
                                    <Shield className="h-3 w-3" /> Platform Issues — routed to RentPe Support Team
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                    {STUDENT_CATEGORIES.filter(c => c.routesTo === "ADMIN").map(cat => (
                                        <button key={cat.key} onClick={() => { setSelectedCategory(cat.key); }}
                                            className={`p-3 rounded-xl border-2 text-left transition-all ${selectedCategory === cat.key ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-200 hover:bg-blue-50/50"}`}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xl">{cat.emoji}</span>
                                                <span className="font-bold text-sm">{cat.label}</span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">{cat.description}</p>
                                            <span className="inline-block mt-1.5 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">{cat.routeLabel}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>


                        {/* Description */}
                        {selectedCategory && (
                            <div>
                                <label className="block text-sm font-bold mb-2">2. Describe in detail *</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Provide as much detail as possible so the team can help you quickly..."
                                    rows={4}
                                    className="w-full border rounded-xl px-4 py-3 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                            </div>
                        )}

                        {/* Photos */}
                        {selectedCategory && (
                            <div>
                                <label className="block text-sm font-bold mb-2">Screenshots / Photos <span className="text-muted-foreground font-normal">(optional, max 3)</span></label>
                                <div className="flex gap-3 flex-wrap">
                                    {uploadedImages.map((img, i) => (
                                        <div key={i} className="relative group">
                                            <img src={img.preview} alt="" className="h-20 w-20 object-cover rounded-xl border-2 border-indigo-100" />
                                            <button onClick={() => setUploadedImages(prev => prev.filter((_, idx) => idx !== i))}
                                                className="absolute -top-3 -right-3 h-11 w-11 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                                                aria-label="Remove image"
                                            >
                                                <div className="h-6 w-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md">
                                                    <X className="h-3 w-3" />
                                                </div>
                                            </button>
                                        </div>
                                    ))}
                                    {uploadedImages.length < 3 && (
                                        <button onClick={() => imgInputRef.current?.click()}
                                            className="h-20 w-20 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all">
                                            <ImagePlus className="h-5 w-5" />
                                            <span className="text-[9px] font-medium">{uploadedImages.length}/3</span>
                                        </button>
                                    )}
                                    <input ref={imgInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                                </div>
                            </div>
                        )}

                        {/* Submit */}
                        <div className="flex gap-3 pt-2 border-t">
                            <button onClick={handleCreate} disabled={creating || !description.trim() || !selectedCategory}
                                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl disabled:opacity-40 transition-all flex items-center gap-2">
                                {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : "Submit Ticket"}
                            </button>
                            <button onClick={() => setTab("my")} className="px-6 py-3 bg-muted hover:bg-muted/80 font-bold text-sm rounded-xl transition-all">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
