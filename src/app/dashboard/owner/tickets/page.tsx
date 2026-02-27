"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { getOwnerTickets, resolveTicket, replyToTicket } from "@/actions/ops";
import { MessageSquare, CheckCircle, Clock, AlertCircle } from "lucide-react";

export default function OwnerTicketsPage() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const data = await getOwnerTickets();
            setTickets(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, []);

    const handleResolve = async (id: string) => {
        if (!confirm(`Mark ticket as resolved?`)) return;
        try {
            await resolveTicket(id);
            fetchTickets();
        } catch (error) {
            alert("Failed to resolve ticket.");
        }
    };

    const handleReply = async (id: string) => {
        const message = prompt(`Enter your reply:`);
        if (!message) return;
        try {
            await replyToTicket(id, message);
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
                    <p className="text-muted-foreground">Manage resident complaints and requests.</p>
                </div>
                <Button variant="outline" onClick={fetchTickets}>Refresh</Button>
            </div>

            <div className="grid gap-4">
                {tickets.map((ticket) => {
                    const replies = JSON.parse(ticket.replies || "[]");
                    return (
                        <Card key={ticket.id} className={ticket.status === 'RESOLVED' ? 'opacity-70' : ''}>
                            <CardHeader className="pb-2 text-primary font-semibold">
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
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ticket.priority === 'HIGH' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                                                }`}>
                                                {ticket.priority} Priority
                                            </span>
                                        </div>
                                        <CardDescription className="text-xs">
                                            Ticket ID: <span className="font-mono">{ticket.displayId}</span> •
                                            Student: {ticket.user?.name} •
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
                                    <p className="text-sm font-medium">Issue Description:</p>
                                    <p className="text-sm text-foreground mt-1">{ticket.description}</p>
                                </div>

                                {replies.length > 0 && (
                                    <div className="space-y-3 mb-4">
                                        <p className="text-xs font-bold uppercase text-muted-foreground">Conversation History</p>
                                        {replies.map((r: any, idx: number) => (
                                            <div key={idx} className={`p-2 rounded text-xs ${r.sender === 'OWNER' ? 'bg-primary/5 border-l-2 border-primary ml-4' : 'bg-muted border-l-2 border-muted-foreground mr-4'}`}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-bold">{r.sender === 'OWNER' ? 'You' : 'Student'}</span>
                                                    <span className="opacity-60">{new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <p>{r.message}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex space-x-2 pt-2 border-t">
                                    {ticket.status !== 'RESOLVED' && (
                                        <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleResolve(ticket.id)}>
                                            <CheckCircle className="h-4 w-4 mr-2" /> Mark Resolved
                                        </Button>
                                    )}
                                    <Button variant="outline" size="sm" onClick={() => handleReply(ticket.id)}>
                                        <MessageSquare className="h-4 w-4 mr-2" /> Reply
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
                {tickets.length === 0 && (
                    <div className="p-12 text-center border-2 border-dashed rounded-xl text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        No support tickets found. Everything looks good!
                    </div>
                )}
            </div>
        </div>
    );
}
