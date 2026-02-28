"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, User, Phone, Mail, CheckCircle, XCircle, Eye, RefreshCcw, MapPin } from "lucide-react";
import { getPendingProperties, approveProperty } from "@/actions/admin";
import { useToast } from "@/components/ui/use-toast";

export default function AdminPropertyApprovalPage() {
    const [properties, setProperties] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchProperties = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getPendingProperties();
            setProperties(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProperties();
    }, [fetchProperties]);

    const handleAction = async (id: string, approved: boolean) => {
        setProcessing(id);
        try {
            await approveProperty(id, approved);
            toast({
                title: approved ? "Property Approved" : "Property Rejected",
                description: approved ? "The property is now live and searchable." : "The property has been rejected.",
            });
            fetchProperties();
        } catch (e: any) {
            toast({
                title: "Action Failed",
                description: e.message,
                variant: "destructive",
            });
        } finally {
            setProcessing(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Property Approvals</h1>
                    <p className="text-muted-foreground">Review and approve new PG/Hostel listings.</p>
                </div>
                <Button variant="outline" onClick={fetchProperties} disabled={loading}>
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            {loading ? (
                <div className="p-20 text-center animate-pulse text-muted-foreground">Loading pending properties...</div>
            ) : properties.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center text-muted-foreground">
                        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        No properties currently awaiting approval.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6">
                    {properties.map(property => (
                        <Card key={property.id} className="overflow-hidden">
                            <CardHeader className="bg-muted/30 pb-4">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <CardTitle className="text-xl flex items-center gap-2">
                                            {property.name}
                                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending</Badge>
                                        </CardTitle>
                                        <CardDescription className="flex items-center gap-1">
                                            <MapPin className="h-3.5 w-3.5" /> {property.city}, {property.address}
                                        </CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            className="h-8"
                                            onClick={() => handleAction(property.id, false)}
                                            disabled={!!processing}
                                        >
                                            <XCircle className="h-4 w-4 mr-1" /> Reject
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="h-8 bg-green-600 hover:bg-green-700"
                                            onClick={() => handleAction(property.id, true)}
                                            disabled={!!processing}
                                        >
                                            <CheckCircle className="h-4 w-4 mr-1" /> Approve
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold uppercase text-muted-foreground">Owner Details</h4>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-sm">
                                                <User className="h-4 w-4 text-purple-600" />
                                                <span className="font-medium">{property.ownerName || property.owner.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <Mail className="h-4 w-4 text-purple-600" /> {property.owner.email}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <Phone className="h-4 w-4 text-purple-600" /> {property.phone || property.owner.phone || "N/A"}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold uppercase text-muted-foreground">Property Info</h4>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div className="bg-muted/50 p-2 rounded">
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Rooms</p>
                                                <p className="font-bold">{property.rooms.length}</p>
                                            </div>
                                            <div className="bg-muted/50 p-2 rounded">
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Beds Listed</p>
                                                <p className="font-bold">
                                                    {property.rooms.reduce((acc: number, r: any) => acc + (r.availability || 0), 0)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 pt-6 border-t flex flex-wrap gap-2">
                                    {JSON.parse(property.amenities || "[]").map((a: string) => (
                                        <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
