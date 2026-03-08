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
    const [propertyType, setPropertyType] = useState<"PG" | "Hostel" | "Flat/Apartment" | "Other" | "">("PG");
    const [otherPropertyType, setOtherPropertyType] = useState("");
    const [gender, setGender] = useState<"Boys" | "Girls" | "Co-ed" | "">("");
    const [amenities, setAmenities] = useState<string[]>([]);
    const [customAmenityInput, setCustomAmenityInput] = useState("");
    const [showCustomAmenity, setShowCustomAmenity] = useState(false);
    
    const amenityOptions = ["WiFi", "AC", "Laundry", "Power Backup", "CCTV", "Biometric", "Food", "Cleaning", "Parking", "Gym", "Hot Water", "TV"];
    
    // Structured document state
    const [docs, setDocs] = useState<{
        buildingPhotos: File[];
        commonAreaPhotos: File[];
        roomsAndBathroomPhotos: File[];
        parkingPhotos: File[];
        amenitiesPhotos: File[];
        aadhaarProof: File[];
        panProof: File[];
        pgLicenceUrl: File[];
        livePhotoUrl: File[];
    }>({
        buildingPhotos: [],
        commonAreaPhotos: [],
        roomsAndBathroomPhotos: [],
        parkingPhotos: [],
        amenitiesPhotos: [],
        aadhaarProof: [],
        panProof: [],
        pgLicenceUrl: [],
        livePhotoUrl: [],
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
                let p = user.phone || "";
                if (p && !p.startsWith("+91")) p = "+91" + p;
                setPhone(p);
            }
        };
        loadProfile();
    }, []);

    const toggleAmenity = (a: string) => {
        setAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
    };

    const addCustomAmenity = () => {
        if (!customAmenityInput.trim()) return;
        const normalizedInput = customAmenityInput.trim();
        if (amenities.includes(normalizedInput)) {
            toast.error("Amenity already added");
            return;
        }
        setAmenities(prev => [...prev, normalizedInput]);
        setCustomAmenityInput("");
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
        const currentFiles = docs[category];
        
        // If single and already has file, subtract its size before adding new one (reupload)
        if (!isMultiple && currentFiles.length > 0) {
            newTotalSize -= currentFiles[0].size;
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
            [category]: isMultiple ? [...prev[category], ...validFiles] : [validFiles[0]]
        }));
        setTotalSize(newTotalSize);
    };

    const removeDoc = (category: keyof typeof docs, index?: number) => {
        const current = docs[category];
        if (index !== undefined) {
            const removed = current[index];
            setDocs(prev => ({
                ...prev,
                [category]: prev[category].filter((_, i) => i !== index)
            }));
            setTotalSize(prev => prev - removed.size);
        } else if (current.length > 0) {
            setTotalSize(prev => prev - current[0].size);
            setDocs(prev => ({ ...prev, [category]: [] }));
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
    const UploadCard = ({ label, sub, category, isMultiple = true, slotsCount = 4, isRequired = false, minRequired }: { 
        label: string; 
        sub: string; 
        category: keyof typeof docs; 
        isMultiple?: boolean; 
        slotsCount?: number;
        isRequired?: boolean;
        minRequired?: number;
    }) => {
        const item = docs[category];
        const files = Array.isArray(item) ? item : (item ? [item] : []);
        const effectiveMinRequired = minRequired ?? (isRequired ? slotsCount : 0);

        const renderGrid = (limit: number) => {
            const slots = [];
            for (let i = 0; i < limit; i++) {
                if (files[i]) {
                    slots.push(
                        <div key={i} className="relative group/img aspect-square border-2 border-purple-200 rounded-xl bg-white overflow-hidden shadow-sm">
                            <img src={URL.createObjectURL(files[i])} alt="preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-all flex flex-col items-center justify-center gap-2 backdrop-blur-[1px]">
                                <button type="button" onClick={() => setViewImage(URL.createObjectURL(files[i]))} 
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-black shadow-lg">
                                    <Eye className="h-3 w-3" /> VIEW
                                </button>
                                <button type="button" onClick={() => removeDoc(category, i)} 
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[9px] font-black shadow-lg">
                                    <X className="h-3 w-3" /> DELETE
                                </button>
                            </div>
                            <div className="absolute bottom-1 right-1 bg-black/60 text-[7px] text-white px-1 rounded-sm font-mono">
                                {(files[i].size / (1024 * 1024)).toFixed(1)}MB
                            </div>
                        </div>
                    );
                } else {
                    const isExtraOptional = files.length >= effectiveMinRequired;
                    slots.push(
                        <label key={i} className="aspect-square border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center bg-slate-50/30 hover:bg-purple-50 hover:border-purple-400 cursor-pointer transition-all group/label">
                            <Plus className={`h-5 w-5 ${isExtraOptional ? "text-slate-300" : "text-slate-400"} group-hover/label:text-purple-600`} />
                            <span className={`text-[9px] font-black ${isExtraOptional ? "text-slate-300" : "text-slate-400"} group-hover/label:text-purple-600 mt-1 uppercase tracking-tight`}>
                                {isExtraOptional ? "OPTIONAL" : "ADD"}
                            </span>
                            <input type="file" accept="image/*" className="hidden" onChange={handleDocChange(category, isMultiple)} />
                        </label>
                    );
                }
            }
            return <div className="grid grid-cols-2 gap-2 w-full">{slots}</div>;
        };

        const error = errors[category];

        return (
            <div className={`border-2 rounded-2xl p-4 flex flex-col gap-3 bg-white transition-all shadow-sm ${error ? "border-red-500 bg-red-50/10" : "border-slate-200 hover:border-purple-300"}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg border ${error ? "bg-red-50 border-red-100" : "bg-purple-50 border-purple-100"}`}>
                            <UploadCloud className={`h-4 w-4 ${error ? "text-red-600" : "text-purple-600"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-black text-slate-800 leading-tight truncate">{label}</p>
                            <p className="text-[9px] text-purple-400 font-bold uppercase truncate">{sub}</p>
                        </div>
                    </div>
                    {isRequired ? (
                        <span className={`text-[10px] font-black px-2 py-1 rounded-md ring-1 ${error ? "bg-red-600 text-white ring-red-600 animate-pulse" : "bg-red-50 text-red-500 ring-red-100/50"}`}>MANDATORY</span>
                    ) : (
                        <span className="bg-slate-50 text-slate-400 text-[10px] font-black px-2 py-1 rounded-md ring-1 ring-slate-100">OPTIONAL</span>
                    )}
                </div>

                <div className="min-h-[140px] flex flex-col items-center justify-center relative">
                    {isMultiple || slotsCount > 1 ? renderGrid(slotsCount) : (
                        files.length > 0 ? (
                            <div className="w-full h-36 relative group border-2 border-purple-200 rounded-xl overflow-hidden shadow-sm">
                                <img src={URL.createObjectURL(files[0])} alt="preview" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
                                    <button type="button" onClick={() => setViewImage(URL.createObjectURL(files[0]))} 
                                        className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black shadow-xl">
                                        <Eye className="h-3 w-3" /> VIEW PHOTO
                                    </button>
                                    <button type="button" onClick={() => removeDoc(category)} 
                                        className="flex items-center gap-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-black shadow-xl">
                                        <X className="h-3 w-3" /> DELETE PHOTO
                                    </button>
                                </div>
                                <div className="absolute bottom-1 right-1 bg-black/60 text-[8px] text-white px-1.5 py-0.5 rounded font-mono">
                                    {(files[0].size / (1024 * 1024)).toFixed(1)}MB
                                </div>
                            </div>
                        ) : (
                            <label className={`w-full h-36 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group/single ${error ? "border-red-400 bg-red-50/50 hover:bg-red-100/50" : "border-slate-300 bg-slate-50/30 hover:bg-purple-50 hover:border-purple-400"}`}>
                                <Plus className={`h-6 w-6 ${error ? "text-red-400" : "text-slate-400 group-hover/single:text-purple-500"} mb-1`} />
                                <span className={`text-[10px] font-black uppercase tracking-widest leading-none ${error ? "text-red-500" : "text-slate-400 group-hover/single:text-purple-500"}`}>AWAITING FILE</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleDocChange(category, false)} />
                            </label>
                        )
                    )}
                </div>
                {error && <p className="text-[10px] text-red-600 font-bold uppercase italic mt-1 text-center">{error}</p>}
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

        // Conditional Mandatory for PG/Hostel text field
        if ((propertyType === "PG" || propertyType === "Hostel") && !pgLicence.trim()) {
            errs.pgLicence = "PG/Hostel Licence Number is required";
        }

        // Conditional Mandatory for Other type description
        if (propertyType === "Other" && !otherPropertyType.trim()) {
            errs.propertyType = "Please specify the property type";
        }

        // Validate mandatory documents with specific slot counts
        if (docs.buildingPhotos.length < 4) errs.buildingPhotos = "4 Building photos are mandatory";
        if (docs.commonAreaPhotos.length < 2) errs.commonAreaPhotos = "2 Common area photos are mandatory";
        if (docs.roomsAndBathroomPhotos.length < 4) errs.roomsAndBathroomPhotos = "4 Rooms & Bathroom photos are mandatory";
        
        // Legal docs (Mandatory)
        if (docs.aadhaarProof.length < 2) errs.aadhaarProof = "Both Aadhaar Front & Back are mandatory";
        if (docs.panProof.length < 2) errs.panProof = "Both PAN Front & Back are mandatory";
        
        // Conditional Mandatory for PG/Hostel
        if (propertyType === "PG" || propertyType === "Hostel") {
            if (!pgLicence.trim()) errs.pgLicence = "PG/Hostel Licence Number is required";
            if (docs.pgLicenceUrl.length < 1) errs.pgLicenceUrl = "PG/Hostel Licence photo is mandatory";
        }
        
        if (docs.livePhotoUrl.length === 0) errs.livePhotoUrl = "Owner Live Photo (Selfie) is mandatory";

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
            formData.set("roomsAndBathroomPhotos", JSON.stringify(processedDocs.roomsAndBathroomPhotos || []));
            formData.set("parkingPhotos", JSON.stringify(processedDocs.parkingPhotos || []));
            formData.set("amenitiesPhotos", JSON.stringify(processedDocs.amenitiesPhotos || []));
            
            formData.set("aadhaarProof", JSON.stringify(processedDocs.aadhaarProof || []));
            formData.set("panProof", JSON.stringify(processedDocs.panProof || []));
            formData.set("pgLicenceUrl", JSON.stringify(processedDocs.pgLicenceUrl || []));
            formData.set("livePhotoUrl", processedDocs.livePhotoUrl?.[0] || "");
            
            // Legacy 'images' for backward compatibility
            formData.set("images", JSON.stringify([
                ...(processedDocs.buildingPhotos || []),
                ...(processedDocs.roomsAndBathroomPhotos || [])
            ]));

            formData.set("ownerName", ownerName);
            formData.set("pgLicence", pgLicence);
            formData.set("propertyType", propertyType === "Other" ? otherPropertyType : propertyType as string);
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
                <Card className="border border-purple-100 shadow-xl overflow-hidden">
                    <CardHeader className="bg-slate-50/50 p-6 border-b">
                        <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-3">
                            <Plus className="h-6 w-6 text-purple-600" /> Basic Details
                        </CardTitle>
                        <CardDescription className="text-sm text-slate-500 mt-1 font-medium italic">Standardized property identification details.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8">
                        {/* Property Type Selection */}
                        <div className="space-y-4 bg-purple-50/30 p-5 rounded-2xl border-2 border-purple-100">
                            <label className="text-[11px] font-black text-purple-600 uppercase tracking-widest flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4" /> 1. Select Property Type (Mandatory)
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {["PG", "Hostel", "Flat/Apartment", "Other"].map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setPropertyType(type as any)}
                                        className={`p-3 rounded-xl border-2 text-[10px] font-black uppercase transition-all flex flex-col items-center gap-2 ${
                                            propertyType === type 
                                            ? "bg-purple-600 border-purple-600 text-white shadow-lg scale-[1.02]" 
                                            : "bg-white border-slate-100 text-slate-500 hover:border-purple-200 hover:bg-purple-50"
                                        }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                            {propertyType === "Other" && (
                                <div className="mt-3 animate-in fade-in slide-in-from-top-1">
                                    <Input
                                        placeholder="Specify property type (e.g. Guest House, Villa...)"
                                        value={otherPropertyType}
                                        onChange={(e) => setOtherPropertyType(e.target.value)}
                                        className="h-10 text-[12px] font-bold border-2 border-purple-200 focus:border-purple-400 bg-white"
                                    />
                                    {errors.propertyType && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase italic">{errors.propertyType}</p>}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                                <p className="text-[10px] text-blue-600 font-medium italic">Locked to registered profile name. Contact Rentpe Support Team to update.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Contact Phone <span className="text-red-500">*</span> <span className="text-[10px] text-muted-foreground">(+91 Mandatory)</span></label>
                                <Input placeholder="e.g. +919876543210" value={phone}
                                    readOnly={true}
                                    maxLength={13} className={`${inputErr("phone")} ${readOnlyCls}`} />
                                <p className="text-[10px] text-blue-600 font-medium italic">Locked to registered profile phone. Contact Rentpe Support Team to update.</p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">
                                    PG/Hostel Licence No. 
                                    {(propertyType === "PG" || propertyType === "Hostel") && <span className="text-red-500">*</span>}
                                    <span className="text-muted-foreground text-xs ml-1">
                                        {propertyType === "PG" || propertyType === "Hostel" ? "(Required)" : "(Optional)"}
                                    </span>
                                </label>
                                <Input 
                                    placeholder="e.g. GOV-12345-PG" 
                                    value={pgLicence} 
                                    onChange={e => setPgLicence(e.target.value)} 
                                    className={inputErr("pgLicence")}
                                />
                                {errors.pgLicence && <p className="text-xs text-red-600 font-semibold">{errors.pgLicence}</p>}
                            </div>
                        </div>

                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-4 shadow-sm">
                             <div className="p-2 bg-red-100 rounded-lg">
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                             </div>
                             <div className="flex flex-col">
                                <p className="text-[11px] text-red-600 font-black uppercase tracking-tight">Data Synchronization Rule</p>
                                <p className="text-[12px] text-slate-800 mt-1 font-bold">
                                    All registered names (Property & Owner) must match exactly with profile details for faster verification.
                                </p>
                             </div>
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
                        <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${errors.amenities ? "border-2 border-red-300 rounded-lg p-2" : ""}`}>
                            {amenityOptions.map((item) => (
                                <label key={item} className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-muted transition-colors ${amenities.includes(item) ? "bg-primary/10 border-primary" : ""}`}>
                                    <input type="checkbox" className="w-4 h-4 text-primary" checked={amenities.includes(item)} onChange={() => toggleAmenity(item)} />
                                    <span className="text-sm">{item}</span>
                                </label>
                            ))}
                            {/* Other Checkbox */}
                            <label className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-muted transition-colors ${showCustomAmenity ? "bg-primary/10 border-primary" : ""}`}>
                                <input type="checkbox" className="w-4 h-4 text-primary" checked={showCustomAmenity} onChange={() => setShowCustomAmenity(!showCustomAmenity)} />
                                <span className="text-sm font-bold">Other (Specify)</span>
                            </label>
                        </div>

                        {showCustomAmenity && (
                            <div className="mt-4 p-4 border-2 border-dashed border-purple-200 rounded-xl bg-purple-50/30 animate-in fade-in slide-in-from-top-2">
                                <div className="flex gap-2">
                                    <Input 
                                        placeholder="Type amenity name (e.g. Swimming Pool, Library...)" 
                                        value={customAmenityInput} 
                                        onChange={(e) => setCustomAmenityInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addCustomAmenity();
                                            }
                                        }}
                                        className="h-10 text-sm font-bold"
                                    />
                                    <Button type="button" onClick={addCustomAmenity} className="bg-purple-600 hover:bg-purple-700 h-10 px-6 font-black">
                                        ADD
                                    </Button>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-tight">Custom amenities will appear as tags below</p>
                            </div>
                        )}

                        {/* Custom Amenities Tags */}
                        {amenities.filter(a => !amenityOptions.includes(a)).length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {amenities.filter(a => !amenityOptions.includes(a)).map(a => (
                                    <div key={a} className="flex items-center gap-2 px-3 py-1.5 bg-white border-2 border-purple-100 rounded-full shadow-sm animate-in zoom-in-95">
                                        <span className="text-sm font-bold text-slate-700">{a}</span>
                                        <button type="button" onClick={() => toggleAmenity(a)} className="text-slate-400 hover:text-red-500 transition-colors">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
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
                        <Button 
                            type="button" 
                            className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-widest shadow-lg shadow-purple-200 border-2 border-purple-400/20 active:scale-95 transition-all" 
                            onClick={addRoom}
                        >
                            <Plus className="h-5 w-5 mr-2 stroke-[3]" /> Add Your Property Room
                        </Button>
                    </CardContent>
                </Card>

                {/* Photos & Documents */}
                <Card className="border border-purple-100 shadow-xl overflow-hidden">
                    <CardHeader className="bg-slate-50/50 p-6 border-b">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex-1">
                                <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-3">
                                    Photos & Documents
                                    <span className="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest flex items-center gap-1 shadow-sm">
                                        <AlertTriangle className="h-3 w-3" /> LIMIT 25MB
                                    </span>
                                </CardTitle>
                                <CardDescription className="text-sm text-slate-500 mt-1 font-medium">Please ensure photos are clear for faster processing.</CardDescription>
                            </div>
                            
                            {/* Static Critical Disclaimer - Reduced Size */}
                            <div className="bg-white border-2 border-red-200 rounded-xl p-4 flex items-start gap-4 max-w-lg shadow-sm relative">
                                <div className="absolute top-0 left-0 w-1 h-full bg-red-500 rounded-l" />
                                <div className="p-2 bg-red-50 rounded-lg">
                                    <AlertTriangle className="h-5 w-5 text-red-600" />
                                </div>
                                <div className="flex flex-col">
                                    <p className="text-[11px] text-red-600 font-black uppercase tracking-tight">CRITICAL REQUIREMENT</p>
                                    <p className="text-[10px] text-slate-800 mt-0.5 font-bold leading-tight">
                                        All registered names (Property & Owner) must match with profile details for faster verification.
                                    </p>
                                    <p className="text-[9px] text-slate-400 mt-1.5 font-black italic uppercase flex items-center gap-1">
                                        <ShieldCheck className="h-3 w-3 text-emerald-500" /> VERIFICATION TEAM WILL UPDATE YOU SOON
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    
                    <CardContent className="p-6 space-y-10">
                        {/* Property Visuals */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-6 w-1.5 bg-purple-600 rounded-full" />
                                <h3 className="text-md font-black text-slate-900 uppercase tracking-tighter">1. Property Assets</h3>
                                <div className="h-px flex-1 bg-slate-100" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <UploadCard label="Building Photos" sub="(Exterior/Interior Required)" category="buildingPhotos" slotsCount={4} isRequired={true} />
                                <UploadCard label="Common Area" sub="(Hallway/Lobby/Shared)" category="commonAreaPhotos" slotsCount={2} isRequired={true} />
                                <UploadCard label="Rooms & Bathroom" sub="(Bed & Living Space)" category="roomsAndBathroomPhotos" slotsCount={4} isRequired={true} />
                                <UploadCard label="Parking Area" sub="(Parking Facility)" category="parkingPhotos" slotsCount={2} isRequired={false} />
                                <UploadCard label="Other Amenities" sub="(Gym/Others)" category="amenitiesPhotos" slotsCount={4} isRequired={false} />
                            </div>
                        </div>

                        {/* Documentation Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-6 w-1.5 bg-purple-600 rounded-full" />
                                <h3 className="text-md font-black text-slate-900 uppercase tracking-tighter">2. Legal Documentation</h3>
                                <div className="h-px flex-1 bg-slate-100" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <UploadCard label="Owner Aadhaar" sub="FRONT & BACK" category="aadhaarProof" slotsCount={2} isRequired={true} />
                                <UploadCard label="Owner PAN" sub="FRONT & BACK" category="panProof" slotsCount={2} isRequired={true} />
                                <UploadCard 
                                    label="PG/Hostel Licence" 
                                    sub={propertyType === "Other" ? "Any other legal doc (Optional)" : "Operational / Approval"} 
                                    category="pgLicenceUrl" 
                                    slotsCount={2} 
                                    isRequired={propertyType === "PG" || propertyType === "Hostel"} 
                                    minRequired={1}
                                />
                                <UploadCard label="Live Photo" sub="Owner Selfie" category="livePhotoUrl" isMultiple={false} slotsCount={1} isRequired={true} />
                            </div>
                        </div>

                        {/* Capacity Stats Card - Reduced Size */}
                        <div className="flex items-center justify-between bg-purple-700 py-4 px-8 rounded-2xl text-white shadow-lg">
                             <div className="flex flex-col">
                                <span className="text-[10px] text-purple-200 uppercase font-black tracking-widest">UTILITIES CONSUMED</span>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-2xl font-black ${(totalSize / (1024 * 1024)) > 20 ? 'text-orange-400' : 'text-white'}`}>
                                        {(totalSize / (1024 * 1024)).toFixed(2)}
                                    </span>
                                    <span className="text-xs font-black text-purple-200">MB</span>
                                </div>
                             </div>
                             <div className="flex flex-col items-end">
                                <span className="text-[10px] text-purple-200 uppercase font-black tracking-widest">FREE SPACE</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-emerald-400">
                                        {(Math.max(0, (MAX_TOTAL_SIZE - totalSize)) / (1024 * 1024)).toFixed(2)}
                                    </span>
                                    <span className="text-xs font-black text-emerald-200">MB</span>
                                </div>
                             </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-purple-600" />
                    <p className="text-sm text-purple-800 font-medium">
                        Property will be listed as <span className="font-bold">Pending Approval</span>. It will go live after <span className="font-bold">Verification Team's final approval</span>.
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
