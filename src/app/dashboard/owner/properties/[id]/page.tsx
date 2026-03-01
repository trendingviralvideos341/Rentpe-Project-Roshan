"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { getPropertyById, savePropertyDocuments, addRoomToProperty, editRoom } from "@/actions/properties";
import { ArrowLeft, Building2, MapPin, BedDouble, AlertCircle, Upload, CheckCircle, FileText, Image as ImageIcon, Plus } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PropertyManagePage() {
    const params = useParams();
    const router = useRouter();
    const propertyId = params.id as string;

    const [property, setProperty] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Document Upload State
    const [uploading, setUploading] = useState(false);

    // Add Room State
    const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);
    const [roomForm, setRoomForm] = useState({ roomNumber: "", type: "Single", price: "", availability: "1" });
    const [roomPhoto, setRoomPhoto] = useState<File | null>(null);
    const [savingRoom, setSavingRoom] = useState(false);

    // Edit Room State
    const [isEditRoomOpen, setIsEditRoomOpen] = useState(false);
    const [editRoomForm, setEditRoomForm] = useState({ id: "", roomNumber: "", type: "Single", price: "", availability: "1" });
    const [editRoomPhoto, setEditRoomPhoto] = useState<File | null>(null);
    const [editingRoom, setEditingRoom] = useState(false);

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
    }, [propertyId, router]);

    const handleFileUpload = async (file: File, docType: string) => {
        if (file.size > 5 * 1024 * 1024) {
            alert(`File exceeds 5MB limit. Please upload a smaller size.`);
            return;
        }
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();

            if (res.ok && data.url) {
                let updateData: any = { [docType]: data.url };
                let newPropertyState = { ...property };

                if (docType === 'buildingPhotos') {
                    const existingPhotos = property.buildingPhotos ? JSON.parse(property.buildingPhotos) : [];
                    if (existingPhotos.length >= 4) {
                        alert("Maximum 4 building photos allowed.");
                        setUploading(false);
                        return;
                    }
                    const updatedPhotos = [...existingPhotos, data.url];
                    updateData = { buildingPhotos: JSON.stringify(updatedPhotos) };
                    newPropertyState.buildingPhotos = updateData.buildingPhotos;
                } else {
                    newPropertyState[docType] = data.url;
                }

                await savePropertyDocuments(propertyId, updateData);
                setProperty(newPropertyState);
                alert(`Document uploaded successfully!`);
            } else {
                alert(`Upload failed: ${data.error}`);
            }
        } catch (error) {
            console.error("Upload Error:", error);
            alert("An error occurred during upload.");
        } finally {
            setUploading(false);
        }
    };

    const handleSaveRoom = async () => {
        if (!roomForm.roomNumber || !roomForm.price) {
            alert("Room Number and Rent Price are required.");
            return;
        }

        setSavingRoom(true);
        try {
            let photoUrl = "";
            if (roomPhoto) {
                if (roomPhoto.size > 5 * 1024 * 1024) throw new Error("Room photo exceeds 5MB");
                const fd = new FormData(); fd.append('file', roomPhoto);
                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                const d = await res.json();
                if (res.ok) photoUrl = d.url;
            }

            const newRoom = await addRoomToProperty(propertyId, {
                roomNumber: roomForm.roomNumber,
                type: roomForm.type,
                price: parseFloat(roomForm.price),
                availability: parseInt(roomForm.availability),
                photoUrl: photoUrl || undefined
            });

            setProperty({ ...property, rooms: [...(property.rooms || []), newRoom] });
            setIsAddRoomOpen(false);
            setRoomForm({ roomNumber: "", type: "Single", price: "", availability: "1" });
            setRoomPhoto(null);
        } catch (e: any) {
            alert(`Error: ${e.message}`);
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
            let photoUrl = "";
            if (editRoomPhoto) {
                if (editRoomPhoto.size > 5 * 1024 * 1024) throw new Error("Room photo exceeds 5MB");
                const fd = new FormData(); fd.append('file', editRoomPhoto);
                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                const d = await res.json();
                if (res.ok) photoUrl = d.url;
            }

            const updatedRoom = await editRoom(editRoomForm.id, {
                roomNumber: editRoomForm.roomNumber,
                type: editRoomForm.type,
                price: parseFloat(editRoomForm.price),
                availability: parseInt(editRoomForm.availability),
                ...(photoUrl ? { photoUrl } : {})
            });

            setProperty({
                ...property,
                rooms: property.rooms.map((r: any) => r.id === editRoomForm.id ? { ...r, ...updatedRoom } : r)
            });
            setIsEditRoomOpen(false);
            setEditRoomPhoto(null);
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
        setEditRoomPhoto(null);
        setIsEditRoomOpen(true);
    };

    if (loading) return <div className="p-20 text-center animate-pulse text-muted-foreground">Loading property details...</div>;
    if (!property) return null;

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
                            ${property.status === 'LIVE' ? 'bg-green-100 text-green-700' : ''}
                            ${property.status === 'REJECTED' ? 'bg-red-100 text-red-700' : ''}
                            ${property.status === 'PENDING_APPROVAL' ? 'bg-amber-100 text-amber-700' : ''}
                        `}>
                            {property.status.replace('_', ' ')}
                        </Badge>
                    </h1>
                    <p className="text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-4 w-4" /> {property.city}, {property.address}
                    </p>
                </div>
            </div>

            {property.status === 'REJECTED' && property.adminNotes && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg shadow-sm">
                    <h3 className="text-red-800 font-bold mb-2 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" /> Admin Feedback / Corrections Needed
                    </h3>
                    <p className="text-red-700">{property.adminNotes}</p>
                    <div className="mt-4">
                        <Button variant="destructive" size="sm">Edit Property to Resolve Issues</Button>
                    </div>
                </div>
            )}

            <Tabs defaultValue="details">
                <TabsList className="grid w-full grid-cols-3 max-w-2xl">
                    <TabsTrigger value="details">Property Details</TabsTrigger>
                    <TabsTrigger value="rooms">Rooms ({property.rooms?.length || 0})</TabsTrigger>
                    <TabsTrigger value="verification">Verification Documents</TabsTrigger>
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
                                    <p className="mt-1">{property.amenities.split(',').join(', ')}</p>
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
                                {property.images && JSON.parse(property.images).map((img: string, i: number) => (
                                    <div key={i} className="aspect-video bg-muted rounded-md overflow-hidden relative">
                                        <img src={img} alt={`Property image ${i + 1}`} className="object-cover w-full h-full" />
                                    </div>
                                ))}
                            </div>

                            {(property.buildingPhotos || property.commonAreaPhoto || property.parkingPhoto || property.bathroomPhoto) && (
                                <div className="mt-8 border-t pt-6">
                                    <h4 className="text-sm font-bold uppercase text-muted-foreground mb-4">Verified Building Photos</h4>
                                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                        {property.buildingPhotos && JSON.parse(property.buildingPhotos).map((img: string, i: number) => (
                                            <div key={i} className="flex flex-col gap-1">
                                                <span className="text-xs font-semibold">Building Photo {i + 1}</span>
                                                <div className="aspect-square bg-muted rounded-md overflow-hidden relative border shadow-sm">
                                                    <img src={img} className="object-cover w-full h-full hover:scale-105 transition-transform" />
                                                </div>
                                            </div>
                                        ))}
                                        {property.commonAreaPhoto && (
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-semibold">Common Area</span>
                                                <div className="aspect-square bg-muted rounded-md overflow-hidden relative border shadow-sm">
                                                    <img src={property.commonAreaPhoto} className="object-cover w-full h-full hover:scale-105 transition-transform" />
                                                </div>
                                            </div>
                                        )}
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
                                    {property.rooms?.map((room: any) => (
                                        <div key={room.id} className="border rounded-md p-4 flex flex-col justify-between">
                                            <div className="flex justify-between items-center mb-4 border-b pb-2">
                                                <span className="font-bold text-lg">Room {room.roomNumber}</span>
                                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{room.type}</Badge>
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <div className="flex flex-col gap-1">
                                                    <span className="flex items-center gap-1 text-sm font-medium"><BedDouble className="h-4 w-4 text-indigo-500" /> {room.availability} Beds Left</span>
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
                    <Card>
                        <CardHeader>
                            <CardTitle>Verification Documents</CardTitle>
                            <CardDescription>Upload necessary documents for Admin approval. Maximum size 5MB each.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {[
                                    { key: 'buildingPhotos', label: 'Building Photos', desc: '4 exterior/interior photos required', icon: <ImageIcon className="w-5 h-5" />, colorClass: 'text-indigo-600', bgClass: 'bg-indigo-50', borderHover: 'border-indigo-200 hover:border-indigo-400', accept: 'image/*', isArray: true, max: 4 },
                                    { key: 'commonAreaPhoto', label: 'Common Area', desc: 'Hallway, Lobby, or Shared', icon: <ImageIcon className="w-5 h-5" />, colorClass: 'text-orange-600', bgClass: 'bg-orange-50', borderHover: 'border-orange-200 hover:border-orange-400', accept: 'image/*' },
                                    { key: 'parkingPhoto', label: 'Parking Area', desc: 'Parking facility photo', icon: <ImageIcon className="w-5 h-5" />, colorClass: 'text-amber-600', bgClass: 'bg-amber-50', borderHover: 'border-amber-200 hover:border-amber-400', accept: 'image/*' },
                                    { key: 'bathroomPhoto', label: 'Bathroom', desc: 'Sample bathroom photo', icon: <ImageIcon className="w-5 h-5" />, colorClass: 'text-rose-600', bgClass: 'bg-rose-50', borderHover: 'border-rose-200 hover:border-rose-400', accept: 'image/*' },
                                    { key: 'aadhaarProof', label: 'Owner Aadhaar Proof', desc: 'Clear front/back of Aadhaar', icon: <FileText className="w-5 h-5" />, colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50', borderHover: 'border-emerald-200 hover:border-emerald-400', accept: 'image/*,.pdf' },
                                    { key: 'panProof', label: 'Owner PAN Proof', desc: 'Clear photo of PAN Card', icon: <FileText className="w-5 h-5" />, colorClass: 'text-blue-600', bgClass: 'bg-blue-50', borderHover: 'border-blue-200 hover:border-blue-400', accept: 'image/*,.pdf' },
                                    { key: 'pgLicenceUrl', label: 'PG / Hostel Licence', desc: 'Official municipal doc', icon: <Building2 className="w-5 h-5" />, colorClass: 'text-purple-600', bgClass: 'bg-purple-50', borderHover: 'border-purple-200 hover:border-purple-400', accept: 'image/*,.pdf' }
                                ].map((cat) => (
                                    <div key={cat.key} className={`border-2 ${cat.borderHover} transition-all rounded-xl p-4 flex flex-col justify-between shadow-sm bg-white`}>
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className={`p-2 ${cat.bgClass} rounded-lg ${cat.colorClass}`}>{cat.icon}</div>
                                            <div>
                                                <h4 className="font-bold text-sm tracking-tight">{cat.label}</h4>
                                                <p className="text-[10px] text-muted-foreground uppercase">{cat.desc}</p>
                                            </div>
                                        </div>

                                        {/* Display logic for arrays (Building Photos) or single files */}
                                        {cat.isArray ? (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-2">
                                                    {(() => {
                                                        const photos = property.buildingPhotos ? JSON.parse(property.buildingPhotos) : [];
                                                        const slots = [];
                                                        // Render uploaded photos first
                                                        for (let i = 0; i < 4; i++) {
                                                            if (photos[i]) {
                                                                slots.push(
                                                                    <div key={`photo-${i}`} className="relative group/img h-20 bg-muted rounded-md overflow-hidden border">
                                                                        <img src={photos[i]} className="w-full h-full object-cover" />
                                                                        <div className="absolute top-1 right-1 bg-white/90 p-0.5 rounded shadow-sm text-green-600">
                                                                            <CheckCircle className="w-3 h-3" />
                                                                        </div>
                                                                    </div>
                                                                );
                                                            } else {
                                                                slots.push(
                                                                    <label key={`slot-${i}`} className="cursor-pointer border-2 border-dashed rounded-md flex flex-col items-center justify-center h-20 hover:bg-muted/30 transition-colors">
                                                                        <input type="file" className="hidden" accept={cat.accept} disabled={uploading} onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], cat.key)} />
                                                                        <Plus className="w-4 h-4 text-muted-foreground" />
                                                                        <span className="text-[8px] font-bold uppercase mt-1">Add Photo</span>
                                                                    </label>
                                                                );
                                                            }
                                                        }
                                                        return slots;
                                                    })()}
                                                </div>
                                                <div className="text-[10px] font-bold text-center text-slate-500">
                                                    {property.buildingPhotos ? JSON.parse(property.buildingPhotos).length : 0} / {cat.max} Uploaded
                                                </div>
                                            </div>
                                        ) : property[cat.key] ? (
                                            <div className="flex flex-col gap-2 relative group">
                                                <div className="w-full h-28 bg-muted rounded-lg overflow-hidden border">
                                                    {property[cat.key].endsWith(".pdf") ?
                                                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 relative group-hover:bg-slate-100 transition-colors">
                                                            <FileText className="w-8 h-8 text-slate-400 mb-1" />
                                                            <span className="text-[10px] font-bold text-slate-500">PDF Document</span>
                                                        </div>
                                                        : <img src={property[cat.key]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                    }
                                                </div>
                                                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm p-1 rounded shadow-sm border text-green-600">
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                </div>
                                                <div className="text-[10px] font-bold text-center text-slate-500 mt-1">✓ Uploaded & Saved</div>
                                            </div>
                                        ) : (
                                            <div className="mt-2 text-center h-full flex flex-col justify-end">
                                                <label className="cursor-pointer block w-full group">
                                                    <input type="file" className="hidden" accept={cat.accept} disabled={uploading} onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], cat.key)} />
                                                    <div className={`w-full border-2 border-dashed ${cat.borderHover} rounded-lg py-5 group-hover:${cat.bgClass} transition-colors flex flex-col items-center justify-center h-28`}>
                                                        <Upload className={`w-6 h-6 ${cat.colorClass} mb-2 opacity-60 group-hover:opacity-100 transition-opacity group-hover:-translate-y-1 duration-300`} />
                                                        <p className={`text-xs font-bold ${cat.colorClass}`}>Upload File</p>
                                                        <p className="text-[9px] text-muted-foreground mt-0.5">Max 5MB</p>
                                                    </div>
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                ))}
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
                            Enter standard room details and an optional photo.
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
                                    let avail = "1";
                                    if (type === "Double") avail = "2";
                                    if (type === "Triple") avail = "3";
                                    if (type === "Four") avail = "4";
                                    setRoomForm({ ...roomForm, type, availability: avail });
                                }}>
                                    <option value="Single">Single Bed</option>
                                    <option value="Double">Double Sharing</option>
                                    <option value="Triple">Triple Sharing</option>
                                    <option value="Four">Four Rest</option>
                                </select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="rent">Monthly Rent (₹)</Label>
                                <Input id="rent" type="number" placeholder="5000" min="0" value={roomForm.price} onChange={e => setRoomForm({ ...roomForm, price: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="avail">Available Beds</Label>
                                <Input id="avail" type="number" min="1" value={roomForm.availability} onChange={e => setRoomForm({ ...roomForm, availability: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="photo">Room Photo <span className="text-xs text-muted-foreground">(opt)</span></Label>
                                <Input id="photo" type="file" accept="image/*" onChange={e => setRoomPhoto(e.target.files?.[0] || null)} />
                            </div>
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
                            Update the details of this room or upload a new photo.
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
                                    let avail = "1";
                                    if (type === "Double") avail = "2";
                                    if (type === "Triple") avail = "3";
                                    if (type === "Four") avail = "4";
                                    setEditRoomForm({ ...editRoomForm, type, availability: avail });
                                }}>
                                    <option value="Single">Single Bed</option>
                                    <option value="Double">Double Sharing</option>
                                    <option value="Triple">Triple Sharing</option>
                                    <option value="Four">Four Rest</option>
                                </select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="editRent">Monthly Rent (₹)</Label>
                                <Input id="editRent" type="number" placeholder="5000" min="0" value={editRoomForm.price} onChange={e => setEditRoomForm({ ...editRoomForm, price: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="editAvail">Available Beds</Label>
                                <Input id="editAvail" type="number" min="1" value={editRoomForm.availability} onChange={e => setEditRoomForm({ ...editRoomForm, availability: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="editPhoto">Update Photo <span className="text-xs text-muted-foreground">(opt)</span></Label>
                                <Input id="editPhoto" type="file" accept="image/*" onChange={e => setEditRoomPhoto(e.target.files?.[0] || null)} />
                            </div>
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
        </div>
    );
}
