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
import { getPropertyById, savePropertyDocuments, addRoomToProperty, editRoom, deletePropertyDocument } from "@/actions/properties";
import { 
    ArrowLeft, Camera, CheckCircle, FileText, ImageIcon, Landmark, 
    Mail, Phone, Plus, RefreshCcw, Trash2, User as UserIcon, Building2, Eye,
    BedDouble, Clock, Users, ParkingCircle, AlertCircle, MapPin, ArrowRight,
    Search, ChevronLeft, ChevronRight, RotateCcw, ZoomIn, ZoomOut, XCircle,
    Home, ShieldCheck
} from 'lucide-react';
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OwnerPaymentCard } from "@/components/property/OwnerPaymentCard";
import { toast } from "sonner";

export function PropertyDetailsContainer({ role }: { role: 'owner' | 'staff' }) {
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
    const [roomForm, setRoomForm] = useState({ roomNumber: "", type: "Single Sharing", price: "", availability: "1" });
    const [savingRoom, setSavingRoom] = useState(false);

    // Edit Room State
    const [isEditRoomOpen, setIsEditRoomOpen] = useState(false);
    const [editRoomForm, setEditRoomForm] = useState({ id: "", roomNumber: "", type: "Single Sharing", price: "", availability: "1" });
    const [editingRoom, setEditingRoom] = useState(false);

    // Live Capture State
    const [isCaptureOpen, setIsCaptureOpen] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // View Photo State
    const [viewDialog, setViewDialog] = useState<{ isOpen: boolean; catKey: string; index?: number; isArray: boolean; label: string; desc: string } | null>(null);
    const [previewZoom, setPreviewZoom] = useState(1);

    useEffect(() => {
        const fetchProperty = async () => {
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
            }
        };
        fetchProperty();
    }, [propertyId, role, router]);

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
        const categories: Record<string, any> = {
            buildingPhotos: { name: "Building Photos", maxSize: 5 * 1024 * 1024, maxMb: 5, isArray: true },
            commonAreaPhotos: { name: "Common Area Photos", maxSize: 5 * 1024 * 1024, maxMb: 5, isArray: true },
            roomsAndBathroomPhotos: { name: "Rooms & Bathroom Photos", maxSize: 5 * 1024 * 1024, maxMb: 5, isArray: true },
            parkingPhotos: { name: "Parking Area Photos", maxSize: 5 * 1024 * 1024, maxMb: 5, isArray: true },
            amenitiesPhotos: { name: "Other Amenities Photos", maxSize: 5 * 1024 * 1024, maxMb: 5, isArray: true },
            aadhaarProof: { name: "Aadhaar Proof", maxSize: 5 * 1024 * 1024, maxMb: 5, isArray: true },
            panProof: { name: "PAN Proof", maxSize: 5 * 1024 * 1024, maxMb: 5, isArray: true },
            pgLicenceUrl: { name: "PG Licence", maxSize: 5 * 1024 * 1024, maxMb: 5, isArray: true },
            livePhotoUrl: { name: "Current Photo", maxSize: 5 * 1024 * 1024, maxMb: 5, isArray: false }
        };

        const cat = categories[docType];
        if (file.size > cat.maxSize) {
            toast.error(`File "${file.name}" exceeds the ${cat.name} size limit (${cat.maxMb}MB).`);
            return;
        }

        if (cat?.isArray) {
            const photos = property[docType] ? safeParse(property[docType]) : [];
            const totalUsed = photos.reduce((acc: number, p: any) => acc + (typeof p === 'object' ? p.size : 1024 * 1024), 0);
            if (totalUsed + file.size > cat.maxSize) {
                toast.error(`Storage full! Only ${((cat.maxSize - totalUsed) / (1024 * 1024)).toFixed(2)} MB remaining in ${cat.name}.`);
                return;
            }
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
                    const maxPhotos = (docType === 'buildingPhotos' || docType === 'roomsAndBathroomPhotos' || docType === 'amenitiesPhotos') ? 4 : 2;
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
        if (!roomForm.roomNumber || !roomForm.price) {
            toast.error("Room Number and Rent Price are required.");
            return;
        }

        setSavingRoom(true);
        try {
            const newRoom = await addRoomToProperty(propertyId, {
                roomNumber: roomForm.roomNumber,
                type: roomForm.type,
                price: parseFloat(roomForm.price),
                availability: parseInt(roomForm.availability)
            });

            setProperty({ ...property, rooms: [...(property.rooms || []), newRoom] });
            setIsAddRoomOpen(false);
            setRoomForm({ roomNumber: "", type: "Single Sharing", price: "", availability: "1" });
            toast.success("Room added successfully!");
        } catch (e: any) {
            toast.error(`Error adding room: ${e.message}`);
        } finally {
            setSavingRoom(false);
        }
    };

    const handleEditRoomSave = async () => {
        if (!editRoomForm.roomNumber || !editRoomForm.price) {
            alert("Room Number and Rent Price are required.");
            return;
        }

        setEditingRoom(true);
        try {
            const updatedRoom = await editRoom(editRoomForm.id, {
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
        });
        setIsEditRoomOpen(true);
    };

    const renderCategory = (cat: any, isLocked: boolean) => (
        <div key={cat.key} className={`border-2 ${cat.borderHover} transition-all rounded-xl p-5 flex flex-col h-full shadow-sm bg-white overflow-hidden`}>
            <div className="flex items-center gap-4 mb-5 pb-3 border-b border-slate-50">
                <div className={`p-3 ${cat.bgClass} rounded-xl ${cat.colorClass} shadow-inner`}>{cat.icon}</div>
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
                            for (let i = 0; i < cat.max; i++) {
                                if (photos[i]) {
                                    const img = typeof photos[i] === 'string' ? photos[i] : photos[i].url;
                                    const isDocVerified = property.verifiedDocs && safeParse(property.verifiedDocs).includes(`${cat.key}-${i}`);
                                    const isReuploadRequired = property.adminNotes?.includes(`[REUPLOAD:${cat.key}-${i}]`);

                                    slots.push(
                                        <div 
                                            key={`photo-${i}`} 
                                            className={`relative h-28 rounded-lg border shadow-sm group/img ${isReuploadRequired ? 'border-red-500 border-2 ring-4 ring-red-100 bg-red-50' : 'bg-white'} overflow-hidden cursor-pointer`}
                                            onClick={() => setViewDialog({ isOpen: true, catKey: cat.key, index: i, isArray: true, label: cat.label, desc: cat.desc })}
                                        >
                                            <img src={img} className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-700" />
                                            <div className="absolute inset-0 bg-slate-900/0 hover:bg-slate-900/20 opacity-0 group-hover/img:opacity-100 transition-all flex flex-col items-center justify-center backdrop-blur-[1px] z-30">
                                                <div className="bg-white/90 p-3 rounded-full shadow-2xl scale-75 group-hover/img:scale-100 transition-all">
                                                    <Search className="w-5 h-5 text-slate-900" />
                                                </div>
                                            </div>
                                            <div className="absolute top-2 right-2 z-40">
                                                {isDocVerified ? (
                                                    <div className="bg-green-600 text-white px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 border border-green-400/30">
                                                        <CheckCircle className="w-3.5 h-3.5 fill-white/20" />
                                                        <span className="text-[9px] font-black uppercase tracking-widest drop-shadow-sm">Verified</span>
                                                    </div>
                                                ) : isReuploadRequired ? (
                                                    <div className="bg-red-600 animate-pulse text-white px-2 py-0.5 rounded-lg shadow-md flex items-center border border-white/20" title="Reupload Required">
                                                        <AlertCircle className="w-3 h-3 mr-1" />
                                                        <span className="text-[8px] font-bold uppercase tracking-wider">Reupload</span>
                                                    </div>
                                                ) : (
                                                    <div className="bg-amber-500 text-white px-2 py-0.5 rounded-lg shadow-md flex items-center border border-white/20" title="Pending Approval">
                                                        <AlertCircle className="w-3 h-3 mr-1" />
                                                        <span className="text-[8px] font-bold uppercase tracking-wider">Pending</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                } else {
                                    slots.push(
                                        isLocked ? (
                                            <div key={`slot-${i}`} className={`border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center h-28 bg-slate-50/50 opacity-40 grayscale`}>
                                                <ImageIcon className="w-6 h-6 text-slate-300 mb-1" />
                                                <span className={`text-[8px] font-bold uppercase tracking-widest text-slate-400`}>Not Provided</span>
                                            </div>
                                        ) : (
                                            <label key={`slot-${i}`} className={`cursor-pointer border-2 border-dashed ${cat.borderHover} rounded-lg flex flex-col items-center justify-center h-28 ${cat.bgClass} transition-all hover:bg-opacity-50 hover:scale-[1.02] active:scale-95 group/slot shadow-sm`}>
                                                <input type="file" className="hidden" accept={cat.accept} disabled={uploading} onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], cat.key)} />
                                                <div className={`p-2 rounded-full ${cat.bgClass} mb-2 group-hover/slot:scale-110 transition-transform`}>
                                                    <Plus className={`w-5 h-5 ${cat.colorClass}`} />
                                                </div>
                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${cat.colorClass}`}>Add Photo</span>
                                            </label>
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
                        <div className="flex-1 flex flex-col">
                            <div 
                                className={`relative flex-1 min-h-[160px] rounded-lg border shadow-sm group/img ${property.adminNotes?.includes(`[REUPLOAD:${cat.key}]`) ? 'border-red-500 border-2 ring-4 ring-red-100 bg-red-50' : 'bg-white'} overflow-hidden cursor-pointer`}
                                onClick={() => setViewDialog({ isOpen: true, catKey: cat.key, isArray: false, label: cat.label, desc: cat.desc })}
                            >
                                <img src={property[cat.key]} className="absolute inset-0 w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-700" />
                                <div className="absolute inset-0 bg-slate-900/0 hover:bg-slate-900/20 opacity-0 group-hover/img:opacity-100 transition-all flex flex-col items-center justify-center backdrop-blur-[1px] z-30">
                                    <div className="bg-white/90 p-4 rounded-full shadow-2xl scale-75 group-hover/img:scale-110 transition-all">
                                        <Search className="w-6 h-6 text-slate-900" />
                                    </div>
                                </div>
                                <div className="absolute top-3 right-3 z-40">
                                    {property.verifiedDocs && safeParse(property.verifiedDocs).includes(cat.key) ? (
                                        <div className="bg-green-600 text-white px-5 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 border-2 border-green-400/50 scale-105">
                                            <CheckCircle className="w-5 h-5 fill-white/20" />
                                            <span className="text-[13px] font-black uppercase tracking-[0.3em] drop-shadow-md">Verified</span>
                                        </div>
                                    ) : property.adminNotes?.includes(`[REUPLOAD:${cat.key}]`) ? (
                                        <div className="bg-orange-600 animate-pulse text-white px-4 py-2 rounded-2xl shadow-xl flex items-center border-2 border-orange-400/50" title="Reupload Required">
                                            <AlertCircle className="w-4 h-4 mr-2" />
                                            <span className="text-[11px] font-black uppercase tracking-widest">Reupload Required</span>
                                        </div>
                                    ) : (
                                        <div className="bg-amber-500 text-white px-4 py-2 rounded-2xl shadow-xl flex items-center border-2 border-amber-300/50" title="Pending Approval">
                                            <AlertCircle className="w-4 h-4 mr-2" />
                                            <span className="text-[11px] font-black uppercase tracking-widest">Pending</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
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
        <div className="space-y-8 animate-in fade-in duration-500">
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
            </div>

            {/* Content Tabs */}
            <Tabs defaultValue="details" className="w-full">
                <TabsList className="flex items-center w-full max-w-2xl bg-white border-2 border-slate-100 p-2 rounded-[24px] h-20 mb-12 shadow-sm">
                    <TabsTrigger value="details" className="flex-1 rounded-full font-black uppercase text-[11px] tracking-widest gap-3 h-14 data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
                        <Home className="w-5 h-5" /> Property Details
                    </TabsTrigger>
                    <TabsTrigger value="rooms" className="flex-1 rounded-full font-black uppercase text-[11px] tracking-widest gap-3 h-14 data-[state=active]:bg-emerald-600 data-[state=active]:text-white transition-all">
                        <BedDouble className="w-5 h-5" /> Rooms ({property.rooms?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="verification" className={`flex-1 rounded-full font-black uppercase text-[11px] tracking-widest gap-3 h-14 data-[state=active]:text-white transition-all ${property.adminNotes?.includes('[REUPLOAD') ? 'bg-red-50 text-red-600 data-[state=active]:bg-red-600' : 'data-[state=active]:bg-amber-600'}`}>
                        <ShieldCheck className="w-5 h-5" /> Verification
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="md:col-span-2 rounded-3xl border-2 border-slate-50 shadow-sm overflow-hidden">
                            <CardHeader className="bg-slate-50/50 border-b-2 border-slate-50">
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Property Description</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <p className="text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{property.description}</p>
                                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t-2 border-slate-50">
                                    <div className="space-y-2">
                                        <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Available Amenities</div>
                                        <div className="flex flex-wrap gap-2">
                                            {(property.amenities || '').split(',').filter(Boolean).map((a: string) => (
                                                <span key={a} className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-100">{a.trim()}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest">House Rules</div>
                                        <p className="text-xs font-bold text-slate-600">{property.rules || "Standard PG Rules Apply"}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-3xl border-2 border-slate-50 shadow-sm overflow-hidden">
                            <CardHeader className="bg-slate-50/50 border-b-2 border-slate-50">
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Location Map</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px] text-center space-y-3">
                                <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-3xl">📍</div>
                                <div>
                                    <div className="font-black text-slate-800 uppercase tracking-tight">{property.city}</div>
                                    <p className="text-xs font-bold text-slate-400 mt-1">{property.address}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="rounded-3xl border-2 border-slate-50 shadow-sm overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b-2 border-slate-50">
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Property Gallery</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {property.images && safeParse(property.images).map((img: string, i: number) => (
                                    <div key={i} className="aspect-square bg-slate-100 rounded-3xl overflow-hidden border-4 border-white shadow-md hover:scale-105 transition-transform duration-500">
                                        <img src={img} className="object-cover w-full h-full" alt="Gallery" />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="rooms" className="space-y-6">
                    {/* Add Room Section for Owner/Manager */}
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-slate-800">Room Inventory</h2>
                        {role === 'owner' && (
                            <Button className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-black uppercase text-[10px] tracking-widest h-11 px-6 shadow-xl shadow-indigo-100" onClick={() => setIsAddRoomOpen(true)}>
                                <Plus className="w-4 h-4 mr-2" /> Add New Room
                            </Button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {property.rooms?.map((room: any) => (
                            <Card key={room.id} className="rounded-[32px] border-2 border-slate-50 shadow-sm hover:shadow-lg transition-all overflow-hidden group">
                                <div className="p-6 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600 font-black text-xl shadow-inner group-hover:scale-110 transition-transform">
                                            {room.roomNumber}
                                        </div>
                                        <Badge variant="outline" className="rounded-xl border-2 px-3 py-1 font-black uppercase text-[9px] tracking-widest text-slate-500">{room.type}</Badge>
                                    </div>
                                    <div className="pt-2">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly Rent</div>
                                        <div className="text-2xl font-black text-slate-900 tracking-tighter">₹{room.price.toLocaleString()}</div>
                                    </div>
                                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${room.availability > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                                            <span className="text-[11px] font-bold text-slate-600">{room.availability} BEDS READY</span>
                                        </div>
                                        {role === 'owner' && (
                                            <Button variant="ghost" size="sm" className="h-8 rounded-lg font-black text-[10px] text-indigo-600" onClick={() => openEditRoomDialog(room)}>EDIT</Button>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="verification" className="space-y-8">
                     <div className="bg-indigo-900 rounded-[40px] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden">
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                            <div className="max-w-xl space-y-4">
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md">
                                    <ShieldCheck className="w-5 h-5 text-indigo-300" />
                                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-100">Official Compliance Center</span>
                                </div>
                                <h2 className="text-4xl font-extrabold tracking-tight">System Identity <span className="text-indigo-400">Verification</span></h2>
                                <p className="text-indigo-100/70 font-medium text-lg leading-relaxed">
                                    Upload government-issued IDs and building documentation to activate your property on RentPe. High-quality scans ensure faster approval.
                                </p>
                            </div>
                            <div className="flex items-center gap-6">
                               <div className="text-center p-6 rounded-3xl bg-white/10 border border-white/10 backdrop-blur-xl">
                                   <div className="text-4xl font-black mb-1">{(safeParse(property.verifiedDocs).length / 9 * 100).toFixed(0)}%</div>
                                   <div className="text-[9px] font-black uppercase tracking-widest text-indigo-300">COMPLIANCE SCORE</div>
                               </div>
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl -z-0"></div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            { key: 'buildingPhotos', label: 'Building Exterior', desc: 'MAIN ENTRANCE & STREET VIEW', icon: <Building2 />, bgClass: 'bg-indigo-50', colorClass: 'text-indigo-600', borderHover: 'hover:border-indigo-300', isArray: true, max: 4, accept: "image/*" },
                            { key: 'commonAreaPhotos', label: 'Common Areas', desc: 'KITCHEN, LOBBY & GYM', icon: <Users />, bgClass: 'bg-indigo-50', colorClass: 'text-indigo-600', borderHover: 'hover:border-indigo-300', isArray: true, max: 2, accept: "image/*" },
                            { key: 'roomsAndBathroomPhotos', label: 'Living Spaces', desc: 'ROOMS & BATHROOMS', icon: <BedDouble />, bgClass: 'bg-indigo-50', colorClass: 'text-indigo-600', borderHover: 'hover:border-indigo-300', isArray: true, max: 4, accept: "image/*" },
                            { key: 'parkingPhotos', label: 'Parking Area', desc: 'BIKE & CAR PARKING', icon: <ParkingCircle />, bgClass: 'bg-indigo-50', colorClass: 'text-indigo-600', borderHover: 'hover:border-indigo-300', isArray: true, max: 2, accept: "image/*" },
                            { key: 'amenitiesPhotos', label: 'Extra Amenities', desc: 'POWER BACKUP, WATER ETC', icon: <Plus />, bgClass: 'bg-indigo-50', colorClass: 'text-indigo-600', borderHover: 'hover:border-indigo-300', isArray: true, max: 4, accept: "image/*" },
                            { key: 'aadhaarProof', label: 'Owner Aadhaar', desc: 'FRONT & BACK SCAN', icon: <UserIcon />, bgClass: 'bg-indigo-50', colorClass: 'text-indigo-600', borderHover: 'hover:border-indigo-300', isArray: true, max: 2, accept: "image/*,application/pdf" },
                            { key: 'panProof', label: 'PAN Card', desc: 'INDIVIDUAL OR BUSINESS', icon: <Landmark />, bgClass: 'bg-indigo-50', colorClass: 'text-indigo-600', borderHover: 'hover:border-indigo-300', isArray: true, max: 2, accept: "image/*,application/pdf" },
                            { key: 'livePhotoUrl', label: 'Current Selfie', desc: 'LIVE PHOTO OF OWNER', icon: <Camera />, bgClass: 'bg-cyan-50', colorClass: 'text-cyan-600', borderHover: 'hover:border-cyan-300', isArray: false, isLive: true, accept: "image/*" },
                            { key: 'pgLicenceUrl', label: 'Trade Licence', desc: 'GOVT PERMIT / LICENCE', icon: <FileText />, bgClass: 'bg-indigo-50', colorClass: 'text-indigo-600', borderHover: 'hover:border-indigo-300', isArray: true, max: 2, accept: "image/*,application/pdf" },
                        ].map(cat => renderCategory(cat, isLocked))}
                     </div>
                </TabsContent>
            </Tabs>

            {/* Room Add/Edit Dialogs */}
            <Dialog open={isAddRoomOpen} onOpenChange={setIsAddRoomOpen}>
                <DialogContent className="rounded-[32px] border-4 border-slate-900 shadow-2xl p-8">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight">Register New Room</DialogTitle>
                        <DialogDescription className="font-bold text-slate-400 uppercase tracking-[0.2em] text-[10px]">Add inventory to {property.name}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-6 font-bold">
                        <div className="grid gap-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400">Room Identifier</Label>
                            <Input placeholder="e.g. 101, B-4" className="h-12 rounded-2xl border-2 border-slate-100" value={roomForm.roomNumber} onChange={e => setRoomForm({...roomForm, roomNumber: e.target.value})} />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400">Bed Configuration</Label>
                            <select className="h-12 rounded-2xl border-2 border-slate-100 bg-white px-4" value={roomForm.type} onChange={e => setRoomForm({...roomForm, type: e.target.value})}>
                                <option>Single Sharing</option>
                                <option>Double Sharing</option>
                                <option>Three Sharing</option>
                                <option>Four Sharing</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Monthly Rent (₹)</Label>
                                <Input type="number" className="h-12 rounded-2xl border-2 border-slate-100" value={roomForm.price} onChange={e => setRoomForm({...roomForm, price: e.target.value})} />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Total Bed Count</Label>
                                <Input type="number" className="h-12 rounded-2xl border-2 border-slate-100" value={roomForm.availability} onChange={e => setRoomForm({...roomForm, availability: e.target.value})} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-xs" onClick={handleSaveRoom} disabled={savingRoom}>{savingRoom ? "PROCESSING..." : "REGISTER ROOM"}</Button>
                    </DialogFooter>
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
                            <Button variant="ghost" className="h-16 px-8 rounded-3xl border-2 border-white/10 font-black uppercase tracking-widest text-xs text-white hover:bg-white/5" onClick={stopCapture}>CANCEL</Button>
                         </div>
                    </div>
                </DialogContent>
                <canvas ref={canvasRef} className="hidden" />
            </Dialog>

            {/* View Dialog */}
            <Dialog open={!!viewDialog} onOpenChange={() => setViewDialog(null)}>
                <DialogContent className="max-w-4xl p-0 rounded-[48px] border-[12px] border-slate-900 shadow-2xl overflow-hidden">
                    {viewDialog && (
                        <div className="bg-white flex flex-col md:flex-row h-full">
                            <div className="flex-1 bg-slate-100 relative min-h-[400px] flex items-center justify-center overflow-hidden">
                                {(() => {
                                    const photos = property[viewDialog.catKey] ? safeParse(property[viewDialog.catKey]) : [];
                                    const photo = viewDialog.isArray ? photos[viewDialog.index!] : property[viewDialog.catKey];
                                    const img = typeof photo === 'string' ? photo : photo?.url;
                                    return (
                                        <div className="relative w-full h-full flex items-center justify-center p-8">
                                            <img src={img} className="max-w-full max-h-[70vh] rounded-3xl shadow-2xl object-contain transition-transform duration-300" style={{ transform: `scale(${previewZoom})` }} />
                                            {/* Preview Controls */}
                                            <div className="absolute bottom-8 flex gap-3 bg-slate-900/80 backdrop-blur-md p-2 rounded-2xl shadow-2xl ring-4 ring-white/10">
                                                <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 h-10 w-10 rounded-xl" onClick={() => setPreviewZoom(p => Math.max(0.5, p - 0.25))}><ZoomOut className="w-5 h-5" /></Button>
                                                <div className="flex items-center px-4 font-black text-white text-[10px] tracking-widest border-x border-white/10">{(previewZoom * 100).toFixed(0)}%</div>
                                                <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 h-10 w-10 rounded-xl" onClick={() => setPreviewZoom(p => Math.min(3, p + 0.25))}><ZoomIn className="w-5 h-5" /></Button>
                                                <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 h-10 w-10 rounded-xl ml-4" onClick={() => setPreviewZoom(1)}><RotateCcw className="w-5 h-5" /></Button>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                            <div className="w-full md:w-80 bg-slate-50 p-8 border-l-2 border-slate-100 flex flex-col">
                                <div className="space-y-6 flex-1">
                                    <div>
                                        <div className="text-[10px] font-black uppercase text-indigo-600 tracking-widest mb-1.5 px-0.5">Asset Category</div>
                                        <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{viewDialog.label}</h3>
                                        <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">{viewDialog.desc}</p>
                                    </div>

                                    <div className="space-y-4 pt-6 border-t-2 border-slate-100">
                                        <div className="bg-white p-4 rounded-2xl border-2 border-slate-100 shadow-sm">
                                            <div className="text-[9px] font-black text-slate-400 uppercase mb-2">Verification Status</div>
                                            {(() => {
                                                const verified = property.verifiedDocs && safeParse(property.verifiedDocs).includes(viewDialog.isArray ? `${viewDialog.catKey}-${viewDialog.index}` : viewDialog.catKey);
                                                return verified ? (
                                                    <div className="flex items-center gap-2 text-emerald-600">
                                                        <CheckCircle className="w-5 h-5" />
                                                        <span className="text-[11px] font-black uppercase tracking-widest">Officially Verified</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-amber-500">
                                                        <Clock className="w-5 h-5" />
                                                        <span className="text-[11px] font-black uppercase tracking-widest">Pending Review</span>
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {!isLocked && (
                                            <div className="space-y-3 pt-6 border-t-2 border-slate-100">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Management Actions</div>
                                                <label className="flex items-center justify-center gap-3 w-full h-12 bg-white border-2 border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-all cursor-pointer shadow-sm">
                                                    <input type="file" className="hidden" disabled={uploading} onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], viewDialog.catKey, viewDialog.index)} />
                                                    <RefreshCcw className={`w-4 h-4 ${uploading ? 'animate-spin' : ''}`} /> Update File
                                                </label>
                                                <Button variant="ghost" className="w-full h-12 rounded-2xl border-2 border-transparent text-red-400 hover:bg-red-50 hover:text-red-600 font-black text-[10px] uppercase tracking-widest transition-all" onClick={() => {
                                                    handleDelete(viewDialog.catKey, viewDialog.index);
                                                    setViewDialog(null);
                                                }}>
                                                    <Trash2 className="w-4 h-4 mr-2" /> Delete Asset
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <Button className="mt-auto h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 font-black uppercase tracking-widest text-[10px]" onClick={() => setViewDialog(null)}>Dismiss Preview</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
