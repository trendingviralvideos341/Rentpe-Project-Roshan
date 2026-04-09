"use client";

import { useState, useEffect } from "react";
import { getNotificationRecipientCount, sendBulkNotification } from "@/actions/adminPhase2";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Bell, Users, Send, Eye, Check } from "lucide-react";

const AUDIENCE_OPTIONS = [
    { key: "ALL", label: "🌐 All Users", desc: "Every student & owner on the platform" },
    { key: "STUDENTS", label: "🎓 Students Only", desc: "Only tenant/student accounts" },
    { key: "OWNERS", label: "🏠 Owners Only", desc: "Only property owner accounts" },
    { key: "CITY", label: "📍 Specific City", desc: "Filter by city" },
];

const CHANNEL_OPTIONS = [
    { key: "INAPP", label: "📲 In-App Only" },
    { key: "EMAIL", label: "📧 Email Only" },
    { key: "BOTH", label: "📲+📧 Both" },
];

const NOTIFICATION_TYPES = ["INFO", "ALERT", "PROMO", "REMINDER", "PLATFORM_UPDATE", "SECURITY"];

const SAVED_TEMPLATES = [
    { title: "Platform Maintenance", message: "Our platform will undergo scheduled maintenance on Sunday 2–4 AM IST. Services may be temporarily unavailable." },
    { title: "Rent Due Reminder", message: "Your rent for this month is due soon. Please ensure timely payment to avoid late fees." },
    { title: "New Feature Launch", message: "We've launched exciting new features on RentPe! Check your dashboard to explore what's new." },
];

