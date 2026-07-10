"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { getPropertyById, savePropertyDocuments, addRoomToProperty, deletePropertyDocument, requestPropertyDeactivation, requestPropertyReactivation, updatePropertyRules, requestBankDetailsCorrection, approveBankDetails } from "@/actions/properties";
import { requestEditBankDetails } from "@/actions/security";
import { deleteRoomByOwner, updateRoomByOwner } from "@/actions/rooms";
import { 
    ArrowLeft, Camera, CheckCircle, FileText, ImageIcon, Landmark, 
    Mail, Phone, Plus, RefreshCcw, Trash2, User as UserIcon, Building2, Eye,
    BedDouble, Clock, Users, ParkingCircle, AlertCircle, MapPin, ArrowRight,
    Search, ChevronLeft, ChevronRight, RotateCcw, ZoomIn, ZoomOut, XCircle,
    Home, ShieldCheck, UtensilsCrossed, PowerOff, AlertTriangle, Zap, Pencil,
    LockOpen, Lock, Loader2
} from 'lucide-react';
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OwnerPaymentCard } from "@/components/property/OwnerPaymentCard";
import { PropertyPhotoCarousel } from "@/components/PropertyPhotoCarousel";
import { BankDetailsModal } from "./BankDetailsModal";
import SecureBankDetails from "./SecureBankDetails";
import { toast } from "sonner";

