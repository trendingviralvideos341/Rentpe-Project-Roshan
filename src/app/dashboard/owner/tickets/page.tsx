"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState, useRef } from "react";
import { getOwnerTickets, getOwnerRaisedTickets, createOwnerTicket, resolveTicket, replyToTicket, escalateTicketToAdmin } from "@/actions/ops";
import { OWNER_TO_ADMIN_CATEGORIES } from "@/lib/ticket-categories";
import { MessageSquare, CheckCircle, Clock, AlertCircle, Plus, Send, ArrowUpRight, Shield, ImagePlus, X } from "lucide-react";

export default function OwnerTicketsPage() {
    const [studentTickets, setStudentTickets] = useState<any[]>([]);
    const [myTickets, setMyTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'incoming' | 'raised'>('incoming');
    const [showCreate, setShowCreate] = useState(false);
    const [category, setCategory] = useState("Payment Settlement");
    const [description, setDescription] = useState("");
    const [creating, setCreating] = useState(false);
    const [replyText, setReplyText] = useState<Record<string, string>>({});
    const [uploadedImages, setUploadedImages] = useState<{file: File, preview: string}[]>([]);
    const imgInputRef = useRef<HTMLInputElement>(null);

    const ownerCategories = OWNER_TO_ADMIN_CATEGORIES;

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const remaining = 3 - uploadedImages.length;
        const toProcess = files.slice(0, remaining);
        
        const newImages = toProcess.map(file => ({
            file,
            preview: URL.createObjectURL(file)
        }));
        
        setUploadedImages(prev => [...prev, ...newImages]);
        e.target.value = '';
    };

    const removeImage = (idx: number) => {
        const removed = uploadedImages[idx];
        if (removed.preview.startsWith('blob:')) {
            URL.revokeObjectURL(removed.preview);
        }
        setUploadedImages(prev => prev.filter((_, i) => i !== idx));
    };

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [st, mt] = await Promise.all([getOwnerTickets(), getOwnerRaisedTickets()]);
            setStudentTickets(st);
            setMyTickets(mt);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchAll(); }, []);

    const handleResolve = async (id: string) => {
        if (!confirm("Mark this ticket as resolved?")) return;
        try { await resolveTicket(id); fetchAll(); } catch (e) { alert("Failed to resolve."); }
    };

    const handleEscalate = async (id: string) => {
        if (!confirm("Escalate this ticket to the RentPe Admin team?")) return;
        try { await escalateTicketToAdmin(id); fetchAll(); } catch (e) { alert("Failed to escalate."); }
    };

    const handleReply = async (id: string) => {
        const message = replyText[id]?.trim();
        if (!message) return;
        try {
            await replyToTicket(id, message);
            setReplyText(prev => ({ ...prev, [id]: "" }));
            fetchAll();
        } catch (e) { alert("Failed to send reply."); }
    };

    const handleCreate = async () => {
        if (!description.trim()) return;
        setCreating(true);
        try {
            const descWithImages = uploadedImages.length > 0
                ? `${description.trim()}\n\n[ATTACHMENTS: ${uploadedImages.length} screenshot(s) attached]`
                : description.trim();
            await createOwnerTicket({ category, description: descWithImages });
            setDescription(""); setShowCreate(false); setUploadedImages([]);
            fetchAll();
            setTab('raised');
        } catch (e) { alert("Failed to create ticket."); }
        finally { setCreating(false); }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading tickets...</div>;

    const displayTickets = tab === 'incoming' ? studentTickets : myTickets;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Support Tickets</h1>
                    <p className="text-muted-foreground">Manage customer complaints & raise issues to RentPe Admin.</p>
                </div>
                <Button onClick={() => setShowCreate(!showCreate)}>
                    <Plus className="h-4 w-4 mr-2" /> Raise to Admin
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setTab('incoming')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'incoming' ? 'bg-orange-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                >
                    From Students ({studentTickets.length})
                </button>
                <button
                    onClick={() => setTab('raised')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'raised' ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                >
                    My Tickets to Admin ({myTickets.length})
                </button>
            </div>

            {/* Create Owner Ticket Form */}
            {showCreate && (
                <Card className="border-blue-300 bg-blue-50/50">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Shield className="h-5 w-5 text-blue-600" /> Raise a Ticket to RentPe Admin
                        </CardTitle>
                        <CardDescription>Report platform issues or escalate matters to our admin team.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                            >
                                {OWNER_TO_ADMIN_CATEGORIES.map(c => (
<option key={c} value={c}>{c}</option>))}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe your issue..."
                                rows={4}
                                className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none"
                            />
                        </div>

                        {/* Photo Upload Section */}
                        <div>
                            <label className="text-sm font-medium mb-1 block">Screenshots / Photos</label>
                            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                <ImagePlus className="h-3 w-3" />
                                Please upload screenshots of the error and photos for quick support (max 3 images)
                            </p>
                            <div className="flex flex-wrap gap-3 mb-3">
                                {uploadedImages.map((img, idx) => (
                                    <div key={idx} className="relative group">
                                        <img src={img.preview} alt={`Screenshot ${idx + 1}`} className="h-24 w-24 object-cover rounded-lg border-2 border-primary/20" />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(idx)}
                                            className="absolute -top-2 -right-2 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                                {uploadedImages.length < 3 && (
                                    <button
                                        type="button"
                                        onClick={() => imgInputRef.current?.click()}
                                        className="h-24 w-24 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-primary/5 transition-all text-muted-foreground"
                                    >
                                        <ImagePlus className="h-5 w-5" />
                                        <span className="text-[10px] font-medium">Add Photo</span>
                                        <span className="text-[9px] opacity-60">{uploadedImages.length}/3</span>
                                    </button>
                                )}
                            </div>
                            <input
                                ref={imgInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={handleImageUpload}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleCreate} disabled={creating || !description.trim()}>
                                {creating ? "Submitting..." : "Submit to Admin"}
                            </Button>
                            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Ticket List */}
            <div className="grid gap-4">
                {displayTickets.map((ticket) => {
                    const replies = JSON.parse(ticket.replies || "[]");
                    const isIncoming = tab === 'incoming';
                    return (
                        <Card key={ticket.id} className={ticket.status === 'RESOLVED' ? 'opacity-70' : ''}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <CardTitle className="text-lg">{ticket.category}</CardTitle>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ticket.status === 'OPEN' ? 'bg-green-100 text-green-800' :
                                                ticket.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                                                    ticket.status === 'ESCALATED' ? 'bg-purple-100 text-purple-800' :
                                                        'bg-gray-100 text-gray-800'
                                                }`}>{ticket.status}</span>
                                            {isIncoming && (
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ticket.priority === 'HIGH' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                                                    }`}>{ticket.priority}</span>
                                            )}
                                        </div>
                                        <CardDescription className="text-xs">
                                            <span className="font-mono">{ticket.displayId}</span> •
                                            {isIncoming && ticket.user?.name && ` Student: ${ticket.user.name} •`}
                                            {ticket.property?.name && ` Property: ${ticket.property.name} •`}
                                            {new Date(ticket.createdAt).toLocaleDateString()}
                                        </CardDescription>
                                    </div>
                                    <div className="p-2 rounded-full bg-muted">
                                        {ticket.status === 'RESOLVED' ? <CheckCircle className="h-5 w-5 text-green-600" /> :
                                            ticket.status === 'ESCALATED' ? <ArrowUpRight className="h-5 w-5 text-purple-600" /> :
                                                <Clock className="h-5 w-5 text-yellow-600" />}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="p-4 rounded bg-muted/30 border mb-4">
                                    <p className="text-sm">{ticket.description}</p>
                                </div>

                                {replies.length > 0 && (
                                    <div className="space-y-3 mb-4">
                                        <p className="text-xs font-bold uppercase text-muted-foreground">Conversation</p>
                                        {replies.map((r: any, idx: number) => (
                                            <div key={idx} className={`p-2 rounded text-xs ${r.sender === 'OWNER' ? 'bg-primary/5 border-l-2 border-primary ml-4' :
                                                r.sender === 'ADMIN' ? 'bg-blue-50 border-l-2 border-blue-400 mr-4' :
                                                    'bg-muted border-l-2 border-muted-foreground mr-4'
                                                }`}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-bold">{r.sender === 'OWNER' ? 'You' : r.sender === 'ADMIN' ? 'Admin' : 'Student'}</span>
                                                    <span className="opacity-60">{new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <p>{r.message}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex gap-2 pt-2 border-t items-center flex-wrap">
                                    {isIncoming && ticket.status !== 'RESOLVED' && ticket.status !== 'ESCALATED' && (
                                        <>
                                            <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700 shrink-0" onClick={() => handleResolve(ticket.id)}>
                                                <CheckCircle className="h-4 w-4 mr-1" /> Resolve
                                            </Button>
                                            <Button variant="outline" size="sm" className="text-purple-600 border-purple-300 shrink-0" onClick={() => handleEscalate(ticket.id)}>
                                                <ArrowUpRight className="h-4 w-4 mr-1" /> Escalate to Admin
                                            </Button>
                                        </>
                                    )}
                                    {ticket.status !== 'RESOLVED' && (
                                        <>
                                            <Input
                                                placeholder="Type a reply..."
                                                value={replyText[ticket.id] || ""}
                                                onChange={(e) => setReplyText(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                                                onKeyDown={(e) => e.key === 'Enter' && handleReply(ticket.id)}
                                                className="flex-1"
                                            />
                                            <Button size="sm" variant="outline" onClick={() => handleReply(ticket.id)} disabled={!replyText[ticket.id]?.trim()} className="shrink-0">
                                                <Send className="h-4 w-4" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
                {displayTickets.length === 0 && (
                    <div className="p-12 text-center border-2 border-dashed rounded-xl text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        {tab === 'incoming' ? 'No student tickets routed to you.' : 'You haven\'t raised any tickets to admin yet.'}
                    </div>
                )}
            </div>
        </div>
    );
}
