'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Plus, X, AlertTriangle, ShieldCheck, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { createProperty } from "@/actions/properties";
import { getCurrentUser } from "@/actions/auth";
import { validateName, validatePhone, validateEmail, normalizePhone } from "@/lib/validators";

export default function AddPropertyPage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Form state
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [pincode, setPincode] = useState("");
    const [city, setCity] = useState("");
    const [state, setState] = useState("");
    const [postOffice, setPostOffice] = useState("");
    const [country] = useState("India");
    const [phone, setPhone] = useState("");
    const [description, setDescription] = useState("");
    const [ownerName, setOwnerName] = useState("");
    const [pgLicence, setPgLicence] = useState("");
    const [gender, setGender] = useState<"Boys" | "Girls" | "Co-ed" | "">("");
    const [amenities, setAmenities] = useState<string[]>([]);
    
    // Structured document state
    const [docs, setDocs] = useState<{
        buildingPhotos: File[];
        commonAreaPhotos: File[];
        bathroomPhoto: File | null;
        parkingPhoto: File | null;
        aadhaarProof: File | null;
        panProof: File | null;
        pgLicenceUrl: File | null;
        livePhotoUrl: File | null;
    }>({
        buildingPhotos: [],
        commonAreaPhotos: [],
        bathroomPhoto: null,
        parkingPhoto: null,
        aadhaarProof: null,
        panProof: null,
        pgLicenceUrl: null,
        livePhotoUrl: null,
    });
    
    const [totalSize, setTotalSize] = useState(0);
    const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB
    
    // Preview modal state
    const [viewImage, setViewImage] = useState<string | null>(null);

    // Pincode auto-fetch
    const [pinFetching, setPinFetching] = useState(false);
    const [pinError, setPinError] = useState("");
    const [postOffices, setPostOffices] = useState<{ Name: string; District: string; State: string }[]>([]);

    const [rooms, setRooms] = useState<{ roomNumber: string; type: string; price: string; availability: string }[]>([]);

    useEffect(() => {
        const loadProfile = async () => {
            const user = await getCurrentUser();
            if (user) {
                setOwnerName(user.name || "");
                setPhone(user.phone || "");
            }
        };
        loadProfile();
    }, []);

    const toggleAmenity = (a: string) => {
        setAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
    };

    const addRoom = () => {
        setRooms([...rooms, { roomNumber: "", type: "Single Sharing", price: "", availability: "1" }]);
    };

    const removeRoom = (i: number) => {
        setRooms(rooms.filter((_, idx) => idx !== i));
    };

    const updateRoom = (i: number, field: string, value: string) => {
        const updated = [...rooms];
        (updated[i] as any)[field] = value;
        setRooms(updated);
    };

    const handleDocChange = (category: keyof typeof docs, isMultiple: boolean) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        let newTotalSize = totalSize;
        const currentFiles = isMultiple ? (docs[category] as File[]) : (docs[category] ? [docs[category] as File] : []);
        
        // If single and already has file, subtract its size before adding new one (reupload)
        if (!isMultiple && docs[category]) {
            newTotalSize -= (docs[category] as File).size;
        }

        const validFiles: File[] = [];
        files.forEach(file => {
            if (newTotalSize + file.size <= MAX_TOTAL_SIZE) {
                validFiles.push(file);
                newTotalSize += file.size;
            } else {
                toast.error(`Limit 25MB reached. Cannot add ${file.name}`);
            }
        });

        if (validFiles.length === 0 && files.length > 0) return;

        setDocs(prev => ({
            ...prev,
            [category]: isMultiple ? [...(prev[category] as File[]), ...validFiles] : validFiles[0]
        }));
        setTotalSize(newTotalSize);
    };

    const removeDoc = (category: keyof typeof docs, index?: number) => {
        const current = docs[category];
        if (Array.isArray(current) && index !== undefined) {
            const removed = current[index];
            setDocs(prev => ({
                ...prev,
                [category]: (prev[category] as File[]).filter((_, i) => i !== index)
            }));
            setTotalSize(prev => prev - removed.size);
        } else if (current && !Array.isArray(current)) {
            setTotalSize(prev => prev - (current as File).size);
            setDocs(prev => ({ ...prev, [category]: null }));
        }
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    // Sub-component for upload cards
    const UploadCard = ({ label, sub, category, isMultiple }: { label: string; sub: string; category: keyof typeof docs; isMultiple: boolean }) => {
        const item = docs[category];
        const files = Array.isArray(item) ? item : (item ? [item] : []);

        return (
            <div className="border rounded-xl p-4 flex flex-col gap-3 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2">
                    <div className="bg-purple-100 p-2 rounded-lg">
                        <UploadCloud className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-900 leading-none">{label}</p>
                        <p className="text-[10px] text-slate-500 uppercase mt-1 tracking-wider">{sub}</p>
                    </div>
                </div>

                <div className="min-h-[140px] border-2 border-dashed rounded-lg bg-slate-50 flex flex-col items-center justify-center relative overflow-hidden group">
                    {files.length > 0 ? (
                        <div className="grid grid-cols-2 gap-1 w-full h-full p-1">
                            {files.map((file, i) => (
                                <div key={i} className="relative group/img aspect-square border rounded bg-white overflow-hidden">
                                    <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <button type="button" onClick={() => setViewImage(URL.createObjectURL(file))} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full text-white">
                                            <Eye className="h-4 w-4" />
                                        </button>
                                        <button type="button" onClick={() => removeDoc(category, isMultiple ? i : undefined)} className="p-1.5 bg-red-500/20 hover:bg-red-500/40 rounded-full text-white">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="absolute bottom-0 right-0 bg-black/50 text-[8px] text-white px-1">
                                        {(file.size / (1024 * 1024)).toFixed(1)}MB
                                    </div>
                                </div>
                            ))}
                            {isMultiple && files.length < 10 && (
                                <label className="aspect-square border-2 border-dashed rounded flex items-center justify-center hover:bg-purple-50 cursor-pointer transition-colors">
                                    <Plus className="h-4 w-4 text-purple-400" />
                                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleDocChange(category, true)} />
                                </label>
                            )}
                        </div>
                    ) : (
                        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Awaiting Upload</span>
                            <div className="mt-2 text-purple-600 font-bold text-xs">Add Photo</div>
                            <input type="file" multiple={isMultiple} accept="image/*" className="hidden" onChange={handleDocChange(category, isMultiple)} />
                        </label>
                    )}
                </div>
                
                {files.length > 0 && !isMultiple && (
                    <div className="flex gap-2">
                        <label className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold text-slate-600 text-center cursor-pointer transition-colors">
                            REUPLOAD
                            <input type="file" accept="image/*" className="hidden" onChange={handleDocChange(category, false)} />
                        </label>
                        <button type="button" onClick={() => removeDoc(category)} className="flex-1 py-1.5 border border-red-100 hover:bg-red-50 rounded text-[10px] font-bold text-red-600 transition-colors uppercase">
                            Delete
                        </button>
                    </div>
                )}
            </div>
        );
    };

    // ── Live validation helper ──
    function setFieldErr(field: string, err: string) {
        setErrors(p => { const n = { ...p }; if (err) n[field] = err; else delete n[field]; return n; });
    }

    // ── Pincode auto-fetch ──
    useEffect(() => {
        if (pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
            setPostOffices([]); setPinError(""); setCity(""); setState(""); setPostOffice("");
            return;
        }
        let cancelled = false;
        setPinFetching(true); setPinError("");

        fetch(`https://api.postalpincode.in/pincode/${pincode}`)
            .then(r => r.json())
            .then(data => {
                if (cancelled) return;
                if (!data?.[0] || data[0].Status !== "Success" || !data[0].PostOffice?.length) {
                    setPinError("Invalid PIN results. Please enter details manually.");
                    return;
                }
                const offices = data[0].PostOffice;
                setPostOffices(offices);
                setCity(offices[0].District);
                setState(offices[0].State);
                setPostOffice(offices[0].Name);
            })
            .catch(() => { if (!cancelled) setPinError("Network error. Please enter details manually."); })
            .finally(() => { if (!cancelled) setPinFetching(false); });

        return () => { cancelled = true; };
    }, [pincode]);

    // ── Final validation ──
    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        if (!name.trim()) errs.name = "Property name is required";
        const ownerErr = validateName(ownerName);
        if (ownerErr) errs.ownerName = ownerErr;
        const phoneErr = validatePhone(phone);
        if (phoneErr) errs.phone = phoneErr;
        if (!address.trim()) errs.address = "Street address is required";
        if (!pincode.trim() || !/^\d{6}$/.test(pincode)) errs.pincode = "Valid 6-digit PIN required";
        if (!city.trim()) errs.city = "City is required (enter valid PIN)";
        if (!state.trim()) errs.state = "State is required (enter valid PIN)";
        if (!description.trim()) errs.description = "Description is required";
        if (!gender) errs.gender = "Gender type is required";
        if (amenities.length === 0) errs.amenities = "Select at least one amenity";
        if (rooms.length === 0) errs.rooms = "Add at least one room";

        rooms.forEach((room, i) => {
            if (!room.roomNumber.trim()) errs[`room_${i}_number`] = `Room ${i + 1}: Room number required`;
            if (!room.price || parseFloat(room.price) <= 0) errs[`room_${i}_price`] = `Room ${i + 1}: Valid price required`;
            if (!room.availability || parseInt(room.availability) <= 0) errs[`room_${i}_avail`] = `Room ${i + 1}: Availability required`;
        });

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setSaving(true);
        try {
            const fullAddress = [address, postOffice, city, state].filter(Boolean).join(", ") + ` - ${pincode}, ${country}`;
            const formData = new FormData();
            formData.set("name", name);
            formData.set("address", fullAddress);
            formData.set("city", city);
            formData.set("description", description);
            formData.set("amenities", JSON.stringify(amenities));
            
            // Convert images to base64 for each category
            const categories = Object.keys(docs) as (keyof typeof docs)[];
            const processedDocs: any = {};

            for (const cat of categories) {
                const value = docs[cat];
                if (Array.isArray(value)) {
                    processedDocs[cat] = await Promise.all(value.map(f => fileToBase64(f)));
                } else if (value) {
                    processedDocs[cat] = await fileToBase64(value);
                } else {
                    processedDocs[cat] = null;
                }
            }

            // Map UI docs to backend schema fields
            formData.set("buildingPhotos", JSON.stringify(processedDocs.buildingPhotos || []));
            formData.set("commonAreaPhotos", JSON.stringify(processedDocs.commonAreaPhotos || []));
            formData.set("bathroomPhoto", processedDocs.bathroomPhoto || "");
            formData.set("parkingPhoto", processedDocs.parkingPhoto || "");
            formData.set("aadhaarProof", processedDocs.aadhaarProof || "");
            formData.set("panProof", processedDocs.panProof || "");
            formData.set("pgLicenceUrl", processedDocs.pgLicenceUrl || "");
            formData.set("livePhotoUrl", processedDocs.livePhotoUrl || "");
            
            // Legacy 'images' for backward compatibility
            formData.set("images", JSON.stringify([...(processedDocs.buildingPhotos || []), ...(processedDocs.commonAreaPhotos || [])]));

            formData.set("ownerName", ownerName);
            formData.set("pgLicence", pgLicence);
            formData.set("phone", phone);
            formData.set("gender", gender);
            formData.set("state", state);
            formData.set("pincode", pincode);
            formData.set("country", country);
            formData.set("rooms", JSON.stringify(rooms.map(r => ({
                roomNumber: r.roomNumber,
                type: r.type,
                price: parseFloat(r.price),
                availability: parseInt(r.availability),
            }))));

            const res = await createProperty(formData);
            if (res) {
                toast.success("Property listing submitted! Our verification team will check soon.");
                router.push("/dashboard/owner/my-properties");
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to create property.");
        } finally {
            setSaving(false);
        }
    };

    const hasErr = Object.keys(errors).length > 0;
    const inputErr = (k: string) => errors[k] ? "border-red-500" : "";
    const readOnlyCls = "bg-gray-50 cursor-not-allowed text-sm";

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold">Add New Property</h1>
                <p className="text-muted-foreground">List your PG or Hostel. All fields marked with <span className="text-red-500">*</span> are mandatory.</p>
            </div>

            {hasErr && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                    <div>
                        <p className="font-bold text-red-800">Please fix the following errors:</p>
                        <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                            {Object.values(errors).map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Basic Info */}
                <Card>
                    <CardHeader>
                        <CardTitle>Basic Information</CardTitle>
                        <CardDescription>Name, owner, and contact details.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Property / PG Name <span className="text-red-500">*</span> <span className="text-[10px] text-muted-foreground">(letters only)</span></label>
                            <Input placeholder="e.g. SkyLiv Boys Hostel" value={name}
                                onChange={e => {
                                    const v = e.target.value;
                                    setName(v);
                                    const err = v.length > 0 ? validateName(v) : "";
                                    setFieldErr("name", err);
                                }} className={inputErr("name")} />
                            {errors.name && <p className="text-xs text-red-600 font-semibold">{errors.name}</p>}
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Building Owner Name <span className="text-red-500">*</span> <span className="text-[10px] text-muted-foreground">(letters only)</span></label>
                            <Input placeholder="e.g. Rajesh Kumar" value={ownerName}
                                readOnly={true}
                                className={`${inputErr("ownerName")} ${readOnlyCls}`} />
                            <p className="text-[10px] text-blue-600 font-medium italic">Locked to registered profile name</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Contact Phone <span className="text-red-500">*</span> <span className="text-[10px] text-muted-foreground">(10 digits)</span></label>
                            <Input placeholder="e.g. 9876543210" value={phone}
                                readOnly={true}
                                maxLength={13} className={`${inputErr("phone")} ${readOnlyCls}`} />
                            <p className="text-[10px] text-blue-600 font-medium italic">Locked to registered profile phone</p>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                             <div className="mt-0.5">⚠️</div>
                             <p className="text-[11px] text-red-800 leading-tight">
                                <span className="font-bold">CRITICAL:</span> All registered names (Property & Owner) <span className="font-bold underline">must match</span> with the registered profile details for faster verification.
                             </p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">PG/Hostel Licence No. <span className="text-muted-foreground text-xs">(optional)</span></label>
                            <Input placeholder="e.g. GOV-12345-PG" value={pgLicence} onChange={e => setPgLicence(e.target.value)} />
                        </div>
                    </CardContent>
                </Card>

                {/* Address with Pincode Auto-Fetch */}
                <Card>
                    <CardHeader>
                        <CardTitle>Property Address</CardTitle>
                        <CardDescription>Enter PIN code to auto-fill city and state.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Street / Locality / Landmark <span className="text-red-500">*</span></label>
                            <Input placeholder="e.g. 12-B, MG Road, Near City Mall" value={address}
                                onChange={e => setAddress(e.target.value)} className={inputErr("address")} />
                            {errors.address && <p className="text-xs text-red-500">{errors.address}</p>}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">
                                    PIN Code <span className="text-red-500">*</span>
                                    {pinFetching && <span className="text-blue-500 animate-pulse text-xs ml-1">⏳ Fetching…</span>}
                                </label>
                                <Input placeholder="560001" maxLength={6} value={pincode}
                                    className={`font-mono tracking-wider ${inputErr("pincode")} ${pinError ? "border-red-500" : ""}`}
                                    onChange={e => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                                {pinError && <p className="text-[10px] text-red-500">{pinError}</p>}
                                {errors.pincode && <p className="text-xs text-red-500">{errors.pincode}</p>}
                            </div>
                            {postOffices.length > 1 ? (
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Post Office <span className="text-red-500">*</span></label>
                                    <select value={postOffice} onChange={e => setPostOffice(e.target.value)}
                                        className="w-full h-10 border rounded-md px-3 py-2 text-sm border-input bg-blue-50">
                                        {postOffices.map(po => <option key={po.Name} value={po.Name}>{po.Name}</option>)}
                                    </select>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Post Office <span className="text-red-500">*</span></label>
                                    <Input value={postOffice} onChange={e => setPostOffice(e.target.value)} placeholder="Auto from PIN or type manually" />
                                </div>
                            )}
                            <div className="space-y-1">
                                <label className="text-sm font-medium">City <span className="text-red-500">*</span>
                                    {city && postOffices.length > 0 && <span className="text-green-600 text-[10px] ml-1">✓ Auto</span>}
                                </label>
                                <Input className={inputErr("city")} value={city} onChange={e => setCity(e.target.value)} placeholder="Auto from PIN or type manually" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">State <span className="text-red-500">*</span>
                                    {state && postOffices.length > 0 && <span className="text-green-600 text-[10px] ml-1">✓ Auto</span>}
                                </label>
                                <Input className={inputErr("state")} value={state} onChange={e => setState(e.target.value)} placeholder="Auto from PIN or type manually" />
                            </div>
                        </div>
                        {city && state && pincode.length === 6 && (
                            <p className="text-xs text-green-600 font-medium">✅ {postOffice}, {city}, {state} - {pincode}, {country}</p>
                        )}
                    </CardContent>
                </Card>

                {/* Property Details */}
                <Card>
                    <CardHeader>
                        <CardTitle>Property Details</CardTitle>
                        <CardDescription>Gender type, description, and amenities.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Gender Type <span className="text-red-500">*</span></label>
                            <div className="flex gap-3">
                                {["Boys", "Girls", "Co-ed"].map(g => (
                                    <button key={g} type="button" onClick={() => setGender(g as any)}
                                        className={`px-5 py-2 rounded-full text-sm font-semibold border-2 transition-all ${gender === g ? "bg-purple-600 text-white border-purple-600" : "border-gray-300 text-gray-600 hover:border-purple-400"} ${errors.gender ? "border-red-400" : ""}`}>
                                        {g === "Boys" ? "🧑 Boys" : g === "Girls" ? "👩 Girls" : "👥 Co-ed"}
                                    </button>
                                ))}
                            </div>
                            {errors.gender && <p className="text-xs text-red-500">{errors.gender}</p>}
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Description <span className="text-red-500">*</span></label>
                            <textarea
                                className={`w-full border rounded-md p-3 text-sm min-h-[100px] ${inputErr("description")}`}
                                placeholder="Describe your property — nearby landmarks, rules, USPs etc."
                                value={description} onChange={e => setDescription(e.target.value)} />
                            {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
                        </div>
                    </CardContent>
                </Card>

                {/* Amenities */}
                <Card>
                    <CardHeader>
                        <CardTitle>Amenities <span className="text-red-500">*</span></CardTitle>
                        <CardDescription>Select what your property offers. (At least 1 required)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${errors.amenities ? "border-2 border-red-300 rounded-lg p-2" : ""}`}>
                            {["WiFi", "AC", "Laundry", "Power Backup", "CCTV", "Biometric", "Food", "Cleaning", "Parking", "Gym", "Hot Water", "TV"].map((item) => (
                                <label key={item} className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-muted transition-colors ${amenities.includes(item) ? "bg-primary/10 border-primary" : ""}`}>
                                    <input type="checkbox" className="w-4 h-4 text-primary" checked={amenities.includes(item)} onChange={() => toggleAmenity(item)} />
                                    <span>{item}</span>
                                </label>
                            ))}
                        </div>
                        {errors.amenities && <p className="text-xs text-red-500 mt-2">{errors.amenities}</p>}
                    </CardContent>
                </Card>

                {/* Rooms */}
                <Card>
                    <CardHeader>
                        <CardTitle>Rooms <span className="text-red-500">*</span></CardTitle>
                        <CardDescription>Add rooms with pricing and availability. (At least 1 room required)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {rooms.length === 0 && (
                            <div className={`text-center py-6 text-muted-foreground ${errors.rooms ? "bg-red-50 border border-red-200 rounded-lg" : ""}`}>
                                No rooms added yet. Click below to add your first room.
                            </div>
                        )}
                        {rooms.map((room, i) => (
                            <div key={i} className="border rounded-lg p-4 space-y-3 relative bg-muted/20">
                                <button type="button" onClick={() => removeRoom(i)} className="absolute top-2 right-2 text-red-400 hover:text-red-600">
                                    <X className="h-4 w-4" />
                                </button>
                                <p className="text-sm font-bold text-purple-700">Room #{i + 1}</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground">Room Number <span className="text-red-500">*</span></label>
                                        <Input className={`mt-1 ${errors[`room_${i}_number`] ? "border-red-500" : ""}`} placeholder="e.g. 101" value={room.roomNumber} onChange={e => updateRoom(i, "roomNumber", e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground">Bed Type <span className="text-red-500">*</span></label>
                                        <select className="mt-1 w-full border rounded-md p-2 text-sm bg-background" value={room.type} onChange={e => {
                                            const type = e.target.value;
                                            let autoAvail = "1";
                                            if (type === "Double") autoAvail = "2";
                                            if (type === "Triple") autoAvail = "3";
                                            if (type === "Four") autoAvail = "4";
                                            if (type === "Double Sharing") autoAvail = "2";
                                            if (type === "Three Sharing") autoAvail = "3";
                                            if (type === "Four Sharing") autoAvail = "4";
                                            if (type === "Five Sharing") autoAvail = "5";
                                            if (type === "Six Sharing") autoAvail = "6";

                                            const updated = [...rooms];
                                            updated[i].type = type;
                                            updated[i].availability = autoAvail;
                                            setRooms(updated);
                                        }}>
                                            <option value="Single Sharing">Single Sharing</option>
                                            <option value="Double Sharing">Double Sharing</option>
                                            <option value="Three Sharing">Three Sharing</option>
                                            <option value="Four Sharing">Four Sharing</option>
                                            <option value="Five Sharing">Five Sharing</option>
                                            <option value="Six Sharing">Six Sharing</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground">Monthly Rent (₹) <span className="text-red-500">*</span></label>
                                        <Input type="number" className={`mt-1 ${errors[`room_${i}_price`] ? "border-red-500" : ""}`} placeholder="5000" min={0} value={room.price} onChange={e => updateRoom(i, "price", e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground">Beds Available <span className="text-red-500">*</span></label>
                                        <Input type="number" className={`mt-1 ${errors[`room_${i}_avail`] ? "border-red-500" : ""}`} placeholder="1" min={1} value={room.availability} onChange={e => updateRoom(i, "availability", e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        ))}
                        <Button type="button" variant="outline" className="w-full border-dashed border-2" onClick={addRoom}>
                            <Plus className="h-4 w-4 mr-2" /> Add Room
                        </Button>
                    </CardContent>
                </Card>

                {/* Photos & Documents */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>Photos & Documents</span>
                            <span className="text-xs font-bold text-red-600 uppercase tracking-widest whitespace-nowrap">🔴 MAX 25 MB OVERALLY LIMIT</span>
                        </CardTitle>
                        <CardDescription>Upload specific photos for faster verification by our team.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <UploadCard label="Building Photos" sub="Ext./Int. photos" category="buildingPhotos" isMultiple={true} />
                            <UploadCard label="Common Area" sub="Hall, Lobby etc." category="commonAreaPhotos" isMultiple={true} />
                            <UploadCard label="Bathroom" sub="Sample room photo" category="bathroomPhoto" isMultiple={false} />
                            <UploadCard label="Parking Area" sub="Facility photo" category="parkingPhoto" isMultiple={false} />
                            <UploadCard label="Owner Aadhaar" sub="Front & Back" category="aadhaarProof" isMultiple={false} />
                            <UploadCard label="Owner PAN" sub="Front copy" category="panProof" isMultiple={false} />
                            <UploadCard label="PG Licence" sub="Commercial copy" category="pgLicenceUrl" isMultiple={false} />
                            <UploadCard label="Live Photo" sub="Current owner selfie" category="livePhotoUrl" isMultiple={false} />
                        </div>

                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-md border border-slate-200">
                             <div className="flex flex-col">
                                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Total Consumed</span>
                                <span className={`text-sm font-mono ${(totalSize / (1024 * 1024)) > 20 ? 'text-red-500' : 'text-slate-800'}`}>
                                    {(totalSize / (1024 * 1024)).toFixed(2)} MB
                                </span>
                             </div>
                             <div className="flex flex-col items-end">
                                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Remaining</span>
                                <span className="text-sm font-mono text-green-600">
                                    {(Math.max(0, (MAX_TOTAL_SIZE - totalSize)) / (1024 * 1024)).toFixed(2)} MB
                                </span>
                             </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-purple-600" />
                    <p className="text-sm text-purple-800 font-medium">
                        Property will be listed as <span className="font-bold">Pending Approval</span>. It will go live after <span className="font-bold underline">verification team check</span>.
                    </p>
                </div>

                <div className="flex justify-end space-x-4">
                    <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
                    <Button size="lg" type="submit" disabled={saving} className="bg-purple-700 hover:bg-purple-800">
                        {saving ? "Processing..." : "🏠 Submit for Approval"}
                    </Button>
                </div>
            </form>

            {/* Simple Lightbox for Viewing Images */}
            {viewImage && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <button onClick={() => setViewImage(null)} className="absolute top-6 right-6 text-white hover:text-gray-300">
                        <X className="h-8 w-8" />
                    </button>
                    <img src={viewImage} alt="Full View" className="max-w-full max-h-full rounded-lg shadow-2xl" />
                </div>
            )}
        </div>
    );
}
