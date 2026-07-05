"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, Plus, MapPin, AlertCircle, ArrowRight, CreditCard, Trash2, RefreshCcw, Activity, CheckCircle, BedDouble, Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getProperties } from "@/actions/properties";
import { Badge } from "@/components/ui/badge";
import { ImageCarousel } from "@/components/ImageCarousel";
import { PropertyStepper } from "@/components/property/PropertyStepper";
import { deleteProperty, createOnboardingFeeOrder, verifyOnboardingFeePayment } from "@/actions/properties";
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
    const [payingProperty, setPayingProperty] = useState<{ id: string; name: string; feeAmount: number } | null>(null);

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

    const handleQuickPay = (property: any) => {
        setPayingProperty({ ...property, feeAmount: onboardingFee });
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
                                            property.status === 'APPROVED_PENDING_PAYMENT' ? "bg-amber-500 animate-pulse" :
                                            property.status === 'APPROVED_PAYMENT_VERIFIED' ? "bg-blue-600" :
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
                                             property.status === 'APPROVED_PENDING_PAYMENT' ? 'Action Needed' :
                                             property.status === 'APPROVED_PAYMENT_VERIFIED' ? 'Pending Live' :
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
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleQuickPay(property); }}
                                                    disabled={processingId === property.id}
                                                >
                                                    {processingId === property.id ? "Processing..." : `PAY ₹${onboardingFee}`}
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

            {/* Razorpay Onboarding Payment Modal */}
            {payingProperty && (
                <RazorpayOnboardingModal
                    property={payingProperty}
                    onClose={() => setPayingProperty(null)}
                    onSuccess={() => { setPayingProperty(null); fetchProperties(); }}
                />
            )}
        </div>
    );
}

// ── Inline Razorpay Onboarding Modal ─────────────────────────────────────────
declare global { interface Window { Razorpay: any; } }

