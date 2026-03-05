"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { getAllTickets, resolveTicket, replyToTicket } from "@/actions/ops";
import { MessageSquare, CheckCircle, Clock, AlertCircle, Send, Filter } from "lucide-react";

export default function AdminTicketsPage() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>("ALL");
    const [replyText, setReplyText] = useState<Record<string, string>>({});

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const data = await getAllTickets();
            setTickets(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTickets(); }, []);

    const handleResolve = async (id: string) => {
        if (!confirm("Mark this ticket as resolved?")) return;
        try {
            await resolveTicket(id);
            fetchTickets();
        } catch (error) {
            alert("Failed to resolve ticket.");
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

    const filtered = filter === "ALL" ? tickets : tickets.filter(t => t.status === filter);
    const openCount = tickets.filter(t => t.status === 'OPEN').length;
    const inProgressCount = tickets.filter(t => t.status === 'IN_PROGRESS').length;
    const resolvedCount = tickets.filter(t => t.status === 'RESOLVED').length;

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading tickets...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Ticket Resolutions</h1>
                <p className="text-muted-foreground">Manage and resolve support tickets from students and owners.</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("ALL")}>
                    <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-2xl font-bold">{tickets.length}</p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md transition-shadow border-green-200" onClick={() => setFilter("OPEN")}>
                    <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-2xl font-bold text-green-600">{openCount}</p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Open</p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md transition-shadow border-yellow-200" onClick={() => setFilter("IN_PROGRESS")}>
                    <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-2xl font-bold text-yellow-600">{inProgressCount}</p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">In Progress</p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md transition-shadow border-gray-200" onClick={() => setFilter("RESOLVED")}>
                    <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-2xl font-bold text-gray-500">{resolvedCount}</p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Resolved</p>
                    </CardContent>
                </Card>
            </div>

            {filter !== "ALL" && (
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Showing: <span className="font-bold text-foreground">{filter}</span></span>
                    <Button variant="ghost" size="sm" onClick={() => setFilter("ALL")}>Clear Filter</Button>
                </div>
            )}

            {/* Ticket List */}
            <div className="grid gap-4">
                {filtered.map((ticket) => {
                    const replies = JSON.parse(ticket.replies || "[]");
                    return (
                        <Card key={ticket.id} className={ticket.status === 'RESOLVED' ? 'opacity-70' : ''}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <CardTitle className="text-lg">{ticket.category}</CardTitle>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ticket.status === 'OPEN' ? 'bg-green-100 text-green-800' :
                                                    ticket.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-gray-100 text-gray-800'
                                                }`}>
                                                {ticket.status}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ticket.priority === 'HIGH' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                                                }`}>
                                                {ticket.priority}
                                            </span>
                                        </div>
                                        <CardDescription className="text-xs">
                                            <span className="font-mono">{ticket.displayId}</span> •
                                            Student: <span className="font-medium">{ticket.user?.name || 'Unknown'}</span>
                                            {ticket.user?.email && ` (${ticket.user.email})`} •
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
                                    <p className="text-sm">{ticket.description}</p>
                                </div>

                                {replies.length > 0 && (
                                    <div className="space-y-3 mb-4">
                                        <p className="text-xs font-bold uppercase text-muted-foreground">Conversation History</p>
                                        {replies.map((r: any, idx: number) => (
                                            <div key={idx} className={`p-2 rounded text-xs ${r.sender === 'ADMIN' ? 'bg-primary/5 border-l-2 border-primary ml-4' :
                                                    r.sender === 'OWNER' ? 'bg-orange-50 border-l-2 border-orange-400 ml-4' :
                                                        'bg-muted border-l-2 border-muted-foreground mr-4'
                                                }`}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-bold">{r.sender === 'ADMIN' ? 'Admin (You)' : r.sender === 'OWNER' ? 'Owner' : 'Student'}</span>
                                                    <span className="opacity-60">{new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <p>{r.message}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex gap-2 pt-2 border-t items-center">
                                    {ticket.status !== 'RESOLVED' && (
                                        <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700 shrink-0" onClick={() => handleResolve(ticket.id)}>
                                            <CheckCircle className="h-4 w-4 mr-1" /> Resolve
                                        </Button>
                                    )}
                                    <Input
                                        placeholder="Type admin reply..."
                                        value={replyText[ticket.id] || ""}
                                        onChange={(e) => setReplyText(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                                        onKeyDown={(e) => e.key === 'Enter' && handleReply(ticket.id)}
                                        className="flex-1"
                                    />
                                    <Button size="sm" variant="outline" onClick={() => handleReply(ticket.id)} disabled={!replyText[ticket.id]?.trim()} className="shrink-0">
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
                {filtered.length === 0 && (
                    <div className="p-12 text-center border-2 border-dashed rounded-xl text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        {filter === "ALL" ? "No tickets found." : `No ${filter.toLowerCase()} tickets.`}
                    </div>
                )}
            </div>
        </div>
    );
}