export function PropertyDetailsContainer({ role, permissions }: { role: 'owner' | 'staff', permissions?: string[] }) {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const propertyId = params?.id as string;
    
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

    const [property, setProperty] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Document Upload State
    const [uploading, setUploading] = useState(false);
    const [uploadingCount, setUploadingCount] = useState(0);
    const [categoryUploading, setCategoryUploading] = useState<Record<string, boolean>>({});

    // Add Room State
    const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);
    const [roomForm, setRoomForm] = useState({ roomNumber: "", type: "Single Sharing (1)", price: "", availability: "1", depositMonths: 0 as 0 | 1 | 2 });
    const [roomFormErrors, setRoomFormErrors] = useState<Record<string, string>>({});
    const [savingRoom, setSavingRoom] = useState(false);

    // Edit Room State
    const [isEditRoomOpen, setIsEditRoomOpen] = useState(false);
    const [editRoomForm, setEditRoomForm] = useState({ id: "", roomNumber: "", type: "Single Sharing (1)", price: "", availability: "1", depositMonths: 0 as 0 | 1 | 2 });
    const [editingRoom, setEditingRoom] = useState(false);

    // Delete Room Confirmation State
    const [roomToDelete, setRoomToDelete] = useState<{ id: string; roomNumber: string; occupiedBeds: number; activeTenants: number } | null>(null);

    // Deactivation Request State
    const [isDeactivationOpen, setIsDeactivationOpen] = useState(false);
    const [deactivationReason, setDeactivationReason] = useState('');
    const [deactivating, setDeactivating] = useState(false);

    // Reactivation Request State
    const [isReactivationOpen, setIsReactivationOpen] = useState(false);
    const [reactivationReason, setReactivationReason] = useState('');
    const [reactivating, setReactivating] = useState(false);

    // Property Rules State
    const [rulesEditOpen, setRulesEditOpen] = useState(false);
    const [rulesDraft, setRulesDraft] = useState<string[]>([]);
    const [newRuleInput, setNewRuleInput] = useState('');
    const [savingRules, setSavingRules] = useState(false);

    // Live Capture State
    const [isCaptureOpen, setIsCaptureOpen] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // View Photo State
    const [viewDialog, setViewDialog] = useState<{ isOpen: boolean; catKey: string; index?: number; isArray: boolean; label: string; desc: string; overrideUrl?: string } | null>(null);
    const [previewZoom, setPreviewZoom] = useState(1);

    const [activeTab, setActiveTab] = useState("details");
    const [isBankDetailsModalOpen, setIsBankDetailsModalOpen] = useState(false);
    const [showEditOtpModal, setShowEditOtpModal] = useState(false);
    const [editOtpInput, setEditOtpInput] = useState("");
    const [isRequestingEdit, setIsRequestingEdit] = useState(false);
    
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const tab = params.get('tab');
            if (tab) setActiveTab(tab);
        }
    }, []);

    const [refreshing, setRefreshing] = useState(false);

    const fetchProperty = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const data = await getPropertyById(propertyId);
            if (!data) {
                router.push(`/dashboard/${role}/properties`);
                return;
            }
            setProperty(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [propertyId, role, router]);

    useEffect(() => {
        fetchProperty();
    }, [fetchProperty]);

    // Poll every 30s so admin's verification changes appear on owner side without a reload
    useEffect(() => {
        const interval = setInterval(() => fetchProperty(true), 30000);
        return () => clearInterval(interval);
    }, [fetchProperty]);

    const parseRules = (val: any): string[] => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { const p = JSON.parse(val); return Array.isArray(p) ? p : (val ? [String(val)] : []); }
        catch { return val ? [String(val)] : []; }
    };

    const handleSaveRules = async (rules: string[]) => {
        setSavingRules(true);
        try {
            await updatePropertyRules(property.id, rules);
            setProperty({ ...property, rules: JSON.stringify(rules) });
            setRulesEditOpen(false);
            setNewRuleInput('');
            toast.success('Property rules saved!');
        } catch (e: any) { toast.error(`Error: ${e.message}`); }
        finally { setSavingRules(false); }
    };

    const startCapture = async () => {
        setIsCaptureOpen(true);
        setCapturing(true);
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                videoRef.current.play();
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            toast.error("Could not access camera. Please ensure it's enabled and try again.");
            setCapturing(false);
            setIsCaptureOpen(false);
        }
    };

    const stopCapture = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCapturing(false);
        setIsCaptureOpen(false);
    }, [stream]);

    const capturePhoto = async () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(async (blob) => {
                    if (blob) {
                        const file = new File([blob], "live_capture.png", { type: "image/png" });
                        await handleFileUpload(file, 'livePhotoUrl');
                        stopCapture();
                    }
                }, 'image/png');
            }
        }
    };

    useEffect(() => {
        return () => {
            stopCapture();
        };
    }, [stopCapture]);

    const handleFileUpload = async (file: File, docType: string, index?: number) => {
        const OVERALL_LIMIT = 25 * 1024 * 1024; // 25MB total across all photos
        const SINGLE_FILE_LIMIT = 10 * 1024 * 1024; // 10MB per single file

        const categories: Record<string, any> = {
            buildingPhotos: { name: "Building Photos", isArray: true },
            commonAreaPhotos: { name: "Common Area Photos", isArray: true },
            roomsAndBathroomPhotos: { name: "Rooms & Bathroom Photos", isArray: true },
            parkingPhotos: { name: "Parking Area Photos", isArray: true },
            amenitiesPhotos: { name: "Other Amenities Photos", isArray: true },
            aadhaarProof: { name: "Aadhaar Proof", isArray: true },
            panProof: { name: "PAN Proof", isArray: true },
            pgLicenceUrl: { name: "PG Licence", isArray: true },
            livePhotoUrl: { name: "Current Photo", isArray: false }
        };

        const cat = categories[docType];

        // Single file size guard
        if (file.size > SINGLE_FILE_LIMIT) {
            toast.error(`File "${file.name}" is too large. Maximum allowed per file is 10MB.`);
            return;
        }

        // Overall 25MB limit across ALL photo categories combined
        const allPhotoKeys = ['buildingPhotos', 'commonAreaPhotos', 'roomsAndBathroomPhotos', 'parkingPhotos', 'amenitiesPhotos', 'aadhaarProof', 'panProof', 'pgLicenceUrl'];
        const totalUsedOverall = allPhotoKeys.reduce((total: number, key: string) => {
            const photos = property[key] ? safeParse(property[key]) : [];
            const keySize = photos
                .filter((p: any) => p !== null && p !== undefined)
                .reduce((acc: number, p: any) => {
                    if (typeof p === 'object' && p?.size) return acc + p.size;
                    if (typeof p === 'string' && p.length > 0) return acc + 512 * 1024; // ~512KB estimate for legacy string URLs
                    return acc;
                }, 0);
            return total + keySize;
        }, 0);

        if (totalUsedOverall + file.size > OVERALL_LIMIT) {
            const remaining = Math.max(0, OVERALL_LIMIT - totalUsedOverall);
            toast.error(`Overall storage limit reached! Only ${(remaining / (1024 * 1024)).toFixed(1)} MB remaining out of your 25MB total.`);
            return;
        }

        const toastId = toast.loading(`Uploading ${docType.split(/(?=[A-Z])/).join(' ')}...`);
        setUploading(true);
        setUploadingCount(prev => prev + 1);
        setCategoryUploading(prev => ({ ...prev, [docType]: true }));
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();

            if (res.ok && data.url) {
                let updateData: any = { [docType]: data.url };
                const newPropertyState = { ...property };

                if (cat?.isArray) {
                    const existingPhotos = property[docType] ? safeParse(property[docType]) : [];
                    const maxPhotos = 4; // Standardized to 4-slot grid (2x2)
                    if (existingPhotos.length >= maxPhotos && index === undefined) {
                        toast.error(`Maximum ${maxPhotos} photos allowed.`, { id: toastId });
                        return;
                    }
                    
                    let updatedPhotos;
                    if (index !== undefined) {
                        updatedPhotos = [...existingPhotos];
                        updatedPhotos[index] = { url: data.url, size: file.size };
                    } else {
                        updatedPhotos = [...existingPhotos, { url: data.url, size: file.size }];
                    }
                    updateData = { [docType]: JSON.stringify(updatedPhotos) };
                    newPropertyState[docType] = updateData[docType];
                } else {
                    newPropertyState[docType] = data.url;
                }

                if (property.adminNotes) {
                    const lines = property.adminNotes.split('\n');
                    const reuploadTag = index !== undefined ? `[REUPLOAD:${docType}-${index}]` : `[REUPLOAD:${docType}]`;
                    const filteredLines = lines.filter((l: string) => !l.startsWith(reuploadTag));
                    const newAdminNotes = filteredLines.join('\n');

                    if (newAdminNotes !== property.adminNotes) {
                        updateData.adminNotes = newAdminNotes;
                        newPropertyState.adminNotes = newAdminNotes;
                    }
                }

                await savePropertyDocuments(propertyId, updateData);
                setProperty(newPropertyState);
                toast.success("Document uploaded & saved!", { id: toastId });
            } else {
                toast.error(`Upload failed: ${data.error || 'Server error'}`, { id: toastId });
            }
        } catch (error) {
            console.error("Upload Error:", error);
            toast.error("An error occurred during upload.", { id: toastId });
        } finally {
            setUploading(false);
            setUploadingCount(prev => Math.max(0, prev - 1));
            setCategoryUploading(prev => ({ ...prev, [docType]: false }));
        }
    };

    const handleDelete = async (docType: string, index?: number) => {
        const isDocVerified = property.verifiedDocs && safeParse(property.verifiedDocs).includes(index !== undefined ? `${docType}-${index}` : docType);
        if (isDocVerified) {
            toast.info("Verified documents cannot be deleted.");
            return;
        }

        if (!confirm("Are you sure you want to delete this file?")) return;

        const toastId = toast.loading("Deleting document...");
        setUploading(true);
        try {
            const res = await deletePropertyDocument(propertyId, docType, index);
            if (res.success) {
                const updatedProperty = { ...property };
                if (index !== undefined && property[docType]) {
                    const items = safeParse(property[docType]);
                    items.splice(index, 1);
                    updatedProperty[docType] = items.length > 0 ? JSON.stringify(items) : null;
                } else {
                    updatedProperty[docType] = null;
                }
                setProperty(updatedProperty);

                // Auto-wipe reupload notes in local state
                if (property.adminNotes) {
                    const lines = property.adminNotes.split('\n');
                    const reuploadTag = index !== undefined ? `[REUPLOAD:${docType}-${index}]` : `[REUPLOAD:${docType}]`;
                    const filteredLines = lines.filter((l: string) => !l.startsWith(reuploadTag));
                    const newAdminNotes = filteredLines.join('\n');
                    if (newAdminNotes !== property.adminNotes) {
                        setProperty({ ...updatedProperty, adminNotes: newAdminNotes || null });
                    }
                }

                toast.success("Deleted successfully.", { id: toastId });
            } else {
                toast.error("Delete failed.", { id: toastId });
            }
        } catch (error) {
            console.error("Delete Error:", error);
            toast.error("Cleanup failed.", { id: toastId });
        } finally {
            setUploading(false);
        }
    };

    const handleSaveRoom = async () => {
        const errs: Record<string, string> = {};
        if (!roomForm.roomNumber.trim()) errs.roomNumber = "Room number is required";
        if (!roomForm.price || parseFloat(roomForm.price) <= 0) errs.price = "Valid monthly rent is required";
        if (!roomForm.availability || parseInt(roomForm.availability) <= 0) errs.availability = "Beds available must be at least 1";
        if (roomForm.depositMonths === 0) errs.depositMonths = "Security deposit selection is mandatory";
        if (Object.keys(errs).length > 0) {
            setRoomFormErrors(errs);
            return;
        }
        setRoomFormErrors({});

        setSavingRoom(true);
        try {
            const newRoom = await addRoomToProperty(propertyId, {
                roomNumber: roomForm.roomNumber,
                type: roomForm.type,
                price: parseFloat(roomForm.price),
                availability: parseInt(roomForm.availability),
                depositMonths: roomForm.depositMonths,
            });

            setProperty({ ...property, rooms: [...(property.rooms || []), newRoom] });
            setRoomForm({ roomNumber: "", type: "Single Sharing (1)", price: "", availability: "1", depositMonths: 0 });
            setRoomFormErrors({});
            toast.success("Room added successfully!");
        } catch (e: any) {
            toast.error(`Error adding room: ${e.message}`);
        } finally {
            setSavingRoom(false);
        }
    };

    const handleDeleteRoom = (roomId: string, roomNumber: string) => {
        // Find the room in the property data to determine occupancy status
        const room = property?.rooms?.find((r: any) => r.id === roomId);
        const occupiedBeds = room?.beds?.filter((b: any) => !['AVAILABLE', 'MAINTENANCE'].includes(b.status)).length ?? 0;
        const activeTenants = room?.tenants?.filter((t: any) => t.status !== 'MOVED_OUT').length ?? 0;
        setRoomToDelete({ id: roomId, roomNumber, occupiedBeds, activeTenants });
    };

    const performDeleteRoom = async () => {
        if (!roomToDelete) return;
        const { id: roomId, roomNumber } = roomToDelete;
        const toastId = toast.loading(`Deleting Room ${roomNumber}...`);
        try {
            await deleteRoomByOwner(roomId);
            setProperty({ ...property, rooms: property.rooms.filter((r: any) => r.id !== roomId) });
            toast.success(`Room ${roomNumber} deleted successfully.`, { id: toastId });
            setRoomToDelete(null);
        } catch (e: any) {
            toast.error(`Error: ${e.message}`, { id: toastId });
        }
    };

    const handleRequestDeactivation = async () => {
        if (!deactivationReason.trim()) return;
        setDeactivating(true);
        try {
            await requestPropertyDeactivation(propertyId, deactivationReason);
            toast.success('Deactivation request submitted. RentPe Team will review and action it.');
            setIsDeactivationOpen(false);
            setDeactivationReason('');
            // Refresh property to show updated status banner
            const updated = await getPropertyById(propertyId);
            if (updated) setProperty(updated);
        } catch (e: any) {
            toast.error(`Error: ${e.message}`);
        } finally {
            setDeactivating(false);
        }
    };

    const handleEditRoomSave = async () => {
        if (!editRoomForm.roomNumber || !editRoomForm.price) {
            alert("Room Number and Rent Price are required.");
            return;
        }

        setEditingRoom(true);
        try {
            const updatedRoom = await updateRoomByOwner(editRoomForm.id, {
                roomNumber: editRoomForm.roomNumber,
                type: editRoomForm.type,
                price: parseFloat(editRoomForm.price),
                availability: parseInt(editRoomForm.availability)
            });

            setProperty({
                ...property,
                rooms: property.rooms.map((r: any) => r.id === editRoomForm.id ? { ...r, ...updatedRoom } : r)
            });
            setIsEditRoomOpen(false);
        } catch (e: any) {
            alert(`Error: ${e.message}`);
        } finally {
            setEditingRoom(false);
        }
    };

    const openEditRoomDialog = (room: any) => {
        setEditRoomForm({
            id: room.id,
            roomNumber: room.roomNumber,
            type: room.type,
            price: room.price.toString(),
            availability: room.availability.toString(),
            depositMonths: (room.depositMonths as 1 | 2) || 1,
        });
        setIsEditRoomOpen(true);
    };

    const renderCategory = (cat: any, isLocked: boolean) => (
        <div key={cat.key} className={`border-2 border-slate-100 transition-all rounded-xl p-5 flex flex-col h-full shadow-sm bg-white overflow-hidden`}>
            <div className="flex items-center gap-4 mb-5 pb-3 border-b border-slate-50">
                <div className={`p-3 ${cat.bgClass || 'bg-slate-50'} rounded-xl ${cat.colorClass || 'text-slate-600'} shadow-inner`}>{cat.icon}</div>
                <div>
                    <h4 className="font-bold text-base tracking-tight text-slate-800">{cat.label}</h4>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">{cat.desc}</p>
                </div>
                {categoryUploading[cat.key] && (
                    <div className="ml-auto flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 animate-pulse">
                        <RefreshCcw className="w-3 h-3 animate-spin" />
                        Syncing...
                    </div>
                )}
            </div>

            {cat.isArray ? (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        {(() => {
                            const photos = property[cat.key] ? safeParse(property[cat.key]) : [];
                            const slots = [];
                            // Compute the first empty (null/undefined/missing) index once — all "Add Photo" slots target this
                            const firstEmptyIndex = (() => {
                                const ei = photos.findIndex((p: any) => !p);
                                return ei !== -1 ? ei : photos.length;
                            })();
                            const uploadIndex = firstEmptyIndex < (cat.max || 4) ? firstEmptyIndex : undefined;

                            for (let i = 0; i < (cat.max || 4); i++) {
                                if (photos[i]) {
                                    const img = typeof photos[i] === 'string' ? photos[i] : photos[i].url;
                                    const isDocVerified = property.verifiedDocs && safeParse(property.verifiedDocs).includes(`${cat.key}-${i}`);
                                    const reuploadLine = property.adminNotes?.split('\n').find((l: string) => l.startsWith(`[REUPLOAD:${cat.key}-${i}]`));
                                    const isReuploadRequired = !!reuploadLine;
                                    const reuploadReason = reuploadLine ? reuploadLine.replace(`[REUPLOAD:${cat.key}-${i}]`, '').trim() : '';

                                    slots.push(
                                        <div 
                                            key={`photo-${i}`} 
                                            className={`relative h-28 rounded-lg border shadow-sm group/img ${isReuploadRequired ? 'border-red-500 border-2 ring-4 ring-red-100 bg-red-50' : 'bg-white'} overflow-hidden cursor-pointer`}
                                            onClick={() => setViewDialog({ isOpen: true, catKey: cat.key, index: i, isArray: true, label: cat.label, desc: cat.desc })}
                                        >
                                            <img src={img} className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-700" />
                                            <div 
                                                className="absolute inset-0 bg-slate-900/0 hover:bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition-all flex flex-col items-center justify-center backdrop-blur-[2px] z-30"
                                            >
                                                <div className="bg-white/95 p-3 rounded-full shadow-2xl scale-75 group-hover/img:scale-100 transition-all">
                                                    <Search className="w-5 h-5 text-slate-900" />
                                                </div>
                                                <span className="text-[9px] font-black text-white mt-3 uppercase tracking-[0.2em] drop-shadow-md">View Entry</span>
                                            </div>
                                            <div className="absolute top-2 right-2 z-40">
                                                {isReuploadRequired ? (
                                                    <div className="bg-red-600 animate-pulse text-white px-2 py-0.5 rounded-lg shadow-md flex items-center border border-white/20" title="Reupload Required">
                                                        <AlertCircle className="w-3 h-3 mr-1" />
                                                        <span className="text-[8px] font-bold uppercase tracking-wider">Reupload</span>
                                                    </div>
                                                ) : isDocVerified ? (
                                                    <div className="bg-green-600 text-white px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 border border-green-400/30">
                                                        <CheckCircle className="w-3.5 h-3.5 fill-white/20" />
                                                        <span className="text-[9px] font-black uppercase tracking-widest drop-shadow-sm">Verified</span>
                                                    </div>
                                                ) : (
                                                    <div className="bg-amber-500 text-white px-2 py-0.5 rounded-lg shadow-md flex items-center border border-white/20" title="Pending Approval">
                                                        <AlertCircle className="w-3 h-3 mr-1" />
                                                        <span className="text-[8px] font-bold uppercase tracking-wider">Pending</span>
                                                    </div>
                                                )}
                                            </div>
                                            {isReuploadRequired && reuploadReason && (
                                                <div className="absolute bottom-0 left-0 right-0 bg-red-600/95 backdrop-blur-md text-white px-2 py-1.5 z-40 flex flex-col border-t border-red-500/50" title={reuploadReason}>
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-red-200 mb-0.5 flex items-center gap-1">
                                                        <AlertCircle className="w-2.5 h-2.5" /> Admin Note
                                                    </span>
                                                    <span className="text-[10px] font-medium leading-tight truncate">{reuploadReason}</span>
                                                </div>
                                            )}
                                        </div>
                                    );

                                } else {
                                    slots.push(
                                        isLocked ? (
                                            <div key={`slot-${i}`} className={`border-2 border-dashed border-slate-100 rounded-lg flex flex-col items-center justify-center h-28 bg-slate-50/50 opacity-40 grayscale`}>
                                                <ImageIcon className="w-6 h-6 text-slate-200 mb-1" />
                                                <span className={`text-[8px] font-bold uppercase tracking-widest text-slate-300`}>Locked</span>
                                            </div>
                                        ) : (
                                            <div key={`slot-${i}`} className="border-2 border-dashed border-slate-100 rounded-lg flex flex-col items-center justify-center h-28 bg-slate-50/50 group/empty relative overflow-hidden">
                                                <ImageIcon className="w-5 h-5 text-slate-300 group-hover/empty:scale-90 transition-transform" />
                                                <span className="text-[8px] font-bold uppercase text-slate-400 mt-1">Add Photo</span>
                                                
                                                <label className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover/empty:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-all backdrop-blur-[1px]">
                                                    <div className="bg-blue-600 text-white p-3 rounded-full shadow-xl scale-90 group-hover/empty:scale-100 transition-transform">
                                                        <Plus className="w-5 h-5 stroke-[3]" />
                                                    </div>
                                                    <span className="text-[10px] font-black text-blue-800 mt-2.5 uppercase tracking-widest drop-shadow-sm">Add Photo</span>
                                                    <input 
                                                        type="file" 
                                                        className="hidden" 
                                                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], cat.key, uploadIndex)}
                                                        accept={cat.accept}
                                                    />
                                                </label>
                                            </div>
                                        )
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
                        (() => {
                            const reuploadLine = property.adminNotes?.split('\n').find((l: string) => l.startsWith(`[REUPLOAD:${cat.key}]`));
                            const isReuploadRequired = !!reuploadLine;
                            const reuploadReason = reuploadLine ? reuploadLine.replace(`[REUPLOAD:${cat.key}]`, '').trim() : '';

                            return (
                                <div className="flex-1 flex flex-col">
                                    <div 
                                        className={`relative flex-1 min-h-[160px] rounded-lg border shadow-sm group/img ${isReuploadRequired ? 'border-red-500 border-2 ring-4 ring-red-100 bg-red-50' : 'bg-white'} overflow-hidden cursor-pointer`}
                                        onClick={() => setViewDialog({ isOpen: true, catKey: cat.key, isArray: false, label: cat.label, desc: cat.desc })}
                                    >
                                        <img src={property[cat.key]} className="absolute inset-0 w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-700" />
                                        <div 
                                            className="absolute inset-0 bg-slate-900/0 hover:bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition-all flex flex-col items-center justify-center backdrop-blur-[2px] z-30"
                                        >
                                            <div className="bg-white/95 p-4 rounded-full shadow-2xl scale-75 group-hover/img:scale-110 transition-all">
                                                <Search className="w-6 h-6 text-slate-900" />
                                            </div>
                                            <span className="text-[10px] font-black text-white mt-4 uppercase tracking-[0.2em] drop-shadow-md">View Document</span>
                                        </div>
                                        <div className="absolute top-3 right-3 z-40">
                                            {isReuploadRequired ? (
                                                <div className="bg-red-600 animate-pulse text-white px-2 py-0.5 rounded-lg shadow-md flex items-center border border-white/20" title="Reupload Required">
                                                    <AlertCircle className="w-3 h-3 mr-1" />
                                                    <span className="text-[8px] font-bold uppercase tracking-wider">Reupload</span>
                                                </div>
                                            ) : property.verifiedDocs && safeParse(property.verifiedDocs).includes(cat.key) ? (
                                                <div className="bg-green-600 text-white px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 border border-green-400/30">
                                                    <CheckCircle className="w-3.5 h-3.5 fill-white/20" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest drop-shadow-sm">Verified</span>
                                                </div>
                                            ) : (
                                                <div className="bg-amber-500 text-white px-2 py-0.5 rounded-lg shadow-md flex items-center border border-white/20" title="Pending Approval">
                                                    <AlertCircle className="w-3 h-3 mr-1" />
                                                    <span className="text-[8px] font-bold uppercase tracking-wider">Pending</span>
                                                </div>
                                            )}
                                        </div>
                                        {isReuploadRequired && reuploadReason && (
                                            <div className="absolute bottom-0 left-0 right-0 bg-red-600/95 backdrop-blur-md text-white px-3 py-2 z-40 flex flex-col border-t border-red-500/50" title={reuploadReason}>
                                                <span className="text-[9px] font-black uppercase tracking-widest text-red-200 mb-0.5 flex items-center gap-1.5">
                                                    <AlertCircle className="w-3 h-3" /> Admin Note
                                                </span>
                                                <span className="text-xs font-medium leading-tight truncate">{reuploadReason}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()
                    ) : cat.isLive ? (
                        <div 
                            className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-cyan-200 rounded-2xl bg-cyan-50/20 hover:bg-cyan-50/50 hover:border-cyan-400 transition-all p-8 group/upload cursor-pointer shadow-inner"
                            onClick={startCapture}
                        >
                            <div className="w-14 h-14 rounded-full bg-white shadow-md border-2 border-cyan-50 flex items-center justify-center mb-4 group-hover/upload:scale-110 transition-transform duration-500">
                                <Plus className="w-7 h-7 text-cyan-400 group-hover/upload:text-cyan-600" />
                            </div>
                            <span className="text-[12px] font-black text-cyan-600 group-hover/upload:text-cyan-700 transition-colors uppercase tracking-[0.2em] leading-none">Awaiting Photo</span>
                            <span className="text-[10px] text-cyan-300 mt-2 font-black group-hover/upload:text-cyan-400 uppercase tracking-widest text-center">Click to Capture Current Photo</span>
                        </div>
                    ) : (
                        isLocked ? (
                            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-8 grayscale opacity-50">
                                <FileText className="w-8 h-8 text-slate-300 mb-2" />
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Document Not Provided</span>
                            </div>
                        ) : (
                            <label className="flex-1 cursor-pointer border-2 border-dashed border-indigo-200 rounded-2xl flex flex-col items-center justify-center p-8 bg-indigo-50/20 hover:bg-indigo-50/50 hover:border-indigo-400 transition-all group/upload shadow-inner">
                                <input type="file" className="hidden" accept={cat.accept} disabled={uploading} onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], cat.key)} />
                                <div className="w-14 h-14 rounded-full bg-white shadow-md border-2 border-indigo-50 flex items-center justify-center mb-4 group-hover/upload:scale-110 transition-transform duration-500">
                                    <Plus className="w-7 h-7 text-indigo-400 group-hover/upload:text-indigo-600" />
                                </div>
                                <span className="text-[12px] font-black text-indigo-600 group-hover/upload:text-indigo-700 transition-colors uppercase tracking-[0.2em] leading-none">Awaiting Document</span>
                                <span className="text-[10px] text-indigo-300 mt-2 font-black group-hover/upload:text-indigo-400 uppercase tracking-widest">Click to browse files</span>
                            </label>
                        )
                    )}
                </div>
            )}
        </div>
    );

    if (loading) return <div className="p-20 text-center animate-pulse text-muted-foreground font-black uppercase tracking-widest">Syncing Property Data...</div>;
    if (!property) return null;

    const isLocked = ['VERIFIED_SUCCESSFULLY', 'APPROVED_PENDING_PAYMENT', 'APPROVED_PAYMENT_VERIFIED', 'APPROVED'].includes(property.status);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 border-[4px] border-slate-950 p-6 md:p-10 rounded-[48px] bg-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl -z-0"></div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                    <Button variant="outline" size="icon" asChild className="h-12 w-12 rounded-2xl border-2 hover:bg-slate-50">
                        <Link href={`/dashboard/${role}/properties`}><ArrowLeft className="h-5 w-5" /></Link>
                    </Button>
                    <div className="space-y-1">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">{property.name}</h1>
                            <Badge variant="secondary" className={`h-7 px-3 rounded-xl font-black uppercase text-[10px] tracking-widest border-2
                                ${property.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : ''}
                                ${(property.status === 'SUSPENDED' || property.status === 'REJECTED') ? 'bg-red-50 text-red-600 border-red-100' : ''}
                                ${(property.status === 'PENDING_VERIFICATION' || property.status === 'NEEDS_CORRECTION') ? 'bg-amber-50 text-amber-600 border-amber-100' : ''}
                                ${property.status === 'APPROVED_PENDING_PAYMENT' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : ''}
                            `}>
                                {property.status.replace('_', ' ')}
                            </Badge>
                        </div>
                        <p className="text-slate-500 font-medium flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-indigo-500" /> {property.city}, {property.address}
                        </p>
                    </div>
                </div>
                {property.displayId && (
                    <div className="flex flex-col items-center px-4 py-3 bg-slate-900 text-white rounded-2xl shadow-xl border-4 border-white group hover:scale-105 transition-transform">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none mb-1">REGISTRATION ID</span>
                        <span className="text-lg font-black font-mono tracking-tighter">{property.displayId}</span>
                    </div>
                )}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchProperty(true)}
                    disabled={refreshing}
                    className="rounded-2xl border-2 border-slate-200 font-black uppercase text-[10px] tracking-widest h-10 px-4 gap-2"
                >
                    <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                    {refreshing ? "Syncing..." : "Sync Status"}
                </Button>
            </div>

            {/* ── RentPe Property Lifecycle (Deactivation & Reactivation) ── */}
            {property.status === 'DEACTIVATION_REQUESTED' && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border-2 border-amber-500 rounded-2xl">
                    <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-black text-amber-800 text-sm">⏳ Exit Request Under Review</p>
                        <p className="text-xs text-amber-700 mt-0.5">Your deactivation request has been submitted. The RentPe Operations Team is reviewing it. You will be notified once a decision is made.</p>
                    </div>
                </div>
            )}
            {property.status === 'REACTIVATION_REQUESTED' && (
                <div className="flex items-start gap-3 p-4 bg-emerald-50 border-2 border-emerald-500 rounded-2xl">
                    <Zap className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-black text-emerald-800 text-sm">⚡ Re-listing Request Under Review</p>
                        <p className="text-xs text-emerald-700 mt-0.5">Your request to re-list this property has been submitted. The RentPe Operations Team will review and approve it shortly. You will be notified once it is LIVE again.</p>
                    </div>
                </div>
            )}
            {property.status === 'DEACTIVATED' && (
                <div className="flex items-start gap-3 p-4 bg-slate-100 border-2 border-slate-400 rounded-2xl">
                    <PowerOff className="h-5 w-5 text-slate-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="font-black text-slate-700 text-sm">🚫 Property Deactivated</p>
                        <p className="text-xs text-slate-500 mt-0.5">This property is no longer visible to students. All data is preserved for legal compliance.</p>
                    </div>
                    {role === 'owner' && (
                        <button
                            onClick={() => setIsReactivationOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg shadow-emerald-200 transition-all flex-shrink-0"
                        >
                            <Zap className="h-3.5 w-3.5" />
                            Request Re-listing
                        </button>
                    )}
                    {role === 'staff' && (
                        <p className="text-[10px] text-slate-400 italic flex-shrink-0">Contact owner to re-list</p>
                    )}
                </div>
            )}
            {(role === 'owner' || (role === 'staff' && permissions?.includes('request_deactivation'))) && (property.status === 'APPROVED' || property.status === 'LIVE') && (
                <div className="flex justify-end">
                    <button
                        onClick={() => setIsDeactivationOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 text-xs font-black bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-200 transition-all uppercase tracking-wider"
                    >
                        <PowerOff className="h-4 w-4" />
                        Request Deactivation
                    </button>
                </div>
            )}

            {/* Content Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="flex items-center w-full max-w-3xl bg-white border border-slate-200 p-1.5 rounded-2xl h-14 mb-12 shadow-sm gap-1">
                    <TabsTrigger
                        value="details"
                        className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 h-10 text-slate-500 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-indigo-200 transition-all duration-200"
                    >
                        <Home className="w-4 h-4" /> Property Details
                    </TabsTrigger>
                    <TabsTrigger
                        value="rooms"
                        className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 h-10 text-slate-500 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-emerald-200 transition-all duration-200"
                    >
                        <UtensilsCrossed className="w-4 h-4" /> Room & Food ({property.rooms?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger
                        value="verification"
                        className={`flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 h-10 text-slate-500 transition-all duration-200 data-[state=active]:text-white data-[state=active]:shadow-md ${
                            property.adminNotes?.includes('[REUPLOAD') && !property.adminNotes?.includes('[REUPLOAD:BANK_DETAILS]')
                                ? 'data-[state=active]:bg-red-500 data-[state=active]:shadow-red-200'
                                : 'data-[state=active]:bg-amber-500 data-[state=active]:shadow-amber-200'
                        }`}
                    >
                        <ShieldCheck className="w-4 h-4" /> Verification
                    </TabsTrigger>
                    <TabsTrigger
                        value="bank_details"
                        className={`flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 h-10 text-slate-500 transition-all duration-200 data-[state=active]:text-white data-[state=active]:shadow-md ${
                            property.status === 'AWAITING_BANK_DETAILS'
                                ? 'data-[state=active]:bg-purple-600 data-[state=active]:shadow-purple-200'
                                : property.adminNotes?.includes('[REUPLOAD:BANK_DETAILS]')
                                ? 'data-[state=active]:bg-red-500 data-[state=active]:shadow-red-200'
                                : 'data-[state=active]:bg-indigo-600 data-[state=active]:shadow-indigo-200'
                        }`}
                    >
                        <Landmark className="w-4 h-4" /> Bank Details
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Property Description + Amenities */}
                        <Card className="rounded-3xl border-2 border-slate-50 shadow-sm overflow-hidden">
                            <CardHeader className="bg-slate-50/50 border-b-2 border-slate-50">
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Property Description</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <p className="text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{property.description}</p>
                                <div className="pt-4 border-t-2 border-slate-50 space-y-2">
                                    <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Available Amenities</div>
                                    <div className="flex flex-wrap gap-2">
                                        {(property.amenities || '').split(',').filter(Boolean).map((a: string) => (
                                            <span key={a} className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-100">{a.trim()}</span>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Gallery */}
                        <Card className="rounded-3xl border-2 border-slate-50 shadow-sm overflow-hidden">
                            <CardHeader className="bg-slate-50/50 border-b-2 border-slate-50">
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Property Gallery</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <PropertyPhotoCarousel
                                    property={property}
                                    className="rounded-xl overflow-hidden shadow-sm border border-slate-100"
                                    aspectClassName="aspect-video"
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Property Rules — editable bullet points */}
                    <Card className="rounded-3xl border-2 border-amber-100 shadow-sm overflow-hidden bg-amber-50/20">
                        <CardHeader className="bg-amber-50/60 border-b-2 border-amber-100">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-amber-700">🏠 Property Rules</CardTitle>
                                {!rulesEditOpen && (
                                    <button
                                        onClick={() => { setRulesDraft(parseRules(property.rules)); setRulesEditOpen(true); }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-all active:scale-95"
                                    >
                                        <Pencil className="w-3 h-3" /> Edit Rules
                                    </button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            {!rulesEditOpen ? (
                                <div>
                                    {parseRules(property.rules).length === 0 ? (
                                        <p className="text-sm text-slate-400 font-bold italic">No rules set yet. Click “Edit Rules” to add property rules.</p>
                                    ) : (
                                        <ul className="space-y-2">
                                            {parseRules(property.rules).map((rule: string, i: number) => (
                                                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                                                    <span className="text-amber-500 font-black mt-0.5 shrink-0">•</span>
                                                    <span className="font-medium leading-snug">{rule}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        {rulesDraft.map((rule: string, i: number) => (
                                            <div key={i} className="flex items-center gap-2 bg-white border border-amber-100 rounded-xl px-3 py-2.5">
                                                <span className="text-amber-500 font-black shrink-0">•</span>
                                                <span className="flex-1 text-sm font-medium text-slate-700">{rule}</span>
                                                <button
                                                    onClick={() => setRulesDraft(rulesDraft.filter((_, idx) => idx !== i))}
                                                    className="h-7 w-7 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-500 shrink-0 transition-all"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                        {rulesDraft.length === 0 && (
                                            <p className="text-xs text-slate-400 italic py-2">No rules yet — add one below.</p>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            value={newRuleInput}
                                            onChange={e => setNewRuleInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && newRuleInput.trim()) { setRulesDraft([...rulesDraft, newRuleInput.trim()]); setNewRuleInput(''); } }}
                                            placeholder="Type a rule and press Enter or click Add..."
                                            className="flex-1 h-10 rounded-xl border-2 border-amber-200 px-3 text-sm font-medium focus:outline-none focus:border-amber-400 bg-white"
                                        />
                                        <button
                                            disabled={!newRuleInput.trim()}
                                            onClick={() => { if (newRuleInput.trim()) { setRulesDraft([...rulesDraft, newRuleInput.trim()]); setNewRuleInput(''); } }}
                                            className="h-10 w-10 flex items-center justify-center bg-amber-600 hover:bg-amber-700 text-white rounded-xl disabled:opacity-40 transition-all shrink-0 active:scale-95"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex gap-2 pt-2 border-t border-amber-100">
                                        <button
                                            onClick={() => { setRulesEditOpen(false); setNewRuleInput(''); }}
                                            className="flex-1 h-10 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-[11px] uppercase tracking-widest transition-all active:scale-95"
                                        >Cancel</button>
                                        <button
                                            onClick={() => handleSaveRules(rulesDraft)}
                                            disabled={savingRules}
                                            className="flex-1 h-10 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-[11px] uppercase tracking-widest transition-all disabled:opacity-50 active:scale-95"
                                        >{savingRules ? 'Saving...' : 'Save Rules'}</button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Location Map — moved to bottom */}
                    <Card className="rounded-3xl border-2 border-slate-50 shadow-sm overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b-2 border-slate-50">
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Location Map</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-center min-h-[140px] gap-6">
                            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-3xl shrink-0">📍</div>
                            <div className="text-center sm:text-left">
                                <div className="font-black text-slate-800 uppercase tracking-tight text-lg">{property.city}</div>
                                <p className="text-sm font-bold text-slate-400 mt-1">{property.address}</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="rooms" className="space-y-6">
                    {/* Food & Mess Service Section */}
                    <div className="p-6 bg-orange-50/50 rounded-3xl border-2 border-orange-100 space-y-4 mb-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-orange-600 rounded-lg shadow-sm">
                                    <UtensilsCrossed className="w-4 h-4 text-white" />
                                </div>
                                <h4 className="text-xs font-black uppercase tracking-widest text-orange-700">Food & Mess Service</h4>
                            </div>
                            <Badge className={`rounded-xl border-2 px-3 py-1 font-black uppercase text-[9px] tracking-widest shadow-sm
                                ${property.foodType === 'INCLUDED' ? 'bg-green-50 text-green-600 border-green-100' : 
                                  property.foodType === 'OPTIONAL' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                                  'bg-slate-50 text-slate-500 border-slate-100'}`}
                            >
                                {property.foodType?.replace('_', ' ') || 'NOT AVAILABLE'}
                            </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-6">
                            <div className="flex items-center gap-3">
                                <div className="text-2xl">{property.foodType === 'INCLUDED' ? '🍱' : property.foodType === 'OPTIONAL' ? '🍴' : '🚫'}</div>
                                <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Service Status</div>
                                    <div className="text-sm font-bold text-slate-700 uppercase">
                                        {property.foodType === 'INCLUDED' ? 'Included in Rent' : property.foodType === 'OPTIONAL' ? 'Optional (Add-on)' : 'Not Available'}
                                    </div>
                                </div>
                            </div>
                            {property.foodType === 'OPTIONAL' && (
                                <div className="border-l-2 border-orange-100 pl-6 space-y-1">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Monthly Charge</div>
                                    <div className="text-lg font-black text-orange-600 tracking-tighter">₹{property.foodPricePerMonth || 0}</div>
                                </div>
                            )}
                        </div>
                        <p className="text-[10px] font-bold text-orange-600/70 border-t border-orange-100/50 pt-3 uppercase tracking-tight">
                            {property.foodType === 'INCLUDED' ? '✅ Meals are pre-included in the monthly rent amount.' : 
                             property.foodType === 'OPTIONAL' ? 'ℹ️ Students can choose to subscribe to this food service for the extra monthly charge.' : 
                             '❌ This property currently does not offer mess or food services.'}
                        </p>
                    </div>

                    {/* Room Inventory Header */}
                    <div className="flex justify-between items-center flex-wrap gap-3 mb-2">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                Room Inventory <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{property.rooms?.length || 0} Rooms</Badge>
                            </h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Manage available rooms and their pricing</p>
                        </div>
                    </div>

                    {/* Not live banner */}
                    {role === 'owner' && !['APPROVED', 'LIVE'].includes(property.status) && (
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-bold text-amber-700 mb-4">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            Room management is available once your property is approved by RentPe Team.
                        </div>
                    )}

                    {/* Two-column layout for LIVE/APPROVED: rooms left, add-room right */}
                    {role === 'owner' && ['APPROVED', 'LIVE'].includes(property.status) ? (
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
                            {/* LEFT: Room Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                {(property.rooms?.length ?? 0) === 0 && (
                                    <div className="col-span-full text-center py-10 text-slate-400 font-bold text-sm bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                        No rooms added yet. Use the panel on the right to add your first room.
                                    </div>
                                )}
                                {property.rooms?.map((room: any) => {
                                    const depositAmt = (room.depositMonths || 0) * (room.price || 0);
                                    return (
                                        <div key={room.id} className="border-2 border-emerald-100 rounded-2xl p-4 text-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-xl hover:shadow-emerald-100 transition-all bg-white hover:-translate-y-1">
                                            {room.photoUrl && (
                                                <div className="absolute inset-0 z-0 opacity-10 group-hover:opacity-20 transition-opacity">
                                                    <img src={room.photoUrl} className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                            <div className="relative z-10 space-y-3">
                                                <div className="flex justify-between items-center border-b border-emerald-100 pb-3">
                                                    <span className="font-bold flex items-center gap-1.5 text-base">
                                                        <Building2 className="h-4 w-4 text-emerald-600" /> Room {room.roomNumber}
                                                    </span>
                                                    <Badge variant="outline" className="rounded-xl border-emerald-100 bg-blue-50 px-2 py-1 font-black uppercase text-[9px] tracking-widest text-blue-700">{room.type}</Badge>
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <div className="space-y-1.5">
                                                        <span className="flex items-center gap-1.5 font-bold bg-emerald-50/80 px-2.5 py-1 rounded-md text-[11px] uppercase tracking-wide text-emerald-700">
                                                            <BedDouble className="h-3.5 w-3.5" /> {room.availability} BEDS READY
                                                        </span>
                                                        <div className="flex flex-col gap-0.5 bg-amber-50/80 px-2.5 py-1.5 rounded-md">
                                                            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest leading-none">Security Deposit</span>
                                                            <span className="text-[13px] font-black text-amber-700 tracking-tight">
                                                                ₹{depositAmt.toLocaleString('en-IN')}
                                                                <span className="text-[9px] font-bold ml-1 text-amber-500">({room.depositMonths}M)</span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-widest leading-none mb-1">Monthly Rent</span>
                                                        <span className="font-black text-green-700 text-2xl tracking-tighter leading-none">₹{(room.price || 0).toLocaleString('en-IN')}</span>
                                                    </div>
                                                </div>
                                                <div className="pt-2 border-t border-emerald-100 flex gap-2">
                                                    <Button 
                                                        className="flex-1 h-9 text-[10px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all active:scale-95" 
                                                        onClick={() => openEditRoomDialog(room)}
                                                    >
                                                        EDIT
                                                    </Button>
                                                    <Button 
                                                        className="h-9 w-9 p-0 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 flex items-center justify-center active:scale-95 transition-all"
                                                        onClick={() => handleDeleteRoom(room.id, room.roomNumber)}
                                                        title="Delete Room"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* RIGHT: Add Room Inline Panel */}
                            <div className="sticky top-6">
                                <div className="border-2 border-emerald-200 rounded-3xl overflow-hidden shadow-xl shadow-emerald-100 bg-white">
                                    {/* Panel Header */}
                                    <div className="bg-emerald-600 px-6 py-5 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                                            <Plus className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Add New Room</h3>
                                            <p className="text-[10px] text-emerald-200 font-bold mt-0.5">All fields are mandatory</p>
                                        </div>
                                    </div>

                                    <div className="p-6 space-y-4">
                                        {/* Room Number */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Room Number <span className="text-red-500">*</span></label>
                                            <Input
                                                placeholder="e.g. 101, B-4"
                                                className={`h-11 rounded-xl border-2 font-bold text-slate-800 ${roomFormErrors.roomNumber ? 'border-red-400 bg-red-50' : 'border-slate-100 focus:border-emerald-300'}`}
                                                value={roomForm.roomNumber}
                                                onChange={e => { setRoomForm({...roomForm, roomNumber: e.target.value}); setRoomFormErrors(p => { const n = {...p}; delete n.roomNumber; return n; }); }}
                                            />
                                            {roomFormErrors.roomNumber && <p className="text-[10px] text-red-600 font-bold">{roomFormErrors.roomNumber}</p>}
                                        </div>

                                        {/* Bed Type */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Bed Type <span className="text-red-500">*</span></label>
                                            <select
                                                className="w-full h-11 rounded-xl border-2 border-slate-100 bg-white px-3 font-bold text-slate-800 focus:border-emerald-300 focus:outline-none"
                                                value={roomForm.type}
                                                onChange={e => {
                                                    const type = e.target.value;
                                                    const match = type.match(/(\d+)/);
                                                    const count = match ? match[1] : "1";
                                                    setRoomForm({...roomForm, type, availability: count});
                                                }}
                                            >
                                                {['Single Sharing (1)','Double Sharing (2)','Three Sharing (3)','Four Sharing (4)','Five Sharing (5)','Six Sharing (6)'].map(t => <option key={t}>{t}</option>)}
                                            </select>
                                        </div>

                                        {/* Monthly Rent + Beds */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Monthly Rent (₹) <span className="text-red-500">*</span></label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">₹</span>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        className={`h-11 rounded-xl border-2 pl-7 font-bold text-slate-800 ${roomFormErrors.price ? 'border-red-400 bg-red-50' : 'border-slate-100 focus:border-emerald-300'}`}
                                                        placeholder="5000"
                                                        value={roomForm.price}
                                                        onChange={e => { setRoomForm({...roomForm, price: e.target.value}); setRoomFormErrors(p => { const n = {...p}; delete n.price; return n; }); }}
                                                    />
                                                </div>
                                                {roomFormErrors.price && <p className="text-[10px] text-red-600 font-bold">{roomFormErrors.price}</p>}
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Beds Available</label>
                                                <Input
                                                    type="number"
                                                    readOnly
                                                    className="h-11 rounded-xl border-2 border-slate-100 font-bold text-slate-500 bg-slate-50 cursor-not-allowed"
                                                    value={roomForm.availability}
                                                />
                                            </div>
                                        </div>

                                        {/* Security Deposit */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                                                🛡️ Security Deposit <span className="text-red-500">*</span>
                                                <span className="text-[9px] text-slate-400 font-bold normal-case">(Max 2 months)</span>
                                            </label>
                                            {!roomForm.price || parseFloat(roomForm.price) <= 0 ? (
                                                <p className="text-[11px] text-amber-600 font-semibold italic bg-amber-50 px-3 py-2 rounded-xl border border-amber-100">
                                                    ⚠️ Enter monthly rent above to see deposit options
                                                </p>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-2">
                                                    {([1, 2] as const).map(m => {
                                                        const rent = parseFloat(roomForm.price) || 0;
                                                        const selected = roomForm.depositMonths === m;
                                                        return (
                                                            <button
                                                                key={m}
                                                                type="button"
                                                                onClick={() => { setRoomForm({...roomForm, depositMonths: m}); setRoomFormErrors(p => { const n = {...p}; delete n.depositMonths; return n; }); }}
                                                                className={`h-[72px] rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all font-black ${
                                                                    selected
                                                                        ? m === 1
                                                                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                                                            : 'border-purple-600 bg-purple-600 text-white shadow-lg shadow-purple-200'
                                                                        : 'border-slate-100 bg-white hover:border-emerald-200'
                                                                }`}
                                                            >
                                                                <span className={`text-[9px] font-black uppercase tracking-widest ${selected ? 'text-white/80' : 'text-slate-500'}`}>
                                                                    {m} Month{m > 1 ? 's' : ''}
                                                                </span>
                                                                <span className={`text-base font-black ${selected ? 'text-white' : 'text-slate-800'}`}>
                                                                    ₹{(rent * m).toLocaleString('en-IN')}
                                                                </span>
                                                                {selected && (
                                                                    <span className="text-[8px] font-black bg-white/20 px-1.5 py-0.5 rounded-full text-white">✓ SELECTED</span>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {roomFormErrors.depositMonths && <p className="text-[10px] text-red-600 font-black animate-pulse">{roomFormErrors.depositMonths}</p>}
                                            <p className="text-[9px] text-slate-400 font-semibold">Per Model Tenancy Act 2021 — Max 2 months • Refundable</p>
                                        </div>

                                        {/* Confirmation summary */}
                                        {roomForm.roomNumber && roomForm.price && parseFloat(roomForm.price) > 0 && roomForm.depositMonths > 0 && (
                                            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                                                <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                                <p className="text-[11px] text-green-700 font-bold">
                                                    Room {roomForm.roomNumber} • ₹{parseFloat(roomForm.price).toLocaleString('en-IN')}/mo • Deposit: ₹{(parseFloat(roomForm.price) * roomForm.depositMonths).toLocaleString('en-IN')} ({roomForm.depositMonths}M)
                                                </p>
                                            </div>
                                        )}

                                        {/* Submit */}
                                        <Button
                                            className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 font-black uppercase tracking-widest text-sm shadow-md shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                                            onClick={handleSaveRoom}
                                            disabled={savingRoom}
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            {savingRoom ? 'Adding Room...' : 'Add Room'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Non-owner or non-live: just show room grid */
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {property.rooms?.map((room: any) => {
                                const depositAmt = (room.depositMonths || 0) * (room.price || 0);
                                return (
                                    <div key={room.id} className="border-2 border-emerald-50 rounded-2xl p-4 text-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-xl hover:shadow-emerald-100 transition-all bg-white hover:-translate-y-1">
                                        {room.photoUrl && (
                                            <div className="absolute inset-0 z-0 opacity-10 group-hover:opacity-20 transition-opacity">
                                                <img src={room.photoUrl} className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                        <div className="p-2 space-y-4 relative z-10">
                                            <div className="relative z-10 flex justify-between items-center mb-4 border-b border-emerald-100 pb-3">
                                                <span className="font-bold flex items-center gap-1.5 text-base">
                                                    <Building2 className="h-4 w-4 text-emerald-600" /> Room {room.roomNumber}
                                                </span>
                                                <Badge variant="outline" className="rounded-xl border-emerald-100 bg-blue-50 px-3 py-1 font-black uppercase text-[9px] tracking-widest text-blue-700">{room.type}</Badge>
                                            </div>
                                            <div className="relative z-10 flex justify-between items-end text-muted-foreground mt-2">
                                                <div className="space-y-1">
                                                    <span className="flex items-center gap-1.5 font-bold bg-emerald-50/50 px-2.5 py-1 rounded-md text-[11px] uppercase tracking-wide text-emerald-700">
                                                        <BedDouble className="h-4 w-4" /> {room.availability} BEDS READY
                                                    </span>
                                                    <div className="flex flex-col gap-0.5 bg-amber-50/80 px-2.5 py-1.5 rounded-md">
                                                        <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest leading-none">Security Deposit</span>
                                                        <span className="text-[13px] font-black text-amber-700 tracking-tight">
                                                            ₹{depositAmt.toLocaleString('en-IN')}
                                                            <span className="text-[9px] font-bold ml-1 text-amber-500">({room.depositMonths}M)</span>
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest leading-none mb-1">Monthly Rent</span>
                                                    <span className="font-black text-green-700 text-2xl tracking-tighter leading-none">₹{(room.price || 0).toLocaleString('en-IN')}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="verification" className="space-y-8">
                     <div className="bg-indigo-900 rounded-[40px] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden">
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                            <div className="max-w-xl space-y-4">
                                <h2 className="text-4xl font-extrabold tracking-tight">Verification</h2>
                                <p className="text-indigo-100/70 font-medium text-lg leading-relaxed">
                                    Upload government-issued IDs and building documentation to activate your property on RentPe. High-quality scans ensure faster approval.
                                </p>
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl -z-0"></div>
                     </div>
                     <div className="space-y-12">
                         {/* Section 1: Property Assets */}
                         <div className="space-y-6">
                             <div className="flex items-center gap-2 border-l-4 border-indigo-500 pl-4 py-1">
                                 <h5 className="font-black text-xs uppercase tracking-[0.2em] text-indigo-700">Property Assets</h5>
                                 <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-100 h-5">Visual Evidence</Badge>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[
                                    { key: 'buildingPhotos', label: 'Building Exterior', desc: 'Building/MAIN ENTRANCE / STREET VIEW', icon: <Building2 />, bgClass: 'bg-indigo-50', colorClass: 'text-indigo-600', borderHover: 'hover:border-indigo-300', isArray: true, max: 4, accept: "image/*" },
                                    { key: 'commonAreaPhotos', label: 'Common Areas', desc: 'Hallway / Lobby / GYM/ Shared', icon: <Users />, bgClass: 'bg-indigo-50', colorClass: 'text-indigo-600', borderHover: 'hover:border-indigo-300', isArray: true, max: 4, accept: "image/*" },
                                    { key: 'roomsAndBathroomPhotos', label: 'Rooms & Bathroom', desc: 'Interior ROOMS & BATHROOMS', icon: <BedDouble />, bgClass: 'bg-indigo-50', colorClass: 'text-indigo-600', borderHover: 'hover:border-indigo-300', isArray: true, max: 4, accept: "image/*" },
                                    { key: 'parkingPhotos', label: 'Parking Area', desc: 'BIKE & CAR PARKING', icon: <ParkingCircle />, bgClass: 'bg-indigo-50', colorClass: 'text-indigo-600', borderHover: 'hover:border-indigo-300', isArray: true, max: 2, accept: "image/*" },
                                    { key: 'amenitiesPhotos', label: 'Other Amenities', desc: 'Fridge/TV/Washing / oTHERS', icon: <Plus />, bgClass: 'bg-indigo-50', colorClass: 'text-indigo-600', borderHover: 'hover:border-indigo-300', isArray: true, max: 4, accept: "image/*" },
                                ].map(cat => renderCategory(cat, isLocked))}
                             </div>
                         </div>
                         {/* Section 2: Legal Documentation */}
                         <div className="space-y-6 pt-6 border-t border-slate-100">
                             <div className="flex items-center gap-2 border-l-4 border-emerald-500 pl-4 py-1">
                                 <h5 className="font-black text-xs uppercase tracking-[0.2em] text-emerald-700">Legal Documentation</h5>
                                 <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 h-5">Identity & Compliance</Badge>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[
                                    { key: 'aadhaarProof', label: 'Aadhaar Card', desc: 'FRONT & BACK REQUIRED', icon: <UserIcon />, bgClass: 'bg-amber-50', colorClass: 'text-amber-600', borderHover: 'hover:border-amber-300', isArray: true, max: 2, accept: "image/*,application/pdf" },
                                    { key: 'panProof', label: 'PAN Card', desc: 'PAN Card INDIVIDUAL OR BUSINESS', icon: <Landmark />, bgClass: 'bg-rose-50', colorClass: 'text-rose-600', borderHover: 'hover:border-rose-300', isArray: true, max: 2, accept: "image/*,application/pdf" },
                                    { key: 'pgLicenceUrl', label: 'Trade Licence', desc: 'GOVT PERMIT / LICENCE', icon: <FileText />, bgClass: 'bg-indigo-50', colorClass: 'text-indigo-600', borderHover: 'hover:border-indigo-300', isArray: true, max: 2, accept: "image/*,application/pdf" },
                                    { key: 'livePhotoUrl', label: 'Photo', desc: 'Current photo of the person', icon: <Camera />, bgClass: 'bg-cyan-50', colorClass: 'text-cyan-600', borderHover: 'hover:border-cyan-300', isArray: false, isLive: true, accept: "image/*" },
                                ].map(cat => renderCategory(cat, isLocked))}
                             </div>
                         </div>
                      </div>
                </TabsContent>

                <TabsContent value="bank_details" className="space-y-6">
                    <div className="bg-white rounded-[32px] border-2 border-slate-100 p-8 shadow-sm">
                        <div className="flex items-center gap-4 mb-8 pb-6 border-b-2 border-slate-50">
                            <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl">
                                <Landmark className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black tracking-tight text-slate-900">Bank Details</h3>
                                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Payment Routing Information</p>
                            </div>
                            {property.status === 'AWAITING_BANK_DETAILS' && (
                                <Badge className="ml-auto bg-amber-100 text-amber-700 border-amber-200 uppercase font-black text-[10px] tracking-widest">
                                    Action Required
                                </Badge>
                            )}
                            {property.status === 'BANK_DETAILS_SUBMITTED' && (
                                <Badge className="ml-auto bg-indigo-100 text-indigo-700 border-indigo-200 uppercase font-black text-[10px] tracking-widest">
                                    Pending Approval
                                </Badge>
                            )}
                            {(property.status === 'APPROVED_PENDING_PAYMENT' || property.status === 'APPROVED_PAYMENT_VERIFIED' || property.status === 'APPROVED' || property.status === 'LIVE') && (
                                <Badge className="ml-auto bg-emerald-100 text-emerald-700 border-emerald-200 uppercase font-black text-[10px] tracking-widest">
                                    Verified
                                </Badge>
                            )}
                        </div>

                        <SecureBankDetails
                            propertyId={property.id}
                            bankName={property.bankName}
                            initialBankAccountNo={property.bankAccountNo}
                            initialBankIfsc={property.bankIfsc}
                            initialCancelChequeUrl={property.cancelChequeUrl}
                            isChequeVerified={property.verifiedDocs?.includes("bank_cheque")}
                            onChequeViewerOpen={(url) => setViewDialog({ isOpen: true, catKey: 'cancelChequeUrl', isArray: false, label: 'Cancelled Cheque', desc: 'Bank Document', overrideUrl: url })}
                            userRole={role as "OWNER" | "STAFF" | "ADMIN"}
                        />

                        {/* Note from admin */}
                        {property.adminNotes?.includes('[REUPLOAD:BANK_DETAILS]') && (
                            <div className="mt-8 bg-red-50 border border-red-200 p-4 rounded-xl">
                                <div className="flex items-center gap-2 text-red-700 font-black mb-1 uppercase text-[10px] tracking-widest">
                                    <AlertTriangle className="w-4 h-4" /> Admin Note (Corrections Needed)
                                </div>
                                <p className="text-sm font-medium text-red-900">
                                    {property.adminNotes.split('\n').find((l: string) => l.startsWith('[REUPLOAD:BANK_DETAILS]'))?.replace('[REUPLOAD:BANK_DETAILS]', '').trim()}
                                </p>
                            </div>
                        )}

                        {/* Owner Action */}
                        {role === 'owner' && property.status === 'AWAITING_BANK_DETAILS' && (
                            <div className="mt-8 pt-8 border-t-2 border-slate-50 flex justify-end">
                                <Button
                                    onClick={() => setIsBankDetailsModalOpen(true)}
                                    className={`h-12 px-8 rounded-2xl font-black uppercase tracking-widest text-sm shadow-md transition-all ${
                                        property.adminNotes?.includes('[REUPLOAD:BANK_DETAILS]')
                                            ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse shadow-amber-200 border-2 border-amber-300'
                                            : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-100'
                                    }`}
                                >
                                    {property.bankName ? 'Update Bank Details' : 'Add Bank Details'}
                                </Button>
                            </div>
                        )}
                        
                        {/* Owner Not Editable Note & Request Edit Button */}
                        {role === 'owner' && property.status !== 'AWAITING_BANK_DETAILS' && (
                            <div className="mt-8 pt-8 border-t-2 border-slate-50 flex flex-col items-center gap-4">
                                <p className="text-xs text-slate-400 italic text-center font-medium">Bank details are currently locked for processing. Editing requires security verification.</p>
                                <Button 
                                    variant="outline" 
                                    className="rounded-xl border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:text-amber-800 text-xs font-black uppercase tracking-widest px-6"
                                    onClick={() => {
                                        setEditOtpInput("");
                                        setShowEditOtpModal(true);
                                    }}
                                >
                                    <LockOpen className="w-4 h-4 mr-2" /> Request Edit Bank Details
                                </Button>
                            </div>
                        )}

                        {/* Admin Actions */}
                        {role === 'staff' && property.status === 'BANK_DETAILS_SUBMITTED' && (
                            <div className="mt-8 pt-8 border-t-2 border-slate-50 flex justify-end gap-4">
                                <Button
                                    variant="outline"
                                    onClick={async () => {
                                        const note = window.prompt("Enter correction reason:");
                                        if (!note) return;
                                        const toastId = toast.loading("Requesting corrections...");
                                        try {
                                            await requestBankDetailsCorrection(propertyId, note);
                                            toast.success("Corrections requested.", { id: toastId });
                                            fetchProperty(true);
                                        } catch (e: any) {
                                            toast.error(e.message, { id: toastId });
                                        }
                                    }}
                                    className="h-12 px-8 rounded-2xl border-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-black uppercase tracking-widest text-sm"
                                >
                                    Corrections Needed
                                </Button>
                                <Button
                                    onClick={async () => {
                                        const toastId = toast.loading("Approving bank details...");
                                        try {
                                            await approveBankDetails(propertyId);
                                            toast.success("Bank details approved!", { id: toastId });
                                            fetchProperty(true);
                                        } catch (e: any) {
                                            toast.error(e.message, { id: toastId });
                                        }
                                    }}
                                    className="h-12 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-700 font-black uppercase tracking-widest text-sm shadow-md shadow-emerald-100"
                                >
                                    Approve & Continue
                                </Button>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            <BankDetailsModal
                isOpen={isBankDetailsModalOpen}
                onClose={() => setIsBankDetailsModalOpen(false)}
                propertyId={propertyId}
                propertyName={property?.name || ''}
                onSuccess={() => fetchProperty(true)}
            />

            {/* Edit Room Dialog — Premium Design */}
            <Dialog open={isEditRoomOpen} onOpenChange={setIsEditRoomOpen}>
                <DialogContent className="max-w-lg rounded-3xl shadow-2xl p-0 overflow-hidden border-0">
                    {/* Header */}
                    <div className="flex items-center gap-4 px-8 pt-8 pb-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200 flex-shrink-0">
                            <BedDouble className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight text-slate-900">Edit Room Details</h2>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Manage Inventory and Pricing Strategy</p>
                        </div>
                    </div>

                    <div className="px-8 pb-8 space-y-5">
                        {/* Row 1: Room Number + Bed Type */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Room Number</label>
                                <div className="relative">
                                    <Input
                                        placeholder="e.g. 101, B-4"
                                        className="h-12 rounded-xl border-2 border-slate-100 font-bold text-slate-800 focus:border-emerald-300"
                                        value={editRoomForm.roomNumber}
                                        onChange={e => setEditRoomForm({...editRoomForm, roomNumber: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Bed Type</label>
                                <select
                                    className="w-full h-12 rounded-xl border-2 border-slate-100 bg-white px-3 font-bold text-slate-800 focus:border-emerald-300 focus:outline-none"
                                    value={editRoomForm.type}
                                    onChange={e => {
                                        const type = e.target.value;
                                        const match = type.match(/\((\d+)\)/);
                                        const count = match ? match[1] : "1";
                                        setEditRoomForm({...editRoomForm, type, availability: count});
                                    }}
                                >
                                    {['Single Sharing (1)','Double Sharing (2)','Three Sharing (3)','Four Sharing (4)','Five Sharing (5)','Six Sharing (6)'].map(t => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Row 2: Monthly Price + Beds Available */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Monthly Price (₹)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400">₹</span>
                                    <Input
                                        type="number"
                                        className="h-12 rounded-xl border-2 border-slate-100 pl-7 font-bold text-slate-800 focus:border-emerald-300"
                                        value={editRoomForm.price}
                                        onChange={e => setEditRoomForm({...editRoomForm, price: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Beds Available</label>
                                <Input
                                    type="number"
                                    readOnly
                                    className="h-12 rounded-xl border-2 border-slate-100 font-bold text-slate-500 bg-slate-50 cursor-not-allowed"
                                    value={editRoomForm.availability}
                                />
                            </div>
                        </div>

                        {/* Info note */}
                        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                            <span className="text-emerald-600 mt-0.5 text-sm">ⓘ</span>
                            <p className="text-[11px] text-emerald-700 font-semibold leading-relaxed">
                                Adding beds will automatically generate new bed ID records.<br />
                                Removing beds is only possible if they are not currently occupied.
                            </p>
                        </div>

                        {/* Security Deposit Months */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Security Deposit Months *</label>
                            <div className="grid grid-cols-2 gap-3">
                                {([1, 2] as const).map(m => {
                                    const rent = parseFloat(editRoomForm.price) || 0;
                                    return (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => setEditRoomForm({...editRoomForm, depositMonths: m})}
                                            className={`h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all font-black ${
                                                editRoomForm.depositMonths === m
                                                    ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100 scale-[1.02] shadow-md'
                                                    : 'border-slate-100 bg-white hover:border-emerald-200'
                                            }`}
                                        >
                                            <span className={`text-xs font-black uppercase tracking-widest ${editRoomForm.depositMonths === m ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                {m} Month{m > 1 ? 's' : ''}
                                            </span>
                                            <span className={`text-lg font-black ${editRoomForm.depositMonths === m ? 'text-emerald-900' : 'text-slate-400'}`}>
                                                ₹{(rent * m).toLocaleString('en-IN')}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-[10px] text-slate-400 font-semibold">Per Model Tenancy Act 2021 — Maximum 2 months for residential PG/Hostel • Deposit is refundable</p>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setIsEditRoomOpen(false)}
                                className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-sm bg-red-600 hover:bg-red-700 text-white transition-all active:scale-95 shadow-sm"
                            >
                                CANCEL
                            </button>
                            <Button
                                className="flex-1 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 font-black uppercase tracking-widest text-sm shadow-md shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleEditRoomSave}
                                disabled={editingRoom || editRoomForm.depositMonths === 0}
                            >
                                💾 {editingRoom ? 'SAVING...' : editRoomForm.depositMonths === 0 ? 'SELECT DEPOSIT' : 'SAVE ROOM'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Room Delete Confirmation Dialog — Premium Design */}
            <Dialog open={!!roomToDelete} onOpenChange={(open) => !open && setRoomToDelete(null)}>
                <DialogContent className="max-w-md rounded-3xl shadow-2xl p-0 overflow-hidden border-0 bg-white">
                    <div className="bg-rose-50 p-8 flex flex-col items-center text-center border-b border-rose-100">
                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl shadow-rose-200/50 border-4 border-rose-500 scale-110">
                            <Trash2 className="h-10 w-10 text-rose-600" />
                        </div>
                        <DialogHeader className="space-y-3">
                            <DialogTitle className="text-3xl font-black text-slate-900 leading-tight tracking-tight">Delete Room {roomToDelete?.roomNumber}?</DialogTitle>
                            {(roomToDelete?.occupiedBeds ?? 0) > 0 || (roomToDelete?.activeTenants ?? 0) > 0 ? (
                                <div className="mt-2 bg-red-100 border-2 border-red-300 rounded-2xl p-4 text-left space-y-2">
                                    <p className="text-sm font-black text-red-700 uppercase tracking-wider flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4" /> Cannot Delete — Room is Occupied
                                    </p>
                                    {(roomToDelete?.activeTenants ?? 0) > 0 && (
                                        <p className="text-xs font-bold text-red-600">
                                            👤 {roomToDelete?.activeTenants} active tenant(s) are currently living in this room.
                                        </p>
                                    )}
                                    {(roomToDelete?.occupiedBeds ?? 0) > 0 && (
                                        <p className="text-xs font-bold text-red-600">
                                            🛏 {roomToDelete?.occupiedBeds} bed(s) are occupied or reserved.
                                        </p>
                                    )}
                                    <p className="text-xs text-red-500 font-semibold border-t border-red-200 pt-2 mt-1">
                                        Please move out or reassign all tenants before deleting this room.
                                    </p>
                                </div>
                            ) : (
                                <DialogDescription className="text-slate-600 font-bold px-4 text-base">
                                    This action is <span className="text-rose-600 font-black">permanent</span> and cannot be undone. All bed records associated with this room will be removed.
                                </DialogDescription>
                            )}
                        </DialogHeader>
                    </div>
                    <DialogFooter className="p-6 bg-slate-50/50 flex flex-col sm:flex-row gap-4">
                        <button 
                            className="flex-1 rounded-2xl h-14 bg-slate-900 hover:bg-black text-white transition-all active:scale-95 font-black uppercase tracking-[0.2em] text-[11px] shadow-xl"
                            onClick={() => setRoomToDelete(null)}
                        >
                            {((roomToDelete?.occupiedBeds ?? 0) > 0 || (roomToDelete?.activeTenants ?? 0) > 0) ? 'Close' : 'No, Keep it'}
                        </button>
                        {!((roomToDelete?.occupiedBeds ?? 0) > 0 || (roomToDelete?.activeTenants ?? 0) > 0) && (
                            <Button 
                                variant="destructive" 
                                className="flex-1 rounded-2xl h-14 bg-rose-600 hover:bg-rose-700 font-black uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-rose-200 active:scale-95 transition-all border-b-4 border-rose-800"
                                onClick={performDeleteRoom}
                            >
                                Yes, Delete Now
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Room Dialog — kept for non-LIVE fallback, not used when inline panel is shown */}
            <Dialog open={isAddRoomOpen} onOpenChange={(open) => { if (!open) { setIsAddRoomOpen(false); setRoomFormErrors({}); } }}>
                <DialogContent className="max-w-lg rounded-3xl shadow-2xl p-0 overflow-hidden border-0">
                    <div className="flex items-center gap-4 px-8 pt-8 pb-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200 flex-shrink-0">
                            <Plus className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight text-slate-900">Add New Room</h2>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Register Inventory for {property?.name}</p>
                        </div>
                    </div>
                    <div className="px-8 pb-8 space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Room Number <span className="text-red-500">*</span></label>
                                <Input
                                    placeholder="e.g. 101, B-4"
                                    className={`h-12 rounded-xl border-2 font-bold text-slate-800 ${roomFormErrors.roomNumber ? 'border-red-400' : 'border-slate-100 focus:border-emerald-300'}`}
                                    value={roomForm.roomNumber}
                                    onChange={e => { setRoomForm({...roomForm, roomNumber: e.target.value}); setRoomFormErrors(p => { const n = {...p}; delete n.roomNumber; return n; }); }}
                                />
                                {roomFormErrors.roomNumber && <p className="text-[10px] text-red-600 font-bold">{roomFormErrors.roomNumber}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Bed Type <span className="text-red-500">*</span></label>
                                <select
                                    className="w-full h-12 rounded-xl border-2 border-slate-100 bg-white px-3 font-bold text-slate-800 focus:border-emerald-300 focus:outline-none"
                                    value={roomForm.type}
                                    onChange={e => {
                                        const type = e.target.value;
                                        const match = type.match(/(\d+)/);
                                        const count = match ? match[1] : "1";
                                        setRoomForm({...roomForm, type, availability: count});
                                    }}
                                >
                                    {['Single Sharing (1)','Double Sharing (2)','Three Sharing (3)','Four Sharing (4)','Five Sharing (5)','Six Sharing (6)'].map(t => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Monthly Price (₹) <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400">₹</span>
                                    <Input
                                        type="number"
                                        className={`h-12 rounded-xl border-2 pl-7 font-bold text-slate-800 ${roomFormErrors.price ? 'border-red-400' : 'border-slate-100 focus:border-emerald-300'}`}
                                        value={roomForm.price}
                                        onChange={e => { setRoomForm({...roomForm, price: e.target.value}); setRoomFormErrors(p => { const n = {...p}; delete n.price; return n; }); }}
                                    />
                                </div>
                                {roomFormErrors.price && <p className="text-[10px] text-red-600 font-bold">{roomFormErrors.price}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Beds Available</label>
                                <Input type="number" readOnly className="h-12 rounded-xl border-2 border-slate-100 font-bold text-slate-500 bg-slate-50 cursor-not-allowed" value={roomForm.availability} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Security Deposit Months <span className="text-red-500">*</span></label>
                            <div className="grid grid-cols-2 gap-3">
                                {([1, 2] as const).map(m => {
                                    const rent = parseFloat(roomForm.price) || 0;
                                    return (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => { setRoomForm({...roomForm, depositMonths: m}); setRoomFormErrors(p => { const n = {...p}; delete n.depositMonths; return n; }); }}
                                            className={`h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all font-black ${
                                                roomForm.depositMonths === m
                                                    ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100 scale-[1.02] shadow-md'
                                                    : 'border-slate-100 bg-white hover:border-emerald-200'
                                            }`}
                                        >
                                            <span className={`text-xs font-black uppercase tracking-widest ${roomForm.depositMonths === m ? 'text-emerald-700' : 'text-slate-500'}`}>{m} Month{m > 1 ? 's' : ''}</span>
                                            <span className={`text-lg font-black ${roomForm.depositMonths === m ? 'text-emerald-900' : 'text-slate-400'}`}>₹{(rent * m).toLocaleString('en-IN')}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {roomFormErrors.depositMonths && <p className="text-[10px] text-red-600 font-bold">{roomFormErrors.depositMonths}</p>}
                            <p className="text-[10px] text-slate-400 font-semibold">Per Model Tenancy Act 2021 — Maximum 2 months • Deposit is refundable</p>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => { setIsAddRoomOpen(false); setRoomForm({ roomNumber: '', type: 'Single Sharing (1)', price: '', availability: '1', depositMonths: 0 }); setRoomFormErrors({}); }}
                                className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-sm bg-red-600 hover:bg-red-700 text-white transition-all active:scale-95 shadow-sm"
                            >
                                CANCEL
                            </button>
                            <Button
                                className="flex-1 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 font-black uppercase tracking-widest text-sm shadow-md shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleSaveRoom}
                                disabled={savingRoom}
                            >
                                + {savingRoom ? 'REGISTERING...' : 'ADD ROOM'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Photo Capture Modal */}
            <Dialog open={isCaptureOpen} onOpenChange={setIsCaptureOpen}>
                <DialogContent className="max-w-xl rounded-[40px] border-8 border-slate-900 shadow-2xl overflow-hidden p-0">
                    <div className="bg-slate-900 p-8 text-white relative">
                         <div className="flex justify-between items-center mb-6">
                            <div className="space-y-1">
                                <h3 className="text-2xl font-black uppercase tracking-tight">Identity Capture</h3>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Hold your Aadhaar/ID near your face</p>
                            </div>
                            <Button variant="ghost" className="rounded-full h-12 w-12 hover:bg-white/10" onClick={stopCapture}>✕</Button>
                         </div>
                         
                         <div className="relative aspect-video bg-black rounded-[32px] overflow-hidden border-4 border-white/10 shadow-inner">
                            <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" />
                            <div className="absolute inset-0 pointer-events-none border-[40px] border-slate-900/40">
                                <div className="w-full h-full border-2 border-dashed border-white/50 rounded-2xl"></div>
                            </div>
                            {capturing && (
                                <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase animate-pulse shadow-lg">
                                    <div className="w-2 h-2 rounded-full bg-white"></div> LIVE STREAM
                                </div>
                            )}
                         </div>

                         <div className="flex gap-4 mt-8 pb-4">
                            <Button className="flex-1 h-16 rounded-3xl bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-900/50" onClick={capturePhoto}>
                                <Camera className="w-5 h-5 mr-3" /> CAPTURE PHOTO
                            </Button>
                            <button 
                                className="h-16 px-10 rounded-3xl border-2 border-red-700 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs transition-all active:scale-95 shadow-lg shadow-red-200" 
                                onClick={stopCapture}
                            >
                                CANCEL
                            </button>
                         </div>
                    </div>
                </DialogContent>
                <canvas ref={canvasRef} className="hidden" />
            </Dialog>
            {/* View Dialog (Aligned with Admin Premium Look) */}
            <Dialog open={!!viewDialog} onOpenChange={(open) => { if (!open) { setViewDialog(null); setPreviewZoom(1); } }}>
                <DialogContent className="max-w-[95vw] md:max-w-7xl p-0 overflow-hidden border-none shadow-2xl bg-slate-950">
                    {viewDialog && (() => {
                        const photos = property[viewDialog.catKey] ? safeParse(property[viewDialog.catKey]) : [];
                        const photo = viewDialog.isArray ? photos[viewDialog.index!] : property[viewDialog.catKey];
                        const img = viewDialog.overrideUrl || (typeof photo === 'string' ? photo : photo?.url);
                        const verified = property.verifiedDocs && safeParse(property.verifiedDocs).includes(viewDialog.isArray ? `${viewDialog.catKey}-${viewDialog.index}` : viewDialog.catKey);
                        
                        return (
                            <div className="flex flex-col h-[90vh]">
                                {/* Top: Expanded Media Preview */}
                                <div 
                                    className="relative flex-1 flex items-center justify-center overflow-hidden"
                                    style={{ background: 'radial-gradient(circle at center, #1e1b4b 0%, #020617 50%, #000000 100%)' }}
                                >
                                    {/* Advanced Blurry Overlay (Professional Look) */}
                                    <div className="absolute inset-0 opacity-30 pointer-events-none overflow-hidden">
                                        <img 
                                            src={img} 
                                            className="w-full h-full object-cover blur-3xl scale-150" 
                                        />
                                    </div>

                                    {/* Background Glow */}
                                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-full w-full bg-indigo-600/10 blur-[120px] rounded-full opacity-30 z-0" />

                                    <div className="relative z-10 w-full h-full flex items-center justify-center transition-transform duration-300 ease-out" style={{ transform: `scale(${previewZoom})` }}>
                                        <img 
                                            src={img} 
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

                                    {/* Top Info Badge */}
                                    <div className="absolute top-6 inset-x-6 z-30 flex items-start justify-between pointer-events-none">
                                        <div className="bg-slate-900/60 backdrop-blur-xl text-white border border-white/10 px-6 py-3 rounded-2xl flex flex-col shadow-2xl pointer-events-auto">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="p-1.5 bg-indigo-500/20 rounded-lg">
                                                    <FileText className="w-5 h-5 text-indigo-400" />
                                                </div>
                                                <span className="text-2xl font-black uppercase tracking-tight leading-tight">
                                                    {viewDialog.label}
                                                </span>
                                            </div>
                                            <span className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em]">
                                                {viewDialog.desc}
                                            </span>
                                        </div>

                                        <div className="flex flex-col items-end gap-2 pointer-events-auto">
                                            {viewDialog.isArray && photos.length > 1 && (
                                                <div className="bg-slate-900/80 backdrop-blur-md text-white border border-white/20 px-6 py-2 rounded-full text-sm font-black uppercase tracking-[0.2em] shadow-2xl">
                                                    Image {viewDialog.index! + 1} / {photos.length}
                                                </div>
                                            )}
                                            {verified ? (
                                                <div className="bg-emerald-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 border border-emerald-400/50">
                                                    <CheckCircle className="w-3 h-3" /> Officially Verified
                                                </div>
                                            ) : (
                                                <div className="bg-amber-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 border border-amber-400/50">
                                                    <Clock className="w-3 h-3" /> Pending Review
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom: Management Command Panel */}
                                <div className="flex-shrink-0 bg-white border-t p-6 md:px-10 shadow-[0_-15px_50px_rgba(0,0,0,0.1)] z-40">
                                    <div className="max-w-screen-xl mx-auto flex flex-wrap items-center gap-4 justify-start w-full">
                                        {!isLocked && (
                                            <>
                                                <Button 
                                                    size="lg"
                                                    onClick={() => {
                                                        handleDelete(viewDialog.catKey, viewDialog.index);
                                                        setViewDialog(null);
                                                    }}
                                                    className="h-16 px-10 text-xs font-black uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 transition-all active:scale-95 shadow-xl shadow-red-100"
                                                    disabled={uploading}
                                                >
                                                    <Trash2 className="w-5 h-5 mr-3" />
                                                    DELETE
                                                </Button>

                                                <label className="cursor-pointer group">
                                                    <div className="h-16 px-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl flex items-center justify-center transition-all shadow-xl shadow-indigo-100 font-black uppercase text-xs tracking-widest active:scale-95">
                                                        <RefreshCcw className={`w-5 h-5 mr-3 ${uploading ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} />
                                                        {uploading ? "Uploading..." : "Replace Document"}
                                                    </div>
                                                    <input 
                                                        type="file" 
                                                        className="hidden" 
                                                        disabled={uploading}
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handleFileUpload(file, viewDialog.catKey, viewDialog.index);
                                                        }}
                                                        accept="image/*"
                                                    />
                                                </label>
                                            </>
                                        )}

                                        <button 
                                            onClick={() => { setViewDialog(null); setPreviewZoom(1); }}
                                            className="h-16 px-14 bg-black hover:bg-slate-900 text-white font-black uppercase text-xs tracking-[0.2em] rounded-2xl shadow-xl active:scale-95 transition-all ml-auto"
                                        >
                                            CLOSE
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* ── Deactivation Request Dialog ─────────────────────────────── */}
            <Dialog open={isDeactivationOpen} onOpenChange={(o) => { if (!deactivating) setIsDeactivationOpen(o); }}>
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-black">
                            <PowerOff className="h-5 w-5 text-red-600" />
                            Request Property Deactivation
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            This will submit a deactivation request to the RentPe Operations Team. Your property will remain live until the team reviews and approves your request.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
                            <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Before You Request</p>
                            <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                                <li>All active tenants must be moved out first</li>
                                <li>All pending bookings must be cancelled</li>
                                <li>Outstanding payouts will be settled before closure</li>
                                <li>Property data is preserved — never deleted</li>
                            </ul>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Reason for Deactivation <span className="text-red-500">*</span>
                            </Label>
                            <textarea
                                value={deactivationReason}
                                onChange={(e) => setDeactivationReason(e.target.value)}
                                placeholder="e.g. Selling the property, moving to a different city, property under renovation..."
                                rows={3}
                                disabled={deactivating}
                                className="w-full border border-border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 flex-col sm:flex-row">
                        <Button
                            onClick={handleRequestDeactivation}
                            disabled={!deactivationReason.trim() || deactivating}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold h-10 px-6 rounded-xl disabled:opacity-50"
                        >
                            {deactivating ? 'Submitting...' : 'Submit Request'}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => { setIsDeactivationOpen(false); setDeactivationReason(''); }}
                            disabled={deactivating}
                            className="h-10 px-6 rounded-xl font-bold bg-black text-white hover:bg-slate-800 border-0"
                        >
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Reactivation Request Dialog ───────────────────────────── */}
            <Dialog open={isReactivationOpen} onOpenChange={(o) => { if (!reactivating) setIsReactivationOpen(o); }}>
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-black">
                            <Zap className="h-5 w-5 text-emerald-600" />
                            Request Property Re-listing
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            This will submit a re-listing request to the RentPe Operations Team. Your property will go LIVE again once the team reviews and approves your request.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 space-y-1">
                            <p className="font-bold">What happens when approved:</p>
                            <ul className="list-disc list-inside space-y-0.5 text-emerald-700">
                                <li>Property becomes visible to students again</li>
                                <li>Bookings and inquiries re-open</li>
                                <li>All your existing data, rooms and documents are intact</li>
                                <li>MoU / agreement will be re-activated</li>
                            </ul>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Reason for Re-listing <span className="text-red-500">*</span>
                            </Label>
                            <textarea
                                value={reactivationReason}
                                onChange={(e) => setReactivationReason(e.target.value)}
                                placeholder="e.g. Renovation complete and ready to re-open, changed plans on selling property, returned to the city..."
                                rows={3}
                                disabled={reactivating}
                                className="w-full border border-border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-200"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 flex-col sm:flex-row">
                        <Button
                            onClick={async () => {
                                if (!reactivationReason.trim()) return;
                                setReactivating(true);
                                try {
                                    await requestPropertyReactivation(propertyId, reactivationReason);
                                    toast.success('Re-listing request submitted! We will review and notify you.');
                                    setIsReactivationOpen(false);
                                    setReactivationReason('');
                                    const data = await getPropertyById(propertyId);
                                    setProperty(data);
                                } catch (err: any) {
                                    toast.error(err.message || 'Failed to submit re-listing request.');
                                } finally {
                                    setReactivating(false);
                                }
                            }}
                            disabled={!reactivationReason.trim() || reactivating}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-6 rounded-xl disabled:opacity-50 shadow-lg shadow-emerald-200"
                        >
                            {reactivating ? 'Submitting...' : 'Submit Re-listing Request'}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => { setIsReactivationOpen(false); setReactivationReason(''); }}
                            disabled={reactivating}
                            className="h-10 px-6 rounded-xl font-bold bg-black text-white hover:bg-slate-800 border-0"
                        >
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* OTP Modal for Requesting Edit */}
            {showEditOtpModal && (
                <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-amber-500 p-6 text-white text-center relative overflow-hidden">
                            <LockOpen className="w-12 h-12 mx-auto mb-3 text-amber-200 relative z-10" />
                            <h3 className="text-xl font-black relative z-10">Security Verification</h3>
                            <p className="text-amber-100 text-sm mt-1 font-medium relative z-10">Verify identity to unlock editing.</p>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-3">
                                <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold mb-1">Warning: Payouts will be suspended.</p>
                                    <p className="opacity-90">Unlocking bank details will require them to be re-verified by our admin team before payouts resume. Enter mock OTP <strong className="font-mono bg-amber-200 px-1 py-0.5 rounded text-amber-900">123456</strong> to proceed.</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">6-Digit Code</label>
                                <Input
                                    type="text"
                                    maxLength={6}
                                    placeholder="• • • • • •"
                                    className="h-14 text-center text-2xl font-mono tracking-[0.5em] font-bold rounded-xl border-2 border-slate-200 focus-visible:ring-amber-500 focus-visible:border-amber-500 transition-all"
                                    value={editOtpInput}
                                    onChange={(e) => setEditOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                                    onKeyDown={async (e) => {
                                        if (e.key === 'Enter' && editOtpInput.length === 6) {
                                            setIsRequestingEdit(true);
                                            try {
                                                const res = await requestEditBankDetails(propertyId, editOtpInput.trim());
                                                if (res.success) {
                                                    toast.success("Bank details unlocked for editing.");
                                                    setShowEditOtpModal(false);
                                                    fetchProperty(true);
                                                    setIsBankDetailsModalOpen(true); // Open edit modal
                                                } else {
                                                    toast.error(res.error || "Invalid OTP.");
                                                }
                                            } catch (err: any) {
                                                toast.error(err.message || "Invalid OTP.");
                                            } finally {
                                                setIsRequestingEdit(false);
                                            }
                                        }
                                    }}
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[10px]"
                                    onClick={() => setShowEditOtpModal(false)}
                                    disabled={isRequestingEdit}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1 h-12 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px]"
                                    disabled={isRequestingEdit || editOtpInput.length !== 6}
                                    onClick={async () => {
                                        setIsRequestingEdit(true);
                                        try {
                                            const res = await requestEditBankDetails(propertyId, editOtpInput.trim());
                                            if (res.success) {
                                                toast.success("Bank details unlocked for editing.");
                                                setShowEditOtpModal(false);
                                                fetchProperty(true);
                                                setIsBankDetailsModalOpen(true); // Open edit modal
                                            } else {
                                                toast.error(res.error || "Invalid OTP.");
                                            }
                                        } catch (err: any) {
                                            toast.error(err.message || "Invalid OTP.");
                                        } finally {
                                            setIsRequestingEdit(false);
                                        }
                                    }}
                                >
                                    {isRequestingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Unlock"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