function RazorpayOnboardingModal({
    property,
    onClose,
    onSuccess,
}: {
    property: { id: string; name: string; displayId?: string; owner?: { name: string; email: string; phone?: string }; feeAmount: number };
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [flow, setFlow] = useState<"idle" | "processing" | "verifying" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [countdown, setCountdown] = useState(10);

    const GST_RATE = 0.18;
    const feeBase = Math.round((property.feeAmount / (1 + GST_RATE)) * 100) / 100;
    const gst = Math.round((property.feeAmount - feeBase) * 100) / 100;
    const cgst = Math.round((gst / 2) * 100) / 100;
    const sgst = Math.round((gst - cgst) * 100) / 100;

    const handlePay = async () => {
        setFlow("processing");
        setErrorMsg("");
        try {
            const order = await createOnboardingFeeOrder(property.id);
            if (!window.Razorpay) {
                await new Promise<void>((resolve, reject) => {
                    const script = document.createElement("script");
                    script.src = "https://checkout.razorpay.com/v1/checkout.js";
                    script.onload = () => resolve();
                    script.onerror = () => reject(new Error("Failed to load Razorpay"));
                    document.body.appendChild(script);
                });
            }
            const rzp = new window.Razorpay({
                key: order.key,
                amount: order.amount,
                currency: order.currency,
                name: "RentPe",
                description: `Onboarding Fee - ${property.name} (${property.displayId || ''}) - ${property.owner?.name || ''}`,
                order_id: order.isMock ? undefined : order.orderId,
                prefill: { 
                    name: property.owner?.name || "", 
                    email: property.owner?.email || "", 
                    contact: property.owner?.phone || "" 
                },
                theme: { color: "#3730a3" },
                handler: async (response: any) => {
                    setFlow("verifying");
                    let tick = 10;
                    setCountdown(10);
                    const interval = setInterval(() => { tick--; setCountdown(tick); if (tick <= 0) clearInterval(interval); }, 1000);
                    try {
                        await verifyOnboardingFeePayment({
                            razorpay_order_id: response.razorpay_order_id || order.orderId,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature || "mock_signature",
                            propertyId: property.id,
                        });
                        clearInterval(interval);
                        setFlow("success");
                        onSuccess();
                    } catch (verifyErr: any) {
                        clearInterval(interval);
                        setErrorMsg(verifyErr.message || "Verification failed. Please contact support.");
                        setFlow("error");
                    }
                },
                modal: { ondismiss: () => { if (flow === "processing") setFlow("idle"); } },
            });
            rzp.open();
        } catch (err: any) {
            setErrorMsg(err.message || "Failed to create payment order. Please try again.");
            setFlow("error");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-gradient-to-br from-indigo-700 to-purple-700 p-6 text-white relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 w-36 h-36 bg-white/10 rounded-full" />
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-xl transition-all z-50">
                        <span className="text-white font-black text-xl leading-none">×</span>
                    </button>
                    <div className="flex items-center gap-3 mb-1 relative z-10">
                        <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-indigo-200">Owner Per Property</p>
                            <p className="font-black text-lg">Onboarding Fee</p>
                        </div>
                    </div>
                    <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mt-1 relative z-10 truncate">
                        {property.name} {property.displayId && `(${property.displayId})`} {property.owner?.name && `• ${property.owner.name}`}
                    </p>
                </div>

                <div className="p-6 space-y-4">
                    {flow === "idle" && (
                        <>
                            <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Fee Breakdown</p>
                                <div className="flex justify-between text-sm text-slate-600">
                                    <span>Base Service Fee</span><span className="font-bold">₹{feeBase.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-600">
                                    <span>CGST @ 9%</span><span className="font-bold">₹{cgst.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-600">
                                    <span>SGST @ 9%</span><span className="font-bold">₹{sgst.toFixed(2)}</span>
                                </div>
                                <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
                                    <span className="font-black text-slate-900">Total (incl. 18% GST)</span>
                                    <span className="font-black text-xl text-indigo-700">₹{property.feeAmount}</span>
                                </div>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                                <p className="text-xs text-amber-700 font-bold">⚠ One-time non-refundable fee</p>
                                <p className="text-xs text-amber-600 mt-0.5">This fee is charged once per property listing on RentPe platform.</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={onClose}
                                    className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-2xl text-sm transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handlePay}
                                    className="w-2/3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black py-4 rounded-2xl text-base transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                                >
                                    <CreditCard className="w-5 h-5" /> Pay ₹{property.feeAmount}
                                </button>
                            </div>
                            <p className="text-center text-[10px] text-slate-400">🔒 Secured by Razorpay · 256-bit SSL</p>
                        </>
                    )}
                    {flow === "processing" && (
                        <div className="py-8 flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                            </div>
                            <p className="font-bold text-slate-700">Opening Razorpay checkout...</p>
                            <p className="text-sm text-slate-400 text-center">Complete the payment in the Razorpay window</p>
                        </div>
                    )}
                    {flow === "verifying" && (
                        <div className="py-8 flex flex-col items-center gap-4">
                            <div className="relative w-20 h-20">
                                <div className="w-20 h-20 rounded-full border-4 border-indigo-100 flex items-center justify-center">
                                    <span className="text-2xl font-black text-indigo-700">{countdown}</span>
                                </div>
                                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin absolute -top-1 -right-1" />
                            </div>
                            <p className="font-black text-slate-800 text-lg">Please wait...</p>
                            <p className="text-sm text-slate-500 text-center">Verifying payment with Razorpay.<br />Do not close this window.</p>
                        </div>
                    )}
                    {flow === "success" && (
                        <div className="py-6 flex flex-col items-center gap-4">
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                            </div>
                            <p className="font-black text-slate-800 text-xl">Payment Verified!</p>
                            <p className="text-sm text-slate-500 text-center">Your onboarding fee has been confirmed.<br />A receipt has been sent to your email.</p>
                            <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600 font-bold transition-colors">Close</button>
                        </div>
                    )}
                    {flow === "error" && (
                        <div className="py-6 flex flex-col items-center gap-4">
                            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-10 h-10 text-red-500" />
                            </div>
                            <p className="font-black text-slate-800 text-lg">Payment Failed</p>
                            <p className="text-sm text-red-600 text-center">{errorMsg}</p>
                            <button onClick={() => { setFlow("idle"); setErrorMsg(""); }} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl transition-all">Try Again</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
