"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDisputeById, sendDisputeMessage, updateDisputePriority } from "@/actions/adminPhase2";
import { resolveDispute, reviewDispute } from "@/actions/disputes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Send, CheckCircle, AlertTriangle, MessageSquare, User, Clock, ArrowUp } from "lucide-react";

const PRIORITY_COLORS: Record<string, string> = {
    URGENT: "bg-red-100 text-red-800",
    HIGH: "bg-orange-100 text-orange-800",
    MEDIUM: "bg-amber-100 text-amber-800",
    LOW: "bg-slate-100 text-slate-600",
};

export default function DisputeDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;
    const [dispute, setDispute] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [resolution, setResolution] = useState("");
    const [resolving, setResolving] = useState(false);
    const [showResolveForm, setShowResolveForm] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const fetchDispute = async () => {
        try {
            const data = await getDisputeById(id);
            setDispute(data);
        } catch { toast.error("Failed to load dispute"); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (id) fetchDispute(); }, [id]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [dispute?.messages]);

    const handleSend = async () => {
        if (!message.trim()) return;
        setSending(true);
        try {
            await sendDisputeMessage(id, message);
            setMessage("");
            fetchDispute();
        } catch { toast.error("Failed to send message"); }
        finally { setSending(false); }
    };

    const handleResolve = async () => {
        if (!resolution.trim()) { toast.error("Resolution text required"); return; }
        setResolving(true);
        try {
            await resolveDispute(id, resolution);
            toast.success("Dispute resolved!");
            fetchDispute();
            setShowResolveForm(false);
        } catch { toast.error("Failed to resolve"); }
        finally { setResolving(false); }
    };

    const handleMarkReview = async () => {
        try {
            await reviewDispute(id);
            toast.success("Marked as Under Review");
            fetchDispute();
        } catch { toast.error("Failed"); }
    };

    const handlePriority = async (priority: string) => {
        try {
            await updateDisputePriority(id, priority);
            toast.success(`Priority set to ${priority}`);
            fetchDispute();
        } catch { toast.error("Failed"); }
    };

    if (loading) return <div className="p-8 animate-pulse text-center text-muted-foreground">Loading dispute...</div>;
    if (!dispute) return <div className="p-8 text-center text-red-500">Dispute not found.</div>;

    return (
        <div className="space-y-4 md:space-y-6 pb-20 md:pb-8 max-w-4xl mx-auto">
            {/* Back + Header */}
            <div>
                <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
                    <ArrowLeft className="h-4 w-4" /> Back to Disputes
                </button>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl md:text-2xl font-black text-slate-900">{dispute.subject}</h1>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">{dispute.displayId} · {dispute.type}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <Badge className={`border-0 ${PRIORITY_COLORS[dispute.priority] || ""}`}>{dispute.priority}</Badge>
                        <Badge className={`border-0 ${dispute.status === 'RESOLVED' ? 'bg-green-100 text-green-800' : dispute.status === 'OPEN' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                            {dispute.status}
                        </Badge>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
                {/* Main Chat + Description */}
                <div className="md:col-span-2 space-y-4">
                    {/* Description Card */}
                    <Card>
                        <CardContent className="p-4 space-y-3">
                            <h3 className="font-bold text-sm text-slate-700 uppercase tracking-wide">Dispute Description</h3>
                            <p className="text-sm text-slate-800 leading-relaxed">{dispute.description}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2 border-t">
                                <User className="h-3.5 w-3.5" />
                                <span>Raised by: <strong>{dispute.raisedByUser?.name || dispute.raisedByUser?.email || "Unknown"}</strong></span>
                                <Clock className="h-3.5 w-3.5 ml-2" />
                                <span>{new Date(dispute.createdAt).toLocaleDateString('en-IN')}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Message Thread */}
                    <Card>
                        <CardContent className="p-4">
                            <h3 className="font-bold text-sm text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" /> Conversation Thread
                            </h3>
                            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 mb-4">
                                {dispute.messages?.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">No messages yet. Start the conversation below.</p>
                                ) : (
                                    dispute.messages?.map((msg: any) => (
                                        <div key={msg.id}
                                            className={`flex ${msg.senderRole === 'ADMIN' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${msg.senderRole === 'ADMIN'
                                                ? 'bg-indigo-600 text-white rounded-br-sm'
                                                : msg.senderRole === 'OWNER'
                                                    ? 'bg-orange-50 text-orange-900 border border-orange-200 rounded-bl-sm'
                                                    : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                                            }`}>
                                                <p className={`text-[10px] font-bold mb-1 ${msg.senderRole === 'ADMIN' ? 'text-indigo-200' : 'text-muted-foreground'}`}>
                                                    {msg.senderRole === 'ADMIN' ? 'Admin (You)' : msg.senderRole === 'OWNER' ? 'Property Owner' : 'Student'}
                                                </p>
                                                <p>{msg.message}</p>
                                                <p className={`text-[10px] mt-1 text-right ${msg.senderRole === 'ADMIN' ? 'text-indigo-300' : 'text-muted-foreground'}`}>
                                                    {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Reply Input */}
                            {dispute.status !== 'RESOLVED' && dispute.status !== 'CLOSED' && (
                                <div className="flex gap-2 border-t pt-3">
                                    <input
                                        className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                        placeholder="Type admin message..."
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                    />
                                    <Button onClick={handleSend} disabled={!message.trim() || sending} className="shrink-0">
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Resolution Form */}
                    {showResolveForm && dispute.status !== 'RESOLVED' && (
                        <Card className="border-green-200 bg-green-50">
                            <CardContent className="p-4 space-y-3">
                                <h3 className="font-bold text-green-800 flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4" /> Enter Resolution
                                </h3>
                                <textarea
                                    className="w-full border border-green-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
                                    rows={3}
                                    placeholder="Describe how this dispute was resolved..."
                                    value={resolution}
                                    onChange={e => setResolution(e.target.value)}
                                />
                                <div className="flex gap-3">
                                    <Button variant="outline" className="flex-1" onClick={() => setShowResolveForm(false)}>Cancel</Button>
                                    <Button className="flex-1 bg-green-600 hover:bg-green-700" disabled={!resolution.trim() || resolving} onClick={handleResolve}>
                                        {resolving ? "Resolving..." : "Mark as Resolved"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {dispute.status === 'RESOLVED' && (
                        <Card className="border-green-200 bg-green-50">
                            <CardContent className="p-4">
                                <h3 className="font-bold text-green-800 flex items-center gap-2 mb-2">
                                    <CheckCircle className="h-4 w-4" /> Resolution
                                </h3>
                                <p className="text-sm text-green-900">{dispute.resolution}</p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sidebar — Actions */}
                <div className="space-y-4">
                    <Card>
                        <CardContent className="p-4 space-y-3">
                            <h3 className="font-bold text-sm text-slate-700 uppercase tracking-wide">Admin Actions</h3>

                            {dispute.status === 'OPEN' && (
                                <Button variant="outline" className="w-full text-amber-600 border-amber-200" onClick={handleMarkReview}>
                                    Mark Under Review
                                </Button>
                            )}

                            {dispute.status !== 'RESOLVED' && dispute.status !== 'CLOSED' && (
                                <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => setShowResolveForm(true)}>
                                    <CheckCircle className="h-4 w-4 mr-2" /> Resolve Dispute
                                </Button>
                            )}

                            <div>
                                <p className="text-xs font-bold uppercase text-slate-500 mb-2">Escalate Priority</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {["LOW", "MEDIUM", "HIGH", "URGENT"].map(p => (
                                        <button key={p} onClick={() => handlePriority(p)}
                                            className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-all ${dispute.priority === p ? PRIORITY_COLORS[p] + " border-transparent shadow" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Dispute Info */}
                    <Card>
                        <CardContent className="p-4 space-y-3">
                            <h3 className="font-bold text-sm text-slate-700 uppercase tracking-wide">Details</h3>
                            {[
                                { label: "Type", value: dispute.type },
                                { label: "Raised By", value: dispute.raisedByUser?.name || "Unknown" },
                                { label: "Email", value: dispute.raisedByUser?.email || "—" },
                                { label: "Role", value: dispute.raisedByRole },
                                { label: "Created", value: new Date(dispute.createdAt).toLocaleDateString('en-IN') },
                            ].map(item => (
                                <div key={item.label}>
                                    <p className="text-[10px] font-black text-slate-400 uppercase">{item.label}</p>
                                    <p className="text-sm font-medium text-slate-800 truncate">{item.value}</p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
