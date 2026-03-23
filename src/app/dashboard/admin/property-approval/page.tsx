"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ActionNote, AuditLog, Property, Room, User } from '@prisma/client';
import {
    CheckCircle, XCircle, AlertCircle, RefreshCcw, Eye, MapPin,
    FileText, Camera, Building2, User as UserIcon, Mail, Phone,
    Smartphone, CreditCard, Landmark, ArrowRight, Home, Users,
    Clock, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, BedDouble, ImageIcon, RotateCcw, Save, Plus, ParkingCircle, Trash2, Search, ShieldCheck, ZoomIn, ZoomOut,
    AlertTriangle, Edit3
} from 'lucide-react';
import { getAllPropertiesForAdmin, getAdminPropertyAnalytics, getAdminPropertyStatusCounts, startPropertyVerification, verifyPropertyDocuments, requirePropertyPayment, exemptPropertyFee, rejectProperty, requestPropertyCorrections, suspendProperty, activateProperty, rollbackPropertyStatus, adminUpdateUserProfile, adminUpdateProperty, adminUpdateRoom, adminAddRoom, adminDeleteRoom } from "@/actions/admin";
import { requestDocumentReupload, togglePropertyDocumentVerification, savePropertyDocuments, deletePropertyDocument } from "@/actions/properties";
import { useToast } from "@/components/ui/use-toast";
import { PropertyStepper } from "@/components/property/PropertyStepper";

