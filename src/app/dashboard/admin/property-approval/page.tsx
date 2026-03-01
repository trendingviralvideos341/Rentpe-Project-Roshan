"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, User, Phone, Mail, CheckCircle, XCircle, RefreshCcw, MapPin, BedDouble, AlertCircle } from "lucide-react";
import { getAllPropertiesForAdmin, approveProperty, getAdminPropertyAnalytics, markPropertyPending } from "@/actions/admin";
import { requestDocumentReupload, togglePropertyDocumentVerification } from "@/actions/properties";
import { useToast } from "@/components/ui/use-toast";

export default function AdminPropertyApprovalPage() {
    const [properties, setProperties] = useState<any[]>([]);
    const [analytics, setAnalytics] = useState({ pending: 0, approved: 0, rejected: 0 });
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState("PENDING_APPROVAL");

    // Dialog state
    const [actionDialog, setActionDialog] = useState<{ isOpen: boolean; propertyId: string; propertyName: string; isApprove: boolean; currentStatus?: string } | null>(null);
    const [adminNotes, setAdminNotes] = useState("");
    const [processing, setProcessing] = useState(false);
    const [reuploadDialog, setReuploadDialog] = useState<{ isOpen: boolean; propertyId: string; docType: string; label: string } | null>(null);
    const [reuploadNote, setReuploadNote] = useState("");

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
        if (!adminNotes.trim() && !actionDialog.isApprove) {
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

    const handleMarkPending = async () => {
        if (!actionDialog) return;
        setProcessing(true);
        try {
            await markPropertyPending(actionDialog.propertyId, adminNotes);
            toast({ title: "Status Updated", description: "Property moved to Pending Approval." });
            setActionDialog(null);
            setAdminNotes("");
            fetchData();
        } catch (e: any) {
            toast({ title: "Action Failed", description: e.message, variant: "destructive" });
        } finally {
            setProcessing(false);
        }
    };

    const handleRequestReupload = async () => {
        if (!reuploadDialog) return;
        if (!reuploadNote.trim()) {
            toast({ title: "Required", description: "Reason for reupload is required.", variant: "destructive" });
            return;
        }

        setProcessing(true);
        try {
            await requestDocumentReupload(reuploadDialog.propertyId, reuploadDialog.docType, reuploadNote);
            toast({ title: "Request Sent", description: `Reupload request for ${reuploadDialog.label} sent to owner.` });
            setReuploadDialog(null);
            setReuploadNote("");
            fetchData();
        } catch (e: any) {
            toast({ title: "Request Failed", description: e.message, variant: "destructive" });
        } finally {
            setProcessing(false);
        }
    };

    const handleToggleVerification = async (propertyId: string, docKey: string, isVerified: boolean) => {
        setProcessing(true);
        try {
            const res = await togglePropertyDocumentVerification(propertyId, docKey, !isVerified);
            if (res.success) {
                toast({ title: isVerified ? "Verification Removed" : "Document Verified", description: "Status updated successfully." });
                fetchData();
            } else {
                throw new Error(res.error);
            }
        } catch (e: any) {
            toast({ title: "Update Failed", description: e.message, variant: "destructive" });
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

            {/* Analytics Cards acting as Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card
                    className={`cursor-pointer transition-all border-2 ${filterStatus === 'PENDING_APPROVAL' ? 'bg-amber-100 border-amber-400 shadow-md scale-[1.02]' : 'bg-amber-50 border-amber-200 hover:bg-amber-100/50'}`}
                    onClick={() => setFilterStatus('PENDING_APPROVAL')}
                >
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-amber-800">Pending Approval</p>
                            <h3 className="text-2xl font-bold text-amber-900">{analytics.pending}</h3>
                        </div>
                        <AlertCircle className="h-8 w-8 text-amber-500 opacity-50" />
                    </CardContent>
                </Card>
                <Card
                    className={`cursor-pointer transition-all border-2 ${filterStatus === 'LIVE' ? 'bg-green-100 border-green-400 shadow-md scale-[1.02]' : 'bg-green-50 border-green-200 hover:bg-green-100/50'}`}
                    onClick={() => setFilterStatus('LIVE')}
                >
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-green-800">Total Approved (Live)</p>
                            <h3 className="text-2xl font-bold text-green-900">{analytics.approved}</h3>
                        </div>
                        <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
                    </CardContent>
                </Card>
                <Card
                    className={`cursor-pointer transition-all border-2 ${filterStatus === 'REJECTED' ? 'bg-red-100 border-red-400 shadow-md scale-[1.02]' : 'bg-red-50 border-red-200 hover:bg-red-100/50'}`}
                    onClick={() => setFilterStatus('REJECTED')}
                >
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-red-800">Total Rejected</p>
                            <h3 className="text-2xl font-bold text-red-900">{analytics.rejected}</h3>
                        </div>
                        <XCircle className="h-8 w-8 text-red-500 opacity-50" />
                    </CardContent>
                </Card>
            </div>

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
                                                <Button size="sm" variant="destructive" className="h-8" onClick={() => setActionDialog({ isOpen: true, propertyId: property.id, propertyName: property.name, isApprove: false, currentStatus: property.status })}>
                                                    <XCircle className="h-4 w-4 mr-1" /> Reject
                                                </Button>
                                                <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 hover:text-white text-white" onClick={() => setActionDialog({ isOpen: true, propertyId: property.id, propertyName: property.name, isApprove: true, currentStatus: property.status })}>
                                                    <CheckCircle className="h-4 w-4 mr-1" /> Approve
                                                </Button>
                                            </>
                                        ) : (
                                            <Button size="sm" variant="outline" className="h-8" onClick={() => setActionDialog({ isOpen: true, propertyId: property.id, propertyName: property.name, isApprove: property.status !== 'LIVE', currentStatus: property.status })}>
                                                Change Status
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 sm:p-6">
                                <Tabs defaultValue="details">
                                    <TabsList className="grid w-full grid-cols-3 max-w-2xl mb-6">
                                        <TabsTrigger value="details">Property Details</TabsTrigger>
                                        <TabsTrigger value="rooms">Rooms ({property.rooms?.length || 0})</TabsTrigger>
                                        <TabsTrigger
                                            value="verification"
                                            className={`relative transition-all ${property.status === 'PENDING_APPROVAL' ? 'bg-amber-50 text-amber-700 data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900 border border-amber-200' : ''}`}
                                        >
                                            Verification Documents
                                            {property.status === 'PENDING_APPROVAL' && (
                                                <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5" title="Action Required">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 border-2 border-white shadow-sm"></span>
                                                </span>
                                            )}
                                        </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="details" className="mt-0">
                                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                                            {/* Owner Info */}
                                            <div className="space-y-4">
                                                <h4 className="text-sm font-bold uppercase text-muted-foreground">Owner Details</h4>
                                                <div className="space-y-2 bg-muted/30 p-4 rounded-lg border">
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
                                                    <p className="text-sm bg-amber-50 text-amber-900 p-4 rounded-lg italic border border-amber-200 shadow-sm">
                                                        "{property.adminNotes}"
                                                    </p>
                                                </div>
                                            )}

                                            {/* Property Description & Amenities */}
                                            <div className="space-y-4 lg:col-span-3 border-t pt-6 mt-2">
                                                <h4 className="text-sm font-bold uppercase text-muted-foreground">Property Description & Amenities</h4>
                                                <div className="grid md:grid-cols-2 gap-6">
                                                    <div>
                                                        <p className="text-sm whitespace-pre-wrap bg-muted/20 p-4 rounded-lg border">{property.description || "No description provided."}</p>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <div>
                                                            <span className="text-xs font-bold uppercase text-muted-foreground block mb-2">Amenities</span>
                                                            <div className="flex flex-wrap gap-2">
                                                                {property.amenities ? property.amenities.split(',').map((amt: string, i: number) => (
                                                                    <Badge key={i} variant="secondary">{amt.trim()}</Badge>
                                                                )) : <span className="text-sm text-muted-foreground">None listed</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="rooms" className="mt-0">
                                        <div className="pt-2">
                                            <h4 className="text-sm font-bold uppercase text-muted-foreground mb-4 flex items-center gap-2">
                                                Rooms Breakdown <Badge variant="outline">{property.rooms?.length || 0} Rooms</Badge>
                                            </h4>

                                            {property.rooms?.length === 0 ? (
                                                <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                                                    No rooms added to this property yet.
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {property.rooms?.map((room: any) => (
                                                        <div key={room.id} className="border rounded-xl p-4 text-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow bg-white">
                                                            {room.photoUrl && (
                                                                <div className="absolute inset-0 z-0 opacity-10 group-hover:opacity-20 transition-opacity">
                                                                    <img src={room.photoUrl} className="w-full h-full object-cover" />
                                                                </div>
                                                            )}
                                                            <div className="relative z-10 flex justify-between items-center mb-4 border-b pb-3">
                                                                <span className="font-bold flex items-center gap-1.5 text-base">
                                                                    <Building2 className="h-4 w-4 text-indigo-500" /> Room {room.roomNumber}
                                                                </span>
                                                                <span className="text-xs font-bold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">{room.type}</span>
                                                            </div>
                                                            <div className="relative z-10 flex justify-between items-end text-muted-foreground mt-2">
                                                                <span className="flex items-center gap-1.5 font-medium bg-muted/50 px-2.5 py-1 rounded-md">
                                                                    <BedDouble className="h-4 w-4 text-indigo-500" /> {room.availability} Beds
                                                                </span>
                                                                <div className="flex flex-col items-end">
                                                                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Monthly Rent</span>
                                                                    <span className="font-bold text-green-700 text-lg leading-none">₹{room.price}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="verification" className="mt-0">
                                        <div className="pt-2">
                                            <h4 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-1.5 mb-4">
                                                <CheckCircle className="h-4 w-4 text-green-600" /> Uploaded Documents for Verification
                                            </h4>

                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                                {(() => {
                                                    const docs = [
                                                        { key: 'pgPhotoUrl', label: 'PG / Bldg (Old)' },
                                                        { key: 'buildingPhotos', label: 'Bldg Photo', isArray: true },
                                                        { key: 'commonAreaPhotos', label: 'Common Area', isArray: true },
                                                        { key: 'parkingPhoto', label: 'Parking' },
                                                        { key: 'bathroomPhoto', label: 'Bathroom' },
                                                        { key: 'aadhaarProof', label: 'Aadhaar' },
                                                        { key: 'panProof', label: 'PAN Card' },
                                                        { key: 'pgLicenceUrl', label: 'PG Licence' }
                                                    ];

                                                    const uploadedItems: { url: string; label: string; key: string }[] = [];
                                                    docs.forEach(d => {
                                                        if (!property[d.key]) return;
                                                        if (d.isArray) {
                                                            try {
                                                                const urls = JSON.parse(property[d.key]);
                                                                urls.forEach((u: any, i: number) => {
                                                                    const actualUrl = typeof u === 'string' ? u : u.url;
                                                                    uploadedItems.push({ url: actualUrl, label: `${d.label} ${i + 1}`, key: `${d.key}-${i}` });
                                                                });
                                                            } catch (e) {
                                                                console.error("Error parsing photos:", e);
                                                            }
                                                        } else {
                                                            const actualUrl = typeof property[d.key] === 'string' ? property[d.key] : property[d.key].url;
                                                            uploadedItems.push({ url: actualUrl, label: d.label, key: d.key });
                                                        }
                                                    });

                                                    if (uploadedItems.length === 0) {
                                                        return <div className="col-span-full p-10 border border-dashed rounded-xl text-center text-sm text-muted-foreground bg-muted/20">No verification documents have been uploaded by the owner yet.</div>;
                                                    }

                                                    return uploadedItems.map((item) => {
                                                        const isVerified = property.verifiedDocs && JSON.parse(property.verifiedDocs).includes(item.key);

                                                        return (
                                                            <div key={item.key} className="relative group flex flex-col h-full bg-white rounded-xl border border-border shadow-sm hover:shadow-md transition-all overflow-hidden">
                                                                <div className={`p-2 text-[11px] font-bold text-center border-b uppercase truncate flex items-center justify-center gap-1 ${isVerified ? 'bg-green-50 text-green-800 border-green-200' : 'bg-muted/50'}`}>
                                                                    {item.label} {isVerified && <CheckCircle className="h-3 w-3 text-green-600" />}
                                                                </div>

                                                                <a href={item.url} target="_blank" className={`block flex-1 overflow-hidden relative ${isVerified ? 'ring-2 ring-green-400 ring-inset' : ''}`}>
                                                                    {String(item.url || "").endsWith(".pdf") ?
                                                                        <div className="w-full h-32 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors">
                                                                            <span className="text-[10px] font-bold text-slate-500 break-words text-center px-1 border-2 border-slate-200 rounded p-2">PDF DOC</span>
                                                                        </div>
                                                                        : <img src={String(item.url || "")} className="w-full h-32 object-cover transition-transform duration-500 hover:scale-110" />}

                                                                    {/* Overlay for quick actions on hover */}
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                                                                        <span className="text-white text-xs font-bold bg-black/50 px-2 py-1 rounded">View Full Size</span>
                                                                    </div>
                                                                </a>

                                                                <div className="grid grid-cols-2 border-t divide-x">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            handleToggleVerification(property.id, item.key, isVerified);
                                                                        }}
                                                                        className={`py-2 px-1 flex items-center justify-center gap-1 text-[9px] font-bold uppercase transition-colors ${isVerified ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'hover:bg-green-50 text-slate-600 hover:text-green-700'}`}
                                                                        disabled={processing}
                                                                    >
                                                                        {isVerified ? <><XCircle className="w-3 h-3" /> Unverify</> : <><CheckCircle className="w-3 h-3" /> Verify Doc</>}
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            setReuploadDialog({
                                                                                isOpen: true,
                                                                                propertyId: property.id,
                                                                                docType: item.key,
                                                                                label: item.label
                                                                            });
                                                                        }}
                                                                        className="py-2 px-1 hover:bg-amber-50 text-slate-600 hover:text-amber-700 flex items-center justify-center gap-1 text-[9px] font-bold uppercase transition-colors"
                                                                    >
                                                                        <RefreshCcw className="w-3 h-3" /> Reupload
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    </TabsContent>
                                </Tabs>
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
                        {actionDialog?.currentStatus === 'REJECTED' && (
                            <Button
                                variant="secondary"
                                className="bg-amber-500 hover:bg-amber-600 text-white font-bold"
                                onClick={handleMarkPending}
                                disabled={processing}
                            >
                                {processing ? "Processing..." : "Move to Pending Approval"}
                            </Button>
                        )}
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

            {/* Reupload Request Dialog */}
            <Dialog open={!!reuploadDialog} onOpenChange={(open: boolean) => !open && setReuploadDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <RefreshCcw className="w-5 h-5 text-amber-500" />
                            Request Reupload: {reuploadDialog?.label}
                        </DialogTitle>
                        <DialogDescription>
                            Ask the owner to reupload this specific document. They will see your reason on their dashboard.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold">Reason for Reupload</label>
                            <Textarea
                                placeholder="e.g. Photo is blurry, document is expired, wrong side uploaded..."
                                value={reuploadNote}
                                onChange={(e) => setReuploadNote(e.target.value)}
                                className="bg-white border-2 border-muted-foreground/30 focus-visible:ring-amber-500"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReuploadDialog(null)} disabled={processing}>Cancel</Button>
                        <Button
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={handleRequestReupload}
                            disabled={processing}
                        >
                            {processing ? "Sending..." : "Send Request"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
