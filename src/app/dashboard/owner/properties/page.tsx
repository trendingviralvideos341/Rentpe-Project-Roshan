"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, Plus, MapPin, AlertCircle, ArrowRight, CreditCard, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getProperties } from "@/actions/properties";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { ImageCarousel } from "@/components/ImageCarousel";
import { PropertyStepper } from "@/components/property/PropertyStepper";
import { payOnboardingFee, deleteProperty } from "@/actions/properties";
import { getPlatformSettings } from "@/actions/platform";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function OwnerPropertiesPage() {
    const [properties, setProperties] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [onboardingFee, setOnboardingFee] = useState(99);
    const { toast } = useToast();

    // Custom Modal State
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [propertyToCancel, setPropertyToCancel] = useState<{ id: string; name: string } | null>(null);

    const fetchProperties = async () => {
        setLoading(true);
        try {
            const data = await getProperties();
            setProperties(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
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
            toast({
                title: "Payment Successful",
                description: "Onboarding fee paid via dummy UPI. Awaiting Rentpe Team activation.",
            });
            fetchProperties();
        } catch (error: any) {
            toast({
                title: "Payment Failed",
                description: error.message || "Failed to process dummy payment.",
                variant: "destructive"
            });
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
                toast({
                    title: "Application Cancelled",
                    description: `Property "${propertyToCancel.name}" has been removed successfully.`,
                });
                fetchProperties();
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to cancel application.",
                variant: "destructive"
            });
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
    }, []);

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading properties...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-1">My Properties</h1>
                    <p className="text-slate-500 font-medium">Manage and monitor your PG listings in real-time.</p>
                </div>
                <Link href="/dashboard/owner/properties/new">
                    <Button className="rounded-xl h-11 px-6 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 font-bold transition-all active:scale-95">
                        <Plus className="mr-2 h-5 w-5" /> Add New Property
                    </Button>
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {properties.map((property) => (
                    <div key={property.id} className="group relative transition-all duration-300">
                        <Card className={cn(
                            "overflow-hidden border-[4px] border-slate-950 transition-all duration-500 shadow-sm group-hover:shadow-2xl h-full relative z-0 rounded-2xl",
                            property.status === 'SUSPENDED' || property.status === 'REJECTED' ? "bg-red-50/30" : "bg-slate-50/50"
                        )}>
                            {/* Main Link Overlay */}
                            <Link 
                                href={`/dashboard/owner/properties/${property.id}`} 
                                className="absolute inset-0 z-10"
                                aria-label={`View details for ${property.name}`}
                            />
                            
                            <div className="relative z-20 pointer-events-none h-full flex flex-col pt-[1px]">
                                <div className="h-48 bg-white relative">
                                    <div className="absolute top-3 right-3 z-40">
                                        {property.status === 'APPROVED' ? (
                                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] px-3 py-1 ring-4 ring-white shadow-xl">Live</Badge>
                                        ) : ['PENDING_VERIFICATION', 'VERIFYING', 'UNDER_REVIEW', 'VERIFYING_DOCUMENTS'].includes(property.status) ? (
                                            <Badge className="bg-blue-600 text-white ring-4 ring-white shadow-xl font-black uppercase tracking-widest text-[10px] px-3 py-1">In Review</Badge>
                                        ) : property.status === 'CORRECTED' ? (
                                            <Badge className="bg-indigo-600 text-white ring-4 ring-white shadow-xl font-black uppercase tracking-widest text-[10px] px-3 py-1">Resubmitted</Badge>
                                        ) : ['APPROVED_PENDING_PAYMENT', 'APPROVED_PAYMENT_VERIFIED'].includes(property.status) ? (
                                            <Badge className="bg-amber-500 text-white ring-4 ring-white shadow-xl font-black uppercase tracking-widest text-[10px] px-3 py-1 animate-pulse">Action Needed</Badge>
                                        ) : property.status === 'VERIFIED_SUCCESSFULLY' ? (
                                            <Badge className="bg-emerald-600 text-white ring-4 ring-white shadow-xl font-black uppercase tracking-widest text-[10px] px-3 py-1">Verified</Badge>
                                        ) : (
                                            <Badge className="bg-red-600 text-white ring-4 ring-white shadow-xl font-black uppercase tracking-widest text-[10px] px-3 py-1">{property.status === 'SUSPENDED' ? 'Suspended' : 'Rejected'}</Badge>
                                        )}
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
                                                <AlertCircle className="h-4 w-4" /> Rentpe Team Feedback / Action Required
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
                                        ) : (
                                            <span className="font-black flex items-center gap-1 text-slate-950 bg-white px-2 py-1 rounded-lg border-2 border-slate-950/10">
                                                <Building className="h-4 w-4 text-indigo-600" /> {property.rooms?.length || 0} Rooms
                                            </span>
                                        )}
                                        <div className="flex items-center gap-2">
                                            {property.status === 'APPROVED_PENDING_PAYMENT' && (
                                                <Button 
                                                    variant="default" 
                                                    size="sm" 
                                                    className="bg-amber-600 hover:bg-amber-700 text-white font-black uppercase text-[10px] h-8 px-4 shadow-lg active:scale-95 animate-bounce shadow-amber-200" 
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleQuickPay(property.id); }}
                                                    disabled={processingId === property.id}
                                                    suppressHydrationWarning
                                                >
                                                    {processingId === property.id ? "Processing..." : "PAY ₹99"}
                                                </Button>
                                            )}
                                            {(property.adminNotes?.includes('[REUPLOAD') && property.status !== 'APPROVED' && property.status !== 'APPROVED_PENDING_PAYMENT') && (
                                                <Badge className="uppercase font-bold text-white bg-red-600 border-2 border-red-800 animate-pulse shadow-md px-3 py-1 text-[10px]">
                                                    <AlertCircle className="w-3 h-3 mr-1" /> Reupload
                                                </Badge>
                                            )}
                                            {property.status !== 'APPROVED' && (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-500 hover:text-white hover:border-rose-500 hover:shadow-lg hover:shadow-rose-100 transition-all duration-300 font-bold uppercase text-[10px] h-8 px-4 rounded-lg active:scale-95"
                                                    onClick={(e) => handleCancelClick(e, property.id, property.name)}
                                                    disabled={processingId === property.id}
                                                    suppressHydrationWarning
                                                >
                                                    Cancel Application
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-full relative z-40 pointer-events-none group-hover/card:translate-y-[-2px] transition-transform">
                                        <div className="w-full flex justify-center items-center gap-2 bg-indigo-600 text-white font-black uppercase tracking-widest py-3.5 rounded-2xl text-xs shadow-xl shadow-indigo-100 group-hover:bg-indigo-700 transition-all group-hover:shadow-indigo-200 relative overflow-hidden">
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
                                <br /> <span className="text-sm font-black text-rose-700 mt-3 block bg-rose-100/50 py-1 px-2 rounded-md border border-rose-200 uppercase tracking-wide">⚠️ This action is permanent and cannot be undone.</span>
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    <DialogFooter className="p-6 bg-slate-50 flex flex-col sm:flex-row gap-3">
                        <Button 
                            variant="default" 
                            className="flex-1 rounded-xl h-11 bg-blue-600 hover:bg-blue-700 text-white border-[3px] border-blue-700 active:scale-95 transition-all font-black uppercase tracking-wider text-[11px] shadow-lg shadow-blue-100"
                            onClick={() => setCancelModalOpen(false)}
                        >
                            No, Keep it
                        </Button>
                        <Button 
                            variant="destructive" 
                            className="flex-1 rounded-xl h-11 bg-rose-600 hover:bg-rose-700 font-black uppercase tracking-wider text-[11px] shadow-lg shadow-rose-100 active:scale-95 transition-all border-[3px] border-rose-700/20"
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
                    <p className="text-slate-400 font-medium mb-6">Start by adding your first one!</p>
                    <Link href="/dashboard/owner/properties/new">
                        <Button className="rounded-xl h-11 px-6 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 font-bold transition-all active:scale-95">
                            <Plus className="mr-2 h-5 w-5" /> Add New Property
                        </Button>
                    </Link>
                </div>
            )}
        </div>
    );
}