export default function AdminPropertyApprovalPage() {
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

    const [properties, setProperties] = useState<any[]>([]);
    const [analytics, setAnalytics] = useState({ pending: 0, approved: 0, rejected: 0 });
    const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState("PENDING_VERIFICATION");
    const [activeTabs, setActiveTabs] = useState<Record<string, string>>({});
    const [expandedProperties, setExpandedProperties] = useState<Record<string, boolean>>({});

    // Dialog state
    const [actionDialog, setActionDialog] = useState<{ isOpen: boolean; propertyId: string; propertyName: string; actionType: 'START_VERIFICATION' | 'VERIFY_DOCS' | 'REQUIRE_PAYMENT' | 'EXEMPT_FEE' | 'REJECT' | 'NEEDS_CORRECTION' | 'SUSPEND' | 'ACTIVATE' | 'ROLLBACK'; currentStatus?: string; currentNotes?: string } | null>(null);
    const [adminNotes, setAdminNotes] = useState("");
    const [processing, setProcessing] = useState(false);

    // Edit Dialogs
    const [editPropertyDialog, setEditPropertyDialog] = useState<{ 
        isOpen: boolean; 
        propertyId: string; 
        name: string; 
        address: string; 
        pincode: string;
        city: string; 
        state: string;
        postOffice: string;
        description: string; 
        amenities: string;
        foodType: string;
        foodPricePerMonth: number;
    } | null>(null);
    const [editRoomDialog, setEditRoomDialog] = useState<{ isOpen: boolean; roomId: string; roomNumber: string; type: string; price: number; availability: number; depositMonths: number } | null>(null);
    const [addRoomDialog, setAddRoomDialog] = useState<{ isOpen: boolean; propertyId: string } | null>(null);
    const [newRoomData, setNewRoomData] = useState({ roomNumber: '', type: 'Single Sharing', price: 5000, availability: 1, depositMonths: 1 });

    // Pincode auto-fetch states for property edit
    const [pinFetching, setPinFetching] = useState(false);
    const [pinError, setPinError] = useState("");
    const [pinOffices, setPinOffices] = useState<{ Name: string; District: string; State: string }[]>([]);

    const handleAdminFileUpload = async (propertyId: string, docType: string, file: File, index?: number) => {
        const toastId = toast({ title: "Uploading...", description: `Uploading ${docType}...` });
        setProcessing(true);
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();

            if (res.ok && data.url) {
                const property = properties.find(p => p.id === propertyId);
                let updateData: any = { [docType]: data.url };

                if (index !== undefined && property && property[docType]) {
                    const photos = safeParse(property[docType]);
                    photos[index] = { url: data.url, size: file.size };
                    updateData = { [docType]: JSON.stringify(photos) };
                } else if (index === undefined && property && property[docType]) {
                     const photos = safeParse(property[docType]);
                     photos.push({ url: data.url, size: file.size });
                     updateData = { [docType]: JSON.stringify(photos) };
                }

                await savePropertyDocuments(propertyId, updateData);
                toast({ title: "Success", description: "Document uploaded by admin." });
                fetchData(true);
            } else {
                toast({ title: "Upload Failed", description: data.error || 'Server error', variant: "destructive" });
            }
        } catch (e: any) {
            toast({ title: "Upload Failed", description: e.message, variant: "destructive" });
        } finally {
            setProcessing(false);
        }
    };

    const handleAdminDelete = async (propertyId: string, docType: string, index?: number) => {
        setProcessing(true);
        try {
            const res = await deletePropertyDocument(propertyId, docType, index);
            if (res.success) {
                toast({ title: "Deleted", description: "Document removed by admin." });
                fetchData(true);
            } else {
                throw new Error(res.error);
            }
        } catch (e: any) {
            toast({ title: "Delete Failed", description: e.message, variant: "destructive" });
        } finally {
            setProcessing(false);
        }
    };

    // Pincode auto-fetch logic
    useEffect(() => {
        if (!editPropertyDialog?.pincode || editPropertyDialog.pincode.length !== 6 || !/^\d{6}$/.test(editPropertyDialog.pincode)) {
            setPinOffices([]);
            setPinError("");
            return;
        }

        let cancelled = false;
        setPinFetching(true);
        setPinError("");

        fetch(`https://api.postalpincode.in/pincode/${editPropertyDialog.pincode}`)
            .then(r => r.json())
            .then(data => {
                if (cancelled) return;
                if (!data?.[0] || data[0].Status !== "Success" || !data[0].PostOffice?.length) {
                    setPinError("Invalid PIN results.");
                    return;
                }
                const offices = data[0].PostOffice;
                setPinOffices(offices);
                
                // Only auto-fill if the fields are currently empty or we just changed the PIN
                setEditPropertyDialog(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        city: prev.city || offices[0].District,
                        state: prev.state || offices[0].State,
                        postOffice: prev.postOffice || offices[0].Name
                    };
                });
            })
            .catch(() => {
                if (!cancelled) setPinError("Network error.");
            })
            .finally(() => {
                if (!cancelled) setPinFetching(false);
            });

        return () => { cancelled = true; };
    }, [editPropertyDialog?.pincode]);

    const handleUpdateProperty = async () => {
        if (!editPropertyDialog) return;
        setProcessing(true);
        try {
            // Reconstruct the full address if needed or just use the fields
            const fullAddress = `${editPropertyDialog.address}, ${editPropertyDialog.postOffice}, ${editPropertyDialog.city}, ${editPropertyDialog.state} - ${editPropertyDialog.pincode}, India`;
            
            await adminUpdateProperty(editPropertyDialog.propertyId, {
                name: editPropertyDialog.name,
                address: fullAddress,
                city: editPropertyDialog.city,
                description: editPropertyDialog.description,
                amenities: editPropertyDialog.amenities,
                foodType: editPropertyDialog.foodType,
                foodPricePerMonth: editPropertyDialog.foodPricePerMonth
            });
            toast({ title: "Success", description: "Property updated successfully." });
            setEditPropertyDialog(null);
            fetchData(true);
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setProcessing(false);
        }
    };

    const handleUpdateRoom = async () => {
        if (!editRoomDialog) return;
        setProcessing(true);
        try {
            await adminUpdateRoom(editRoomDialog.roomId, {
                roomNumber: editRoomDialog.roomNumber,
                type: editRoomDialog.type,
                price: editRoomDialog.price,
                availability: editRoomDialog.availability,
                depositMonths: editRoomDialog.depositMonths,
            });
            toast({ title: "Success", description: "Room updated successfully." });
            setEditRoomDialog(null);
            fetchData(true);
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setProcessing(false);
        }
    };

    const handleAddRoom = async () => {
        if (!addRoomDialog) return;
        if (!newRoomData.roomNumber) {
            toast({ title: "Room Number Required", variant: "destructive" });
            return;
        }
        setProcessing(true);
        try {
            await adminAddRoom(addRoomDialog.propertyId, newRoomData);
            toast({ title: "Success", description: "Room added successfully." });
            setAddRoomDialog(null);
            setNewRoomData({ roomNumber: '', type: 'Single Sharing', price: 10000, availability: 1, depositMonths: 1 });
            fetchData(true);
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setProcessing(false);
        }
    };

    const handleDeleteRoom = async (roomId: string) => {
        if (!window.confirm("Are you sure you want to delete this room? This cannot be undone.")) return;
        setProcessing(true);
        try {
            await adminDeleteRoom(roomId);
            toast({ title: "Success", description: "Room deleted successfully." });
            fetchData(true);
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setProcessing(false);
        }
    };
    const [reuploadDialog, setReuploadDialog] = useState<{ isOpen: boolean; propertyId: string; docType: string; label: string } | null>(null);
    const [reuploadNote, setReuploadNote] = useState("");
    const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; propertyId: string; docType: string; label: string; index?: number } | null>(null);
    const [deleteNote, setDeleteNote] = useState("");
    const [editOwnerDialog, setEditOwnerDialog] = useState<{ isOpen: boolean; userId: string; name: string; email: string; phone: string } | null>(null);
    const [viewDialog, setViewDialog] = useState<{ isOpen: boolean; propertyId: string; catKey: string; index?: number; isArray: boolean; label: string; desc: string } | null>(null);
    const [previewZoom, setPreviewZoom] = useState(1);

    const { toast } = useToast();

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [propsData, statsData, countsData] = await Promise.all([
                getAllPropertiesForAdmin(filterStatus),
                getAdminPropertyAnalytics(),
                getAdminPropertyStatusCounts()
            ]);
            setProperties(propsData);
            setAnalytics(statsData);
            setStatusCounts(countsData);
        } catch (e) {
            console.error(e);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [filterStatus]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleConfirmAction = async () => {
        if (!actionDialog) return;
        if ((actionDialog.actionType === 'REJECT' || actionDialog.actionType === 'ROLLBACK' || actionDialog.actionType === 'EXEMPT_FEE' || (actionDialog.actionType === 'ACTIVATE' && actionDialog.currentStatus === 'SUSPENDED')) && !adminNotes.trim()) {
            toast({ title: "Required", description: "A reason or note is required for this action.", variant: "destructive" });
            return;
        }

        setProcessing(true);
        try {
            switch(actionDialog.actionType) {
                case 'START_VERIFICATION': await startPropertyVerification(actionDialog.propertyId); break;
                case 'VERIFY_DOCS': await verifyPropertyDocuments(actionDialog.propertyId); break;
                case 'REQUIRE_PAYMENT': await requirePropertyPayment(actionDialog.propertyId); break;
                case 'EXEMPT_FEE': await exemptPropertyFee(actionDialog.propertyId, adminNotes); break;
                case 'REJECT': await rejectProperty(actionDialog.propertyId, adminNotes); break;
                case 'NEEDS_CORRECTION': await requestPropertyCorrections(actionDialog.propertyId, adminNotes); break;
                case 'SUSPEND': await suspendProperty(actionDialog.propertyId, adminNotes); break;
                case 'ACTIVATE': await activateProperty(actionDialog.propertyId, adminNotes); break;
                case 'ROLLBACK': await rollbackPropertyStatus(actionDialog.propertyId, adminNotes); break;
            }
            toast({
                title: "Status Updated",
                description: `Property status has been successfully updated.`,
            });
            setActionDialog(null);
            setAdminNotes("");
            fetchData(true); // Silent refresh
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
            fetchData(true); // Silent refresh
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
                fetchData(true); // Silent refresh
            } else {
                throw new Error(res.error);
            }
        } catch (e: any) {
            toast({ title: "Update Failed", description: e.message, variant: "destructive" });
        } finally {
            setProcessing(false);
        }
    };

    
    const handleUpdateOwner = async () => {
        if (!editOwnerDialog) return;
        setProcessing(true);
        try {
            await adminUpdateUserProfile(editOwnerDialog.userId, {
                name: editOwnerDialog.name,
                email: editOwnerDialog.email,
                phone: editOwnerDialog.phone
            });
            toast({ title: "Owner Updated", description: "Profile details have been corrected." });
            setEditOwnerDialog(null);
            fetchData(true);
        } catch (e: any) {
            toast({ title: "Update Failed", description: e.message, variant: "destructive" });
        } finally {
            setProcessing(false);
        }
    };

    const renderAdminCategory = (property: any, cat: any) => (
        <div key={cat.key} className={`border-2 ${cat.borderClass} transition-all rounded-2xl p-4 flex flex-col shadow-sm bg-white overflow-hidden group/card`}>
            <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 ${cat.bgClass} rounded-lg ${cat.colorClass}`}> {cat.icon} </div>
                <div>
                    <h4 className="font-bold text-base tracking-tight text-slate-800">{cat.label}</h4>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">{cat.desc}</p>
                </div>
            </div>

            {cat.isArray ? (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        {(() => {
                            const photos = safeParse(property[cat.key]);
                            const slots = [];
                            for (let i = 0; i < (cat.max || 4); i++) {
                                if (photos[i]) {
                                    const img = typeof photos[i] === 'string' ? photos[i] : photos[i].url;
                                    const isVerified = property.verifiedDocs && safeParse(property.verifiedDocs).includes(`${cat.key}-${i}`);
                                    
                                     slots.push(
                                        <div key={`${property.id}-${cat.key}-${i}`} className={`relative h-24 sm:h-36 rounded-xl border shadow-sm group/img ${isVerified ? 'border-green-500 ring-4 ring-green-100 bg-green-50' : 'bg-white'} overflow-hidden`}>
                                            <div className="w-full h-full overflow-hidden bg-slate-100">
                                                <img src={img} className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-500" />
                                            </div>
                                            
                                            {/* Verified Watermark */}
                                            {isVerified && (
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.07] z-10 transition-opacity group-hover/img:opacity-[0.1]">
                                                    <span className="text-xl font-black rotate-[-25deg] text-green-600 uppercase tracking-widest whitespace-nowrap">VERIFIED</span>
                                                </div>
                                            )}

                                            {/* Status Badge */}
                                            <div className="absolute top-0 right-0 z-40">
                                                {isVerified ? (
                                                    <div className="bg-green-600 text-white px-3 py-1.5 rounded-bl-xl shadow-[0_4px_15px_rgba(22,163,74,0.3)] flex items-center gap-1.5 border-l border-b border-green-400/50 animate-in fade-in slide-in-from-top-2 slide-in-from-right-2 duration-500">
                                                        <CheckCircle className="w-3.5 h-3.5 fill-white/10" />
                                                        <span className="text-[9px] font-black uppercase tracking-widest drop-shadow-sm">Verified</span>
                                                    </div>
                                                ) : (
                                                    <div className="bg-amber-500 text-white px-2 py-0.5 rounded-bl-lg shadow-md flex items-center border-l border-b border-white/20">
                                                        <AlertCircle className="w-3 h-3 mr-1" />
                                                        <span className="text-[8px] font-bold uppercase tracking-wider">Pending</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Unified Clean Hover Overlay */}
                                            <div 
                                                className="absolute inset-0 bg-slate-900/0 hover:bg-slate-900/40 opacity-0 hover:opacity-100 transition-all flex flex-col items-center justify-center backdrop-blur-[2px] z-30 group-hover/img:opacity-100 cursor-pointer"
                                                onClick={() => {
                                                    setViewDialog({ 
                                                        isOpen: true, 
                                                        propertyId: property.id, 
                                                        catKey: cat.key, 
                                                        index: i, 
                                                        isArray: true, 
                                                        label: cat.label, 
                                                        desc: cat.desc 
                                                    });
                                                }}
                                            >
                                                <div className="bg-white/90 p-4 rounded-full shadow-2xl scale-75 group-hover/img:scale-100 transition-all">
                                                    <Search className="w-6 h-6 text-slate-900" />
                                                </div>
                                                <span className="text-[10px] font-black text-white mt-3 uppercase tracking-[0.2em] drop-shadow-lg">View Document</span>
                                            </div>
                                        </div>
                                    );
                                } else {
                                     slots.push(
                                        <div key={`${property.id}-${cat.key}-slot-${i}`} className="border-2 border-dashed border-slate-100 rounded-xl flex flex-col items-center justify-center h-24 sm:h-36 bg-slate-50/50 group/empty relative overflow-hidden">
                                            <ImageIcon className="w-5 h-5 text-slate-300 group-hover/empty:scale-90 transition-transform" />
                                            <span className="text-[8px] font-bold uppercase text-slate-400 mt-1">Add Photo</span>
                                            
                                            {/* Admin Upload Overaly */}
                                            <label className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover/empty:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-all backdrop-blur-[1px]">
                                                <div className="bg-blue-600 text-white p-3 rounded-full shadow-xl scale-90 group-hover/empty:scale-100 transition-transform">
                                                    <Plus className="w-5 h-5 stroke-[3]" />
                                                </div>
                                                <span className="text-[10px] font-black text-blue-800 mt-2.5 uppercase tracking-widest drop-shadow-sm">Add Photo</span>
                                                <input 
                                                    type="file" 
                                                    className="hidden" 
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleAdminFileUpload(property.id, cat.key, file, i);
                                                    }}
                                                    accept="image/*"
                                                />
                                            </label>
                                        </div>
                                    );
                                }
                            }
                            return slots;
                        })()}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col h-full">
                    {property[cat.key] ? (
                        <div className="flex flex-col h-36">
                            <div className={`relative flex-1 rounded-lg border shadow-sm group/img ${safeParse(property.verifiedDocs).includes(cat.key) ? 'border-green-500 border-2 ring-4 ring-green-100 bg-green-50' : 'bg-white'} overflow-hidden mb-3`}>
                                {property[cat.key].endsWith(".pdf") ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50">
                                        <FileText className="w-10 h-10 text-slate-400 mb-2" />
                                        <span className="text-[10px] font-bold text-slate-500">PDF Document</span>
                                    </div>
                                ) : (
                                    <img src={property[cat.key]} className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-700" />
                                )}
                                
                                <div className="absolute top-2 right-2 z-40">
                                    {safeParse(property.verifiedDocs).includes(cat.key) ? (
                                        <div className="bg-green-600 text-white px-4 py-2 rounded-xl shadow-[0_10px_30px_rgba(22,163,74,0.4)] flex items-center gap-2 border border-green-400/30 animate-in zoom-in duration-500" title="Verified">
                                            <CheckCircle className="w-4 h-4 fill-white/20" />
                                            <span className="text-[12px] font-black uppercase tracking-[0.2em] drop-shadow-md">Verified</span>
                                        </div>
                                    ) : (
                                        <div className="bg-amber-500 text-white px-3 py-1 rounded-full shadow-lg flex items-center border border-white/20" title="Pending Approval">
                                            <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Pending Approval</span>
                                        </div>
                                    )}
                                </div>

                                {/* Verified Watermark (Large) */}
                                {safeParse(property.verifiedDocs).includes(cat.key) && (
                                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none opacity-[0.05] z-10 transition-opacity group-hover/img:opacity-[0.08]">
                                        <span className="text-5xl font-black rotate-[-20deg] text-green-700 uppercase tracking-[0.3em] whitespace-nowrap">VERIFIED DOC</span>
                                    </div>
                                )}

                                {/* Unified Clean Hover Overlay (Singleton) */}
                                <div 
                                    className="absolute inset-0 bg-slate-900/0 hover:bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition-all flex flex-col items-center justify-center backdrop-blur-[2px] z-30 p-4 cursor-pointer"
                                    onClick={() => {
                                        setViewDialog({ 
                                            isOpen: true, 
                                            propertyId: property.id, 
                                            catKey: cat.key, 
                                            isArray: false, 
                                            label: cat.label, 
                                            desc: cat.desc 
                                        });
                                    }}
                                >
                                    <div className="bg-white/90 p-5 rounded-full shadow-2xl scale-75 group-hover/img:scale-110 transition-all">
                                        <Search className="w-7 h-7 text-slate-900" />
                                    </div>
                                    <span className="text-[11px] font-black text-white mt-4 uppercase tracking-[0.3em] drop-shadow-lg">View Document</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div key={`${property.id}-${cat.key}-empty`} className="h-36 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50 p-6 group/empty overflow-hidden relative">
                            <Plus className="w-8 h-8 text-slate-300 mb-2 group-hover/empty:scale-90 transition-transform" />
                            <span className="text-xs font-bold text-slate-400 uppercase">Add Photo</span>
                            
                            {/* Admin Upload Overlay */}
                            <label className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover/empty:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-all backdrop-blur-[1px]">
                                <div className="bg-blue-600 text-white p-3 rounded-full shadow-lg scale-90 group-hover/empty:scale-100 transition-transform">
                                    <Plus className="w-6 h-6" />
                                </div>
                                <span className="text-xs font-black text-blue-700 mt-3 uppercase tracking-[0.2em]">Add Photo</span>
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleAdminFileUpload(property.id, cat.key, file);
                                    }}
                                    accept="image/*,.pdf"
                                />
                            </label>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Property Approvals</h1>
                    <p className="text-muted-foreground">Review, filter, and manage property listings.</p>
                </div>
                <Button variant="outline" onClick={() => fetchData(false)} disabled={loading}>
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-purple-50 p-3 rounded-lg border border-purple-100 mb-6">
                <AlertCircle className="h-4 w-4 text-purple-600" />
                <span>Click <strong>"View Details"</strong> on any property to see full documentation, room layouts, and the verification stepper.</span>
            </div>

            {/* Scrollable Tabs filter */}
            <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar">
                {[
                    { id: 'PENDING_VERIFICATION', label: 'Approve Applications', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100', bgActive: 'bg-blue-600 text-white' },
                    { id: 'CORRECTED', label: 'Corrected Resubmissions', icon: RefreshCcw, color: 'text-indigo-600', bg: 'bg-indigo-100', bgActive: 'bg-indigo-600 text-white' },
                    { id: 'VERIFYING_DOCUMENTS', label: 'Verifying Documents', icon: Eye, color: 'text-purple-600', bg: 'bg-purple-100', bgActive: 'bg-purple-600 text-white' },
                    { id: 'NEEDS_CORRECTION', label: 'Needs Correction', icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-100', bgActive: 'bg-amber-600 text-white' },
                    { id: 'VERIFIED_SUCCESSFULLY', label: 'Verified Successfully', icon: CheckCircle, color: 'text-amber-600', bg: 'bg-amber-100', bgActive: 'bg-amber-600 text-white' },
                    { id: 'APPROVED_PENDING_PAYMENT', label: 'Pending Payment', icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-100', bgActive: 'bg-amber-600 text-white' },
                    { id: 'APPROVED_PAYMENT_VERIFIED', label: 'Payment Verified', icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-100', bgActive: 'bg-emerald-600 text-white' },
                    { id: 'APPROVED', label: 'Live Properties', icon: Building2, color: 'text-green-600', bg: 'bg-green-100', bgActive: 'bg-green-600 text-white' },
                    { id: 'SUSPENDED', label: 'Temporary Suspended', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100', bgActive: 'bg-red-600 text-white' },
                    { id: 'REJECTED', label: 'Banned', icon: XCircle, color: 'text-red-900', bg: 'bg-red-200', bgActive: 'bg-red-900 text-white' },
                ].map((tab) => {
                    const isActive = filterStatus === tab.id;
                    const Icon = tab.icon;
                    const count = statusCounts[tab.id] || 0;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setFilterStatus(tab.id)}
                            className={`flex items-center gap-3 px-6 py-2.5 rounded-[18px] whitespace-nowrap transition-all duration-300 border-2 font-black uppercase text-[10px] tracking-widest ${
                                isActive 
                                    ? "bg-slate-950 text-white border-slate-950 shadow-xl shadow-slate-200 -translate-y-0.5" 
                                    : "bg-white/80 backdrop-blur-sm text-slate-500 border-slate-100 hover:border-slate-300 hover:bg-white hover:text-slate-900"
                            }`}
                        >
                            <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-400' : tab.color}`} />
                            {tab.label}
                            {count > 0 && (
                                <span className={`ml-1 flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[9px] font-black rounded-full border shadow-sm ${
                                    tab.id === 'APPROVED' 
                                        ? 'bg-emerald-500 text-white border-emerald-600' 
                                        : 'bg-red-500 text-white border-red-600'
                                }`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    )
                })}
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
                    {properties.map((property, index) => {
                        const propertyImages = safeParse(property.images);
                        const mainImage = propertyImages[0] || property.pgPhotoUrl;
                        const isExpanded = !!expandedProperties[property.id];
                        const isRedState = property.status === 'REJECTED' || property.status === 'SUSPENDED';
                        const isApproved = property.status === 'APPROVED' || property.status === 'APPROVED_PAYMENT_VERIFIED';
                        
                        // User-requested color cycle: Soft Blue -> Soft Purple -> Intense Red
                        const cycleIndex = index % 3;
                        let cycleClass = 'bg-blue-50/80 border-blue-300 shadow-blue-100/50'; // Vibrant Soft Blue
                        if (cycleIndex === 1) cycleClass = 'bg-purple-50/80 border-purple-300 shadow-purple-100/50'; // Vibrant Soft Purple
                        else if (cycleIndex === 2) cycleClass = 'bg-red-50/90 border-red-300 shadow-red-100/50'; // Vibrant Intense Red

                        const statusColor = isApproved ? '#10b981' : isRedState ? '#b91c1c' : property.status === 'PENDING_VERIFICATION' ? '#3b82f6' : property.status === 'VERIFYING_DOCUMENTS' ? '#9333ea' : property.status === 'CORRECTED' ? '#4f46e5' : '#f59e0b';

                        return (
                            <Card key={property.id} id={`property-card-${property.id}`} className={cn(
                                "overflow-hidden transition-all duration-500 border-[4px] border-slate-950",
                                isExpanded 
                                    ? "ring-8 ring-indigo-50 shadow-2xl shadow-indigo-100/50 z-10 -mx-2 mb-8" 
                                    : "hover:shadow-2xl shadow-slate-200/50 mb-4"
                            )}>
                                <style jsx>{`
                                    .group:hover {
                                        box-shadow: 0 0 50px var(--hover-glow), 0 60px 120px -30px rgba(0,0,0,0.5);
                                    }
                                `}</style>

                                {isRedState && (
                                    <div className="bg-red-600 text-white text-[9px] font-black uppercase tracking-[0.2em] py-1 text-center animate-pulse relative z-30">
                                        Action Required - Suspension / Rejection In Effect
                                    </div>
                                )}

                                <CardContent className={cn(
                                    "p-5 sm:p-6 flex flex-col md:flex-row gap-6 transition-all cursor-pointer select-none",
                                    isExpanded ? "bg-white" : isRedState ? "bg-red-50/30" : "bg-slate-50/50",
                                    !isExpanded && "hover:bg-slate-100/80"
                                )}
                                    onClick={() => setExpandedProperties(prev => ({ ...prev, [property.id]: !prev[property.id] }))}
                                >
                                    {/* Thumbnail Section */}
                                    <div className="relative w-full md:w-48 h-32 rounded-xl overflow-hidden shadow-inner border-[3px] border-slate-950/10 flex-shrink-0 bg-white">
                                        {mainImage ? (
                                            <img src={mainImage} alt={property.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                        ) : (
                                            <div className="w-full h-full bg-white flex flex-col items-center justify-center text-slate-400">
                                                <Camera className="h-8 w-8 mb-1" />
                                                <span className="text-[10px] uppercase font-bold">No Image</span>
                                            </div>
                                        )}
                                        <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-white text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                                            <Home className="h-3 w-3" /> {property.propertyType}
                                        </div>
                                    </div>

                                    {/* Info Section */}
                                    <div className="flex-1 flex flex-col justify-between py-1">
                                        <div className="space-y-4">
                                            <div className="flex flex-wrap items-start justify-between gap-4">
                                                <div className="space-y-1.5 min-w-[200px]">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex flex-col border-b-[3px] border-slate-950/20 pb-2 flex-grow">
                                                            <div className="flex items-center flex-wrap gap-3">
                                                                <h3 className="text-3xl font-black tracking-tighter text-slate-950 group-hover:text-indigo-600 transition-colors uppercase leading-none break-words max-w-full">
                                                                    {property.name}
                                                                </h3>
                                                                <span className="text-[12px] flex-shrink-0 font-black tracking-widest bg-white text-slate-950 border-2 border-slate-950/20 px-3 py-0.5 rounded-lg shadow-sm uppercase">
                                      ID: {property.displayId || 'PND'}
                                  </span>
                                                            </div>
                                                        </div>
                                                        <Badge variant="secondary" className={`
                                                            self-center font-black px-4 py-1.5 rounded-full text-[11px] uppercase tracking-widest shadow-md border-2
                                                            ${property.status === 'APPROVED' ? 'bg-green-100 text-green-700 border border-green-200' : ''}
                                                            ${(property.status === 'SUSPENDED' || property.status === 'REJECTED') ? 'bg-red-100 text-red-700 border border-red-200' : ''}
                                                            ${property.status === 'PENDING_VERIFICATION' ? 'bg-blue-100 text-blue-700 border border-blue-200' : ''}
                                                            ${property.status === 'CORRECTED' ? 'bg-indigo-100 text-indigo-700 border border-indigo-300 shadow-sm' : ''}
                                                            ${property.status === 'VERIFYING_DOCUMENTS' ? 'bg-purple-100 text-purple-700 border border-purple-200' : ''}
                                                            ${property.status === 'NEEDS_CORRECTION' ? 'bg-amber-100 text-amber-700 border border-amber-200' : ''}
                                                            ${property.status === 'VERIFIED_SUCCESSFULLY' ? 'bg-amber-100 text-amber-700 border border-amber-300' : ''}
                                                            ${property.status === 'APPROVED_PENDING_PAYMENT' ? 'bg-amber-100 text-amber-700 border border-amber-300 shadow-sm' : ''}
                                                            ${property.status === 'APPROVED_PAYMENT_VERIFIED' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-sm' : ''}
                                                        `}>
                                                            {property.status === 'PENDING_VERIFICATION' ? 'Application Pending' : property.status === 'CORRECTED' ? 'Resubmitted Docs' : property.status === 'APPROVED_PAYMENT_VERIFIED' ? 'Fee Paid - Ready' : property.status.replace(/_/g, ' ')}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-slate-500 font-medium">
                                                        <MapPin className="h-4 w-4 text-slate-400" />
                                                        <span className="text-sm line-clamp-1">{property.city}, {property.address}</span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end gap-1.5">
                                                    <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-white/50 rounded-lg border border-slate-200/50">
                                                            <Clock className="h-3 w-3 text-slate-400" />
                                                            <span>Submitted: {new Date(property.createdAt).toLocaleDateString()}</span>
                                                        </div>
                                                        {isApproved && (
                                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500 text-white rounded-lg shadow-sm shadow-emerald-100">
                                                                <CheckCircle className="h-3 w-3" />
                                                                <span>Live Date: {new Date(property.updatedAt).toLocaleDateString()}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-6 pt-4 border-t-[3px] border-slate-950/20">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                                        <UserIcon className="h-4 w-4" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold uppercase text-slate-400">Owner</span>
                                                        <span className="text-xs font-bold text-slate-700">{property.owner?.name || "Unknown Owner"}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                                                        <Users className="h-4 w-4" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold uppercase text-slate-400">Occupancy</span>
                                                        <span className="text-xs font-bold text-slate-700">{property.genderType} Only</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-600">
                                                        <Building2 className="h-4 w-4" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold uppercase text-slate-400">Rooms</span>
                                                        <span className="text-xs font-bold text-slate-700">{property.rooms?.length || 0} Listed</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons Column */}
                                    <div className="flex md:border-l md:pl-6 border-slate-100 items-center justify-end" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex flex-row items-center gap-2 flex-wrap md:flex-nowrap">
                                            <Button 
                                                size="sm" 
                                                className={`h-10 px-6 rounded-xl transition-all shadow-md font-black uppercase tracking-wider text-[11px] active:scale-95 ${isExpanded ? 'bg-slate-800 text-white hover:bg-slate-900 border-2 border-slate-700 shadow-slate-200' : 'bg-green-600 text-white hover:bg-green-700 shadow-green-200'}`}
                                                onClick={() => setExpandedProperties(prev => ({ ...prev, [property.id]: !prev[property.id] }))}
                                            >
                                                {isExpanded ? (
                                                    <><ChevronUp className="h-4 w-4 mr-2" /> Hide</>
                                                ) : (
                                                    <><Eye className="h-4 w-4 mr-2" /> Details</>
                                                )}
                                            </Button>

                                            <div className="flex items-center gap-2">
                                                {(property.status === 'PENDING_VERIFICATION' || property.status === 'CORRECTED') && (
                                                    <Button size="sm" className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100 font-bold whitespace-nowrap" onClick={() => setActionDialog({ isOpen: true, propertyId: property.id, propertyName: property.name, actionType: 'START_VERIFICATION', currentStatus: property.status })}>
                                                        {property.status === 'CORRECTED' ? 'Resume Verification' : 'Approve Application'}
                                                    </Button>
                                                )}
                                                {property.status === 'VERIFYING_DOCUMENTS' && (
                                                    <>
                                                        <Button size="sm" className="h-10 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-100 font-bold whitespace-nowrap" onClick={() => setActionDialog({ isOpen: true, propertyId: property.id, propertyName: property.name, actionType: 'VERIFY_DOCS', currentStatus: property.status })}>
                                                            Documents Verified
                                                        </Button>
                                                        <Button size="sm" className="h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-100 font-bold whitespace-nowrap" onClick={() => setActionDialog({ isOpen: true, propertyId: property.id, propertyName: property.name, actionType: 'NEEDS_CORRECTION', currentStatus: property.status })}>
                                                            Needs Correction
                                                        </Button>
                                                    </>
                                                )}
                                                {property.status === 'APPROVED' && (
                                                    <Button size="sm" variant="destructive" className="h-10 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-100 font-bold whitespace-nowrap" onClick={() => setActionDialog({ isOpen: true, propertyId: property.id, propertyName: property.name, actionType: 'SUSPEND', currentStatus: property.status })}>
                                                        Temporary Suspend
                                                    </Button>
                                                )}
                                                {property.status === 'SUSPENDED' && (
                                                    <Button size="sm" className="h-10 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl px-4 font-bold shadow-lg shadow-cyan-100 whitespace-nowrap" onClick={() => setActionDialog({ isOpen: true, propertyId: property.id, propertyName: property.name, actionType: 'ACTIVATE', currentStatus: property.status, currentNotes: property.adminNotes })}>
                                                        Reactivate
                                                    </Button>
                                                )}                                                 {property.status === 'VERIFIED_SUCCESSFULLY' && (
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex flex-col items-end gap-1">
                                                            <div className="px-3 py-1 bg-orange-600 border-2 border-orange-700 rounded-xl text-[10px] font-black text-white uppercase tracking-[0.2em] shadow-lg shadow-orange-100 flex items-center justify-center mb-0.5">
                                                                ₹99 FEE PENDING
                                                            </div>
                                                            <Button size="sm" className="h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-4 font-bold shadow-lg shadow-amber-100 whitespace-nowrap" onClick={() => setActionDialog({ isOpen: true, propertyId: property.id, propertyName: property.name, actionType: 'REQUIRE_PAYMENT', currentStatus: property.status })}>
                                                                <CreditCard className="h-4 w-4 mr-2" /> Request Payment
                                                            </Button>
                                                        </div>
                                                        <Button size="sm" className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 font-bold shadow-lg shadow-emerald-100 whitespace-nowrap" onClick={() => setActionDialog({ isOpen: true, propertyId: property.id, propertyName: property.name, actionType: 'EXEMPT_FEE', currentStatus: property.status })}>
                                                            <ShieldCheck className="h-4 w-4 mr-2" /> Exempt Fee
                                                        </Button>
                                                    </div>
                                                 )}
                                                 {property.status === 'APPROVED_PAYMENT_VERIFIED' && (
                                                     <Button size="sm" className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 font-bold shadow-lg shadow-emerald-100 whitespace-nowrap" onClick={() => setActionDialog({ isOpen: true, propertyId: property.id, propertyName: property.name, actionType: 'ACTIVATE', currentStatus: property.status })}>
                                                         Make Live
                                                     </Button>
                                                 )}

                                                 {property.status === 'APPROVED_PENDING_PAYMENT' && (
                                                     <Button size="sm" variant="outline" className="h-10 border-amber-200 text-amber-700 hover:bg-amber-50 rounded-xl px-4 font-bold shadow-lg shadow-amber-50 whitespace-nowrap" onClick={() => setActionDialog({ isOpen: true, propertyId: property.id, propertyName: property.name, actionType: 'EXEMPT_FEE', currentStatus: property.status })}>
                                                         <ShieldCheck className="h-4 w-4 mr-2" /> Exempt Fee
                                                     </Button>
                                                 )}
                                                {['VERIFYING_DOCUMENTS', 'VERIFIED_SUCCESSFULLY', 'APPROVED_PENDING_PAYMENT', 'APPROVED', 'NEEDS_CORRECTION'].includes(property.status) && (
                                                    <Button 
                                                        size="sm" 
                                                        variant="outline" 
                                                        className="h-10 px-4 rounded-xl border-2 border-slate-200 hover:bg-slate-50 text-slate-600 font-bold whitespace-nowrap group/undo" 
                                                        onClick={() => setActionDialog({ isOpen: true, propertyId: property.id, propertyName: property.name, actionType: 'ROLLBACK', currentStatus: property.status })}
                                                    >
                                                        <RotateCcw className="h-4 w-4 mr-2 transition-transform group-hover/undo:-rotate-45" />
                                                        Move Back
                                                    </Button>
                                                )}
                                            </div>

                                            {(property.status !== 'REJECTED' && property.status !== 'SUSPENDED') && (
                                                <Button 
                                                    size="sm" 
                                                    variant="destructive" 
                                                    className={`h-10 px-4 rounded-xl font-bold shadow-lg whitespace-nowrap ${property.status === 'APPROVED' ? 'bg-red-900 hover:bg-black text-white shadow-red-200' : 'bg-red-500 hover:bg-red-600 text-white shadow-red-100'}`} 
                                                    onClick={() => setActionDialog({ isOpen: true, propertyId: property.id, propertyName: property.name, actionType: 'REJECT', currentStatus: property.status })}
                                                >
                                                    <XCircle className="h-4 w-4 mr-2" />
                                                    {property.status === 'APPROVED' ? 'Banned' : 'Reject'}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>



                                {isExpanded && (
                                    <div className="animate-in slide-in-from-top-4 duration-500 ease-out border-t-2 border-indigo-100/50">
                                        <CardContent className="p-4 sm:p-10 space-y-10 bg-white/50 backdrop-blur-sm">
                                            <div className="relative">
                                                <div className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-transparent -ml-10 hidden md:block" />
                                                <PropertyStepper status={property.status} adminNotes={property.adminNotes} />
                                            </div>
                                                                                        <Tabs 
                                                value={activeTabs[property.id] || "details"} 
                                                onValueChange={(val) => setActiveTabs(prev => ({ ...prev, [property.id]: val }))}
                                                className="w-full"
                                            >
                                                <TabsList className="flex items-center w-full max-w-2xl bg-slate-50 border border-slate-200 p-1.5 rounded-[24px] h-14 mb-10 shadow-inner relative z-0">
                                                    <TabsTrigger 
                                                        value="details"
                                                        className="flex-1 rounded-full font-black uppercase text-[10px] tracking-[0.1em] gap-2 h-11 transition-all duration-300 
                                                        bg-transparent text-slate-500
                                                        data-[state=active]:bg-white data-[state=active]:text-indigo-600 
                                                        data-[state=active]:shadow-lg data-[state=active]:border border-transparent data-[state=active]:border-indigo-100 group/tab 
                                                        hover:bg-indigo-50/50 active:scale-95"
                                                    >
                                                        <Home className="w-4 h-4 group-data-[state=active]/tab:scale-110 transition-transform" />
                                                        <span>Property Details</span>
                                                    </TabsTrigger>
                                                    <TabsTrigger 
                                                        value="rooms"
                                                        className="flex-1 rounded-full font-black uppercase text-[10px] tracking-[0.1em] gap-2 h-11 transition-all duration-300 
                                                        bg-transparent text-slate-500
                                                        data-[state=active]:bg-white data-[state=active]:text-emerald-600 
                                                        data-[state=active]:shadow-lg data-[state=active]:border border-transparent data-[state=active]:border-emerald-100 group/tab 
                                                        hover:bg-emerald-50/50 active:scale-95"
                                                    >
                                                        <BedDouble className="w-4 h-4 group-data-[state=active]/tab:scale-110 transition-transform" />
                                                        <span>Room & Food</span>
                                                    </TabsTrigger>
                                                    <TabsTrigger
                                                        value="verification"
                                                        className={`flex-1 rounded-full font-black uppercase text-[10px] tracking-[0.1em] gap-2 h-11 transition-all duration-300 relative group/tab active:scale-95 bg-transparent text-slate-500
                                                            data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:border border-transparent
                                                            ${(property.status === 'PENDING_VERIFICATION' || property.status === 'NEEDS_CORRECTION')
                                                                ? 'data-[state=active]:text-amber-600 data-[state=active]:border-amber-100 hover:bg-amber-50/50' 
                                                                : 'data-[state=active]:text-indigo-600 data-[state=active]:border-indigo-100 hover:bg-indigo-50/50'
                                                            }`}
                                                    >
                                                        <ShieldCheck className="w-4 h-4 group-data-[state=active]/tab:scale-110 transition-transform" />
                                                        <span>Verification</span>
                                                        {(property.status === 'PENDING_VERIFICATION' || property.status === 'NEEDS_CORRECTION') && (
                                                            <span className="absolute top-1 right-1 flex h-2.5 w-2.5" title="Action Required">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 border border-white shadow-sm"></span>
                                                            </span>
                                                        )}
                                                    </TabsTrigger>
                                                </TabsList>

                                                <TabsContent value="details" className="mt-0">
                                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                                                        {/* Owner Info */}
                                                        <div className="space-y-4">
                                                            <div className="flex justify-between items-center">
                                                                <h4 className="text-sm font-bold uppercase text-muted-foreground">Owner Details</h4>
                                                                {property.owner && (
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="sm" 
                                                                        className="h-6 text-[10px] font-black uppercase text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                                        onClick={() => setEditOwnerDialog({
                                                                            isOpen: true,
                                                                            userId: property.owner.id,
                                                                            name: property.owner.name,
                                                                            email: property.owner.email,
                                                                            phone: property.owner.phone
                                                                        })}
                                                                    >
                                                                        Edit Profile
                                                                    </Button>
                                                                )}
                                                            </div>
                                                            <div className="space-y-2 bg-indigo-50/20 p-4 rounded-xl border-2 border-indigo-50 shadow-inner">
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <UserIcon className="h-4 w-4 text-indigo-600" />
                                                                    <span className="font-bold text-slate-700">{property.ownerName || property.owner?.name || "Unknown"}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <Mail className="h-4 w-4 text-purple-600" /> {property.owner?.email || "Unknown"}
                                                                </div>
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <Phone className="h-4 w-4 text-purple-600" /> {property.phone || property.owner?.phone || "N/A"}
                                                                </div>
                                                                {property.onboardingPaymentMethod && (
                                                                    <div className="pt-2 border-t mt-2 flex flex-col gap-1">
                                                                        <span className="text-[10px] font-black uppercase text-emerald-600">Payment Verified</span>
                                                                        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                                                            {property.onboardingPaymentMethod === 'UPI' && <Smartphone className="h-4 w-4 text-emerald-500" />}
                                                                            {property.onboardingPaymentMethod === 'CARD' && <CreditCard className="h-4 w-4 text-emerald-500" />}
                                                                            {property.onboardingPaymentMethod === 'NETBANKING' && <Landmark className="h-4 w-4 text-emerald-500" />}
                                                                            {property.onboardingPaymentMethod}
                                                                        </div>
                                                                        <span className="text-[9px] text-muted-foreground">
                                                                            {property.onboardingPaidAt && new Date(property.onboardingPaidAt).toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Admin Notes / Context */}
                                                        {property.adminNotes && (
                                                            <div className="space-y-2 lg:col-span-2">
                                                                <h4 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-1">
                                                                    <AlertCircle className="h-4 w-4" /> Last Admin Note (Owner Feedback)
                                                                </h4>
                                                                <p className="text-sm bg-amber-50/50 text-amber-900 p-4 rounded-xl italic border-2 border-amber-100/50 shadow-inner">
                                                                    &quot;{property.adminNotes}&quot;
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* Property Description & Amenities */}
                                                        <div className="space-y-4 lg:col-span-3 border-t pt-6 mt-2">
                                                            <div className="flex justify-between items-center mb-4">
                                                                <h4 className="text-sm font-bold uppercase text-muted-foreground">Property Description & Amenities</h4>
                                                                <Button 
                                                                    variant="outline" 
                                                                    size="sm" 
                                                                    className="h-8 px-3 font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 uppercase text-[10px] tracking-widest border border-blue-200"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        
                                                                        // Attempt to parse existing address components
                                                                        let addr = property.address || "";
                                                                        let street = addr, po = "", city = property.city || "", state = "", pin = "";
                                                                        
                                                                        const pinRegex = /(.*),\s*(.*),\s*(.*),\s*(.*)\s*-\s*(\d{6}),\s*India/;
                                                                        const match = addr.match(pinRegex);
                                                                        
                                                                        if (match) {
                                                                            street = match[1];
                                                                            po = match[2];
                                                                            city = match[3];
                                                                            state = match[4];
                                                                            pin = match[5];
                                                                        }

                                                                        setEditPropertyDialog({
                                                                            isOpen: true,
                                                                            propertyId: property.id,
                                                                            name: property.name,
                                                                            address: street,
                                                                            pincode: pin,
                                                                            city: city,
                                                                            state: state,
                                                                            postOffice: po,
                                                                            description: property.description || "",
                                                                            amenities: property.amenities || "",
                                                                            foodType: property.foodType || "NOT_AVAILABLE",
                                                                            foodPricePerMonth: property.foodPricePerMonth || 0
                                                                        });
                                                                    }}
                                                                >
                                                                    Edit Details
                                                                </Button>
                                                            </div>
                                                            <div className="grid md:grid-cols-2 gap-6">
                                                                <div>
                                                                    <p className="text-sm whitespace-pre-wrap bg-indigo-50/10 p-4 rounded-xl border-2 border-indigo-50/50 shadow-inner">{property.description || "No description provided."}</p>
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
                                                        {/* Food & Mess Section */}
                                                        <div className="mb-8 bg-gradient-to-br from-orange-50 to-white p-6 rounded-3xl border-2 border-orange-100 shadow-sm relative overflow-hidden group">
                                                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                                                                <FileText className="w-24 h-24 text-orange-600" />
                                                            </div>
                                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                                                                <div className="space-y-1">
                                                                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-orange-600 mb-1">Food & Mess Service</h4>
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="p-2 bg-orange-100 rounded-xl">
                                                                           <CheckCircle className="w-5 h-5 text-orange-600" />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xl font-black text-slate-800 tracking-tight">
                                                                                {property.foodType === 'NONE' ? "No Food Service" : 
                                                                                 property.foodType === 'VEG' ? "Pure Vegetarian" :
                                                                                 property.foodType === 'BOTH' ? "Veg & Non-Veg" :
                                                                                 property.foodType === 'NON_VEG' ? "Non-Vegetarian" : "Not Specified"}
                                                                            </p>
                                                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Available for all tenants</p>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-6">
                                                                    <div className="h-12 w-px bg-orange-200 hidden md:block" />
                                                                    <div className="text-right">
                                                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-0.5 tracking-widest">Monthly Charge</p>
                                                                        <p className="text-2xl font-black text-orange-600">
                                                                            {property.foodPricePerMonth ? `₹${property.foodPricePerMonth.toLocaleString()}` : "₹0"}
                                                                            <span className="text-xs text-slate-400 font-bold ml-1 uppercase">/ Month</span>
                                                                        </p>
                                                                    </div>
                                                                    <Button 
                                                                        variant="outline" 
                                                                        size="sm" 
                                                                        className="h-10 px-4 font-black bg-white hover:bg-orange-600 hover:text-white text-orange-600 rounded-xl uppercase text-[10px] tracking-widest border-2 border-orange-200 shadow-sm transition-all active:scale-95"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            // Reuse edit property dialog for food info
                                                                            const addr = property.address || "";
                                                                            const street = addr, po = "", city = property.city || "", state = "", pin = "";
                                                                            setEditPropertyDialog({
                                                                                isOpen: true,
                                                                                propertyId: property.id,
                                                                                name: property.name,
                                                                                address: street,
                                                                                pincode: pin,
                                                                                city: city,
                                                                                state: state,
                                                                                postOffice: po,
                                                                                description: property.description || "",
                                                                                amenities: property.amenities || "",
                                                                                foodType: property.foodType || "NOT_AVAILABLE",
                                                                                foodPricePerMonth: property.foodPricePerMonth || 0
                                                                            });
                                                                        }}
                                                                    >
                                                                        Edit Food Details
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex justify-between items-center mb-4">
                                                            <h4 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                                                                Rooms Breakdown <Badge variant="outline">{property.rooms?.length || 0} Rooms</Badge>
                                                            </h4>
                                                            <Button 
                                                                size="sm" 
                                                                className="h-9 px-4 font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-100 flex items-center gap-2 group"
                                                                onClick={() => setAddRoomDialog({ isOpen: true, propertyId: property.id })}
                                                            >
                                                                <Plus className="w-3.5 h-3.5 mr-1 group-hover:rotate-90 transition-transform" />
                                                                Add New Room
                                                            </Button>
                                                        </div>

                                                        {property.rooms?.length === 0 ? (
                                                            <div className="text-center py-10 text-muted-foreground bg-emerald-50/10 rounded-xl border-2 border-dashed border-emerald-100">
                                                                No rooms added to this property yet.
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                                {property.rooms?.map((room: any) => (
                                                                    <div key={room.id} className="border-2 border-emerald-50 rounded-2xl p-4 text-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-xl hover:shadow-emerald-100 transition-all bg-white hover:-translate-y-1">
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
                                                                        <div className="relative z-10 mt-3 pt-3 border-t border-emerald-100 flex gap-2">
                                                                             <Button 
                                                                                 variant="ghost" 
                                                                                 size="sm" 
                                                                                 className="flex-1 h-9 text-[10px] font-black uppercase tracking-widest bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 rounded-xl transition-all border border-emerald-100"
                                                                                 onClick={(e) => {
                                                                                     e.stopPropagation();
                                                                                     setEditRoomDialog({
                                                                                         isOpen: true,
                                                                                         roomId: room.id,
                                                                                         roomNumber: room.roomNumber,
                                                                                         type: room.type,
                                                                                         price: room.price,
                                                                                         availability: room.availability,
                                                                                         depositMonths: room.depositMonths ?? 1,
                                                                                     });
                                                                                 }}
                                                                             >
                                                                                 Edit Room
                                                                             </Button>
                                                                         </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TabsContent>

                                                <TabsContent value="verification" className="mt-0">
                                                    <div className="pt-2 space-y-8">
                                                        <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                            <div>
                                                                <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                                                    <CheckCircle className="h-5 w-5 text-emerald-600" /> Document Verification
                                                                </h4>
                                                                <p className="text-xs text-muted-foreground">Review and approve property assets and legal documentation.</p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {property.status === 'CORRECTED' && (
                                                                    <Button 
                                                                        size="sm" 
                                                                        className="h-9 px-6 font-black bg-amber-600 hover:bg-amber-700 text-white rounded-xl uppercase text-[10px] tracking-[0.15em] shadow-lg shadow-amber-100 animate-pulse border-b-4 border-amber-800"
                                                                        onClick={() => setActionDialog({ isOpen: true, propertyId: property.id, propertyName: property.name, actionType: 'START_VERIFICATION', currentStatus: property.status })}
                                                                    >
                                                                        <RefreshCcw className="h-3.5 w-3.5 mr-2" /> Finish Review & Resume
                                                                    </Button>
                                                                )}
                                                                {property.owner && (
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="sm" 
                                                                        className="h-9 px-4 font-black bg-blue-50 text-blue-700 hover:bg-blue-100 uppercase text-[10px] tracking-widest border border-blue-200 shadow-sm"
                                                                        onClick={() => setEditOwnerDialog({
                                                                            isOpen: true,
                                                                            userId: property.owner.id,
                                                                            name: property.owner.name,
                                                                            email: property.owner.email,
                                                                            phone: property.owner.phone
                                                                        })}
                                                                    >
                                                                        <UserIcon className="h-4 w-4 mr-2" /> Correct Profile
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Section 1: Property Assets */}
                                                        <div className="space-y-4">
                                                            <div className="flex items-center gap-2 border-l-4 border-indigo-500 pl-4 py-1">
                                                                <h5 className="font-black text-xs uppercase tracking-[0.2em] text-indigo-700">Property Assets</h5>
                                                                <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-100 h-5">Visual Evidence</Badge>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                {[
                                                                    { key: 'buildingPhotos', label: 'Building Exterior', desc: 'Building/MAIN ENTRANCE / STREET VIEW', icon: <Building2 className="w-5 h-5" />, colorClass: 'text-indigo-600', bgClass: 'bg-indigo-50', borderClass: 'border-indigo-100', isArray: true, max: 4 },
                                                                    { key: 'commonAreaPhotos', label: 'Common Areas', desc: 'Hallway / Lobby / GYM/ Shared', icon: <Users className="w-5 h-5" />, colorClass: 'text-purple-600', bgClass: 'bg-purple-50', borderClass: 'border-purple-100', isArray: true, max: 4 },
                                                                    { key: 'roomsAndBathroomPhotos', label: 'Rooms & Bathroom', desc: 'Interior ROOMS & BATHROOMS', icon: <BedDouble className="w-5 h-5" />, colorClass: 'text-blue-600', bgClass: 'bg-blue-50', borderClass: 'border-blue-100', isArray: true, max: 4 },
                                                                    { key: 'parkingPhotos', label: 'Parking Area', desc: 'BIKE & CAR PARKING', icon: <ParkingCircle className="w-5 h-5" />, colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-100', isArray: true, max: 2 },
                                                                    { key: 'amenitiesPhotos', label: 'Other Amenities', desc: 'Fridge/TV/Washing / oTHERS', icon: <ImageIcon className="w-5 h-5" />, colorClass: 'text-cyan-600', bgClass: 'bg-cyan-50', borderClass: 'border-cyan-100', isArray: true, max: 4 },
                                                                ].map(cat => renderAdminCategory(property, cat))}
                                                            </div>
                                                        </div>

                                                        {/* Section 2: Legal Documentation */}
                                                        <div className="space-y-4 pt-6 border-t border-slate-100">
                                                            <div className="flex items-center gap-2 border-l-4 border-emerald-500 pl-4 py-1">
                                                                <h5 className="font-black text-xs uppercase tracking-[0.2em] text-emerald-700">Legal Documentation</h5>
                                                                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 h-5">Identity & Compliance</Badge>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                {[
                                                                    { key: 'aadhaarProof', label: 'Aadhaar Card', desc: 'FRONT & BACK REQUIRED', icon: <FileText className="w-5 h-5" />, colorClass: 'text-amber-600', bgClass: 'bg-amber-50', borderClass: 'border-amber-100', isArray: true, max: 2 },
                                                                    { key: 'panProof', label: 'PAN Card', desc: 'PAN Card INDIVIDUAL OR BUSINESS', icon: <FileText className="w-5 h-5" />, colorClass: 'text-rose-600', bgClass: 'bg-rose-50', borderClass: 'border-rose-100', isArray: true, max: 2 },
                                                                    { key: 'pgLicenceUrl', label: 'Trade Licence', desc: 'GOVT PERMIT / LICENCE', icon: <ShieldCheck className="w-5 h-5" />, colorClass: 'text-indigo-600', bgClass: 'bg-indigo-50', borderClass: 'border-indigo-100', isArray: true, max: 2 },
                                                                    { key: 'livePhotoUrl', label: 'Photo', desc: 'Current photo of the person', icon: <Camera className="w-5 h-5" />, colorClass: 'text-red-600', bgClass: 'bg-red-50', borderClass: 'border-red-100' }
                                                                ].map(cat => renderAdminCategory(property, cat))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TabsContent>
                                            </Tabs>
                                </CardContent>
                                </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Action Dialog */}
            <Dialog open={!!actionDialog} onOpenChange={(open: boolean) => !open && setActionDialog(null)}>
                <DialogContent showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle>
                            {actionDialog?.actionType === 'REJECT' ? "Reject Property" :
                             actionDialog?.actionType === 'START_VERIFICATION' ? "Start Verification" :
                             actionDialog?.actionType === 'VERIFY_DOCS' ? "Documents Verified" :
                             actionDialog?.actionType === 'REQUIRE_PAYMENT' ? "Require Payment" :
                             actionDialog?.actionType === 'NEEDS_CORRECTION' ? "Request Correction" :
                             actionDialog?.actionType === 'SUSPEND' ? "Suspend Property" :
                             actionDialog?.actionType === 'ACTIVATE' ? "Activate Property (Go Live)" :
                             actionDialog?.actionType === 'ROLLBACK' ? "Rollback Status (Move Back)" :
                             "Exempt Fee & Approve"}
                        </DialogTitle>
                        <DialogDescription asChild>
                            <div className="space-y-4">
                                <div className="text-slate-500 font-medium pb-2 border-b border-slate-100">
                                    You are about to perform this action on <strong>{actionDialog?.propertyName}</strong>.
                                </div>
                                
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <div className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-2 flex items-center gap-2">
                                        <AlertCircle className="h-3.5 w-3.5" /> Action Guidelines
                                    </div>
                                    <div className="text-[13px] font-bold text-slate-700 leading-relaxed mb-3">
                                        {actionDialog?.actionType === 'START_VERIFICATION' && "Click this only if the basic property info is correct and you're ready to check the owner's documents."}
                                        {actionDialog?.actionType === 'VERIFY_DOCS' && "Click this only after you have checked every document and confirmed they are all correct."}
                                        {actionDialog?.actionType === 'REQUIRE_PAYMENT' && "Confirm Request for Platform Fee (₹99). This will notify the owner to pay the default onboarding amount to push their property live."}
                                        {actionDialog?.actionType === 'EXEMPT_FEE' && "Click this only if you are allowed to skip the fee for this property."}
                                        {actionDialog?.actionType === 'ACTIVATE' && (
                                            actionDialog?.currentStatus === 'SUSPENDED' 
                                            ? "Click this only when the reason for suspension has been solved and the property is safe to go live again."
                                            : "Click this only when the payment is confirmed and the property is ready to be seen by everyone."
                                        )}
                                        {actionDialog?.actionType === 'ROLLBACK' && "Click this only to fix a mistake or accidental click. Briefly explain what happened for the history log."}
                                        {actionDialog?.actionType === 'NEEDS_CORRECTION' && "Click this only if some details are wrong or missing. Tell the owner exactly what they need to fix."}
                                        {actionDialog?.actionType === 'REJECT' && "Click this only if the property violates our rules and cannot be approved. This is usually a final decision."}
                                        {actionDialog?.actionType === 'SUSPEND' && "Click this only for urgent safety or policy issues while a property is already live."}
                                    </div>

                                    {actionDialog?.actionType === 'ACTIVATE' && actionDialog?.currentStatus === 'SUSPENDED' && actionDialog?.currentNotes && (
                                        <div className="mt-4 pt-4 border-t border-slate-200">
                                            <div className="text-[10px] font-black uppercase text-red-500 mb-1 flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3" /> Original Suspension Reason
                                            </div>
                                            <div className="text-xs bg-red-50 p-3 rounded-lg border border-red-100 text-red-700 font-medium italic italic">
                                                "{actionDialog.currentNotes}"
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    {(actionDialog?.actionType === 'REJECT' || actionDialog?.actionType === 'NEEDS_CORRECTION' || actionDialog?.actionType === 'SUSPEND' || actionDialog?.actionType === 'ROLLBACK' || actionDialog?.actionType === 'EXEMPT_FEE' || (actionDialog?.actionType === 'ACTIVATE' && actionDialog?.currentStatus === 'SUSPENDED')) && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold flex items-center gap-1">
                                    {(actionDialog?.actionType === 'ROLLBACK' || actionDialog?.actionType === 'ACTIVATE' || actionDialog?.actionType === 'EXEMPT_FEE') ? "Internal Audit Note / Reason (Private)" : "Admin Notes / Instructions for Owner"}
                                    <span className="text-red-500">*</span>
                                </label>
                                <Textarea
                                    placeholder={
                                        actionDialog?.actionType === 'ROLLBACK' ? "E.g. Correcting accidental click/Internal status error..." :
                                        actionDialog?.actionType === 'EXEMPT_FEE' ? "E.g. Partnership agreement/Verified offline payment..." :
                                        actionDialog?.actionType === 'ACTIVATE' ? "E.g. Issues solved by owner/Policy compliance verified..." :
                                        actionDialog?.actionType === 'NEEDS_CORRECTION' ? "E.g. Please upload a clear photo of the bathroom." : 
                                        "E.g. Violation of terms..."
                                    }
                                    value={adminNotes}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAdminNotes(e.target.value)}
                                    rows={4}
                                    className="bg-white border-2 border-muted-foreground/30 focus-visible:ring-indigo-500"
                                />
                                <p className="text-[10px] text-muted-foreground uppercase">
                                    {(actionDialog?.actionType === 'ROLLBACK' || actionDialog?.actionType === 'ACTIVATE' || actionDialog?.actionType === 'EXEMPT_FEE')
                                        ? "This note is for internal audit logs only and will NOT be sent to the owner." 
                                        : "This message will be permanently logged and sent directly to the owner."}
                                </p>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex flex-row items-center justify-end gap-3 sm:gap-4 !space-x-0 pt-4">
                        <button 
                            onClick={() => setActionDialog(null)} 
                            disabled={processing}
                            className="px-8 py-3 text-xs font-black bg-red-600 hover:bg-red-700 text-white rounded-full transition-all active:scale-95 shadow-lg shadow-red-200 uppercase tracking-widest border border-red-700/30"
                        >
                            CANCEL
                        </button>
                        <button
                            className={cn(
                                "px-10 py-3 text-xs font-black rounded-full text-white transition-all active:scale-95 shadow-lg flex items-center gap-2",
                                (actionDialog?.actionType === 'REJECT' || actionDialog?.actionType === 'SUSPEND') 
                                    ? "bg-red-600 hover:bg-red-700 shadow-red-200" 
                                    : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                            )}
                            onClick={handleConfirmAction}
                            disabled={processing}
                        >
                            {processing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                            {processing ? "PROCESSING..." : "CONFIRM ACTION"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reupload Request Dialog */}
            <Dialog open={!!reuploadDialog} onOpenChange={(open: boolean) => !open && setReuploadDialog(null)}>
                <DialogContent className="max-w-md rounded-2xl" showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-black text-orange-600">
                            <RefreshCcw className="w-6 h-6" />
                            Request Reupload: {reuploadDialog?.label}
                        </DialogTitle>
                        <DialogDescription className="font-medium text-slate-500">
                            Ask the owner to reupload this specific document. They will see your reason on their dashboard.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Reason for Reupload</label>
                            <Textarea
                                placeholder="e.g. Photo is blurry, document is expired, wrong side uploaded..."
                                value={reuploadNote}
                                onChange={(e) => setReuploadNote(e.target.value)}
                                className="min-h-[120px] rounded-xl border-slate-200 focus:ring-orange-500/20"
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex flex-row items-center justify-end gap-3 sm:gap-4 !space-x-0 pt-4">
                        <button 
                            onClick={() => setReuploadDialog(null)} 
                            className="px-8 py-3 text-xs font-black bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-full transition-all active:scale-95 shadow-sm uppercase tracking-widest"
                            disabled={processing}
                        >
                            CANCEL
                        </button>
                        <button
                            className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs px-10 py-3 rounded-full shadow-lg shadow-orange-100 transition-all active:scale-95 flex items-center gap-2"
                            onClick={handleRequestReupload}
                            disabled={processing}
                        >
                            {processing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                            {processing ? "SENDING..." : "SEND REQUEST"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Admin Delete Confirmation Dialog */}
            <Dialog open={!!deleteDialog?.isOpen} onOpenChange={(open) => !open && setDeleteDialog(null)}>
                <DialogContent className="max-w-md rounded-2xl" showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-black text-red-600">
                            <Trash2 className="w-6 h-6" />
                            Confirm Delete: {deleteDialog?.label}
                        </DialogTitle>
                        <DialogDescription className="font-medium text-slate-500">
                            Permanently delete this document? This action cannot be reversed.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Deletion Reason / Note</label>
                            <Textarea
                                placeholder="e.g. Inappropriate content, duplicated document, admin cleanup..."
                                value={deleteNote}
                                onChange={(e) => setDeleteNote(e.target.value)}
                                className="min-h-[100px] rounded-xl border-slate-200 focus:ring-red-500/20"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <button 
                            onClick={() => setDeleteDialog(null)} 
                            className="px-8 py-3 text-xs font-black bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-full transition-all active:scale-95 shadow-sm uppercase tracking-widest"
                            disabled={processing}
                        >
                            CANCEL
                        </button>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white font-black rounded-xl px-10 shadow-lg shadow-red-100 transition-all active:scale-95 border-b-4 border-red-800"
                            onClick={async () => {
                                if (!deleteNote.trim()) {
                                    toast({ title: "Reason Required", description: "Please provide a reason for deletion.", variant: "destructive" });
                                    return;
                                }
                                if (deleteDialog) {
                                    await handleAdminDelete(deleteDialog.propertyId, deleteDialog.docType, deleteDialog.index);
                                    setDeleteDialog(null);
                                    setDeleteNote("");
                                }
                            }}
                            disabled={processing}
                        >
                            {processing ? "Deleting..." : "Confirm Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Quick Edit Owner Dialog */}
            <Dialog open={!!editOwnerDialog?.isOpen} onOpenChange={(open) => !open && setEditOwnerDialog(null)}>
                <DialogContent className="sm:max-w-[425px] rounded-2xl" showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-black">
                            <UserIcon className="h-5 w-5 text-blue-600" /> Correct Owner Details
                        </DialogTitle>
                        <DialogDescription className="font-medium text-slate-500">
                            Update profile details if they mismatch the documents.
                        </DialogDescription>
                    </DialogHeader>
                    {editOwnerDialog && (
                        <div className="grid gap-6 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name</Label>
                                <Input 
                                    id="name" 
                                    value={editOwnerDialog.name} 
                                    onChange={(e) => setEditOwnerDialog({...editOwnerDialog, name: e.target.value})}
                                    className="h-11 rounded-xl border-slate-200 focus:ring-blue-500/20"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Address</Label>
                                <Input 
                                    id="email" 
                                    type="email"
                                    value={editOwnerDialog.email} 
                                    onChange={(e) => setEditOwnerDialog({...editOwnerDialog, email: e.target.value})}
                                    className="h-11 rounded-xl border-slate-200 focus:ring-blue-500/20"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number</Label>
                                <div className="flex">
                                    <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 bg-slate-50 text-xs font-bold text-slate-500">+91</span>
                                    <Input 
                                        id="phone" 
                                        value={editOwnerDialog.phone.replace('+91', '')} 
                                        onChange={(e) => setEditOwnerDialog({...editOwnerDialog, phone: e.target.value})}
                                        className="h-11 rounded-l-none rounded-r-xl border-slate-200 focus:ring-blue-500/20"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2 sm:gap-0">
                        <button 
                            onClick={() => setEditOwnerDialog(null)} 
                            className="px-8 py-3 text-xs font-black bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-full transition-all active:scale-95 shadow-sm uppercase tracking-widest"
                        >
                            CANCEL
                        </button>
                        <Button 
                            onClick={handleUpdateOwner} 
                            disabled={processing}
                            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black px-6 shadow-lg shadow-blue-100"
                        >
                            {processing ? <RefreshCcw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Admin Edit Property Dialog */}
            <Dialog open={!!editPropertyDialog?.isOpen} onOpenChange={(open) => !open && setEditPropertyDialog(null)}>
                <DialogContent className="sm:max-w-[550px] rounded-[32px] border-2 border-blue-50 shadow-2xl p-0 overflow-hidden" showCloseButton={false}>
                    <div className="bg-gradient-to-br from-blue-50/50 to-white p-6 border-b border-blue-100/50 relative">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-3 text-2xl font-black text-slate-800 tracking-tight">
                                <div className="p-2.5 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
                                    <Building2 className="w-6 h-6 text-white" />
                                </div>
                                Edit Property Details
                            </DialogTitle>
                            <DialogDescription className="font-semibold text-slate-400 mt-1 uppercase text-[10px] tracking-widest pl-1">
                                Update verification records and property identity
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    {editPropertyDialog && (
                        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            <div className="space-y-2 group">
                                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-600 transition-colors ml-1">Property Name / Title</Label>
                                <Input 
                                    value={editPropertyDialog.name} 
                                    onChange={(e) => setEditPropertyDialog({...editPropertyDialog, name: e.target.value})}
                                    className="h-14 rounded-2xl border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-slate-700 transition-all shadow-sm"
                                    placeholder="Enter property name..."
                                />
                            </div>

                            <div className="space-y-2 group">
                                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-600 transition-colors ml-1">Street / Locality / Landmark</Label>
                                <Input 
                                    value={editPropertyDialog.address} 
                                    onChange={(e) => setEditPropertyDialog({...editPropertyDialog, address: e.target.value})}
                                    className="h-14 rounded-2xl border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-slate-700 transition-all shadow-sm"
                                    placeholder="123 Main St, Near landmark..."
                                />
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="space-y-2 group">
                                    <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-600 transition-colors ml-1">
                                        PIN Code {pinFetching && <RefreshCcw className="w-3 h-3 animate-spin inline ml-1 text-blue-500" />}
                                    </Label>
                                    <Input 
                                        maxLength={6}
                                        value={editPropertyDialog.pincode} 
                                        onChange={(e) => setEditPropertyDialog({...editPropertyDialog, pincode: e.target.value.replace(/\D/g, "").slice(0, 6)})}
                                        className="h-14 rounded-2xl border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-slate-700 transition-all shadow-sm tracking-widest"
                                        placeholder="560001"
                                    />
                                    {pinError && <p className="text-[10px] text-red-500 font-bold mt-1 ml-1">{pinError}</p>}
                                </div>
                                <div className="space-y-2 group">
                                    <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-600 transition-colors ml-1">Post Office</Label>
                                    {pinOffices.length > 0 ? (
                                        <select 
                                            value={editPropertyDialog.postOffice}
                                            onChange={(e) => setEditPropertyDialog({...editPropertyDialog, postOffice: e.target.value})}
                                            className="w-full h-14 rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-sm appearance-none"
                                        >
                                            {pinOffices.map((off, i) => (
                                                <option key={i} value={off.Name}>{off.Name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <Input 
                                            value={editPropertyDialog.postOffice} 
                                            onChange={(e) => setEditPropertyDialog({...editPropertyDialog, postOffice: e.target.value})}
                                            className="h-14 rounded-2xl border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-slate-700 transition-all shadow-sm"
                                            placeholder="Locality"
                                        />
                                    )}
                                </div>
                                <div className="space-y-2 group">
                                    <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-600 transition-colors ml-1">City</Label>
                                    <Input 
                                        value={editPropertyDialog.city} 
                                        onChange={(e) => setEditPropertyDialog({...editPropertyDialog, city: e.target.value})}
                                        className="h-14 rounded-2xl border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-slate-700 transition-all shadow-sm"
                                        placeholder="City"
                                    />
                                </div>
                                <div className="space-y-2 group">
                                    <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-600 transition-colors ml-1">State</Label>
                                    <Input 
                                        value={editPropertyDialog.state} 
                                        onChange={(e) => setEditPropertyDialog({...editPropertyDialog, state: e.target.value})}
                                        className="h-14 rounded-2xl border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-slate-700 transition-all shadow-sm"
                                        placeholder="State"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 group">
                                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-600 transition-colors ml-1">Property Description</Label>
                                <Textarea 
                                    value={editPropertyDialog.description} 
                                    onChange={(e) => setEditPropertyDialog({...editPropertyDialog, description: e.target.value})}
                                    className="min-h-[120px] rounded-2xl border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-slate-700 transition-all shadow-sm p-4"
                                    placeholder="Describe the property..."
                                />
                            </div>
                            
                            <div className="space-y-2 group">
                                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-600 transition-colors ml-1">Amenities (Comma separated)</Label>
                                <Input 
                                    value={editPropertyDialog.amenities} 
                                    onChange={(e) => setEditPropertyDialog({...editPropertyDialog, amenities: e.target.value})}
                                    className="h-14 rounded-2xl border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-slate-700 transition-all shadow-sm"
                                    placeholder="WiFi, AC, Food..."
                                />
                            </div>

                            <div className="p-6 bg-orange-50/50 rounded-3xl border-2 border-orange-100 space-y-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 bg-orange-600 rounded-lg">
                                        <FileText className="w-4 h-4 text-white" />
                                    </div>
                                    <h4 className="text-xs font-black uppercase tracking-widest text-orange-700">Food & Mess Settings</h4>
                                </div>
                                
                                <div className="space-y-4">
                                     <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Food Service Selection</Label>
                                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                         {([
                                             { val: 'NOT_AVAILABLE', emoji: '🚫', title: 'Not Available', desc: 'No food service' },
                                             { val: 'INCLUDED', emoji: '🍱', title: 'Included in Rent', desc: 'Meals included' },
                                             { val: 'OPTIONAL', emoji: '🍴', title: 'Optional (Add-on)', desc: 'Opt in/out' },
                                         ] as const).map(opt => (
                                             <button
                                                 key={opt.val}
                                                 type="button"
                                                 onClick={() => setEditPropertyDialog({...editPropertyDialog, foodType: opt.val})}
                                                 className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col gap-1 ${
                                                     editPropertyDialog.foodType === opt.val
                                                         ? "bg-orange-600 border-orange-600 text-white shadow-lg scale-[1.02]"
                                                         : "bg-white border-slate-100 text-slate-700 hover:border-orange-200 hover:bg-orange-50"
                                                 }`}
                                             >
                                                 <span className="text-2xl">{opt.emoji}</span>
                                                 <span className="text-[10px] font-black uppercase tracking-widest leading-none mt-1">{opt.title}</span>
                                                 <span className={`text-[9px] font-medium ${editPropertyDialog.foodType === opt.val ? 'text-orange-100' : 'text-slate-400'}`}>{opt.desc}</span>
                                             </button>
                                         ))}
                                     </div>
 
                                     {/* Conditional price input for OPTIONAL */}
                                     {editPropertyDialog.foodType === 'OPTIONAL' && (
                                         <div className="animate-in fade-in slide-in-from-top-2 duration-300 bg-orange-100/30 p-4 rounded-2xl border-2 border-orange-200">
                                             <Label className="text-[11px] font-black text-orange-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                 Monthly Food Charge (₹)
                                             </Label>
                                             <div className="relative">
                                                 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-600 font-bold">₹</div>
                                                 <Input 
                                                     type="number"
                                                     value={editPropertyDialog.foodPricePerMonth} 
                                                     onChange={(e) => setEditPropertyDialog({...editPropertyDialog, foodPricePerMonth: parseFloat(e.target.value) || 0})}
                                                     className="h-14 rounded-2xl border-orange-200 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 font-black text-orange-600 pl-8 transition-all shadow-sm bg-white"
                                                 />
                                             </div>
                                             <p className="text-[9px] text-orange-600 font-bold mt-2 uppercase tracking-tight">
                                                 Students can opt in/out for this monthly price.
                                             </p>
                                         </div>
                                     )}
                                     {editPropertyDialog.foodType === 'INCLUDED' && (
                                         <div className="animate-in fade-in slide-in-from-top-2 duration-300 bg-green-50 p-4 rounded-2xl border-2 border-green-200">
                                             <p className="text-xs font-bold text-green-700 flex items-center gap-2 uppercase tracking-tight">
                                                 ✅ Meals are included in rent.
                                             </p>
                                         </div>
                                     )}
                                     {editPropertyDialog.foodType === 'NOT_AVAILABLE' && (
                                         <div className="animate-in fade-in slide-in-from-top-2 duration-300 bg-slate-50 p-4 rounded-2xl border-2 border-slate-200">
                                             <p className="text-xs font-bold text-slate-500 flex items-center gap-2 uppercase tracking-tight">
                                                 🚫 No food service provided.
                                             </p>
                                         </div>
                                     )}
                                 </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end gap-3">
                        <button 
                            onClick={() => setEditPropertyDialog(null)} 
                            className="px-8 py-3 text-xs font-black bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-full transition-all active:scale-95 shadow-sm uppercase tracking-widest"
                        >
                            CANCEL
                        </button>
                        <Button 
                            onClick={handleUpdateProperty} 
                            disabled={processing}
                            className="h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black px-8 shadow-xl shadow-blue-200 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                        >
                            {processing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            UPDATE PROPERTY
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Admin Edit Room Dialog */}
            <Dialog open={!!editRoomDialog?.isOpen} onOpenChange={(open) => !open && setEditRoomDialog(null)}>
                <DialogContent className="sm:max-w-[450px] rounded-[32px] border-2 border-emerald-50 shadow-2xl p-0 overflow-hidden" showCloseButton={false}>
                    <div className="bg-gradient-to-br from-emerald-50/50 to-white p-6 border-b border-emerald-100/50 relative">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-3 text-2xl font-black text-slate-800 tracking-tight">
                                <div className="p-2.5 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-200">
                                    <BedDouble className="w-6 h-6 text-white" />
                                </div>
                                Edit Room Details
                            </DialogTitle>
                            <DialogDescription className="font-semibold text-slate-400 mt-1 uppercase text-[10px] tracking-widest pl-1">
                                Manage inventory and pricing strategy
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    {editRoomDialog && (
                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2 group">
                                    <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-emerald-600 transition-colors ml-1">Room Number</Label>
                                    <Input 
                                        value={editRoomDialog.roomNumber} 
                                        onChange={(e) => setEditRoomDialog({...editRoomDialog, roomNumber: e.target.value})}
                                        className="h-14 rounded-2xl border-slate-200 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-black text-slate-700 transition-all shadow-sm"
                                        placeholder="101"
                                    />
                                </div>
                                <div className="space-y-2 group">
                                    <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-emerald-600 transition-colors ml-1">Bed Type</Label>
                                    <select 
                                        value={editRoomDialog.type}
                                        onChange={(e) => {
                                            const type = e.target.value;
                                            let autoAvail = editRoomDialog.availability;
                                            if (type === "Single Sharing") autoAvail = 1;
                                            if (type === "Double Sharing") autoAvail = 2;
                                            if (type === "Three Sharing") autoAvail = 3;
                                            if (type === "Four Sharing") autoAvail = 4;
                                            if (type === "Five Sharing") autoAvail = 5;
                                            if (type === "Six Sharing") autoAvail = 6;
                                            setEditRoomDialog({...editRoomDialog, type, availability: autoAvail});
                                        }}
                                        className="w-full h-14 rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-sm appearance-none"
                                    >
                                        <option value="Single Sharing">Single Sharing (1)</option>
                                        <option value="Double Sharing">Double Sharing (2)</option>
                                        <option value="Three Sharing">Three Sharing (3)</option>
                                        <option value="Four Sharing">Four Sharing (4)</option>
                                        <option value="Five Sharing">Five Sharing (5)</option>
                                        <option value="Six Sharing">Six Sharing (6)</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2 group">
                                    <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-emerald-600 transition-colors ml-1">Monthly Price (₹)</Label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</div>
                                        <Input 
                                            type="number"
                                            value={editRoomDialog.price} 
                                            onChange={(e) => setEditRoomDialog({...editRoomDialog, price: parseFloat(e.target.value)})}
                                            className="h-14 rounded-2xl border-slate-200 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 font-black text-emerald-600 pl-8 transition-all shadow-sm"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2 group">
                                    <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-emerald-600 transition-colors ml-1">Beds Available</Label>
                                    <Input 
                                        type="number"
                                        readOnly
                                        value={editRoomDialog.availability} 
                                        className="h-14 rounded-2xl border-slate-200 bg-slate-50 cursor-not-allowed font-black text-slate-700 transition-all shadow-sm"
                                    />
                                </div>
                            </div>
                            
                            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                                <p className="text-[10px] text-emerald-700 font-bold leading-relaxed">
                                    Adding beds will automatically generate new bed ID records. Removing beds is only possible if they are not currently occupied.
                                </p>
                            </div>

                            {/* Security Deposit — MTA 2021 */}
                            <div className="space-y-2">
                                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-emerald-600 transition-colors ml-1">
                                    Security Deposit Months <span className="text-red-500">*</span>
                                </Label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[1, 2].map(m => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => setEditRoomDialog({ ...editRoomDialog!, depositMonths: m })}
                                            className={`h-16 rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all font-black text-sm ${
                                                editRoomDialog?.depositMonths === m
                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-4 ring-emerald-100'
                                                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                                            }`}
                                        >
                                            <span>{m} Month{m > 1 ? 's' : ''}</span>
                                            <span className="text-[10px] font-normal opacity-70">₹{((editRoomDialog?.price || 0) * m).toLocaleString('en-IN')}</span>
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[9px] text-slate-400 ml-1">Per Model Tenancy Act 2021 — Maximum 2 months for residential PG/Hostel • Deposit is refundable</p>
                            </div>
                        </div>
                    )}
                    
                    <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end gap-3">
                        <Button 
                            variant="default" 
                            onClick={() => setEditRoomDialog(null)} 
                            className="rounded-full font-black text-xs uppercase tracking-widest h-10 px-8 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200 hover:shadow-red-300 transition-all active:scale-95"
                        >
                            CANCEL
                        </Button>
                        <Button 
                            onClick={handleUpdateRoom} 
                            disabled={processing}
                            className="h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 shadow-xl shadow-emerald-200 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                        >
                            {processing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            SAVE ROOM
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Admin Add Room Dialog */}
            <Dialog open={addRoomDialog?.isOpen} onOpenChange={(open: boolean) => !open && setAddRoomDialog(null)}>
                <DialogContent className="max-w-md p-0 overflow-hidden rounded-[32px] border-none shadow-[0_32px_128px_-16px_rgba(0,0,0,0.3)]">
                    <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-indigo-900 p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl animate-pulse" />
                        <div className="relative z-10">
                            <h2 className="text-3xl font-black tracking-tighter uppercase mb-2">New Room Asset</h2>
                            <p className="text-indigo-100 text-[11px] font-bold tracking-widest uppercase opacity-80">Add structural unit to property listing</p>
                        </div>
                    </div>
                    
                    <div className="p-8 space-y-6 bg-white">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Identity Tag</Label>
                                <div className="relative group">
                                    <Input 
                                        placeholder="e.g. 101, Suite A" 
                                        className="h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 font-black text-slate-900 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all text-lg"
                                        value={newRoomData.roomNumber}
                                        onChange={(e) => setNewRoomData({ ...newRoomData, roomNumber: e.target.value })}
                                    />
                                    <Building2 className="absolute right-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Occupancy</Label>
                                    <div className="relative">
                                        <select 
                                            className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 font-bold text-slate-700 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                            value={newRoomData.type}
                                            onChange={(e) => {
                                                const type = e.target.value;
                                                let autoAvail = 1;
                                                if (type === "Double Sharing") autoAvail = 2;
                                                if (type === "Triple Sharing") autoAvail = 3;
                                                if (type === "Four Sharing") autoAvail = 4;
                                                setNewRoomData({...newRoomData, type, availability: autoAvail});
                                            }}
                                        >
                                            <option>Single Sharing</option>
                                            <option>Double Sharing</option>
                                            <option>Triple Sharing</option>
                                            <option>Four Sharing</option>
                                        </select>
                                        <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Beds</Label>
                                    <Input 
                                        type="number" 
                                        readOnly
                                        className="h-14 bg-slate-100 border-2 border-slate-100 rounded-2xl px-5 font-black text-slate-500 cursor-not-allowed"
                                        value={newRoomData.availability}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Financial Allocation (Rent)</Label>
                                <div className="relative group">
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-xl group-focus-within:text-green-600 transition-colors">₹</span>
                                    <Input 
                                        type="number" 
                                        className="h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl pl-10 pr-5 font-black text-slate-900 focus:ring-4 focus:ring-green-50 focus:border-green-500 transition-all text-2xl"
                                        value={newRoomData.price}
                                        onChange={(e) => setNewRoomData({ ...newRoomData, price: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            {/* Security Deposit — MTA 2021 Compliant */}
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                    Security Deposit <span className="text-amber-500">*</span> (MTA 2021 — Max 2 Months)
                                </Label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[1, 2].map(m => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => setNewRoomData({ ...newRoomData, depositMonths: m })}
                                            className={`h-16 rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all font-black text-sm ${
                                                newRoomData.depositMonths === m
                                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-4 ring-indigo-100'
                                                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                                            }`}
                                        >
                                            <span>{m} Month{m > 1 ? 's' : ''}</span>
                                            <span className="text-[10px] font-normal opacity-70">₹{((newRoomData.price || 0) * m).toLocaleString('en-IN')}</span>
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[9px] text-slate-400 ml-1">Max 2 months per Model Tenancy Act, 2021 • Refundable upon vacating</p>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button 
                                variant="destructive" 
                                className="flex-1 h-16 rounded-2xl font-black uppercase text-[11px] tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-100"
                                onClick={() => setAddRoomDialog(null)}
                            >
                                Cancel
                            </Button>
                            <Button 
                                className="flex-[2] h-16 rounded-2xl font-black uppercase text-[11px] tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-3 group"
                                onClick={handleAddRoom}
                                disabled={processing}
                            >
                                {processing ? (
                                    <RefreshCcw className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                                        Initialize Room
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Image Preview Dialog */}
            <Dialog open={!!viewDialog} onOpenChange={(open) => !open && setViewDialog(null)}>
                <DialogContent className="max-w-[95vw] md:max-w-7xl p-0 overflow-hidden border-none shadow-2xl bg-slate-950">
                    {viewDialog && (() => {
                        const property = properties.find(p => p.id === viewDialog.propertyId);
                        if (!property) return null;

                        const photos = viewDialog.isArray ? safeParse(property[viewDialog.catKey]) : [property[viewDialog.catKey]];
                        const contentUrl = typeof photos[viewDialog.index || 0] === 'string' 
                            ? photos[viewDialog.index || 0] 
                            : (photos[viewDialog.index || 0]?.url || "");
                        const photoCount = photos.length;
                        const docKey = viewDialog.isArray ? `${viewDialog.catKey}-${viewDialog.index}` : viewDialog.catKey;
                        const isVerified = property.verifiedDocs && safeParse(property.verifiedDocs).includes(docKey);

                        return (
                            <div className="flex flex-col h-[90vh]">
                                {/* Hidden Title for Accessibility */}
                                <div className="sr-only">
                                    <DialogHeader>
                                        <DialogTitle>{viewDialog.label} - {viewDialog.desc}</DialogTitle>
                                    </DialogHeader>
                                </div>

                                {/* Top: Expanded Media Preview */}
                                <div 
                                    className="relative flex-1 flex items-center justify-center overflow-hidden"
                                    style={{ background: 'radial-gradient(circle at center, #1e1b4b 0%, #020617 50%, #000000 100%)' }}
                                >
                                    {/* Advanced Blurry Overlay (Admin's Signature Professional Look) */}
                                    <div className="absolute inset-0 opacity-30 pointer-events-none overflow-hidden">
                                        <img 
                                            src={contentUrl} 
                                            className="w-full h-full object-cover blur-3xl scale-150" 
                                        />
                                    </div>

                                    {/* Background Glow */}
                                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-full w-full bg-blue-600/10 blur-[120px] rounded-full opacity-30 z-0" />

                                    {!contentUrl ? (
                                        <p className="text-white relative z-10">Image not found</p>
                                    ) : contentUrl.endsWith(".pdf") ? (
                                        <div className="flex flex-col items-center text-white gap-4 w-full h-full justify-center bg-slate-900/50 relative z-10">
                                            <div className="bg-blue-500/10 p-8 rounded-full">
                                                <FileText className="w-24 h-24 text-blue-400" />
                                            </div>
                                            <div className="text-center">
                                                <h3 className="text-xl font-bold">PDF Document Preview</h3>
                                                <p className="text-slate-400 mt-1">Direct preview limited for PDF types</p>
                                            </div>
                                            <Button size="lg" variant="secondary" className="font-bold uppercase tracking-widest mt-4 h-14 px-10" onClick={() => window.open(contentUrl)}>
                                                Open High-Res PDF
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="relative z-10 w-full h-full flex items-center justify-center transition-transform duration-300 ease-out" style={{ transform: `scale(${previewZoom})` }}>
                                                <img 
                                                    src={contentUrl} 
                                                    className="max-w-full max-h-full object-contain animate-in fade-in zoom-in-95 duration-500 shadow-2xl rounded-lg" 
                                                />
                                            </div>

                                            {/* Floating Zoom Controls */}
                                            <div className="absolute bottom-6 inset-x-0 flex justify-center z-50 pointer-events-none">
                                                <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-xl p-1.5 rounded-2xl border border-white/20 shadow-2xl pointer-events-auto">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        onClick={() => setPreviewZoom(prev => Math.max(0.25, prev - 0.25))}
                                                        className="w-10 h-10 rounded-xl text-white hover:bg-white/10"
                                                    >
                                                        <ZoomOut className="w-5 h-5" />
                                                    </Button>
                                                    <div className="w-12 text-center text-[10px] font-black text-white uppercase tracking-tighter">
                                                        {Math.round(previewZoom * 100)}%
                                                    </div>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        onClick={() => setPreviewZoom(prev => Math.min(5, prev + 0.25))}
                                                        className="w-10 h-10 rounded-xl text-white hover:bg-white/10"
                                                    >
                                                        <ZoomIn className="w-5 h-5" />
                                                    </Button>
                                                    <div className="w-px h-6 bg-white/10 mx-1" />
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={() => setPreviewZoom(1)}
                                                        className="px-4 h-10 rounded-xl text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
                                                    >
                                                        Reset
                                                    </Button>
                                                </div>
                                            </div>
                                            
                                            {/* Array Navigation Overlays */}
                                            {viewDialog.isArray && photoCount > 1 && (
                                                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between px-6 z-20 pointer-events-none">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        title="Previous Image"
                                                        className={`bg-slate-900/80 hover:bg-slate-900 text-white rounded-full h-20 w-20 pointer-events-auto backdrop-blur-md transition-all shadow-2xl border border-white/20 ${viewDialog.index === 0 ? 'opacity-0 invisible' : 'opacity-100'}`}
                                                        onClick={(e) => { e.stopPropagation(); setViewDialog(prev => ({ ...prev!, index: Math.max(0, prev!.index! - 1) })); setPreviewZoom(1); }}
                                                    >
                                                        <ChevronLeft className="h-12 w-12" />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        title="Next Image"
                                                        className={`bg-slate-900/80 hover:bg-slate-900 text-white rounded-full h-20 w-20 pointer-events-auto backdrop-blur-md transition-all shadow-2xl border border-white/20 ${viewDialog.index === photoCount - 1 ? 'opacity-0 invisible' : 'opacity-100'}`}
                                                        onClick={(e) => { e.stopPropagation(); setViewDialog(prev => ({ ...prev!, index: prev!.index! + 1 })); setPreviewZoom(1); }}
                                                    >
                                                        <ChevronRight className="h-12 w-12" />
                                                    </Button>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Top Info Badge */}
                                    <div className="absolute top-6 inset-x-6 z-30 flex items-start justify-between pointer-events-none">
                                        <div className="bg-slate-900/60 backdrop-blur-xl text-white border border-white/10 px-6 py-3 rounded-2xl flex flex-col shadow-2xl pointer-events-auto">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="p-1.5 bg-blue-500/20 rounded-lg">
                                                    <FileText className="w-5 h-5 text-blue-400" />
                                                </div>
                                                <span className="text-2xl font-black uppercase tracking-tight leading-tight">
                                                    {viewDialog.label}
                                                </span>
                                            </div>
                                            <span className="text-[11px] font-black text-blue-400 uppercase tracking-[0.2em]">
                                                {viewDialog.desc}
                                            </span>
                                        </div>

                                        <div className="flex flex-col items-end gap-2 pointer-events-auto">
                                            {viewDialog.isArray && (
                                                <div className="bg-slate-900/80 backdrop-blur-md text-white border border-white/20 px-6 py-2 rounded-full text-sm font-black uppercase tracking-[0.2em] shadow-2xl">
                                                    Image {viewDialog.index! + 1} / {photoCount}
                                                </div>
                                            )}
                                            {isVerified ? (
                                                <div className="bg-green-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 border border-green-400/50">
                                                    <CheckCircle className="w-3 h-3" /> Verified
                                                </div>
                                            ) : (
                                                <div className="bg-orange-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 border border-orange-400/50">
                                                    <AlertCircle className="w-3 h-3" /> Not Verified
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom: Controls Panel */}
                                <div className="flex-shrink-0 bg-white border-t p-6 md:px-10 shadow-[0_-15px_50px_rgba(0,0,0,0.1)] z-40">
                                    <div className="max-w-screen-xl mx-auto flex flex-wrap items-center gap-4 justify-start w-full">
                                        {/* 1. Delete */}
                                        <Button 
                                            size="lg"
                                            onClick={() => setDeleteDialog({
                                                isOpen: true,
                                                propertyId: viewDialog.propertyId,
                                                docType: viewDialog.catKey,
                                                label: viewDialog.label,
                                                index: viewDialog.index
                                            })}
                                            className="h-14 px-8 text-[11px] font-black uppercase shadow-xl active:scale-95 bg-red-600 hover:bg-red-700 text-white"
                                            disabled={processing}
                                        >
                                            <Trash2 className="w-5 h-5 mr-3" />
                                            DELETE
                                        </Button>

                                        {/* 2. Admin Replace */}
                                        <label className="cursor-pointer group">
                                            <div className="h-14 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center transition-all shadow-lg font-black uppercase text-sm active:scale-95">
                                                <RefreshCcw className="w-5 h-5 mr-3 group-hover:rotate-180 transition-transform duration-500" />
                                                REPLACE DOCUMENT
                                            </div>
                                            <input 
                                                type="file" 
                                                className="hidden" 
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleAdminFileUpload(viewDialog.propertyId, viewDialog.catKey, file, viewDialog.index);
                                                }}
                                                accept="image/*"
                                            />
                                        </label>

                                        {/* 3. Request Reupload */}
                                        {!isVerified && (
                                            <Button 
                                                size="lg"
                                                onClick={() => setReuploadDialog({ 
                                                    isOpen: true, 
                                                    propertyId: viewDialog.propertyId, 
                                                    docType: docKey, 
                                                    label: viewDialog.label 
                                                })}
                                                className="h-14 px-8 text-sm font-black uppercase shadow-xl bg-orange-500 hover:bg-orange-600 text-white transition-all active:scale-95"
                                                disabled={processing}
                                            >
                                                <AlertCircle className="w-5 h-5 mr-3" />
                                                Request Reupload
                                            </Button>
                                        )}

                                        {/* 4. Approve Now */}
                                        <Button 
                                            size="lg"
                                            onClick={() => handleToggleVerification(viewDialog.propertyId, docKey, isVerified)}
                                            className={`h-14 px-8 text-sm font-black uppercase shadow-xl transition-all active:scale-95 ${isVerified ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700 ring-4 ring-green-100'}`}
                                            disabled={processing}
                                        >
                                            {isVerified ? <RotateCcw className="w-5 h-5 mr-3" /> : <CheckCircle className="w-5 h-5 mr-3" />}
                                            {isVerified ? "Revoke Approval" : "Approve Now"}
                                        </Button>

                                        {/* 5. Close */}
                                        <Button 
                                            size="lg"
                                            onClick={() => { setViewDialog(null); setPreviewZoom(1); }}
                                            className="h-14 px-12 bg-black hover:bg-slate-900 text-white font-black uppercase text-[11px] tracking-[0.2em] rounded-xl shadow-xl active:scale-95 transition-all ml-auto"
                                        >
                                            CLOSE
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    );
}
