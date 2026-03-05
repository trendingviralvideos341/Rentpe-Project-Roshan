"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { getStudentTickets, createStudentTicket, replyToTicket } from "@/actions/ops";
import { MessageSquare, CheckCircle, Clock, AlertCircle, Plus, Send } from "lucide-react";

const CATEGORIES = ["Maintenance", "Food Quality", "Cleanliness", "Roommate Issue", "WiFi / Internet", "Water / Electricity", "Security", "Other"];

export default function StudentTicketsPage() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [category, setCategory] = useState("Maintenance");
    const [description, setDescription] = useState("");
    const [creating, setCreating] = useState(false);
    const [replyText, setReplyText] = useState<Record<string, string>>({});

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const data = await getStudentTickets();
            setTickets(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTickets(); }, []);

    const handleCreate = async () => {
        if (!description.trim()) return;
        setCreating(true);
        try {
            await createStudentTicket({ category, description: description.trim() });
            setDescription("");
            setShowCreate(false);
            fetchTickets();
        } catch (error) {
            alert("Failed to create ticket.");
        } finally {
            setCreating(false);
        }
    };

    const handleReply = async (id: string) => {
        const message = replyText[id]?.trim();
        if (!message) return;
        try {
            await replyToTicket(id, message);
            setReplyText(prev => ({ ...prev, [id]: "" }));
            fetchTickets();
        } catch (error) {
            alert("Failed to send reply.");
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading tickets...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Support Tickets</h1>
                    <p className="text-muted-foreground">Raise issues or track your existing requests.</p>
                </div>
                <Button onClick={() => setShowCreate(!showCreate)}>
                    <Plus className="h-4 w-4 mr-2" /> New Ticket
                </Button>
            </div>

            {/* Create Ticket Form */}
            {showCreate && (
                <Card className="border-primary/30 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="text-lg">Create New Ticket</CardTitle>
                        <CardDescription>Describe your issue and we'll get back to you.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                            >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe your issue in detail..."
                                rows={4}
                                className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleCreate} disabled={creating || !description.trim()}>
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
                    return (
                        <Card key={ticket.id} className={ticket.status === 'RESOLVED' ? 'opacity-70' : ''}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-lg">{ticket.category}</CardTitle>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ticket.status === 'OPEN' ? 'bg-green-100 text-green-800' :
                                                    ticket.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-gray-100 text-gray-800'
                                                }`}>
                                                {ticket.status}
                                            </span>
                                        </div>
                                        <CardDescription className="text-xs">
                                            Ticket ID: <span className="font-mono">{ticket.displayId}</span> •
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
                                            <div key={idx} className={`p-2 rounded text-xs ${r.sender === 'USER' ? 'bg-primary/5 border-l-2 border-primary ml-4' : 'bg-muted border-l-2 border-muted-foreground mr-4'}`}>
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
                        No tickets yet. Click "New Ticket" to raise an issue.
                    </div>
                )}
            </div>
        </div>
    );
}
