"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { getPropertyById, savePropertyDocuments, addRoomToProperty } from "@/actions/properties";
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

    const handleFileUpload = async (file: File, docType: 'pgPhotoUrl' | 'idProofUrl' | 'pgLicenceUrl') => {
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
                await savePropertyDocuments(propertyId, { [docType]: data.url });
                setProperty({ ...property, [docType]: data.url });
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
                                                <span className="flex items-center gap-1 text-sm font-medium"><BedDouble className="h-4 w-4 text-indigo-500" /> {room.availability} Beds Left</span>
                                                <span className="font-bold text-green-700 text-xl flex items-center gap-1">
                                                    <span className="text-xs text-muted-foreground font-normal">Rent:</span> ₹{room.price}
                                                </span>
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
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* PG Photo */}
                                <div className="border hover:border-indigo-400 transition-all rounded-lg p-5 flex flex-col justify-between">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-3 bg-indigo-100 rounded-full text-indigo-600"><ImageIcon className="w-6 h-6" /></div>
                                        <div>
                                            <h4 className="font-bold text-sm">Building Entry Photo</h4>
                                            <p className="text-xs text-muted-foreground">Clear photo from outside</p>
                                        </div>
                                    </div>
                                    {property.pgPhotoUrl ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="w-full h-32 bg-muted rounded overflow-hidden">
                                                <img src={property.pgPhotoUrl} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="text-xs text-green-600 font-bold flex items-center justify-center gap-1"><CheckCircle className="w-4 h-4" /> Uploaded</div>
                                        </div>
                                    ) : (
                                        <div className="mt-4 text-center">
                                            <label className="cursor-pointer">
                                                <input type="file" className="hidden" accept="image/*" disabled={uploading} onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'pgPhotoUrl')} />
                                                <div className="w-full border-2 border-dashed border-indigo-200 rounded-md py-6 hover:bg-indigo-50 transition-colors">
                                                    <Upload className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                                                    <p className="text-sm font-semibold text-indigo-600">Select File</p>
                                                    <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG up to 5MB</p>
                                                </div>
                                            </label>
                                        </div>
                                    )}
                                </div>

                                {/* ID Proof */}
                                <div className="border hover:border-emerald-400 transition-all rounded-lg p-5 flex flex-col justify-between">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-3 bg-emerald-100 rounded-full text-emerald-600"><FileText className="w-6 h-6" /></div>
                                        <div>
                                            <h4 className="font-bold text-sm">Owner ID Proof</h4>
                                            <p className="text-xs text-muted-foreground">Aadhaar / PAN</p>
                                        </div>
                                    </div>
                                    {property.idProofUrl ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="w-full h-32 bg-muted rounded overflow-hidden">
                                                <img src={property.idProofUrl} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="text-xs text-green-600 font-bold flex items-center justify-center gap-1"><CheckCircle className="w-4 h-4" /> Uploaded</div>
                                        </div>
                                    ) : (
                                        <div className="mt-4 text-center">
                                            <label className="cursor-pointer">
                                                <input type="file" className="hidden" accept="image/*,.pdf" disabled={uploading} onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'idProofUrl')} />
                                                <div className="w-full border-2 border-dashed border-emerald-200 rounded-md py-6 hover:bg-emerald-50 transition-colors">
                                                    <Upload className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                                                    <p className="text-sm font-semibold text-emerald-600">Select File</p>
                                                    <p className="text-[10px] text-muted-foreground mt-1">Image/PDF up to 5MB</p>
                                                </div>
                                            </label>
                                        </div>
                                    )}
                                </div>

                                {/* PG Licence */}
                                <div className="border hover:border-purple-400 transition-all rounded-lg p-5 flex flex-col justify-between">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-3 bg-purple-100 rounded-full text-purple-600"><Building2 className="w-6 h-6" /></div>
                                        <div>
                                            <h4 className="font-bold text-sm">PG / Hostel Licence</h4>
                                            <p className="text-xs text-muted-foreground">Official municipal doc</p>
                                        </div>
                                    </div>
                                    {property.pgLicenceUrl ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="w-full h-32 bg-muted rounded overflow-hidden">
                                                <img src={property.pgLicenceUrl} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="text-xs text-green-600 font-bold flex items-center justify-center gap-1"><CheckCircle className="w-4 h-4" /> Uploaded</div>
                                        </div>
                                    ) : (
                                        <div className="mt-4 text-center">
                                            <label className="cursor-pointer">
                                                <input type="file" className="hidden" accept="image/*,.pdf" disabled={uploading} onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'pgLicenceUrl')} />
                                                <div className="w-full border-2 border-dashed border-purple-200 rounded-md py-6 hover:bg-purple-50 transition-colors">
                                                    <Upload className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                                                    <p className="text-sm font-semibold text-purple-600">Select File</p>
                                                    <p className="text-[10px] text-muted-foreground mt-1">Image/PDF up to 5MB</p>
                                                </div>
                                            </label>
                                        </div>
                                    )}
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
        </div>
    );
}
