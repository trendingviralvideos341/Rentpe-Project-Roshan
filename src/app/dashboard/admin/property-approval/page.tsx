"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, User, Phone, Mail, CheckCircle, XCircle, RefreshCcw, MapPin, BedDouble, AlertCircle, ImageIcon, FileText, Upload, Eye, Camera } from "lucide-react";
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

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {[
                                                    { key: 'buildingPhotos', label: 'Building Photos', desc: '4 exterior/interior photos required', icon: <ImageIcon className="w-5 h-5" />, colorClass: 'text-indigo-600', bgClass: 'bg-indigo-50', borderClass: 'border-indigo-200', isArray: true },
                                                    { key: 'commonAreaPhotos', label: 'Common Area', desc: 'Hallway, Lobby, or Shared (4 Photos)', icon: <ImageIcon className="w-5 h-5" />, colorClass: 'text-orange-600', bgClass: 'bg-orange-50', borderClass: 'border-orange-200', isArray: true },
                                                    { key: 'bathroomPhoto', label: 'Bathroom', desc: 'Sample bathroom photo', icon: <ImageIcon className="w-5 h-5" />, colorClass: 'text-rose-600', bgClass: 'bg-rose-50', borderClass: 'border-rose-200' },
                                                    { key: 'parkingPhoto', label: 'Parking Area', desc: 'Parking facility photo', icon: <ImageIcon className="w-5 h-5" />, colorClass: 'text-amber-600', bgClass: 'bg-amber-50', borderClass: 'border-amber-200' },
                                                    { key: 'aadhaarProof', label: 'Owner Aadhaar Proof', desc: 'Clear front/back of Aadhaar', icon: <FileText className="w-5 h-5" />, colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-200' },
                                                    { key: 'panProof', label: 'Owner PAN Proof', desc: 'Clear photo of PAN Card', icon: <FileText className="w-5 h-5" />, colorClass: 'text-blue-600', bgClass: 'bg-blue-50', borderClass: 'border-blue-200' },
                                                    { key: 'pgLicenceUrl', label: 'PG / Hostel Licence', desc: 'Official municipal doc', icon: <Building2 className="w-5 h-5" />, colorClass: 'text-purple-600', bgClass: 'bg-purple-50', borderClass: 'border-purple-200' },
                                                    { key: 'livePhotoUrl', label: 'Live Photo Capture', desc: 'Real-time Identity Check', icon: <Camera className="w-5 h-5" />, colorClass: 'text-cyan-600', bgClass: 'bg-cyan-50', borderClass: 'border-cyan-200' }
                                                ].map((cat) => (
                                                    <div key={cat.key} className={`border-2 ${cat.borderClass} transition-all rounded-xl p-4 flex flex-col justify-between shadow-sm bg-white`}>
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <div className={`p-2 ${cat.bgClass} rounded-lg ${cat.colorClass}`}>{cat.icon}</div>
                                                            <div>
                                                                <h4 className="font-bold text-sm tracking-tight">{cat.label}</h4>
                                                                <p className="text-[10px] text-muted-foreground uppercase">{cat.desc}</p>
                                                            </div>
                                                        </div>

                                                        {cat.isArray ? (
                                                            <div className="space-y-3">
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    {(() => {
                                                                        const photos = property[cat.key] ? JSON.parse(property[cat.key]) : [];
                                                                        const slots = [];
                                                                        for (let i = 0; i < 4; i++) {
                                                                            if (photos[i]) {
                                                                                const img = typeof photos[i] === 'string' ? photos[i] : photos[i].url;
                                                                                const isVerified = property.verifiedDocs && JSON.parse(property.verifiedDocs).includes(`${cat.key}-${i}`);

                                                                                slots.push(
                                                                                    <div key={`photo-${i}`} className={`relative h-24 rounded-md overflow-hidden border shadow-inner group/img ${isVerified ? 'ring-2 ring-green-400 ring-offset-1' : 'bg-muted'}`}>
                                                                                        <img src={img} className="w-full h-full object-cover" />
                                                                                        {/* Admin Actions - Verify / Reupload */}
                                                                                        <div className="absolute inset-x-0 bottom-0 bg-white/95 border-t border-slate-200 flex opacity-0 group-hover/img:opacity-100 transition-opacity divide-x">
                                                                                            <button
                                                                                                onClick={(e) => { e.preventDefault(); handleToggleVerification(property.id, `${cat.key}-${i}`, isVerified); }}
                                                                                                className={`flex-1 py-1.5 flex items-center justify-center gap-1 text-[9px] font-bold uppercase transition-colors ${isVerified ? 'hover:bg-red-50 text-red-600' : 'hover:bg-green-50 text-green-700'}`}
                                                                                                disabled={processing}
                                                                                            >
                                                                                                {isVerified ? "Unverify" : "Verify Doc"}
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={(e) => { e.preventDefault(); setReuploadDialog({ isOpen: true, propertyId: property.id, docType: `${cat.key}-${i}`, label: `${cat.label} ${i + 1}` }); }}
                                                                                                className="flex-1 py-1.5 hover:bg-amber-50 text-amber-700 flex items-center justify-center gap-1 text-[9px] font-bold uppercase transition-colors"
                                                                                            >
                                                                                                Reupload
                                                                                            </button>
                                                                                        </div>
                                                                                        <div className="absolute top-0 right-0 z-10">
                                                                                            {isVerified && (
                                                                                                <div className="bg-green-600 text-white p-1 rounded-bl-md shadow-sm" title="Verified">
                                                                                                    <CheckCircle className="w-3 h-3" />
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                        <a href={img} target="_blank" className="absolute top-0 left-0 bg-slate-800/80 text-white p-1 rounded-br-md shadow-sm opacity-0 group-hover/img:opacity-100 transition-opacity" title="View Full Size">
                                                                                            <Eye className="w-3 h-3" />
                                                                                        </a>
                                                                                    </div>
                                                                                );
                                                                            } else {
                                                                                slots.push(
                                                                                    <div key={`slot-${i}`} className={`border-2 border-dashed border-slate-200 rounded-md flex flex-col items-center justify-center h-24 bg-slate-50 opacity-60`}>
                                                                                        <span className={`text-[8px] font-bold uppercase mt-1 text-slate-400`}>Awaiting Upload</span>
                                                                                    </div>
                                                                                );
                                                                            }
                                                                        }
                                                                        return slots;
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        ) : property[cat.key] ? (
                                                            <div className="flex flex-col gap-2 relative group h-full">
                                                                {(() => {
                                                                    const img = typeof property[cat.key] === 'string' ? property[cat.key] : property[cat.key].url;
                                                                    const isVerified = property.verifiedDocs && JSON.parse(property.verifiedDocs).includes(cat.key);

                                                                    return (
                                                                        <div className={`w-full h-32 rounded-lg overflow-hidden border shadow-inner relative ${isVerified ? 'ring-2 ring-green-400 ring-offset-2' : 'bg-muted'}`}>
                                                                            {img.endsWith(".pdf") ?
                                                                                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 transition-colors">
                                                                                    <FileText className="w-8 h-8 text-slate-400 mb-1" />
                                                                                    <span className="text-[10px] font-bold text-slate-500">PDF Document</span>
                                                                                </div>
                                                                                : <img src={img} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                                            }
                                                                            <div className="absolute top-0 right-0 z-10">
                                                                                {isVerified && (
                                                                                    <div className="bg-green-600 text-white p-1.5 rounded-bl-md shadow-sm" title="Verified">
                                                                                        <CheckCircle className="w-4 h-4" />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <a href={img} target="_blank" className="absolute top-0 left-0 bg-slate-800/80 text-white p-1.5 rounded-br-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" title="View Full Size">
                                                                                <Eye className="w-4 h-4" />
                                                                            </a>

                                                                            <div className="absolute inset-x-0 bottom-0 bg-white/95 border-t border-slate-200 flex divide-x opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                <button
                                                                                    onClick={(e) => { e.preventDefault(); handleToggleVerification(property.id, cat.key, isVerified); }}
                                                                                    className={`flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-bold uppercase transition-colors ${isVerified ? 'hover:bg-red-50 text-red-600' : 'hover:bg-green-50 text-green-700'}`}
                                                                                    disabled={processing}
                                                                                >
                                                                                    {isVerified ? <><XCircle className="w-4 h-4" /> Unverify</> : <><CheckCircle className="w-4 h-4" /> Verify Doc</>}
                                                                                </button>
                                                                                <button
                                                                                    onClick={(e) => { e.preventDefault(); setReuploadDialog({ isOpen: true, propertyId: property.id, docType: cat.key, label: cat.label }); }}
                                                                                    className="flex-1 py-3 hover:bg-amber-50 text-amber-700 flex items-center justify-center gap-1.5 text-xs font-bold uppercase transition-colors"
                                                                                >
                                                                                    <RefreshCcw className="w-4 h-4" /> Reupload
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        ) : (
                                                            <div className="mt-2 text-center h-full flex flex-col justify-end">
                                                                <div className={`w-full h-32 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center bg-slate-50 opacity-60`}>
                                                                    <p className={`text-xs font-bold text-slate-400 mt-2 uppercase tracking-wider`}>Awaiting Upload</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
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
