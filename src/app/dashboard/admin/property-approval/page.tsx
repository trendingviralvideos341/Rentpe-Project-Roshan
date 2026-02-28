"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, User, Phone, Mail, CheckCircle, XCircle, RefreshCcw, MapPin, BedDouble, AlertCircle } from "lucide-react";
import { getAllPropertiesForAdmin, approveProperty, getAdminPropertyAnalytics } from "@/actions/admin";
import { useToast } from "@/components/ui/use-toast";

export default function AdminPropertyApprovalPage() {
    const [properties, setProperties] = useState<any[]>([]);
    const [analytics, setAnalytics] = useState({ pending: 0, approved: 0, rejected: 0 });
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState("PENDING_APPROVAL");

    // Dialog state
    const [actionDialog, setActionDialog] = useState<{ isOpen: boolean; propertyId: string; propertyName: string; isApprove: boolean } | null>(null);
    const [adminNotes, setAdminNotes] = useState("");
    const [processing, setProcessing] = useState(false);

    const { toast } = useToast();

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [propsData, statsData] = await Promise.all([
                getAllPropertiesForAdmin(filterStatus),
                getAdminPropertyAnalytics()
            ]);
            setProperties(propsData);
            setAnalytics(statsData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [filterStatus]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleConfirmAction = async () => {
        if (!actionDialog) return;
        if (!adminNotes.trim()) {
            toast({ title: "Required", description: "Admin notes are required for this action.", variant: "destructive" });
            return;
        }

        setProcessing(true);
        try {
            await approveProperty(actionDialog.propertyId, actionDialog.isApprove, adminNotes);
            toast({
                title: actionDialog.isApprove ? "Property Approved" : "Property Rejected",
                description: "The action and notes have been recorded.",
            });
            setActionDialog(null);
            setAdminNotes("");
            fetchData();
        } catch (e: any) {
            toast({ title: "Action Failed", description: e.message, variant: "destructive" });
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Property Approvals</h1>
                    <p className="text-muted-foreground">Review, filter, and manage property listings.</p>
                </div>
                <Button variant="outline" onClick={fetchData} disabled={loading}>
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            {/* Analytics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-amber-800">Pending Approval</p>
                            <h3 className="text-2xl font-bold text-amber-900">{analytics.pending}</h3>
                        </div>
                        <AlertCircle className="h-8 w-8 text-amber-500 opacity-50" />
                    </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-green-800">Total Approved (Live)</p>
                            <h3 className="text-2xl font-bold text-green-900">{analytics.approved}</h3>
                        </div>
                        <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
                    </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-red-800">Total Rejected</p>
                            <h3 className="text-2xl font-bold text-red-900">{analytics.rejected}</h3>
                        </div>
                        <XCircle className="h-8 w-8 text-red-500 opacity-50" />
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Tabs value={filterStatus} onValueChange={setFilterStatus}>
                <TabsList className="grid w-full grid-cols-3 max-w-lg mb-6">
                    <TabsTrigger value="PENDING_APPROVAL">Pending Review</TabsTrigger>
                    <TabsTrigger value="LIVE">Approved (Live)</TabsTrigger>
                    <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
                </TabsList>
            </Tabs>

            {/* List */}
            {loading ? (
                <div className="p-20 text-center animate-pulse text-muted-foreground">Loading properties...</div>
            ) : properties.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center text-muted-foreground">
                        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        No properties found for this status.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6">
                    {properties.map(property => (
                        <Card key={property.id} className="overflow-hidden border-l-4" style={{
                            borderLeftColor: property.status === 'LIVE' ? '#22c55e' : property.status === 'REJECTED' ? '#ef4444' : '#f59e0b'
                        }}>
                            <CardHeader className="bg-muted/30 pb-4">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <CardTitle className="text-xl flex items-center gap-2">
                                            {property.name}
                                            <Badge variant="secondary" className={`
                                                ${property.status === 'LIVE' ? 'bg-green-100 text-green-700' : ''}
                                                ${property.status === 'REJECTED' ? 'bg-red-100 text-red-700' : ''}
                                                ${property.status === 'PENDING_APPROVAL' ? 'bg-amber-100 text-amber-700' : ''}
                                            `}>
                                                {property.status.replace('_', ' ')}
                                            </Badge>
                                        </CardTitle>
                                        <CardDescription className="flex items-center gap-1">
                                            <MapPin className="h-3.5 w-3.5" /> {property.city}, {property.address}
                                        </CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        {property.status === 'PENDING_APPROVAL' ? (
                                            <>
                                                <Button size="sm" variant="destructive" className="h-8" onClick={() => setActionDialog({ isOpen: true, propertyId: property.id, propertyName: property.name, isApprove: false })}>
                                                    <XCircle className="h-4 w-4 mr-1" /> Reject
                                                </Button>
                                                <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 hover:text-white text-white" onClick={() => setActionDialog({ isOpen: true, propertyId: property.id, propertyName: property.name, isApprove: true })}>
                                                    <CheckCircle className="h-4 w-4 mr-1" /> Approve
                                                </Button>
                                            </>
                                        ) : (
                                            <Button size="sm" variant="outline" className="h-8" onClick={() => setActionDialog({ isOpen: true, propertyId: property.id, propertyName: property.name, isApprove: property.status !== 'LIVE' })}>
                                                Change Status
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {/* Owner Info */}
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold uppercase text-muted-foreground">Owner Details</h4>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-sm">
                                                <User className="h-4 w-4 text-purple-600" />
                                                <span className="font-medium">{property.ownerName || property.owner?.name || "Unknown"}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <Mail className="h-4 w-4 text-purple-600" /> {property.owner?.email || "Unknown"}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <Phone className="h-4 w-4 text-purple-600" /> {property.phone || property.owner?.phone || "N/A"}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Admin Notes / Context */}
                                    {property.adminNotes && (
                                        <div className="space-y-2 lg:col-span-2">
                                            <h4 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-1">
                                                <AlertCircle className="h-4 w-4" /> Last Admin Note (Owner Feedback)
                                            </h4>
                                            <p className="text-sm bg-muted p-3 rounded-md italic border">
                                                "{property.adminNotes}"
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Rooms Breakdown */}
                                <div className="mt-6 pt-6 border-t">
                                    <h4 className="text-sm font-bold uppercase text-muted-foreground mb-4 flex items-center gap-2">
                                        Rooms Breakdown <Badge variant="outline">{property.rooms?.length || 0} Rooms</Badge>
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                        {property.rooms?.map((room: any) => (
                                            <div key={room.id} className="border rounded-md p-3 text-sm flex flex-col justify-between" style={{ background: 'linear-gradient(to bottom right, rgba(0,0,0,0.01), rgba(0,0,0,0.03))' }}>
                                                <div className="flex justify-between items-center mb-3 border-b pb-2">
                                                    <span className="font-bold flex items-center gap-1"><Building2 className="h-3 w-3 text-muted-foreground" /> Room {room.roomNumber}</span>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full border border-blue-200">{room.type}</span>
                                                </div>
                                                <div className="flex justify-between items-end text-muted-foreground">
                                                    <span className="flex items-center gap-1 font-medium bg-white px-2 py-0.5 rounded shadow-sm border"><BedDouble className="h-3 w-3 text-indigo-500" /> {room.availability} Beds</span>
                                                    <span className="font-bold text-green-700 text-base">₹{room.price}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Action Dialog */}
            <Dialog open={!!actionDialog} onOpenChange={(open: boolean) => !open && setActionDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{actionDialog?.isApprove ? "Approve Property" : "Reject/Feedback Property"}</DialogTitle>
                        <DialogDescription>
                            You are about to {actionDialog?.isApprove ? "approve" : "reject"} the property <strong>{actionDialog?.propertyName}</strong>.
                            <br /><br />
                            {actionDialog?.isApprove
                                ? "Approving will make this property LIVE on the student portal. You must add verification notes below."
                                : "Rejecting allows you to send notes back to the owner detailing what they must fix (e.g. invalid documents, blurry photos)."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold flex items-center gap-1">
                                Admin Notes / Instructions for Owner
                                <span className="text-red-500">*</span>
                            </label>
                            <Textarea
                                placeholder={actionDialog?.isApprove ? "E.g. Document verified, property approved for listing." : "E.g. The PG License uploaded is unreadable. Please upload a clear PDF."}
                                value={adminNotes}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAdminNotes(e.target.value)}
                                rows={4}
                                className="bg-white border-2 border-muted-foreground/30 focus-visible:ring-indigo-500"
                            />
                            <p className="text-[10px] text-muted-foreground uppercase">This message will be permanently logged and sent directly to the owner.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setActionDialog(null)} disabled={processing}>Cancel</Button>
                        <Button
                            variant="default"
                            className={actionDialog?.isApprove ? "bg-green-600 hover:bg-green-700 text-white font-bold px-6" : "bg-red-600 hover:bg-red-700 text-white font-bold px-6"}
                            onClick={handleConfirmAction}
                            disabled={processing}
                        >
                            {processing ? "Processing..." : `Confirm ${actionDialog?.isApprove ? "Approval" : "Rejection"}`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
