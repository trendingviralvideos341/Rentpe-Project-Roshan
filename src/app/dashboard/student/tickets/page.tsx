"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState, useRef } from "react";
import { getStudentTickets, createStudentTicket, replyToTicket } from "@/actions/ops";
import { OWNER_CATEGORIES, ADMIN_CATEGORIES } from "@/lib/ticket-categories";
import { CheckCircle, Clock, AlertCircle, Plus, Send, Building, Shield, ImagePlus, X } from "lucide-react";

export default function StudentTicketsPage() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [category, setCategory] = useState("");
    const [description, setDescription] = useState("");
    const [creating, setCreating] = useState(false);
    const [replyText, setReplyText] = useState<Record<string, string>>({});
    const [uploadedImages, setUploadedImages] = useState<{file: File, preview: string}[]>([]);
    const imgInputRef = useRef<HTMLInputElement>(null);

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

    const categories = { owner: OWNER_CATEGORIES, admin: ADMIN_CATEGORIES };
    const allCategories = [...categories.owner, ...categories.admin];

    const fetchTickets = async () => {
        setLoading(true);
        try { setTickets(await getStudentTickets()); } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchTickets(); }, []);

    const handleCreate = async () => {
        if (!description.trim() || !category) return;
        setCreating(true);
        try {
            const descWithImages = uploadedImages.length > 0
                ? `${description.trim()}\n\n[ATTACHMENTS: ${uploadedImages.length} screenshot(s) attached]`
                : description.trim();
            await createStudentTicket({ category, description: descWithImages });
            setDescription(""); setCategory(""); setShowCreate(false); 
            // Cleanup previews
            uploadedImages.forEach(img => URL.revokeObjectURL(img.preview));
            setUploadedImages([]);
            fetchTickets();
        } catch (e) { alert("Failed to create ticket."); }
        finally { setCreating(false); }
    };

    const handleReply = async (id: string) => {
        const message = replyText[id]?.trim();
        if (!message) return;
        try {
            await replyToTicket(id, message);
            setReplyText(prev => ({ ...prev, [id]: "" }));
            fetchTickets();
        } catch (e) { alert("Failed to send reply."); }
    };

    const getRoutingLabel = (cat: string) => {
        if (categories.owner.includes(cat)) return { label: "→ Owner", icon: Building, color: "text-orange-600 bg-orange-100" };
        return { label: "→ RentPe Admin", icon: Shield, color: "text-blue-600 bg-blue-100" };
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading tickets...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Support Tickets</h1>
                    <p className="text-muted-foreground">Raise issues and track your requests.</p>
                </div>
                <Button onClick={() => setShowCreate(!showCreate)}>
                    <Plus className="h-4 w-4 mr-2" /> New Ticket
                </Button>
            </div>

            {/* Create Ticket Form */}
            {showCreate && (
                <Card className="border-primary/30 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="text-lg">Raise a New Ticket</CardTitle>
                        <CardDescription>Select a category — your ticket will be automatically routed to the right team.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">What&apos;s your issue about?</label>

                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                <Building className="h-3 w-3" /> <strong>Property Issues</strong> — goes to your PG Owner
                            </p>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {categories.owner.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setCategory(c)}
                                        className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${category === c ? 'bg-orange-600 text-white border-orange-600' : 'hover:bg-orange-50 border-orange-200 text-orange-700'
                                            }`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>

                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                <Shield className="h-3 w-3" /> <strong>Platform Issues</strong> — goes directly to RentPe Admin
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {categories.admin.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setCategory(c)}
                                        className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${category === c ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-blue-50 border-blue-200 text-blue-700'
                                            }`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {category && (
                            <div className="p-2 rounded bg-muted text-xs flex items-center gap-2">
                                {(() => { const r = getRoutingLabel(category); return <><r.icon className="h-4 w-4" /><span>This ticket will be sent to <strong>{r.label.replace('→ ', '')}</strong></span></>; })()}
                            </div>
                        )}

                        <div>
                            <label className="text-sm font-medium mb-1 block">Describe your issue</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe your issue in detail..."
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
                                            onClick={() => removeImage(idx)}
                                            className="absolute -top-2 -right-2 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                                {uploadedImages.length < 3 && (
                                    <button
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
                            <Button onClick={handleCreate} disabled={creating || !description.trim() || !category}>
                                {creating ? "Submitting..." : "Submit Ticket"}
                            </Button>
                            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Ticket List */}
            <div className="grid gap-4">
                {tickets.map((ticket) => {
                    const replies = JSON.parse(ticket.replies || "[]");
                    const routing = getRoutingLabel(ticket.category);
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
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${routing.color}`}>
                                                {routing.label}
                                            </span>
                                        </div>
                                        <CardDescription className="text-xs">
                                            <span className="font-mono">{ticket.displayId}</span> •
                                            {ticket.property?.name && ` Property: ${ticket.property.name} •`}
                                            {new Date(ticket.createdAt).toLocaleDateString()}
                                        </CardDescription>
                                    </div>
                                    <div className="p-2 rounded-full bg-muted">
                                        {ticket.status === 'RESOLVED' ? <CheckCircle className="h-5 w-5 text-green-600" /> : <Clock className="h-5 w-5 text-yellow-600" />}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="p-4 rounded bg-muted/30 border mb-4">
                                    <p className="text-sm text-foreground">{ticket.description}</p>
                                </div>

                                {replies.length > 0 && (
                                    <div className="space-y-3 mb-4">
                                        <p className="text-xs font-bold uppercase text-muted-foreground">Conversation</p>
                                        {replies.map((r: any, idx: number) => (
                                            <div key={idx} className={`p-2 rounded text-xs ${r.sender === 'USER' ? 'bg-primary/5 border-l-2 border-primary ml-4' :
                                                r.sender === 'OWNER' ? 'bg-orange-50 border-l-2 border-orange-400 mr-4' :
                                                    'bg-blue-50 border-l-2 border-blue-400 mr-4'
                                                }`}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-bold">{r.sender === 'USER' ? 'You' : r.sender === 'OWNER' ? 'Owner' : 'Admin'}</span>
                                                    <span className="opacity-60">{new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <p>{r.message}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {ticket.status !== 'RESOLVED' && (
                                    <div className="flex gap-2 pt-2 border-t">
                                        <Input
                                            placeholder="Type a reply..."
                                            value={replyText[ticket.id] || ""}
                                            onChange={(e) => setReplyText(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                                            onKeyDown={(e) => e.key === 'Enter' && handleReply(ticket.id)}
                                        />
                                        <Button size="sm" onClick={() => handleReply(ticket.id)} disabled={!replyText[ticket.id]?.trim()}>
                                            <Send className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
                {tickets.length === 0 && (
                    <div className="p-12 text-center border-2 border-dashed rounded-xl text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        No tickets yet. Click &quot;New Ticket&quot; to raise an issue.
                    </div>
                )}
            </div>
        </div>
    );
}