export default function BulkNotificationPage() {
    const [audience, setAudience] = useState("ALL");
    const [city, setCity] = useState("");
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");
    const [type, setType] = useState("INFO");
    const [channel, setChannel] = useState<"INAPP" | "EMAIL" | "BOTH">("INAPP");
    const [recipientCount, setRecipientCount] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [preview, setPreview] = useState(false);
    const [sent, setSent] = useState(false);

    const fetchCount = async () => {
        setLoading(true);
        try {
            const count = await getNotificationRecipientCount(audience as any, city || null);
            setRecipientCount(count);
        } catch { toast.error("Failed to fetch count"); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchCount(); }, [audience, city]);

    const handleSend = async () => {
        if (!title.trim() || !message.trim()) { toast.error("Title and message are required"); return; }
        setSending(true);
        try {
            const result = await sendBulkNotification(audience as any, city || null, title, message, type, channel);
            toast.success(`Notification sent to ${result.recipientCount} users!`);
            setSent(true);
            setTitle("");
            setMessage("");
            setPreview(false);
        } catch { toast.error("Failed to send notification"); }
        finally { setSending(false); }
    };

    const charLimit = 500;

    return (
        <div className="space-y-4 md:space-y-6 pb-20 md:pb-8 max-w-3xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
                    <Bell className="h-7 w-7 text-violet-600" /> Bulk Notification Sender
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Send platform-wide notifications to users</p>
            </div>

            {sent && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <Check className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                        <p className="font-bold text-green-800">Notification sent successfully!</p>
                        <p className="text-sm text-green-700">Choose a new audience and compose another message.</p>
                    </div>
                    <Button variant="outline" className="ml-auto shrink-0" onClick={() => setSent(false)}>New</Button>
                </div>
            )}

            {!sent && (
                <>
                    {/* Step 1 — Audience */}
                    <Card>
                        <CardContent className="p-5 space-y-4">
                            <h2 className="font-black text-slate-800 flex items-center gap-2">
                                <span className="w-6 h-6 bg-violet-600 text-white text-xs rounded-full flex items-center justify-center font-black">1</span>
                                Target Audience
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {AUDIENCE_OPTIONS.map(opt => (
                                    <button key={opt.key} onClick={() => setAudience(opt.key)}
                                        className={`p-3 rounded-xl border text-left transition-all ${audience === opt.key ? "border-violet-500 bg-violet-50 shadow-md" : "border-slate-200 hover:border-violet-300"}`}>
                                        <p className="font-bold text-sm">{opt.label}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                                    </button>
                                ))}
                            </div>

                            {audience === "CITY" && (
                                <input
                                    className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                                    placeholder="Enter city name (e.g. Delhi, Bangalore)..."
                                    value={city}
                                    onChange={e => setCity(e.target.value)}
                                />
                            )}

                            <div className="flex items-center gap-3 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
                                <Users className="h-5 w-5 text-violet-600 shrink-0" />
                                <p className="text-sm font-semibold text-violet-900">
                                    {loading ? "Counting..." : `${recipientCount?.toLocaleString() ?? "?"} recipients will receive this notification`}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Step 2 — Compose */}
                    <Card>
                        <CardContent className="p-5 space-y-4">
                            <h2 className="font-black text-slate-800 flex items-center gap-2">
                                <span className="w-6 h-6 bg-violet-600 text-white text-xs rounded-full flex items-center justify-center font-black">2</span>
                                Compose Message
                            </h2>

                            {/* Templates */}
                            <div>
                                <p className="text-xs font-bold uppercase text-slate-500 mb-2">Quick Templates</p>
                                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                    {SAVED_TEMPLATES.map(tpl => (
                                        <button key={tpl.title} onClick={() => { setTitle(tpl.title); setMessage(tpl.message); }}
                                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-bold whitespace-nowrap hover:border-violet-400 transition-colors">
                                            {tpl.title}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 block mb-1.5">Notification Title *</label>
                                    <input
                                        className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                                        placeholder="e.g. Platform Maintenance Alert"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        maxLength={100}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 block mb-1.5">Message Body * ({message.length}/{charLimit})</label>
                                    <textarea
                                        className="w-full border rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-300"
                                        rows={4}
                                        placeholder="Write your message here..."
                                        value={message}
                                        onChange={e => setMessage(e.target.value.slice(0, charLimit))}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Step 3 — Delivery Settings */}
                    <Card>
                        <CardContent className="p-5 space-y-4">
                            <h2 className="font-black text-slate-800 flex items-center gap-2">
                                <span className="w-6 h-6 bg-violet-600 text-white text-xs rounded-full flex items-center justify-center font-black">3</span>
                                Delivery Settings
                            </h2>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 block mb-2">Notification Type</label>
                                    <select className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                                        value={type} onChange={e => setType(e.target.value)}>
                                        {NOTIFICATION_TYPES.map(t => <option key={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 block mb-2">Channel</label>
                                    <div className="flex gap-2">
                                        {CHANNEL_OPTIONS.map(ch => (
                                            <button key={ch.key} onClick={() => setChannel(ch.key as any)}
                                                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${channel === ch.key ? "bg-violet-600 text-white border-transparent" : "border-slate-200 text-slate-600"}`}>
                                                {ch.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Preview + Send */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setPreview(!preview)}>
                            <Eye className="h-4 w-4 mr-2" /> {preview ? "Hide Preview" : "Show Preview"}
                        </Button>
                        <Button
                            className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold py-3"
                            disabled={!title.trim() || !message.trim() || sending || loading}
                            onClick={handleSend}
                        >
                            <Send className="h-4 w-4 mr-2" />
                            {sending ? "Sending..." : `Send to ${recipientCount?.toLocaleString() ?? "?"} Users`}
                        </Button>
                    </div>

                    {preview && (
                        <Card className="border-violet-200 bg-violet-50">
                            <CardContent className="p-5">
                                <p className="text-xs font-black uppercase text-violet-500 mb-3">Preview</p>
                                <div className="bg-white rounded-2xl p-4 shadow-sm border max-w-sm mx-auto">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-9 h-9 bg-violet-100 rounded-full flex items-center justify-center">
                                            <Bell className="h-4 w-4 text-violet-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-900">{title || "Notification Title"}</p>
                                            <p className="text-xs text-muted-foreground">RentPe Platform</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-700 leading-relaxed">{message || "Your message will appear here..."}</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
