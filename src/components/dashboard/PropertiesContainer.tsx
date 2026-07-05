"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, Plus, MapPin, AlertCircle, ArrowRight, CreditCard, Trash2, RefreshCcw, Activity, CheckCircle, BedDouble } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getProperties } from "@/actions/properties";
import { Badge } from "@/components/ui/badge";
import { ImageCarousel } from "@/components/ImageCarousel";
import { PropertyStepper } from "@/components/property/PropertyStepper";
import { payOnboardingFee, deleteProperty } from "@/actions/properties";
import { getPlatformSettings } from "@/actions/platform";
import { BankDetailsModal } from "./BankDetailsModal";
import { Landmark } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PropertiesContainerProps {
    role: 'owner' | 'staff';
    permissions?: string[];
}

export function PropertiesContainer({ role, permissions = [] }: PropertiesContainerProps) {
    const [properties, setProperties] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [onboardingFee, setOnboardingFee] = useState(99);
    const latestStatuses = useRef<Record<string, string>>({});

    // Custom Modal State
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [propertyToCancel, setPropertyToCancel] = useState<{ id: string; name: string } | null>(null);
    const [bankModalOpen, setBankModalOpen] = useState(false);
    const [propertyForBank, setPropertyForBank] = useState<{ id: string; name: string } | null>(null);

    const fetchProperties = async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const data = await getProperties();
            // Detect status changes and notify owner
            if (silent && latestStatuses.current) {
                (data as any[]).forEach((p: any) => {
                    const prev = latestStatuses.current[p.id];
                    if (prev && prev !== p.status) {
                        toast.info(`"${p.name}" status updated: ${p.status.replace(/_/g, ' ')}`);
                    }
                });
            }
            latestStatuses.current = Object.fromEntries((data as any[]).map((p: any) => [p.id, p.status]));
            setProperties(data);
        } catch (error) {
            console.error(error);
            if (!silent) toast.error("Failed to fetch properties");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const safeParse = (val: any) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val !== 'string') return [val];
        try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
            return [val];
        }
    };

    const handleQuickPay = async (id: string) => {
        setProcessingId(id);
        try {
            await payOnboardingFee(id, "UPI (Dummy)");
            toast.success("Onboarding fee paid via dummy UPI. Awaiting activation.");
            fetchProperties();
        } catch (error: any) {
            toast.error(error.message || "Failed to process payment.");
        } finally {
            setProcessingId(null);
        }
    };

    const handleCancelClick = (e: React.MouseEvent, id: string, name: string) => {
        e.preventDefault();
        e.stopPropagation();
        setPropertyToCancel({ id, name });
        setCancelModalOpen(true);
    };

    const performCancel = async () => {
        if (!propertyToCancel) return;
        
        setProcessingId(propertyToCancel.id);
        setCancelModalOpen(false);
        
        try {
            const res = await deleteProperty(propertyToCancel.id);
            if (res.success) {
                toast.success(`Property "${propertyToCancel.name}" application cancelled.`);
                fetchProperties();
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to cancel application.");
        } finally {
            setProcessingId(null);
            setPropertyToCancel(null);
        }
    };

    useEffect(() => {
        fetchProperties();
        getPlatformSettings().then(settings => {
            if (settings?.ownerOnboardingFeeFlat) setOnboardingFee(settings.ownerOnboardingFeeFlat);
        });
        // Poll every 20s so admin verification changes reflect without manual reload
        const interval = setInterval(() => fetchProperties(true), 20000);
        return () => clearInterval(interval);
    }, []);

    if (loading && properties.length === 0) return (
        <div className="p-8 flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground font-medium text-xs tracking-widest uppercase text-center">Loading Properties...</p>
        </div>
    );

    const basePath = `/dashboard/${role}`;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-1">My Properties</h1>
                    <p className="text-slate-500 font-medium">Manage and monitor your PG listings in real-time.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchProperties(true)}
                        disabled={refreshing}
                        className="rounded-xl border-2 border-slate-200 font-black uppercase text-[10px] tracking-widest h-10 px-4 gap-2"
                    >
                        <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Syncing...' : 'Sync Status'}
                    </Button>
                    {(role === 'owner' || (role === 'staff' && permissions.includes('register_property'))) && (
                        <Link href={`${basePath}/properties/new`}>
                            <Button className="rounded-xl h-11 px-6 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 font-bold transition-all active:scale-95">
                                <Plus className="mr-2 h-5 w-5" /> Add New Property
                            </Button>
                        </Link>
                    )}
                </div>
            </div>

            {/* Portfolio Stats Banner */}
            {!loading && properties.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-linear-to-br from-indigo-500 to-indigo-700 rounded-2xl p-5 text-white shadow-xl shadow-indigo-200 border border-indigo-400 relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-indigo-100 font-black text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1.5"><Building className="h-3.5 w-3.5" /> Total Properties</p>
                            <h3 className="text-4xl font-black">{properties.length}</h3>
                        </div>
                        <Activity className="absolute -right-4 -bottom-4 h-24 w-24 text-indigo-400/30 group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    
                    <div className="bg-linear-to-br from-emerald-500 to-emerald-700 rounded-2xl p-5 text-white shadow-xl shadow-emerald-200 border border-emerald-400 relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-emerald-100 font-black text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5" /> Live & Approved</p>
                            <h3 className="text-4xl font-black">{properties.filter(p => p.status === 'LIVE' || p.status === 'APPROVED').length}</h3>
                        </div>
                        <CheckCircle className="absolute -right-4 -bottom-4 h-24 w-24 text-emerald-400/30 group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    
                    <div className="bg-linear-to-br from-purple-500 to-purple-700 rounded-2xl p-5 text-white shadow-xl shadow-purple-200 border border-purple-400 relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-purple-100 font-black text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1.5"><BedDouble className="h-3.5 w-3.5" /> Total Rooms</p>
                            <h3 className="text-4xl font-black">{properties.reduce((sum, p) => sum + (p.rooms?.length || 0), 0)}</h3>
                        </div>
                        <BedDouble className="absolute -right-4 -bottom-4 h-24 w-24 text-purple-400/30 group-hover:scale-110 transition-transform duration-500" />
                    </div>
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {properties.map((property) => (
                    <div key={property.id} className="group relative transition-all duration-300">
                        <Card className={cn(
                            "overflow-hidden border-[4px] border-slate-950 transition-all duration-500 shadow-sm group-hover:shadow-2xl h-full relative z-0 rounded-2xl",
                            property.status === 'SUSPENDED' || property.status === 'REJECTED' ? "bg-red-50/30" : "bg-slate-50/50"
                        )}>
                            <Link 
                                href={`${basePath}/properties/${property.id}`} 
                                className="absolute inset-0 z-10"
                            />
                            
                            <div className="relative z-20 pointer-events-none h-full flex flex-col pt-[1px]">
                                <div className="h-48 bg-white relative">
                                    <div className="absolute top-3 right-3 z-40">
                                        <Badge className={cn(
                                            "text-white font-black uppercase tracking-widest text-[10px] px-3 py-1 ring-4 ring-white shadow-xl",
                                            property.status === 'LIVE' ? "bg-emerald-600 hover:bg-emerald-700" :
                                            property.status === 'APPROVED' ? "bg-emerald-600 hover:bg-emerald-700" :
                                            ['PENDING_VERIFICATION', 'VERIFYING', 'UNDER_REVIEW', 'VERIFYING_DOCUMENTS'].includes(property.status) ? "bg-blue-600" :
                                            property.status === 'NEEDS_CORRECTION' ? "bg-orange-500" :
                                            property.status === 'CORRECTED' ? "bg-indigo-600" :
                                            ['APPROVED_PENDING_PAYMENT', 'APPROVED_PAYMENT_VERIFIED'].includes(property.status) ? "bg-amber-500 animate-pulse" :
                                            property.status === 'AWAITING_BANK_DETAILS' ? "bg-purple-600 animate-pulse" :
                                            property.status === 'BANK_DETAILS_SUBMITTED' ? "bg-purple-600" :
                                            property.status === 'BANK_DETAILS_VERIFIED' ? "bg-emerald-600" :
                                            property.status === 'VERIFIED_SUCCESSFULLY' ? "bg-emerald-600" :
                                            property.status === 'SUSPENDED' ? "bg-orange-600" : "bg-red-600"
                                        )}>
                                            {['LIVE', 'APPROVED'].includes(property.status) ? 'Live' :
                                             ['PENDING_VERIFICATION', 'VERIFYING', 'UNDER_REVIEW', 'VERIFYING_DOCUMENTS'].includes(property.status) ? 'In Review' :
                                             property.status === 'NEEDS_CORRECTION' ? 'Pending' :
                                             property.status === 'CORRECTED' ? 'Resubmitted' :
                                             ['APPROVED_PENDING_PAYMENT', 'APPROVED_PAYMENT_VERIFIED'].includes(property.status) ? 'Action Needed' :
                                             property.status === 'AWAITING_BANK_DETAILS' ? 'Action Needed' :
                                             property.status === 'BANK_DETAILS_SUBMITTED' ? 'Verifying Bank' :
                                             property.status === 'BANK_DETAILS_VERIFIED' ? 'Bank Verified' :
                                             property.status === 'VERIFIED_SUCCESSFULLY' ? 'Verified' :
                                             property.status === 'SUSPENDED' ? 'Suspended' : 'Rejected'}
                                        </Badge>
                                    </div>
                                    {(() => {
                                        const mergedImages: string[] = [];
                                        if (property.buildingPhotos) {
                                            const photos = safeParse(property.buildingPhotos);
                                            photos.forEach((p: any) => { if (p) mergedImages.push(typeof p === 'string' ? p : p.url); });
                                        }
                                        if (property.commonAreaPhotos) {
                                            const photos = safeParse(property.commonAreaPhotos);
                                            photos.forEach((p: any) => { if (p) mergedImages.push(typeof p === 'string' ? p : p.url); });
                                        }
                                        return <ImageCarousel images={mergedImages} alt={property.name} />;
                                    })()}
                                </div>
                                <div className="border-b-[3px] border-slate-950/20" />
                                <CardHeader className="pb-2 space-y-1">
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col">
                                            <CardTitle className="text-2xl font-black tracking-tight text-slate-950">{property.name}</CardTitle>
                                            <div className="flex items-center text-xs font-bold text-slate-600 mt-0.5">
                                                <MapPin className="h-3 w-3 mr-1 text-slate-500" /> {property.city}
                                            </div>
                                        </div>
                                        {property.displayId && (
                                            <Badge variant="outline" className="text-[10px] bg-white font-mono font-black text-slate-950 border-slate-950/20">
                                                {property.displayId}
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <div className="border-b-[3px] border-slate-950/20 mx-6" />
                                <CardContent className="space-y-4 flex-grow">
                                    <PropertyStepper status={property.status} adminNotes={property.adminNotes} />

                                    {(property.status === 'SUSPENDED' || property.status === 'REJECTED' || (property.status === 'NEEDS_CORRECTION' && property.adminNotes?.includes('[REUPLOAD'))) && property.adminNotes && (
                                        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                                            <p className="text-xs font-bold text-red-800 uppercase mb-2 flex items-center gap-1 border-b border-red-200 pb-1">
                                                <AlertCircle className="h-4 w-4" /> Action Required
                                            </p>
                                            <div className="text-sm text-red-700 space-y-1">
                                                {property.adminNotes.split('\n').map((line: string, i: number) => {
                                                    if (line.includes('[REUPLOAD:')) {
                                                        const tagMatch = line.match(/\[REUPLOAD:([a-zA-Z0-9-]+)\]/);
                                                        let prefix = "Document Reupload";
                                                        if (tagMatch && tagMatch[1]) {
                                                            const rawKey = tagMatch[1].split('-')[0];
                                                            const mapping: Record<string, string> = {
                                                                buildingPhotos: "Building Photos",
                                                                commonAreaPhotos: "Common Area",
                                                                bathroomPhoto: "Bathroom",
                                                                parkingPhoto: "Parking",
                                                                aadhaarProof: "Aadhaar",
                                                                panProof: "PAN Card",
                                                                pgLicenceUrl: "PG Licence"
                                                            };
                                                            prefix = mapping[rawKey] || rawKey;
                                                        }
                                                        const cleanText = line.replace(/\[REUPLOAD:[a-zA-Z0-9-]+\]/g, '').trim();
                                                        if (!cleanText) return null;
                                                        return (
                                                            <div key={i} className="flex gap-2">
                                                                <span className="font-bold shrink-0">{prefix}:</span>
                                                                <span>{cleanText}</span>
                                                            </div>
                                                        );
                                                    }
                                                    return <div key={i}>{line}</div>;
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    <p className="text-sm font-bold text-slate-700 leading-relaxed line-clamp-2">
                                        {property.description}
                                    </p>
                                    <div className="flex justify-between items-center text-sm pt-4 border-t-[3px] border-slate-950/20 mt-4 mb-4 relative z-40 pointer-events-auto">
                                        {property.status === 'APPROVED_PENDING_PAYMENT' ? (
                                                <div className="flex items-center gap-1.5 text-amber-600 font-bold text-xs uppercase tracking-tight">
                                                    <CreditCard className="h-4 w-4" /> ₹{onboardingFee} Fee Pending
                                                </div>
                                        ) : property.status === 'AWAITING_BANK_DETAILS' ? (
                                                <div className="flex items-center gap-1.5 text-purple-600 font-bold text-xs uppercase tracking-tight">
                                                    <Landmark className="h-4 w-4" /> Bank Details Needed
                                                </div>
                                        ) : property.status === 'BANK_DETAILS_SUBMITTED' ? (
                                                <div className="flex items-center gap-1.5 text-purple-600 font-bold text-xs uppercase tracking-tight">
                                                    <CheckCircle className="h-4 w-4" /> Verifying Bank Details
                                                </div>
                                        ) : (
                                            <div className="flex items-center gap-2 bg-slate-50/80 px-4 py-2 rounded-2xl border-2 border-slate-100 shadow-inner">
                                                <Building className="h-5 w-5 text-indigo-600" />
                                                <span className="text-sm font-black text-slate-950">{property.rooms?.length || 0} Rooms</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            {property.status === 'APPROVED_PENDING_PAYMENT' && (role === 'owner' || permissions.includes('manage_properties')) && (
                                                <Button 
                                                    variant="default" 
                                                    size="sm" 
                                                    className="bg-amber-600 hover:bg-amber-700 text-white font-black uppercase text-[10px] h-8 px-4 shadow-lg active:scale-95 animate-bounce shadow-amber-200" 
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleQuickPay(property.id); }}
                                                    disabled={processingId === property.id}
                                                >
                                                    {processingId === property.id ? "Processing..." : "PAY ₹99"}
                                                </Button>
                                            )}
                                            {property.status === 'AWAITING_BANK_DETAILS' && (role === 'owner' || permissions.includes('manage_properties')) && (
                                                <Button 
                                                    variant="default" 
                                                    size="sm" 
                                                    className="bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-[10px] h-8 px-4 shadow-lg active:scale-95 shadow-purple-200 animate-pulse border border-purple-400" 
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPropertyForBank({ id: property.id, name: property.name }); setBankModalOpen(true); }}
                                                >
                                                    Add Bank Details
                                                </Button>
                                            )}
                                            {property.status !== 'APPROVED' && property.status !== 'LIVE' && (role === 'owner' || permissions.includes('manage_properties')) && (
                                                <button 
                                                    className="h-10 px-8 text-[11px] font-black bg-red-600 hover:bg-red-700 text-white rounded-2xl transition-all active:scale-95 shadow-lg shadow-red-100 uppercase tracking-widest border border-red-700/20"
                                                    onClick={(e) => handleCancelClick(e, property.id, property.name)}
                                                    disabled={processingId === property.id}
                                                >
                                                    CANCEL
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-full relative z-40 pointer-events-none group-hover/card:translate-y-[-2px] transition-transform">
                                        <div className="w-full flex justify-center items-center gap-2 bg-indigo-600 text-white font-black uppercase tracking-widest py-3.5 rounded-2xl text-xs shadow-xl shadow-indigo-100 group-hover:bg-indigo-700 transition-all relative overflow-hidden">
                                            <span className="relative z-10 flex items-center gap-2">View Property Details <ArrowRight className="h-4 w-4" /></span>
                                            <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                                        </div>
                                    </div>
                                </CardContent>
                            </div>
                        </Card>
                    </div>
                ))}
            </div>

            {/* Custom Confirmation Dialog */}
            <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
                <DialogContent className="sm:max-w-[425px] border-[4px] border-slate-950 rounded-2xl overflow-hidden p-0 bg-white shadow-2xl">
                    <div className="bg-blue-50 p-8 flex flex-col items-center text-center border-b-[3px] border-slate-950/10">
                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 border-[3px] border-blue-600 shadow-md">
                            <Trash2 className="h-10 w-10 text-rose-600" />
                        </div>
                        <DialogHeader>
                            <DialogTitle className="text-3xl font-black text-slate-950 leading-tight tracking-tight">Cancel Application?</DialogTitle>
                            <DialogDescription className="text-slate-600 font-bold pt-3 text-base">
                                Are you sure you want to cancel the application for <span className="text-blue-700 font-black italic">"{propertyToCancel?.name}"</span>?
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    <DialogFooter className="p-6 bg-slate-50 flex flex-col sm:flex-row gap-3">
                        <button 
                            className="flex-1 rounded-xl h-11 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-all active:scale-95 font-black uppercase tracking-wider text-[11px] shadow-sm border border-indigo-100"
                            onClick={() => setCancelModalOpen(false)}
                        >
                            No, Keep it
                        </button>
                        <Button 
                            variant="destructive" 
                            className="flex-1 rounded-xl h-11 bg-red-600 hover:bg-red-700 font-black uppercase tracking-wider text-[11px] shadow-lg active:scale-95 transition-all border-[3px] border-red-700/20"
                            onClick={performCancel}
                        >
                            Yes, Cancel Now
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {properties.length === 0 && !loading && (
                <div className="col-span-full p-24 text-center border-[4px] border-dashed border-slate-950/10 rounded-3xl bg-slate-50/50">
                    <Building className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-xl font-bold text-slate-500">No properties listed yet.</p>
                </div>
            )}
            {/* Bank Details Modal */}
            {propertyForBank && (
                <BankDetailsModal 
                    isOpen={bankModalOpen}
                    onClose={() => {
                        setBankModalOpen(false);
                        setPropertyForBank(null);
                    }}
                    propertyId={propertyForBank.id}
                    propertyName={propertyForBank.name}
                    onSuccess={() => fetchProperties(true)}
                />
            )}
        </div>
    );
}
