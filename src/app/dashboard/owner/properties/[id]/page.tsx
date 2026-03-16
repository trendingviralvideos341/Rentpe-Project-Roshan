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

export default function PropertyManagePage() {
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
                    router.push("/dashboard/owner/properties");
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [propertyId]);

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

    // Cleanup effect for camera stream
    useEffect(() => {
        return () => {
            stopCapture();
        };
    }, [stopCapture]);

    const handleFileUpload = async (file: File, docType: string, index?: number) => {
        // Category-based size limit logic (User wants 5MB total per category)
        const categories: Record<string, any> = {
            buildingPhotos: { name: "Building Photos", maxSize: 5 * 1024 * 1024, maxMb: 5, isArray: true },
            commonAreaPhotos: { name: "Common Area Photos", maxSize: 5 * 1024 * 1024, maxMb: 5, isArray: true },
            roomsAndBathroomPhotos: { name: "Rooms & Bathroom Photos", maxSize: 5 * 1024 * 1024, maxMb: 5, isArray: true },
            parkingPhotos: { name: "Parking Area Photos", maxSize: 5 * 1024 * 1024, maxMb: 5, isArray: true },
            amenitiesPhotos: { name: "Other Amenities Photos", maxSize: 5 * 1024 * 1024, maxMb: 5, isArray: true },
            aadhaarProof: { name: "Aadhaar Proof", maxSize: 5 * 1024 * 1024, maxMb: 5, isArray: true },
            panProof: { name: "PAN Proof", maxSize: 5 * 1024 * 1024, maxMb: 5, isArray: true },
            pgLicenceUrl: { name: "PG Licence", maxSize: 5 * 1024 * 1024, maxMb: 5, isArray: true },
            livePhotoUrl: { name: "Live Photo", maxSize: 5 * 1024 * 1024, maxMb: 5, isArray: false }
        };

        const cat = categories[docType];
        if (file.size > cat.maxSize) {
            toast.error(`File "${file.name}" exceeds the ${cat.name} size limit (${cat.maxMb}MB).`);
            return;
        }

        // Logic for "Remaining MB" calculation: 
        // We'll calculate it on the fly in the render, but we need to ensure the new file fits.
        if (cat?.isArray) {
            const photos = property[docType] ? safeParse(property[docType]) : [];
            // For simplicity, we'll assume each existing photo is ~1MB if size not tracked, 
            // but the user wants real-time. I'll add a 'size' property to the JSON if it doesn't exist.
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
            
            // Timeout safety for fetch if server hangs (though Cloudinary now has its own)
            const data = await res.json();

            if (res.ok && data.url) {
                let updateData: any = { [docType]: data.url };
                const newPropertyState = { ...property };

                if (cat?.isArray) {
                    const existingPhotos = property[docType] ? safeParse(property[docType]) : [];
                    // max is determined by category, but default to 4 for photos and 2 for docs
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

    const getReuploadNote = (docType: string) => {
        if (!property?.adminNotes) return null;

        const verifiedDocs = property.verifiedDocs ? safeParse(property.verifiedDocs) : [];
        // If the entire category is verified, ignore the reupload note
        if (verifiedDocs.includes(docType)) return null;

        const lines = property.adminNotes.split('\n');
        // Match both [REUPLOAD:category] and [REUPLOAD:category-index]
        const matches = lines.filter((l: string) =>
            l.startsWith(`[REUPLOAD:${docType}]`) || l.startsWith(`[REUPLOAD:${docType}-`)
        );

        if (matches.length > 0) {
            const parsedNotes = matches.map((m: string) => {
                const tagFull = m.match(/\[REUPLOAD:[a-zA-Z0-9-]+\]/)?.[0] || '';
                const tagContent = tagFull.replace('[REUPLOAD:', '').replace(']', '');
                const parts = tagContent.split('-');

                // If it's a specific photo in an array, check if that specific photo is verified
                if (parts[1]) {
                    const specificDocKey = `${docType}-${parts[1]}`;
                    if (verifiedDocs.includes(specificDocKey)) return null;
                }

                const indexLabel = parts[1] ? `(Photo ${parseInt(parts[1]) + 1}) - ` : '';
                return `${indexLabel}${m.replace(tagFull, '').trim()}`.trim();
            }).filter(Boolean);

            if (parsedNotes.length > 0) {
                return parsedNotes.join(' | ');
            }
        }

        return null;
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



    const handleLivePhoto = () => {
        startCapture();
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
                                            
                                            {/* Hover Overlay */}
                                            <div className="absolute inset-0 bg-slate-900/0 hover:bg-slate-900/20 opacity-0 group-hover/img:opacity-100 transition-all flex flex-col items-center justify-center backdrop-blur-[1px] z-30">
                                                <div className="bg-white/90 p-3 rounded-full shadow-2xl scale-75 group-hover/img:scale-100 transition-all">
                                                    <Search className="w-5 h-5 text-slate-900" />
                                                </div>
                                                <span className="text-[9px] font-black text-white mt-2 uppercase tracking-widest drop-shadow-lg">View Photo</span>
                                            </div>

                                            {/* Verified Badge */}
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

                                            {/* Watermark */}
                                            {isDocVerified && (
                                                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none opacity-[0.05] z-10 transition-opacity group-hover/img:opacity-[0.08]">
                                                    <span className="text-xl font-black rotate-[-20deg] text-green-700 uppercase tracking-[0.3em] whitespace-nowrap">VERIFIED</span>
                                                </div>
                                            )}
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
                                <img 
                                    src={property[cat.key]} 
                                    className="absolute inset-0 w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-700" 
                                />
                                
                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-slate-900/0 hover:bg-slate-900/20 opacity-0 group-hover/img:opacity-100 transition-all flex flex-col items-center justify-center backdrop-blur-[1px] z-30">
                                    <div className="bg-white/90 p-4 rounded-full shadow-2xl scale-75 group-hover/img:scale-110 transition-all">
                                        <Search className="w-6 h-6 text-slate-900" />
                                    </div>
                                    <span className="text-[10px] font-black text-white mt-3 uppercase tracking-widest drop-shadow-lg">View Photo</span>
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

                                {/* Watermark */}
                                {property.verifiedDocs && safeParse(property.verifiedDocs).includes(cat.key) && (
                                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none opacity-[0.05] z-10 transition-opacity group-hover/img:opacity-[0.08]">
                                        <span className="text-5xl font-black rotate-[-20deg] text-green-700 uppercase tracking-[0.3em] whitespace-nowrap">VERIFIED</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : cat.isLive ? (
                        <div className="flex-1 flex flex-col gap-4 items-center justify-center border-2 border-dashed border-cyan-200 rounded-2xl bg-cyan-50/30 p-8 group/live hover:bg-cyan-50/50 transition-all">
                            <div className="w-20 h-20 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center mb-2 group-hover/live:scale-110 transition-transform duration-500 shadow-inner border-2 border-cyan-200/50">
                                <Camera className="w-10 h-10" />
                            </div>
                            <div className="text-center">
                                <p className="text-[12px] font-black text-cyan-900 uppercase tracking-tighter">Live Identity Required</p>
                                <p className="text-[10px] text-cyan-600 mt-1 max-w-[180px] font-bold">Please capture a live selfie of the property owner for verification.</p>
                            </div>
                            <Button 
                                onClick={handleLivePhoto} 
                                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-black text-[12px] uppercase tracking-widest py-6 rounded-xl shadow-xl shadow-cyan-100 transition-all active:scale-95 border-b-4 border-cyan-800"
                            >
                                Open Secure Camera
                            </Button>
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

    if (loading) return <div className="p-20 text-center animate-pulse text-muted-foreground">Loading property details...</div>;
    if (!property) return null;

    const isLocked = ['VERIFIED_SUCCESSFULLY', 'APPROVED_PENDING_PAYMENT', 'APPROVED_PAYMENT_VERIFIED', 'APPROVED'].includes(property.status);

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard/owner/properties"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        {property.name}
                        <Badge variant="secondary" className={`
                            ${property.status === 'APPROVED' ? 'bg-green-100 text-green-700' : ''}
                            ${(property.status === 'SUSPENDED' || property.status === 'REJECTED') ? 'bg-red-100 text-red-700' : ''}
                            ${(property.status === 'PENDING_VERIFICATION' || property.status === 'NEEDS_CORRECTION') ? 'bg-amber-100 text-amber-700' : ''}
                            ${property.status === 'APPROVED_PENDING_PAYMENT' ? 'bg-purple-100 text-purple-700 border-purple-200' : ''}
`}>
                            {property.status.replace('_', ' ')}
                        </Badge>
                        {property.displayId && (
                            <div className="flex flex-col items-center px-3 py-1 bg-slate-900 text-white rounded-lg ml-auto shadow-lg border border-slate-700 group hover:scale-105 transition-transform cursor-help" title="Official Property Registration Number">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-0.5">Reg ID</span>
                                <span className="text-sm font-black font-mono tracking-tighter">{property.displayId}</span>
                            </div>
                        )}
                    </h1>
                    <p className="text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-4 w-4" /> {property.city}, {property.address}
                    </p>
                </div>
                <div className="ml-auto">
                    {uploadingCount > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 animate-pulse">
                            <RefreshCcw className="w-4 h-4 animate-spin text-indigo-600" />
                            <span className="text-xs font-bold text-indigo-700">System Syncing...</span>
                        </div>
                    )}
                </div>
            </div>

            {(property.status === 'REJECTED' || property.status === 'SUSPENDED' || ((property.status === 'NEEDS_CORRECTION' || property.status === 'PENDING_VERIFICATION') && property.adminNotes?.includes('[REUPLOAD'))) && property.adminNotes && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg shadow-sm">
                    <h3 className="text-red-800 font-bold mb-3 flex items-center gap-2 border-b border-red-200 pb-2">
                        <AlertCircle className="h-5 w-5" /> RentPe Team Feedback / Corrections Needed
                    </h3>
                    <div className="text-red-700 space-y-2 mb-4">
                        {property.adminNotes.split('\n').map((line: string, i: number) => {
                            if (line.includes('[REUPLOAD:')) {
                                const tagMatch = line.match(/\[REUPLOAD:([a-zA-Z0-9-]+)\]/);
                                let prefix = "Document Reupload";
                                if (tagMatch && tagMatch[1]) {
                                    const rawKey = tagMatch[1].split('-')[0];
                                    const mapping: Record<string, string> = {
                                        buildingPhotos: "Building Photos",
                                        commonAreaPhotos: "Common Area",
                                        roomsAndBathroomPhotos: "Rooms & Bathroom",
                                        parkingPhotos: "Parking Area",
                                        amenitiesPhotos: "Other Amenities",
                                        aadhaarProof: "Aadhaar",
                                        panProof: "PAN Card",
                                        pgLicenceUrl: "PG Licence",
                                        livePhotoUrl: "Live Photo"
                                    };
                                    prefix = mapping[rawKey] || rawKey;

                                    // Append specific photo index if present
                                    const parts = tagMatch[1].split('-');
                                    if (parts[1]) {
                                        prefix += ` (Photo ${parseInt(parts[1]) + 1})`;
                                    }
                                }
                                const cleanText = line.replace(/\[REUPLOAD:[a-zA-Z0-9-]+\]/g, '').trim();
                                if (!cleanText) return null;

                                // Hide if this specific document is verified
                                const verifiedDocs = property.verifiedDocs ? safeParse(property.verifiedDocs) : [];
                                if (tagMatch && tagMatch[1] && verifiedDocs.includes(tagMatch[1])) {
                                    return null;
                                }

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
                    <div className="mt-4">
                        <Button variant="destructive" size="default" className="shadow-md font-bold uppercase tracking-wider text-xs gap-2" onClick={() => {
                            if (property.adminNotes.includes('[REUPLOAD')) {
                                const tab = document.querySelector('[value="verification"]') as HTMLElement;
                                if (tab) tab.click();
                            }
                        }}>Go to Verification Documents <ArrowRight className="w-4 h-4 ml-1" /></Button>
                    </div>
                </div>
            )}

            {property.status === 'APPROVED_PENDING_PAYMENT' && (
                <OwnerPaymentCard
                    propertyId={propertyId}
                    propertyName={property.name}
                    onSuccess={() => {
                        setProperty({ ...property, status: 'APPROVED' });
                        router.refresh();
                    }}
                />
            )}

            <Tabs defaultValue="details" className="w-full">
                <TabsList className="flex items-center w-full max-w-2xl bg-white border-2 border-slate-100 p-2 rounded-[24px] h-20 mb-12 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.1)] relative z-0">
                    <TabsTrigger 
                        value="details"
                        className="flex-1 rounded-full font-black uppercase text-[11px] tracking-[0.15em] gap-3 h-14 transition-all duration-500 
                        bg-indigo-600/90 border-2 border-indigo-400/30 text-white shadow-sm
                        data-[state=active]:bg-indigo-600 data-[state=active]:text-white 
                        data-[state=active]:shadow-[0_20px_40px_-10px_rgba(79,70,229,0.5)] data-[state=active]:border-indigo-300 data-[state=active]:-translate-y-2 group/tab 
                        hover:bg-indigo-500 active:scale-95"
                    >
                        <Home className="w-5 h-5 group-data-[state=active]/tab:scale-110 transition-transform" />
                        <span>Property Details</span>
                    </TabsTrigger>

                    <TabsTrigger 
                        value="rooms"
                        className="flex-1 rounded-full font-black uppercase text-[11px] tracking-[0.15em] gap-3 h-14 transition-all duration-500 
                        bg-emerald-600/90 border-2 border-emerald-400/30 text-white shadow-sm
                        data-[state=active]:bg-emerald-600 data-[state=active]:text-white 
                        data-[state=active]:shadow-[0_20px_40px_-10px_rgba(16,185,129,0.5)] data-[state=active]:border-emerald-300 data-[state=active]:-translate-y-2 group/tab 
                        hover:bg-emerald-500 active:scale-95"
                    >
                        <BedDouble className="w-5 h-5 group-data-[state=active]/tab:scale-110 transition-transform" />
                        <span>Rooms ({property.rooms?.length || 0})</span>
                    </TabsTrigger>

                    <TabsTrigger
                        value="verification"
                        className={`flex-1 rounded-full font-black uppercase text-[11px] tracking-[0.15em] gap-3 h-14 transition-all duration-500 border-2 relative group/tab active:scale-95 shadow-sm text-white
                            ${property.adminNotes?.includes('[REUPLOAD') 
                                ? 'bg-red-600/90 border-red-400/30 hover:bg-red-500 data-[state=active]:-translate-y-2 data-[state=active]:bg-red-600 data-[state=active]:shadow-[0_20px_40px_-10px_rgba(220,38,38,0.5)] data-[state=active]:border-red-300' 
                                : 'bg-amber-600/90 border-amber-400/30 hover:bg-amber-500 data-[state=active]:-translate-y-2 data-[state=active]:bg-amber-600 data-[state=active]:shadow-[0_20px_40px_-10px_rgba(245,158,11,0.5)] data-[state=active]:border-amber-300'
                            }`}
                    >
                        <ShieldCheck className="w-5 h-5 group-data-[state=active]/tab:scale-110 transition-transform" />
                        <span>Verification</span>
                        {property.adminNotes?.includes('[REUPLOAD') && (
                            <span className="absolute top-2 right-2 flex h-3.5 w-3.5" title="Action Required">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-white shadow-sm"></span>
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="pt-4 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Description</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="whitespace-pre-wrap">{property.description}</p>

                            <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-4">
                                <div>
                                    <p className="text-sm text-muted-foreground font-semibold uppercase">Amenities</p>
                                    <p className="mt-1">{(property.amenities || '').split(',').filter(Boolean).join(', ') || 'None listed'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground font-semibold uppercase">Rules</p>
                                    <p className="mt-1">{property.rules}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Photos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {property.images && safeParse(property.images).map((img: string, i: number) => (
                                    <div key={i} className="aspect-video bg-muted rounded-md overflow-hidden relative">
                                        <img src={img} alt={`Property image ${i + 1} `} className="object-cover w-full h-full" />
                                    </div>
                                ))}
                            </div>

                            {(property.buildingPhotos || property.commonAreaPhoto || property.parkingPhoto || property.bathroomPhoto) && (
                                <div className="mt-8 border-t pt-6">
                                    <h4 className="text-sm font-bold uppercase text-muted-foreground mb-4">Verified Building Photos</h4>
                                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                        {property.buildingPhotos && safeParse(property.buildingPhotos).map((img: any, i: number) => (
                                            <div key={i} className="flex flex-col gap-1">
                                                <span className="text-xs font-semibold">Building Photo {i + 1}</span>
                                                <div className="aspect-square bg-muted rounded-md overflow-hidden relative border shadow-sm">
                                                    <img src={typeof img === 'string' ? img : img.url} className="object-cover w-full h-full hover:scale-105 transition-transform" />
                                                </div>
                                            </div>
                                        ))}
                                        {property.commonAreaPhotos && safeParse(property.commonAreaPhotos).map((img: any, i: number) => (
                                            <div key={i} className="flex flex-col gap-1">
                                                <span className="text-xs font-semibold">Common Area {i + 1}</span>
                                                <div className="aspect-square bg-muted rounded-md overflow-hidden relative border shadow-sm">
                                                    <img src={typeof img === 'string' ? img : img.url} className="object-cover w-full h-full hover:scale-105 transition-transform" />
                                                </div>
                                            </div>
                                        ))}
                                        {property.parkingPhoto && (
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-semibold">Parking Area</span>
                                                <div className="aspect-square bg-muted rounded-md overflow-hidden relative border shadow-sm">
                                                    <img src={property.parkingPhoto} className="object-cover w-full h-full hover:scale-105 transition-transform" />
                                                </div>
                                            </div>
                                        )}
                                        {property.bathroomPhoto && (
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-semibold">Bathroom</span>
                                                <div className="aspect-square bg-muted rounded-md overflow-hidden relative border shadow-sm">
                                                    <img src={property.bathroomPhoto} className="object-cover w-full h-full hover:scale-105 transition-transform" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="rooms" className="pt-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div>
                                <CardTitle>Rooms List</CardTitle>
                                <CardDescription>Manage the rooms available in this property.</CardDescription>
                            </div>
                            <Button size="sm" onClick={() => setIsAddRoomOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md">
                                <Plus className="mr-2 h-4 w-4" /> Add Room
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {property.rooms?.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-lg">
                                    No rooms added yet.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {property.rooms && [...property.rooms].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' })).map((room: any) => (
                                        <div key={room.id} className="border rounded-md p-4 flex flex-col justify-between">
                                            <div className="flex justify-between items-center mb-4 border-b pb-2">
                                                <span className="font-bold text-lg">Room {room.roomNumber}</span>
                                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{room.type}</Badge>
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <div className="flex flex-col gap-1">
                                                    {(() => {
                                                        const avail = room.availability || 0;
                                                        if (avail === 0) {
                                                            return <span className="flex items-center gap-1 text-sm font-bold text-red-600"><BedDouble className="h-4 w-4" /> 0 Beds Left (Full)</span>;
                                                        } else if (avail < 5) {
                                                            return <span className="flex items-center gap-1 text-sm font-bold text-red-500"><BedDouble className="h-4 w-4" /> {avail} Beds Left</span>;
                                                        } else if (avail >= 5 && avail <= 15) {
                                                            return <span className="flex items-center gap-1 text-sm font-bold text-orange-500"><BedDouble className="h-4 w-4" /> {avail} Beds Left</span>;
                                                        } else {
                                                            return <span className="flex items-center gap-1 text-sm font-bold text-green-600"><BedDouble className="h-4 w-4" /> {avail} Beds Left</span>;
                                                        }
                                                    })()}
                                                    <span className="font-bold text-green-700 text-xl flex items-center gap-1">
                                                        <span className="text-xs text-muted-foreground font-normal">Rent:</span> ₹{room.price}
                                                    </span>
                                                </div>
                                                <Button variant="outline" size="sm" onClick={() => openEditRoomDialog(room)}>Edit Room</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="verification" className="pt-4 space-y-4">
                    <Card className="border-none shadow-xl overflow-hidden bg-slate-50/30">
                        <CardHeader className="bg-white border-b border-slate-100 pb-8">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest mb-3 border border-indigo-100/50">
                                        <CheckCircle className="w-3 h-3" /> Property Verification Protocol
                                    </div>
                                    <CardTitle className="text-2xl font-black text-slate-900 tracking-tight">Required Documentation</CardTitle>
                                    <CardDescription className="text-slate-500 font-medium max-w-md mt-1">
                                        Please provide clear photos and legal identification to list your property. All files are encrypted and verified by our compliance team.
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 md:p-10">
                            <div className="space-y-12">
                                {/* Property Visuals Group */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="h-8 w-1.5 bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.5)]" />
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                                                I. Property Assets
                                                <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[9px]">VISUALS</Badge>
                                            </h3>
                                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tight">High quality photos increase tenant trust</p>
                                        </div>
                                        <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent ml-4" />
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-2">
                                        {[
                                            { key: 'buildingPhotos', label: 'Building Photos', desc: 'Exterior / Main Gate (Max 4)', icon: <Building2 className="w-5 h-5 text-indigo-600" />, colorClass: 'text-indigo-600', bgClass: 'bg-indigo-50', borderHover: 'border-indigo-200 hover:border-indigo-400', accept: 'image/*', isArray: true, max: 4 },
                                            { key: 'commonAreaPhotos', label: 'Common Area', desc: 'Hallway / Lobby / Shared (Max 4)', icon: <Users className="w-5 h-5 text-purple-600" />, colorClass: 'text-purple-600', bgClass: 'bg-purple-50', borderHover: 'border-purple-200 hover:border-purple-400', accept: 'image/*', isArray: true, max: 4 },
                                            { key: 'roomsAndBathroomPhotos', label: 'Rooms & Bathroom', desc: 'Interior Space Checklist (Max 4)', icon: <BedDouble className="w-5 h-5 text-blue-600" />, colorClass: 'text-blue-600', bgClass: 'bg-blue-50', borderHover: 'border-blue-200 hover:border-blue-400', accept: 'image/*', isArray: true, max: 4 },
                                            { key: 'parkingPhotos', label: 'Parking Area', desc: 'Dedicated Space (Max 4)', icon: <ParkingCircle className="w-5 h-5 text-emerald-600" />, colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50', borderHover: 'border-emerald-200 hover:border-emerald-400', accept: 'image/*', isArray: true, max: 4 },
                                            { key: 'amenitiesPhotos', label: 'Other Amenities', desc: 'Fridge/TV/Washing (Max 4)', icon: <ImageIcon className="w-5 h-5 text-cyan-600" />, colorClass: 'text-cyan-600', bgClass: 'bg-cyan-50', borderHover: 'border-cyan-200 hover:border-cyan-400', accept: 'image/*', isArray: true, max: 4 },
                                        ].map((cat) => renderCategory(cat, isLocked))}
                                    </div>
                                </div>

                                {/* Legal Documentation Group */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="h-8 w-1.5 bg-emerald-600 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                                                II. Legal Documentation
                                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[9px]">REQUIRED</Badge>
                                            </h3>
                                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tight">Identity & Ownership Verification</p>
                                        </div>
                                        <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent ml-4" />
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-2">
                                        {[
                                            { key: 'aadhaarProof', label: 'Aadhaar Card', desc: 'FRONT & BACK required', icon: <FileText className="w-5 h-5 text-emerald-600" />, colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50', borderHover: 'border-emerald-200 hover:border-emerald-400', accept: 'image/*,.pdf', isArray: true, max: 2 },
                                            { key: 'panProof', label: 'PAN Card', desc: 'FRONT & BACK required', icon: <FileText className="w-5 h-5 text-blue-600" />, colorClass: 'text-blue-600', bgClass: 'bg-blue-50', borderHover: 'border-blue-200 hover:border-blue-400', accept: 'image/*,.pdf', isArray: true, max: 2 },
                                            { key: 'pgLicenceUrl', label: 'Property License / Docs', desc: 'Official property papers', icon: <Building2 className="w-5 h-5 text-purple-600" />, colorClass: 'text-purple-600', bgClass: 'bg-purple-50', borderHover: 'border-purple-200 hover:border-purple-400', accept: 'image/*,.pdf', isArray: true, max: 2 },
                                            { key: 'livePhotoUrl', label: 'Identity Photo', desc: 'Selfie verification', icon: <Camera className="w-5 h-5 text-cyan-600" />, colorClass: 'text-cyan-600', bgClass: 'bg-cyan-50', borderHover: 'border-cyan-200 hover:border-cyan-400', isLive: true }
                                        ].map((cat) => renderCategory(cat, isLocked))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isAddRoomOpen} onOpenChange={setIsAddRoomOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add a New Room</DialogTitle>
                        <DialogDescription>
                            Enter standard room details.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="roomNum">Room Number / Name</Label>
                            <Input id="roomNum" placeholder="e.g. 101 or Deluxe A" value={roomForm.roomNumber} onChange={e => setRoomForm({ ...roomForm, roomNumber: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Select Bed Type</Label>
                                <select className="w-full border rounded-md p-2 text-sm bg-background" value={roomForm.type} onChange={e => {
                                    const type = e.target.value;
                                    const availMap: Record<string, string> = {
                                        "Single Sharing": "1",
                                        "Double Sharing": "2",
                                        "Three Sharing": "3",
                                        "Four Sharing": "4",
                                        "Five Sharing": "5",
                                        "Six Sharing": "6"
                                    };
                                    setRoomForm({ ...roomForm, type, availability: availMap[type] || "1" });
                                }}>
                                    <option value="Single Sharing">Single Sharing (1)</option>
                                    <option value="Double Sharing">Double Sharing (2)</option>
                                    <option value="Three Sharing">Three Sharing (3)</option>
                                    <option value="Four Sharing">Four Sharing (4)</option>
                                    <option value="Five Sharing">Five Sharing (5)</option>
                                    <option value="Six Sharing">Six Sharing (6)</option>
                                </select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="rent">Monthly Rent (₹)</Label>
                                <Input id="rent" type="number" placeholder="5000" min="0" value={roomForm.price} onChange={e => setRoomForm({ ...roomForm, price: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="avail">Available Beds <span className="text-[10px] text-muted-foreground">(Locked to Bed Type)</span></Label>
                            <Input id="avail" type="number" disabled className="bg-slate-50 font-bold" value={roomForm.availability} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsAddRoomOpen(false)}>Cancel</Button>
                        <Button type="button" onClick={handleSaveRoom} disabled={savingRoom} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            {savingRoom ? "Saving..." : "Save Room"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditRoomOpen} onOpenChange={setIsEditRoomOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Room {editRoomForm.roomNumber}</DialogTitle>
                        <DialogDescription>
                            Update the details of this room.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="editRoomNum">Room Number / Name</Label>
                            <Input id="editRoomNum" placeholder="e.g. 101 or Deluxe A" value={editRoomForm.roomNumber} onChange={e => setEditRoomForm({ ...editRoomForm, roomNumber: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Select Bed Type</Label>
                                <select className="w-full border rounded-md p-2 text-sm bg-background" value={editRoomForm.type} onChange={e => {
                                    const type = e.target.value;
                                    const availMap: Record<string, string> = {
                                        "Single Sharing": "1",
                                        "Double Sharing": "2",
                                        "Three Sharing": "3",
                                        "Four Sharing": "4",
                                        "Five Sharing": "5",
                                        "Six Sharing": "6"
                                    };
                                    setEditRoomForm({ ...editRoomForm, type, availability: availMap[type] || "1" });
                                }}>
                                    <option value="Single Sharing">Single Sharing (1)</option>
                                    <option value="Double Sharing">Double Sharing (2)</option>
                                    <option value="Three Sharing">Three Sharing (3)</option>
                                    <option value="Four Sharing">Four Sharing (4)</option>
                                    <option value="Five Sharing">Five Sharing (5)</option>
                                    <option value="Six Sharing">Six Sharing (6)</option>
                                </select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="editRent">Monthly Rent (₹)</Label>
                                <Input id="editRent" type="number" placeholder="5000" min="0" value={editRoomForm.price} onChange={e => setEditRoomForm({ ...editRoomForm, price: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="editAvail">Available Beds <span className="text-[10px] text-muted-foreground">(Locked to Bed Type)</span></Label>
                            <Input id="editAvail" type="number" disabled className="bg-slate-50 font-bold" value={editRoomForm.availability} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsEditRoomOpen(false)}>Cancel</Button>
                        <Button type="button" onClick={handleEditRoomSave} disabled={editingRoom} className="bg-green-600 hover:bg-green-700 text-white shadow-md">
                            {editingRoom ? "Updating..." : "Update Room"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Camera Capture Dialog */}
            <Dialog open={isCaptureOpen} onOpenChange={(open) => !open && stopCapture()}>
                <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-white">
                            <Camera className="w-5 h-5 text-cyan-400" />
                            Live Identity Verification
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Please position your face clearly in the frame and click capture.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-700 shadow-2xl">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-4 flex justify-center">
                            <div className="w-16 h-16 border-4 border-white rounded-full flex items-center justify-center bg-white/20 backdrop-blur-sm animate-pulse">
                                <div className="w-12 h-12 bg-white rounded-full shadow-lg" />
                            </div>
                        </div>
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                    <DialogFooter className="flex sm:justify-between gap-3">
                        <Button variant="outline" onClick={stopCapture} className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800">
                            Cancel
                        </Button>
                        <Button
                            onClick={capturePhoto}
                            disabled={capturing || uploading}
                            className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold flex-1"
                        >
                            {capturing || uploading ? (
                                <><RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                            ) : (
                                <><Camera className="w-4 h-4 mr-2" /> Capture Photo</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Interactive Photo View Modal */}
            <Dialog open={!!viewDialog?.isOpen} onOpenChange={(open) => !open && setViewDialog(null)}>
                <DialogContent className="max-w-[95vw] md:max-w-7xl p-0 overflow-hidden border-none shadow-2xl bg-slate-950">
                    {viewDialog && (
                        <div className="flex flex-col h-[90vh] relative">
                            {/* Hidden Title for Accessibility */}
                            <div className="sr-only">
                                <DialogHeader>
                                    <DialogTitle>{viewDialog.label} - {viewDialog.desc}</DialogTitle>
                                </DialogHeader>
                            </div>

                            {/* Header: Admin-style Box Header */}
                            <div className="absolute top-6 inset-x-6 z-50 flex items-start justify-between pointer-events-none">
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

                                <button 
                                    onClick={() => setViewDialog(null)}
                                    className="w-14 h-14 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-white/10 text-white flex items-center justify-center hover:bg-red-500/80 transition-all shadow-2xl pointer-events-auto group"
                                >
                                    <XCircle className="w-8 h-8 group-hover:scale-110 transition-transform" />
                                </button>
                            </div>

                            {/* Main Display: Large Image */}
                            <div 
                                className="flex-1 relative flex items-center justify-center group/viewer overflow-hidden"
                                style={{ background: 'radial-gradient(circle at center, #1e1b4b 0%, #020617 50%, #000000 100%)' }}
                            >
                                {(() => {
                                    const photos = viewDialog.isArray ? safeParse(property[viewDialog.catKey]) : [property[viewDialog.catKey]];
                                    const currentImg = typeof photos[viewDialog.index || 0] === 'string' 
                                        ? photos[viewDialog.index || 0] 
                                        : (photos[viewDialog.index || 0]?.url || "");
                                    const photoCount = photos.length;
                                    const docKey = viewDialog.isArray ? `${viewDialog.catKey}-${viewDialog.index}` : viewDialog.catKey;
                                    const isVerified = property.verifiedDocs && safeParse(property.verifiedDocs).includes(docKey);

                                    return (
                                        <>
                                            {/* Advanced Blurry Overlay (Synchronized with Admin) */}
                                            <div className="absolute inset-0 opacity-30 pointer-events-none overflow-hidden">
                                                <img 
                                                    src={currentImg} 
                                                    className="w-full h-full object-cover blur-3xl scale-150" 
                                                />
                                            </div>

                                            {/* Background Glow */}
                                            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-full w-full bg-blue-600/10 blur-[120px] rounded-full opacity-30 z-0" />
                                            
                                            <div className="relative z-10 w-full h-full flex items-center justify-center transition-transform duration-300 ease-out" style={{ transform: `scale(${previewZoom})` }}>
                                                <img 
                                                    src={currentImg} 
                                                    className="max-w-full max-h-full object-contain rounded-xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] border border-white/20 animate-in fade-in zoom-in-95 duration-500" 
                                                />
                                            </div>

                                            {/* Navigation Arrows */}
                                            {viewDialog.isArray && photoCount > 1 && (
                                                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-6 md:px-12 pointer-events-none z-20">
                                                    <button 
                                                        disabled={viewDialog.index === 0}
                                                        onClick={(e) => { e.stopPropagation(); setViewDialog({ ...viewDialog, index: (viewDialog.index || 0) - 1 }); setPreviewZoom(1); }}
                                                        className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all pointer-events-auto active:scale-90 ${viewDialog.index === 0 ? 'bg-white/5 border-white/5 text-white/10 cursor-not-allowed' : 'bg-white/10 border-white/20 text-white hover:bg-indigo-600 hover:border-indigo-400 shadow-2xl backdrop-blur-md'}`}
                                                    >
                                                        <ChevronLeft className="w-8 h-8" />
                                                    </button>
                                                    <button 
                                                        disabled={viewDialog.index === photoCount - 1}
                                                        onClick={(e) => { e.stopPropagation(); setViewDialog({ ...viewDialog, index: (viewDialog.index || 0) + 1 }); setPreviewZoom(1); }}
                                                        className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all pointer-events-auto active:scale-90 ${viewDialog.index === photoCount - 1 ? 'bg-white/5 border-white/5 text-white/10 cursor-not-allowed' : 'bg-white/10 border-white/20 text-white hover:bg-indigo-600 hover:border-indigo-400 shadow-2xl backdrop-blur-md'}`}
                                                    >
                                                        <ChevronRight className="w-8 h-8" />
                                                    </button>
                                                </div>
                                            )}

                                            {/* Top Info Overlays (Sync with Admin layout: Right side) */}
                                            <div className="absolute top-6 right-24 z-40 flex flex-col items-end gap-2">
                                                {viewDialog.isArray && (
                                                    <div className="bg-slate-900/80 backdrop-blur-md text-white border border-white/20 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl">
                                                        Image {viewDialog.index! + 1} / {photoCount}
                                                    </div>
                                                )}

                                                {isVerified ? (
                                                    <div className="bg-green-600/90 backdrop-blur-md text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl flex items-center gap-2 border border-green-400/50">
                                                        <CheckCircle className="w-4 h-4" /> VERIFIED
                                                    </div>
                                                ) : (
                                                    <div className="bg-amber-500/90 backdrop-blur-md text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl flex items-center gap-2 border border-amber-400/50">
                                                        <RotateCcw className="w-4 h-4 animate-pulse" /> PENDING
                                                    </div>
                                                )}
                                            </div>

                                            {/* Floating Zoom Controls (Positioned exactly as requested) */}
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
                                        </>
                                    );
                                 })()}
                            </div>

                            {/* Footer: Control Panel */}
                            <div className="h-28 bg-white border-t flex items-center px-10 relative z-50">
                                <div className="max-w-screen-xl mx-auto w-full flex items-center justify-between gap-6">
                                    <div className="flex items-center gap-3">
                                        {(() => {
                                            const docKey = viewDialog.isArray ? `${viewDialog.catKey}-${viewDialog.index}` : viewDialog.catKey;
                                            const isVerified = property.verifiedDocs && safeParse(property.verifiedDocs).includes(docKey);
                                            
                                            if (!isVerified && !isLocked) {
                                                return (
                                                    <>
                                                        <label className="cursor-pointer">
                                                            <div className="h-12 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center transition-all shadow-lg active:scale-95 font-black uppercase text-[10px] tracking-widest">
                                                                <RefreshCcw className="w-4 h-4 mr-2" /> Replace
                                                            </div>
                                                            <input 
                                                                type="file" 
                                                                className="hidden" 
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) handleFileUpload(file, viewDialog.catKey, viewDialog.index);
                                                                }}
                                                                accept="image/*"
                                                            />
                                                        </label>
                                                        <Button 
                                                            variant="destructive"
                                                            className="h-12 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95"
                                                            onClick={() => {
                                                                handleDelete(viewDialog.catKey, viewDialog.index);
                                                                setViewDialog(null);
                                                            }}
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                                                        </Button>
                                                    </>
                                                );
                                            }
                                            return (
                                                <div className="flex items-center gap-2 text-slate-400 font-bold text-[9px] uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-lg border">
                                                    <CheckCircle className="w-3 h-3" /> Management Locked
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    <Button 
                                        className="h-14 px-12 bg-black hover:bg-slate-900 text-white font-black uppercase text-[11px] tracking-[0.2em] rounded-xl shadow-xl active:scale-95 transition-all"
                                        onClick={() => { setViewDialog(null); setPreviewZoom(1); }}
                                    >
                                        Close
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
