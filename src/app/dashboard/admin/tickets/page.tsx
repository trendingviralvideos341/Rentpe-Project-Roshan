"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { getAllTickets, resolveTicket, replyToTicket } from "@/actions/ops";
import { CheckCircle, Clock, AlertCircle, Send, Filter, Building, Shield, Users, ArrowUpRight } from "lucide-react";

export default function AdminTicketsPage() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [teamFilter, setTeamFilter] = useState<string>("ALL");
    const [sourceFilter, setSourceFilter] = useState<string>("ALL");
    const [replyText, setReplyText] = useState<Record<string, string>>({});

    const fetchTickets = async () => {
        setLoading(true);
        try { setTickets(await getAllTickets()); } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchTickets(); }, []);

    const handleResolve = async (id: string) => {
        if (!confirm("Mark this ticket as resolved?")) return;
        try { await resolveTicket(id); fetchTickets(); } catch (e) { alert("Failed to resolve."); }
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

    let filtered = tickets;
    if (statusFilter !== "ALL") filtered = filtered.filter(t => t.status === statusFilter);
    if (teamFilter !== "ALL") filtered = filtered.filter(t => t.targetTeam === teamFilter);
    if (sourceFilter !== "ALL") filtered = filtered.filter(t => t.raisedByRole === sourceFilter);

    const openCount = tickets.filter(t => t.status === 'OPEN').length;
    const escalatedCount = tickets.filter(t => t.status === 'ESCALATED').length;
    const fromStudents = tickets.filter(t => t.raisedByRole === 'USER').length;
    const fromOwners = tickets.filter(t => t.raisedByRole === 'OWNER').length;
    const routedToOwner = tickets.filter(t => t.targetTeam === 'OWNER').length;
    const routedToAdmin = tickets.filter(t => t.targetTeam === 'ADMIN').length;

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading tickets...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Ticket Resolutions</h1>
                <p className="text-muted-foreground">Full visibility — manage tickets from students & owners across the platform.</p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setStatusFilter("ALL"); setTeamFilter("ALL"); setSourceFilter("ALL"); }}>
                    <CardContent className="pt-3 pb-3 text-center">
                        <p className="text-xl font-bold">{tickets.length}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md border-green-200" onClick={() => { setStatusFilter("OPEN"); setTeamFilter("ALL"); setSourceFilter("ALL"); }}>
                    <CardContent className="pt-3 pb-3 text-center">
                        <p className="text-xl font-bold text-green-600">{openCount}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Open</p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md border-purple-200" onClick={() => { setStatusFilter("ESCALATED"); setTeamFilter("ALL"); setSourceFilter("ALL"); }}>
                    <CardContent className="pt-3 pb-3 text-center">
                        <p className="text-xl font-bold text-purple-600">{escalatedCount}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Escalated</p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md border-blue-200" onClick={() => { setSourceFilter("USER"); setStatusFilter("ALL"); setTeamFilter("ALL"); }}>
                    <CardContent className="pt-3 pb-3 text-center">
                        <p className="text-xl font-bold text-blue-600">{fromStudents}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">From Students</p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md border-orange-200" onClick={() => { setSourceFilter("OWNER"); setStatusFilter("ALL"); setTeamFilter("ALL"); }}>
                    <CardContent className="pt-3 pb-3 text-center">
                        <p className="text-xl font-bold text-orange-600">{fromOwners}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">From Owners</p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md border-red-200" onClick={() => { setTeamFilter("ADMIN"); setStatusFilter("ALL"); setSourceFilter("ALL"); }}>
                    <CardContent className="pt-3 pb-3 text-center">
                        <p className="text-xl font-bold text-red-600">{routedToAdmin}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">→ Admin Team</p>
                    </CardContent>
                </Card>
            </div>

            {(statusFilter !== "ALL" || teamFilter !== "ALL" || sourceFilter !== "ALL") && (
                <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Active filters:</span>
                    {statusFilter !== "ALL" && <span className="text-xs px-2 py-1 rounded bg-muted font-bold">{statusFilter}</span>}
                    {teamFilter !== "ALL" && <span className="text-xs px-2 py-1 rounded bg-muted font-bold">Team: {teamFilter}</span>}
                    {sourceFilter !== "ALL" && <span className="text-xs px-2 py-1 rounded bg-muted font-bold">From: {sourceFilter}</span>}
                    <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("ALL"); setTeamFilter("ALL"); setSourceFilter("ALL"); }}>Clear</Button>
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
                                                        ticket.status === 'ESCALATED' ? 'bg-purple-100 text-purple-800' :
                                                            'bg-gray-100 text-gray-800'
                                                }`}>{ticket.status}</span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ticket.raisedByRole === 'USER' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                                                }`}>
                                                {ticket.raisedByRole === 'USER' ? '👤 Student' : '🏠 Owner'}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ticket.targetTeam === 'ADMIN' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                → {ticket.targetTeam}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ticket.priority === 'HIGH' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                                                }`}>{ticket.priority}</span>
                                        </div>
                                        <CardDescription className="text-xs">
                                            <span className="font-mono">{ticket.displayId}</span> •
                                            Raised by: <strong>{ticket.user?.name || 'Unknown'}</strong>
                                            {ticket.user?.email && ` (${ticket.user.email})`} •
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
                                        <p className="text-xs font-bold uppercase text-muted-foreground">Conversation History</p>
                                        {replies.map((r: any, idx: number) => (
                                            <div key={idx} className={`p-2 rounded text-xs ${r.sender === 'ADMIN' ? 'bg-primary/5 border-l-2 border-primary ml-4' :
                                                    r.sender === 'OWNER' ? 'bg-orange-50 border-l-2 border-orange-400' :
                                                        'bg-blue-50 border-l-2 border-blue-400 mr-4'
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
                        {statusFilter === "ALL" && teamFilter === "ALL" && sourceFilter === "ALL" ? "No tickets found." : "No tickets match the current filter."}
                    </div>
                )}
            </div>
        </div>
    );
}
