'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Plus, X, AlertTriangle, ShieldCheck, UploadCloud, Loader2, Building2, Users, BedDouble, ParkingCircle, ImageIcon, Camera } from "lucide-react";
import { toast } from "sonner";
import { createProperty } from "@/actions/properties";
import { getCurrentUser } from "@/actions/auth";
import { getCloudinarySignature } from "@/actions/uploads";
import { getPlatformSettings } from "@/actions/platform";
import { validateName, validatePhone, validateEmail, normalizePhone } from "@/lib/validators";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useResumableUpload } from "@/hooks/useResumableUpload";
import { ResilienceIndicator } from "@/components/ui/ResilienceIndicator";
import { DraftRecoveryAlert } from "@/components/ui/DraftRecoveryAlert";
import { compressImage } from "@/lib/imageCompression";

// UPLOAD-ON-SELECT: Each photo uploads immediately when selected
type DocEntry = { file: File; previewUrl: string; cloudUrl: string | null; uploading: boolean; error?: string };
type DocsState = {
    buildingPhotos: DocEntry[];
    commonAreaPhotos: DocEntry[];
    roomsAndBathroomPhotos: DocEntry[];
    parkingPhotos: DocEntry[];
    amenitiesPhotos: DocEntry[];
    aadhaarProof: DocEntry[];
    panProof: DocEntry[];
    pgLicenceUrl: DocEntry[];
    livePhotoUrl: DocEntry[];
};

export default function AddPropertyPage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Form state
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [pincode, setPincode] = useState("");

    // Performance: Session-persistent signature cache to avoid redundant server roundtrips
    const [signatureCache, setSignatureCache] = useState<{data: any, expiry: number} | null>(null);
    const [city, setCity] = useState("");
    const [state, setState] = useState("");
    const [postOffice, setPostOffice] = useState("");
    const [country] = useState("India");
    const [phone, setPhone] = useState("");
    const [description, setDescription] = useState("");
    const [ownerName, setOwnerName] = useState("");
    const [ownerEmail, setOwnerEmail] = useState("");
    const [businessName, setBusinessName] = useState("");
    const [propertyType, setPropertyType] = useState<"PG" | "Hostel" | "Flat/Apartment" | "Other" | "">("PG");
    const [licenseNumber, setLicenseNumber] = useState("");
    const [reraId, setReraId] = useState("");
    const [otherPropertyType, setOtherPropertyType] = useState("");
    const [gender, setGender] = useState<"Boys" | "Girls" | "Co-ed" | "">("");
    const [amenities, setAmenities] = useState<string[]>([]);
    const [customAmenityInput, setCustomAmenityInput] = useState("");
    const [showCustomAmenity, setShowCustomAmenity] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [feeTermsAccepted, setFeeTermsAccepted] = useState(false);
    // ── Food & Mess Service (Section 2) ──
    const [foodType, setFoodType] = useState<'NOT_AVAILABLE' | 'INCLUDED' | 'OPTIONAL' | "">("");
    const [foodPricePerMonth, setFoodPricePerMonth] = useState('');
    const amenityOptions = ["WiFi", "AC", "Laundry", "Power Backup", "CCTV", "Biometric", "Food", "Cleaning", "Parking", "Gym", "Hot Water", "TV"];
    
    const suggestedAmenities = [
        "Swimming Pool", "Attached Bathroom", "Visitor Parking", "Lift/Elevator", 
        "Security Guard", "Library", "Study Room", "Induction/Gas", "Refrigerator", 
        "Microwave", "Balcony", "Garden", "Daily Buffet", "Mess Facility"
    ];
    
    const [docs, setDocs] = useState<DocsState>({
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

    const [uploadingCount, setUploadingCount] = useState(0);

    // Resilience Hooks
    const { 
        status: saveStatus, 
        lastSaved, 
        restoredData, 
        updateData, 
        clearDraft 
    } = useAutoSave({
        entityType: 'PROPERTY',
        entityId: undefined, // undefined for new property
        interval: 5000,
        paused: uploadingCount > 0 || saving
    });

    const { 
        status: uploadStatus, 
        progress: uploadProgress, 
        uploadFile 
    } = useResumableUpload();

    const [showRecoveryAlert, setShowRecoveryAlert] = useState(false);

    const [onboardingFee, setOnboardingFee] = useState<number | null>(null);

    useEffect(() => {
        const loadProfileAndSettings = async () => {
            const [user, settings] = await Promise.all([
                getCurrentUser(),
                getPlatformSettings().catch(() => null)
            ]);

            if (user) {
                // Auth Check: If staff, must have register_property permission
                if (user.role === 'STAFF') {
                    const perms = JSON.parse((user as any).staffPermissions || "[]");
                    if (!perms.includes('register_property')) {
                        toast.error("Unauthorized: You do not have permission to register properties.");
                        router.push("/dashboard/staff/properties");
                        return;
                    }
                }

                setOwnerName(user.name || "");
                setOwnerEmail(user.email || "");
                let p = user.phone || "";
                if (p && !p.startsWith("+91")) p = "+91" + p;
                setPhone(p);
                
                // Clear any existing errors for these fields
                setErrors(prev => {
                    const next = { ...prev };
                    delete next.ownerName;
                    delete next.ownerEmail;
                    delete next.phone;
                    return next;
                });
            }

            if (settings) {
                // Industry Standard: Default to settings but we'll re-fetch on server for security
                setOnboardingFee(settings.ownerOnboardingFeeFlat);
            }
        };
        loadProfileAndSettings();
    }, []);

    // OPTIMISTIC WARM-UP: Pre-fetch signature so it's ready before user selects photos
    useEffect(() => {
        const warmUpSignature = async () => {
            const now = Date.now();
            const timestamp = Math.floor(now / 1000);
            try {
                const data = await getCloudinarySignature({
                    folder: `rentpe/properties/temp`,
                    timestamp
                });
                setSignatureCache({ data, expiry: now + 45 * 60 * 1000 });
                return data;
            } catch (err) {
                // Silently fail, it's just a warm-ups
                return null;
            }
        };
        warmUpSignature();
    }, []);

    // Sync latest form state to auto-save hook
    useEffect(() => {
        const formData = {
            name, address, pincode, city, state, postOffice, phone,
            description, ownerName, ownerEmail, businessName,
            propertyType, licenseNumber, reraId, otherPropertyType,
            gender, amenities, rooms
            // Note: We don't save raw File objects to drafts; they are handled by useResumableUpload
        };
        updateData(formData);
    }, [
        name, address, pincode, city, state, postOffice, phone,
        description, ownerName, ownerEmail, businessName,
        propertyType, licenseNumber, reraId, otherPropertyType,
        gender, amenities, rooms, updateData
    ]);

    // Check for draft recovery
    useEffect(() => {
        if (restoredData && !name) {
            setShowRecoveryAlert(true);
        }
    }, [restoredData, name]);

    const handleRestoreDraft = () => {
        if (!restoredData) return;
        const d = restoredData;
        setName(d.name || "");
        setAddress(d.address || "");
        setPincode(d.pincode || "");
        setCity(d.city || "");
        setState(d.state || "");
        setPostOffice(d.postOffice || "");
        setDescription(d.description || "");
        setBusinessName(d.businessName || "");
        setPropertyType(d.propertyType || "PG");
        setLicenseNumber(d.licenseNumber || "");
        setReraId(d.reraId || "");
        setOtherPropertyType(d.otherPropertyType || "");
        setGender(d.gender || "");
        setAmenities(d.amenities || []);
        setRooms(d.rooms || []);
        setShowRecoveryAlert(false);
        toast.success("Draft restored successfully!");
    };

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

    // UPLOAD-ON-SELECT: Upload immediately when user picks a file
    const handleDocChange = (category: keyof DocsState, isMultiple: boolean) => async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        e.target.value = ''; // reset input so same file can be re-selected

        let newTotalSize = totalSize;
        const currentEntries = docs[category];

        // Single-slot: replace existing
        if (!isMultiple && currentEntries.length > 0) {
            newTotalSize -= currentEntries[0].file.size;
        }

        const validFiles: File[] = [];
        for (const file of files) {
            if (newTotalSize + file.size <= MAX_TOTAL_SIZE) {
                validFiles.push(file);
                newTotalSize += file.size;
            } else {
                toast.error(`25MB limit reached. Cannot add "${file.name}"`);
            }
        }
        if (validFiles.length === 0) return;
        setTotalSize(newTotalSize);

        // Add entries immediately with uploading=true for instant UI feedback
        const newEntries: DocEntry[] = validFiles.map(file => ({
            file,
            previewUrl: URL.createObjectURL(file),
            cloudUrl: null,
            uploading: true,
        }));

        // Update entries with progress immediately for UX
        setDocs(prev => ({
            ...prev,
            [category]: isMultiple ? [...prev[category], ...newEntries] : [newEntries[0]]
        }));

        setUploadingCount(prev => prev + newEntries.length);
        
        // HIGH-SPEED PATH: Parallelize everything
        // 1. Preparation phase: Start signature fetching and file compression IN PARALLEL
        const getOrFetchSignature = async () => {
            // Reuse cached signature if valid (30 min buffer)
            const now = Date.now();
            if (signatureCache && signatureCache.expiry > now) {
                return signatureCache.data;
            }

            const timestamp = Math.floor(now / 1000);
            try {
                const data = await getCloudinarySignature({
                    folder: `rentpe/properties/temp`,
                    timestamp
                });
                // Cache for 45 mins (Cloudinary default is 1h)
                setSignatureCache({ data, expiry: now + 45 * 60 * 1000 });
                return data;
            } catch (err) {
                console.error("Signature fetch failed", err);
                return null;
            }
        };

        // Kick off signature and file processing at the same time
        const signaturePromise = getOrFetchSignature();

        await Promise.all(newEntries.map(async (entry) => {
            // SHOW OPTIMIZING STATE FIRST
            const toastId = toast.loading(`Optimizing ${entry.file.name}...`);
            
            try {
                // Compression and signature happen in parallel across files
                const [optimizedFile, sigData] = await Promise.all([
                    compressImage(entry.file),
                    signaturePromise
                ]);
                
                // Update toast for upload phase
                toast.loading(`Uploading ${entry.file.name}...`, { id: toastId });

                // Direct high-speed upload using pre-fetched/cached signature
                const result = await uploadFile(optimizedFile, { signatureData: sigData }) as { url: string };
                
                setDocs(prev => ({
                    ...prev,
                    [category]: prev[category].map(e =>
                        e.previewUrl === entry.previewUrl
                            ? { ...e, cloudUrl: result.url, uploading: false }
                            : e
                    )
                }));
                toast.success(`${entry.file.name} ready!`, { id: toastId });
            } catch (err: any) {
                console.error("Upload error for", entry.file.name, err);
                setDocs(prev => ({
                    ...prev,
                    [category]: prev[category].map(e =>
                        e.previewUrl === entry.previewUrl
                            ? { ...e, uploading: false, error: 'Upload failed' }
                            : e
                    )
                }));
                toast.error(`Failed to upload ${entry.file.name}.`, { id: toastId });
            } finally {
                setUploadingCount(prev => Math.max(0, prev - 1));
            }
        }));
    };

    const removeDoc = (category: keyof DocsState, index?: number) => {
        const current = docs[category];
        if (index !== undefined) {
            const removed = current[index];
            setTotalSize(prev => prev - removed.file.size);
            setDocs(prev => ({ ...prev, [category]: prev[category].filter((_, i) => i !== index) }));
        } else if (current.length > 0) {
            setTotalSize(prev => prev - current[0].file.size);
            setDocs(prev => ({ ...prev, [category]: [] }));
        }
    };


    // Sub-component for upload cards — shows spinner on each thumbnail while uploading
    const UploadCard = ({ label, sub, category, isMultiple = true, slotsCount = 4, isRequired = false, minRequired }: { 
        label: string; 
        sub: string; 
        category: keyof DocsState; 
        isMultiple?: boolean; 
        slotsCount?: number;
        isRequired?: boolean;
        minRequired?: number;
    }) => {
        const entries = docs[category];
        const effectiveMinRequired = minRequired ?? (isRequired ? slotsCount : 0);

        const renderThumbnail = (entry: DocEntry, i: number) => (
            <div key={i} className="relative group/img aspect-square border-2 border-purple-200 rounded-xl bg-white overflow-hidden shadow-sm">
                <img src={entry.previewUrl} alt="preview" className={`w-full h-full object-cover ${entry.uploading ? 'opacity-40' : ''}`} />
                {entry.uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                        <Loader2 className="h-6 w-6 text-purple-600 animate-spin" />
                    </div>
                )}
                {entry.error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-50/80">
                        <span className="text-[9px] text-red-600 font-black text-center px-1">FAILED<br/>Tap to retry</span>
                    </div>
                )}
                {!entry.uploading && !entry.error && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-all flex flex-col items-center justify-center gap-2 backdrop-blur-[1px]">
                        <button type="button" onClick={() => setViewImage(entry.previewUrl)} 
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-black shadow-lg">
                            <Eye className="h-3 w-3" /> VIEW
                        </button>
                        <button type="button" onClick={() => removeDoc(category, i)} 
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[9px] font-black shadow-lg">
                            <X className="h-3 w-3" /> DELETE
                        </button>
                    </div>
                )}
                {entry.cloudUrl && (
                    <div className="absolute bottom-1 right-1 bg-green-600/80 text-[7px] text-white px-1 rounded-sm font-mono">✓ SAVED</div>
                )}
            </div>
        );

        const renderGrid = (limit: number) => {
            const slots = [];
            for (let i = 0; i < limit; i++) {
                if (entries[i]) {
                    slots.push(renderThumbnail(entries[i], i));
                } else {
                    const isExtraOptional = entries.length >= effectiveMinRequired;
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
                            {category === 'buildingPhotos' && <Building2 className={`h-4 w-4 ${error ? "text-red-600" : "text-purple-600"}`} />}
                            {category === 'commonAreaPhotos' && <Users className={`h-4 w-4 ${error ? "text-red-600" : "text-purple-600"}`} />}
                            {category === 'roomsAndBathroomPhotos' && <BedDouble className={`h-4 w-4 ${error ? "text-red-600" : "text-purple-600"}`} />}
                            {category === 'parkingPhotos' && <ParkingCircle className={`h-4 w-4 ${error ? "text-red-600" : "text-purple-600"}`} />}
                            {category === 'amenitiesPhotos' && <ImageIcon className={`h-4 w-4 ${error ? "text-red-600" : "text-purple-600"}`} />}
                            {['aadhaarProof', 'panProof', 'pgLicenceUrl'].includes(category) && <ShieldCheck className={`h-4 w-4 ${error ? "text-red-600" : "text-purple-600"}`} />}
                            {category === 'livePhotoUrl' && <Camera className={`h-4 w-4 ${error ? "text-red-600" : "text-purple-600"}`} />}
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
                        entries.length > 0 ? (
                            <div className="w-full h-36 relative group border-2 border-purple-200 rounded-xl overflow-hidden shadow-sm">
                                <img src={entries[0].previewUrl} alt="preview" className={`w-full h-full object-cover ${entries[0].uploading ? 'opacity-40' : ''}`} />
                                {entries[0].uploading && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                                        <Loader2 className="h-8 w-8 text-purple-600 animate-spin" />
                                    </div>
                                )}
                                {!entries[0].uploading && !entries[0].error && (
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
                                        <button type="button" onClick={() => setViewImage(entries[0].previewUrl)} 
                                            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black shadow-xl">
                                            <Eye className="h-3 w-3" /> VIEW PHOTO
                                        </button>
                                        <button type="button" onClick={() => removeDoc(category)} 
                                            className="flex items-center gap-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-black shadow-xl">
                                            <X className="h-3 w-3" /> DELETE PHOTO
                                        </button>
                                    </div>
                                )}
                                {entries[0].cloudUrl && (
                                    <div className="absolute bottom-1 right-1 bg-green-600/80 text-[8px] text-white px-1.5 py-0.5 rounded font-mono">✓ SAVED</div>
                                )}
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
        if (!termsAccepted) errs.termsAccepted = "You must accept terms to list your property";
        if (onboardingFee !== null && onboardingFee > 0 && !feeTermsAccepted) {
            errs.feeTermsAccepted = "Fee acknowledgment is required.";
        }
        // ── Section 2 food validation ──
        if (foodType === 'OPTIONAL' && (!foodPricePerMonth.trim() || parseFloat(foodPricePerMonth) <= 0)) {
            errs.foodPricePerMonth = "Monthly food price is required for Optional food service";
        }
        if (!foodType) {
            errs.foodType = "Please select a food service option (Mandatory)";
        }

        // Conditional Mandatory for PG/Hostel Licence
        if ((propertyType === "PG" || propertyType === "Hostel") && !licenseNumber.trim()) {
            errs.licenseNumber = "PG/Hostel Licence Number is required";
        }

        // Conditional Mandatory for Other type description
        if (propertyType === "Other" && !otherPropertyType.trim()) {
            errs.propertyType = "Please specify the property type";
        }

        // Validate mandatory documents with specific slot counts
        // Photos are now optional per user request
        // if (docs.buildingPhotos.length < 4) errs.buildingPhotos = "4 Building photos are mandatory";
        // if (docs.commonAreaPhotos.length < 2) errs.commonAreaPhotos = "2 Common area photos are mandatory";
        // if (docs.roomsAndBathroomPhotos.length < 4) errs.roomsAndBathroomPhotos = "4 Rooms & Bathroom photos are mandatory";
        
        // Legal docs (Mandatory)
        if (docs.aadhaarProof.length < 2) errs.aadhaarProof = "Both Aadhaar Front & Back are mandatory";
        if (docs.panProof.length < 2) errs.panProof = "Both PAN Front & Back are mandatory";
        
        // Conditional Mandatory for PG/Hostel
        if (propertyType === "PG" || propertyType === "Hostel") {
            if (!licenseNumber.trim()) errs.licenseNumber = "PG/Hostel Licence Number is required";
            if (docs.pgLicenceUrl.length < 1) errs.pgLicenceUrl = "PG/Hostel Licence photo is mandatory";
        }
        
        if (docs.livePhotoUrl.length === 0) errs.livePhotoUrl = "Owner Current Photo (Selfie) is mandatory";

        rooms.forEach((room, i) => {
            if (!room.roomNumber.trim()) errs[`room_${i}_number`] = `Room ${i + 1}: Room number required`;
            if (!room.price || parseFloat(room.price) <= 0) errs[`room_${i}_price`] = `Room ${i + 1}: Valid price required`;
            if (!room.availability || parseInt(room.availability) <= 0) errs[`room_${i}_avail`] = `Room ${i + 1}: Availability required`;
        });

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const [successData, setSuccessData] = useState<{ displayId: string; name: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return; // INDUSTRY STANDARD: Prevent parallel submission triggers
        if (!validate()) return;

        // Block submit if any photo is still uploading
        const allEntries = Object.values(docs).flat();
        const stillUploading = allEntries.filter(e => e.uploading);
        const failedUploads = allEntries.filter(e => e.error);

        if (stillUploading.length > 0) {
            toast.error(`Please wait — ${stillUploading.length} photo(s) still uploading...`);
            return;
        }
        if (failedUploads.length > 0) {
            toast.error(`${failedUploads.length} photo(s) failed to upload. Please remove and re-add them.`);
            return;
        }

        setSaving(true);
        const progressToast = toast.loading("Saving property...");
        
        try {
            // All photos are already uploaded — just collect the URLs instantly
            const uploadedUrls: Record<string, string[]> = {};
            const categories = Object.keys(docs) as (keyof DocsState)[];
            for (const category of categories) {
                uploadedUrls[category] = docs[category]
                    .filter(e => e.cloudUrl)
                    .map(e => e.cloudUrl as string);
            }

            const fullAddress = [address, postOffice, city, state].filter(Boolean).join(", ") + ` - ${pincode}, India`;

            // HIGH-SPEED SUBMISSION: Use JSON payload to bypass FormData parsing overhead
            const submissionData = {
                name,
                address: fullAddress,
                city,
                description,
                businessName,
                amenities,
                ownerName,
                propertyType,
                licenseNumber,
                reraId,
                rooms,
                termsAccepted,
                feeTermsAccepted,
                // Section 2 — Food Service
                foodType,
                foodPricePerMonth: foodType === 'OPTIONAL' ? foodPricePerMonth : '',
                ...uploadedUrls,
                livePhotoUrl: docs.livePhotoUrl[0]?.cloudUrl // Single URL for current photo
            };

            const res = await createProperty(submissionData);
            
            if (res) {
                toast.success("Property listing submitted!", { id: progressToast });
                clearDraft();
                
                // INDUSTRY STANDARD: Trigger fresh background fetch before showing success state
                router.refresh(); 
                
                setSuccessData({ displayId: res.displayId || "PENDING", name: res.name });
            }
        } catch (e: any) {
            toast.error(e.message || "Upload failed. Please try again.", { id: progressToast });
        } finally {
            setSaving(false);
        }
    };

    if (successData) {
        return (
            <div className="max-w-2xl mx-auto py-12 px-4 text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="mb-8 flex justify-center">
                    <div className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center border-4 border-green-50 shadow-xl">
                        <ShieldCheck className="h-12 w-12 text-green-600" />
                    </div>
                </div>
                <h1 className="text-4xl font-black text-slate-900 mb-2">Registration Successful!</h1>
                <p className="text-slate-500 font-medium mb-8">Your property has been listed and is currently under verification.</p>
                
                <Card className="border-2 border-purple-100 overflow-hidden shadow-2xl mb-8">
                    <div className="bg-purple-600 p-4">
                        <p className="text-white text-[10px] font-black uppercase tracking-widest leading-none">Property Registration ID</p>
                    </div>
                    <CardContent className="p-8">
                        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 mb-4">
                            <span className="text-5xl font-black text-slate-800 tracking-tighter font-mono">{successData.displayId}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-700">{successData.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">Please quote this ID for all future support queries.</p>
                    </CardContent>
                </Card>

                <div className="flex flex-col gap-3">
                    <Button onClick={() => router.push("/dashboard/owner/properties")} className="w-full h-14 bg-slate-900 hover:bg-black text-white font-black rounded-xl text-lg shadow-xl transition-all hover:scale-[1.02]">
                        GO TO PROPERTIES DASHBOARD
                    </Button>
                    <Button variant="outline" onClick={() => window.location.reload()} className="w-full h-14 border-2 border-slate-200 font-black rounded-xl text-lg">
                        ADD ANOTHER PROPERTY
                    </Button>
                </div>
            </div>
        );
    }

    const hasErr = Object.keys(errors).length > 0;
    const inputErr = (k: string) => errors[k] ? "border-red-500" : "";
    const readOnlyCls = "bg-gray-50 cursor-not-allowed text-sm";

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-3xl font-bold">Add New Property</h1>
                        <p className="text-muted-foreground">List your PG or Hostel. All fields marked with <span className="text-red-500">*</span> are mandatory.</p>
                    </div>
                    <ResilienceIndicator 
                        status={uploadingCount > 0 ? 'UPLOADING' : saveStatus} 
                        lastSaved={lastSaved}
                        progress={uploadingCount > 0 ? undefined : undefined} // Percentage is misleading for multiple files
                    />
                </div>
                
                {showRecoveryAlert && (
                    <DraftRecoveryAlert 
                        entityName="Property Listing"
                        onRestore={handleRestoreDraft}
                        onDismiss={() => {
                            setShowRecoveryAlert(false);
                            clearDraft();
                        }}
                    />
                )}
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
                <Card className="border-[7px] border-purple-200 shadow-xl shadow-purple-900/5 overflow-hidden bg-white/80 backdrop-blur-md">
                    <CardHeader className="bg-linear-to-r from-purple-100/80 via-white/50 to-transparent p-6 border-b border-purple-100">
                        <CardTitle className="text-xl font-black text-purple-700 flex items-center gap-3">
                            <Plus className="h-6 w-6" /> Basic Details
                        </CardTitle>
                        <CardDescription className="text-sm text-slate-500 mt-1 font-medium italic">Standardized property identification details.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8 bg-purple-50/10">
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
                                        suppressHydrationWarning
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
                                        suppressHydrationWarning
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
                                    }} className={inputErr("name")} suppressHydrationWarning />
                                {errors.name && <p className="text-xs text-red-600 font-semibold">{errors.name}</p>}
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Building Owner Name <span className="text-red-500">*</span> <span className="text-[10px] text-muted-foreground">(letters only)</span></label>
                                <Input placeholder="e.g. Rajesh Kumar" value={ownerName}
                                    readOnly={true}
                                    className={`${inputErr("ownerName")} ${readOnlyCls}`} suppressHydrationWarning />
                                <p className="text-[10px] text-blue-600 font-medium italic">Locked to registered profile name. Contact Rentpe Support Team to update.</p>
                                {errors.ownerName && <p className="text-xs text-red-600 font-semibold">{errors.ownerName}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Business / Entity Name <span className="text-[10px] text-muted-foreground">(Optional)</span></label>
                                <Input placeholder="e.g. SkyLiv Properties Pvt Ltd" value={businessName}
                                    onChange={e => setBusinessName(e.target.value)}
                                    className="h-10 text-sm font-medium" suppressHydrationWarning />
                                <p className="text-[10px] text-slate-400 font-medium italic uppercase tracking-tighter">Enter legal business name if applicable.</p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Contact Email</label>
                                <Input placeholder="owner@example.com" value={ownerEmail}
                                    readOnly={true}
                                    className={`${readOnlyCls}`} suppressHydrationWarning />
                                <p className="text-[10px] text-blue-600 font-medium italic">Locked to registered account email.</p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Contact Phone <span className="text-red-500">*</span></label>
                                <Input placeholder="e.g. +919876543210" value={phone}
                                    readOnly={true}
                                    maxLength={13} className={`${inputErr("phone")} ${readOnlyCls}`} suppressHydrationWarning />
                                <p className="text-[10px] text-blue-600 font-medium italic">Locked to verified mobile number.</p>
                                {errors.phone && <p className="text-xs text-red-600 font-semibold">{errors.phone}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">
                                    PG/Hostel Licence No. 
                                    {(propertyType === "PG" || propertyType === "Hostel") && <span className="text-red-500">*</span>}
                                </label>
                                <Input 
                                    placeholder="e.g. GOV-12345-PG" 
                                    value={licenseNumber} 
                                    onChange={e => setLicenseNumber(e.target.value)} 
                                    className={inputErr("licenseNumber")}
                                    suppressHydrationWarning
                                />
                                {errors.licenseNumber && <p className="text-xs text-red-600 font-semibold">{errors.licenseNumber}</p>}
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">
                                    RERA ID / Reg No.
                                    <span className="text-muted-foreground text-xs ml-1">(Highly Recommended)</span>
                                </label>
                                <Input 
                                    placeholder="e.g. RERA-KA-2024-001" 
                                    value={reraId} 
                                    onChange={e => setReraId(e.target.value)} 
                                    suppressHydrationWarning
                                />
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
                <Card className="border-[7px] border-blue-200 shadow-xl shadow-blue-900/5 overflow-hidden bg-white/80 backdrop-blur-md">
                    <CardHeader className="bg-linear-to-r from-blue-100/80 via-white/50 to-transparent p-6 border-b border-blue-100">
                        <CardTitle className="text-xl font-black text-blue-700">Property Address</CardTitle>
                        <CardDescription>Enter PIN code to auto-fill city and state.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4 bg-blue-50/10">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Street / Locality / Landmark <span className="text-red-500">*</span></label>
                            <Input placeholder="e.g. 12-B, MG Road, Near City Mall" value={address}
                                onChange={e => setAddress(e.target.value)} className={inputErr("address")} suppressHydrationWarning />
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
                                    onChange={e => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} suppressHydrationWarning />
                                {pinError && <p className="text-[10px] text-red-500">{pinError}</p>}
                                {errors.pincode && <p className="text-xs text-red-500">{errors.pincode}</p>}
                            </div>
                            {postOffices.length > 1 ? (
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Post Office <span className="text-red-500">*</span></label>
                                    <select value={postOffice} onChange={e => setPostOffice(e.target.value)}
                                        className="w-full h-10 border rounded-md px-3 py-2 text-sm border-input bg-blue-50" suppressHydrationWarning>
                                        {postOffices.map(po => <option key={po.Name} value={po.Name}>{po.Name}</option>)}
                                    </select>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Post Office <span className="text-red-500">*</span></label>
                                    <Input value={postOffice} onChange={e => setPostOffice(e.target.value)} placeholder="Auto from PIN or type manually" suppressHydrationWarning />
                                </div>
                            )}
                            <div className="space-y-1">
                                <label className="text-sm font-medium">City <span className="text-red-500">*</span>
                                    {city && postOffices.length > 0 && <span className="text-green-600 text-[10px] ml-1">✓ Auto</span>}
                                </label>
                                <Input className={inputErr("city")} value={city} onChange={e => setCity(e.target.value)} placeholder="Auto from PIN or type manually" suppressHydrationWarning />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">State <span className="text-red-500">*</span>
                                    {state && postOffices.length > 0 && <span className="text-green-600 text-[10px] ml-1">✓ Auto</span>}
                                </label>
                                <Input className={inputErr("state")} value={state} onChange={e => setState(e.target.value)} placeholder="Auto from PIN or type manually" suppressHydrationWarning />
                            </div>
                        </div>
                        {city && state && pincode.length === 6 && (
                            <p className="text-xs text-green-600 font-medium">✅ {postOffice}, {city}, {state} - {pincode}, {country}</p>
                        )}
                    </CardContent>
                </Card>

                {/* Property Details */}
                <Card className="border-[7px] border-orange-200 shadow-xl shadow-orange-900/5 overflow-hidden bg-white/80 backdrop-blur-md">
                    <CardHeader className="bg-linear-to-r from-orange-100/80 via-white/50 to-transparent p-6 border-b border-orange-100">
                        <CardTitle className="text-xl font-black text-orange-700">Property Details</CardTitle>
                        <CardDescription>Gender type, description, and amenities.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4 bg-orange-50/10">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Gender Type <span className="text-red-500">*</span></label>
                            <div className="flex gap-3">
                                {["Boys", "Girls", "Co-ed"].map(g => (
                                    <button key={g} type="button" onClick={() => setGender(g as any)}
                                        suppressHydrationWarning
                                        className={`px-5 py-2 rounded-full text-sm font-semibold border-2 transition-all ${
                                            gender === g 
                                            ? "bg-purple-600 border-purple-600 text-white shadow-md active:scale-95" 
                                            : "bg-white border-slate-200 text-slate-500 hover:border-purple-300 active:scale-95"
                                        } ${errors.gender ? "border-red-400" : ""}`}>
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
                                value={description} 
                                onChange={e => setDescription(e.target.value)} 
                                suppressHydrationWarning 
                            />
                            {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
                        </div>
                    </CardContent>
                </Card>

                {/* Amenities */}
                <Card className="border-[7px] border-indigo-200 shadow-xl shadow-indigo-900/5 overflow-hidden bg-white/80 backdrop-blur-md">
                    <CardHeader className="bg-linear-to-r from-indigo-100/80 via-white/50 to-transparent p-6 border-b border-indigo-100">
                        <CardTitle className="text-xl font-black text-indigo-700">Amenities <span className="text-red-500">*</span></CardTitle>
                        <CardDescription>Select what your property offers. (At least 1 required)</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 bg-indigo-50/10">
                        <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${errors.amenities ? "border-2 border-red-300 rounded-lg p-2" : ""}`}>
                            {amenityOptions.map((item) => (
                                <label key={item} className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-muted transition-colors ${amenities.includes(item) ? "bg-primary/10 border-primary" : ""}`}>
                                    <input type="checkbox" className="w-4 h-4 text-primary" checked={amenities.includes(item)} onChange={() => toggleAmenity(item)} suppressHydrationWarning />
                                    <span className="text-sm">{item}</span>
                                </label>
                            ))}
                            {/* Other Checkbox */}
                            <label className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-muted transition-colors ${showCustomAmenity ? "bg-primary/10 border-primary" : ""}`}>
                                <input type="checkbox" className="w-4 h-4 text-primary" checked={showCustomAmenity} onChange={() => setShowCustomAmenity(!showCustomAmenity)} suppressHydrationWarning />
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
                                        list="amenity-suggestions"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addCustomAmenity();
                                            }
                                        }}
                                        className="h-10 text-sm font-bold"
                                        suppressHydrationWarning
                                    />
                                    <datalist id="amenity-suggestions">
                                        {suggestedAmenities.map(a => (
                                            <option key={a} value={a} />
                                        ))}
                                    </datalist>
                                    <Button type="button" onClick={addCustomAmenity} className="bg-purple-600 hover:bg-purple-700 h-10 px-6 font-black" suppressHydrationWarning>
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
                                        <button type="button" onClick={() => toggleAmenity(a)} className="text-slate-400 hover:text-red-500 transition-colors" suppressHydrationWarning>
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {errors.amenities && <p className="text-xs text-red-500 mt-2">{errors.amenities}</p>}
                    </CardContent>
                </Card>

                {/* ── Food & Mess Service ── */}
                <Card className="border-[7px] border-orange-200 shadow-xl shadow-orange-900/5 overflow-hidden bg-white/80 backdrop-blur-md">
                    <CardHeader className="bg-linear-to-r from-orange-100/80 via-white/50 to-transparent p-6 border-b border-orange-100">
                        <CardTitle className="text-xl font-black text-orange-700 flex items-center gap-3">
                            🍽 Food & Mess Service
                        </CardTitle>
                        <CardDescription className="text-sm text-slate-500 mt-1 font-medium italic">
                            Define if your property provides meals — students will see this clearly before booking.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4 bg-orange-50/10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {([
                                { val: 'NOT_AVAILABLE', emoji: '🚫', title: 'Not Available', desc: 'No food service' },
                                { val: 'INCLUDED', emoji: '🍱', title: 'Included in Rent', desc: 'Meals included, no extra charge' },
                                { val: 'OPTIONAL', emoji: '🍴', title: 'Optional (Add-on)', desc: 'Student can opt in/out' },
                            ] as { val: 'NOT_AVAILABLE' | 'INCLUDED' | 'OPTIONAL'; emoji: string; title: string; desc: string }[]).map(opt => (
                                <button
                                    key={opt.val}
                                    type="button"
                                    onClick={() => setFoodType(opt.val)}
                                    suppressHydrationWarning
                                    className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col gap-1 ${
                                        foodType === opt.val
                                            ? "bg-orange-600 border-orange-600 text-white shadow-lg scale-[1.02]"
                                            : "bg-white border-slate-100 text-slate-700 hover:border-orange-200 hover:bg-orange-50"
                                    }`}
                                >
                                    <span className="text-2xl">{opt.emoji}</span>
                                    <span className="text-[11px] font-black uppercase tracking-wide">{opt.title}</span>
                                    <span className={`text-[10px] font-medium ${foodType === opt.val ? 'text-orange-100' : 'text-slate-400'}`}>{opt.desc}</span>
                                </button>
                            ))}
                        </div>

                        {/* Conditional price input for OPTIONAL */}
                        {foodType === 'OPTIONAL' && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300 bg-orange-50 p-4 rounded-xl border-2 border-orange-200">
                                <label className="text-[11px] font-black text-orange-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    💰 Monthly Food Charge (₹) <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    type="number"
                                    placeholder="e.g. 2000"
                                    min={1}
                                    value={foodPricePerMonth}
                                    onChange={e => setFoodPricePerMonth(e.target.value)}
                                    suppressHydrationWarning
                                    className={`h-12 text-lg font-bold border-2 ${errors.foodPricePerMonth ? 'border-red-500' : 'border-orange-200 focus:border-orange-400'} bg-white`}
                                />
                                {errors.foodPricePerMonth && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase italic">{errors.foodPricePerMonth}</p>}
                                <p className="text-[10px] text-orange-600 font-bold mt-2">
                                    Students will see this as a monthly add-on. They can opt in/out after booking.
                                </p>
                            </div>
                        )}
                        {foodType === 'INCLUDED' && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300 bg-green-50 p-4 rounded-xl border-2 border-green-200">
                                <p className="text-sm font-bold text-green-700">
                                    ✅ Meals are included in rent. Students <strong>cannot</strong> opt out of food.
                                </p>
                            </div>
                        )}
                        {foodType === 'NOT_AVAILABLE' && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300 bg-slate-50 p-4 rounded-xl border-2 border-slate-200">
                                <p className="text-sm font-bold text-slate-500">
                                    🚫 No food service at this property. Students will manage food independently.
                                </p>
                            </div>
                        )}
                        {!foodType && (
                            <div className={`p-4 rounded-xl border-2 border-dashed ${errors.foodType ? 'bg-red-50 border-red-300' : 'bg-orange-50/30 border-orange-200'} transition-all`}>
                                <p className={`text-sm font-bold ${errors.foodType ? 'text-red-600 animate-pulse' : 'text-orange-600/70'}`}>
                                    ⚠️ Please select one of the options above to proceed.
                                </p>
                            </div>
                        )}
                        {errors.foodType && <p className="text-[10px] text-red-500 font-bold uppercase italic mt-1">{errors.foodType}</p>}
                    </CardContent>
                </Card>

                {/* Rooms */}
                <Card className="border-[7px] border-rose-200 shadow-xl shadow-rose-900/5 overflow-hidden bg-white/80 backdrop-blur-md">
                    <CardHeader className="bg-linear-to-r from-rose-100/80 via-white/50 to-transparent p-6 border-b border-rose-100">
                        <CardTitle className="text-xl font-black text-rose-700">Rooms <span className="text-red-500">*</span></CardTitle>
                        <CardDescription>Add rooms with pricing and availability. (At least 1 room required)</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4 bg-rose-50/10">
                        {rooms.length === 0 && (
                            <div className={`text-center py-6 text-muted-foreground ${errors.rooms ? "bg-red-50 border border-red-200 rounded-lg" : ""}`}>
                                No rooms added yet. Click below to add your first room.
                            </div>
                        )}
                        {rooms.map((room, i) => (
                            <div key={i} className="border rounded-lg p-4 space-y-3 relative bg-muted/20">
                                <button type="button" onClick={() => removeRoom(i)} className="absolute top-2 right-2 text-red-400 hover:text-red-600" suppressHydrationWarning>
                                    <X className="h-4 w-4" />
                                </button>
                                <p className="text-sm font-bold text-rose-700">Room #{i + 1}</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground">Room Number <span className="text-red-500">*</span></label>
                                        <Input className={`mt-1 ${errors[`room_${i}_number`] ? "border-red-500" : ""}`} placeholder="e.g. 101" value={room.roomNumber} onChange={e => updateRoom(i, "roomNumber", e.target.value)} suppressHydrationWarning />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground">Bed Type <span className="text-red-500">*</span></label>
                                        <select 
                                            className="mt-1 w-full border rounded-md p-2 text-sm bg-background" 
                                            value={room.type} 
                                            onChange={e => {
                                                const type = e.target.value;
                                                let autoAvail = "1";
                                                if (type === "Double Sharing") autoAvail = "2";
                                                if (type === "Three Sharing") autoAvail = "3";
                                                if (type === "Four Sharing") autoAvail = "4";
                                                if (type === "Five Sharing") autoAvail = "5";
                                                if (type === "Six Sharing") autoAvail = "6";

                                                const updated = [...rooms];
                                                updated[i].type = type;
                                                updated[i].availability = autoAvail;
                                                setRooms(updated);
                                            }} 
                                            suppressHydrationWarning
                                        >
                                            <option value="Single Sharing">Single Sharing (1)</option>
                                            <option value="Double Sharing">Double Sharing (2)</option>
                                            <option value="Three Sharing">Three Sharing (3)</option>
                                            <option value="Four Sharing">Four Sharing (4)</option>
                                            <option value="Five Sharing">Five Sharing (5)</option>
                                            <option value="Six Sharing">Six Sharing (6)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground">Monthly Rent (₹) <span className="text-red-500">*</span></label>
                                        <Input type="number" className={`mt-1 ${errors[`room_${i}_price`] ? "border-red-500" : ""}`} placeholder="5000" min={0} value={room.price} onChange={e => updateRoom(i, "price", e.target.value)} suppressHydrationWarning />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground">Beds Available <span className="text-red-500">*</span></label>
                                        <Input 
                                            type="number" 
                                            readOnly 
                                            className={`mt-1 bg-gray-50 cursor-not-allowed font-bold ${errors[`room_${i}_avail`] ? "border-red-500" : ""}`} 
                                            placeholder="1" 
                                            value={room.availability} 
                                            suppressHydrationWarning
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        <Button 
                            type="button" 
                            className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-200 border-none active:scale-95 transition-all text-sm" 
                            onClick={addRoom}
                            suppressHydrationWarning
                        >
                            <Plus className="h-5 w-5 mr-2" /> Add Your Property Room
                        </Button>
                    </CardContent>
                </Card>

                {/* Photos & Documents */}
                <Card className="border-[7px] border-purple-200 shadow-xl shadow-purple-900/5 overflow-hidden bg-white/80 backdrop-blur-md">
                    <CardHeader className="bg-linear-to-r from-purple-100/80 via-white/50 to-transparent p-6 border-b border-purple-100">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex-1">
                                <CardTitle className="text-xl font-black text-purple-700 flex items-center gap-3">
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
                    
                    <CardContent className="p-6 space-y-10 bg-purple-50/10">
                        {/* Property Visuals */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <h3 className="text-md font-black text-purple-700 uppercase tracking-tight">1. Property Assets</h3>
                                <div className="h-px flex-1 bg-purple-100" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <UploadCard label="Building Photos" sub="Exterior / Main Gate (Max 4)" category="buildingPhotos" slotsCount={4} isRequired={false} />
                                <UploadCard label="Common Area" sub="Hallway / Lobby / Shared (Max 4)" category="commonAreaPhotos" slotsCount={4} isRequired={false} />
                                <UploadCard label="Rooms & Bathroom" sub="Interior Space Checklist (Max 4)" category="roomsAndBathroomPhotos" slotsCount={4} isRequired={false} />
                                <UploadCard label="Parking Area" sub="Dedicated Space (Max 4)" category="parkingPhotos" slotsCount={4} isRequired={false} />
                                <UploadCard label="Other Amenities" sub="Fridge / TV / Washing (Max 4)" category="amenitiesPhotos" slotsCount={4} isRequired={false} />
                            </div>
                        </div>

                        {/* Documentation Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <h3 className="text-md font-black text-purple-700 uppercase tracking-tight">2. Legal Documentation</h3>
                                <div className="h-px flex-1 bg-purple-100" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <UploadCard label="Owner Aadhaar" sub="FRONT & BACK" category="aadhaarProof" slotsCount={2} isRequired={true} />
                                <UploadCard label="Owner PAN" sub="FRONT & BACK" category="panProof" slotsCount={2} isRequired={true} />
                                <UploadCard 
                                    label="PG/Hostel/Flat/Apartment Licence" 
                                    sub="and if any Others Licence applicable" 
                                    category="pgLicenceUrl" 
                                    slotsCount={2} 
                                    isRequired={propertyType === "PG" || propertyType === "Hostel"} 
                                    minRequired={1}
                                />
                                <UploadCard label="Current Photo" sub="Current photo of the person" category="livePhotoUrl" isMultiple={false} slotsCount={1} isRequired={true} />
                            </div>
                        </div>

                        {/* Capacity Stats Card - Simplified */}
                        <div className="flex items-center justify-between bg-slate-50/80 border-2 border-slate-200/50 p-5 rounded-2xl shadow-inner">
                             <div className="flex flex-col">
                                <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">UTILITIES CONSUMED</span>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-xl font-black ${(totalSize / (1024 * 1024)) > 20 ? 'text-red-500' : 'text-slate-900'}`}>
                                        {(totalSize / (1024 * 1024)).toFixed(2)}
                                    </span>
                                    <span className="text-xs font-black text-slate-400">MB</span>
                                </div>
                             </div>
                             <div className="flex flex-col items-end">
                                <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">FREE SPACE</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-black text-emerald-600">
                                        {(Math.max(0, (MAX_TOTAL_SIZE - totalSize)) / (1024 * 1024)).toFixed(2)}
                                    </span>
                                    <span className="text-xs font-black text-emerald-600">MB</span>
                                </div>
                             </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Legal & Compliance Section */}
                <Card className="border-[7px] border-emerald-200 shadow-xl shadow-emerald-900/5 overflow-hidden bg-white/80 backdrop-blur-md transition-all">
                    <CardHeader className="bg-linear-to-r from-emerald-100/80 via-white/50 to-transparent p-4 border-b border-emerald-100">
                        <CardTitle className="text-xl font-black text-emerald-700 flex items-center gap-2 uppercase tracking-wide">
                            <ShieldCheck className="h-6 w-6" /> Legal Agreement
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6 bg-emerald-50/10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <label className="flex items-start gap-3 cursor-pointer group bg-slate-50 p-4 rounded-xl border hover:border-primary transition-all shadow-sm">
                                    <input
                                        type="checkbox"
                                        checked={termsAccepted}
                                        onChange={(e) => {
                                            setTermsAccepted(e.target.checked);
                                            if (e.target.checked) setFieldErr("termsAccepted", "");
                                        }}
                                        className="mt-1 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                        suppressHydrationWarning
                                    />
                                    <div className="flex flex-col">
                                        <span className={`text-[11px] font-bold uppercase tracking-wide ${termsAccepted ? 'text-primary' : 'text-slate-600'}`}>
                                            General Terms & Conditions
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-medium leading-tight mt-1">
                                            I confirm all property details are accurate and I agree to abide by RentPe&apos;s listing policies.
                                        </span>
                                    </div>
                                </label>
                                {errors.termsAccepted && (
                                    <p className="text-[10px] text-red-600 font-bold uppercase italic flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" /> {errors.termsAccepted}
                                    </p>
                                )}
                            </div>

                            {onboardingFee !== null && (
                                <div className="space-y-4">
                                    <label className="flex items-start gap-3 cursor-pointer group bg-slate-50 p-4 rounded-xl border hover:border-primary transition-all shadow-sm">
                                        <input
                                            type="checkbox"
                                            checked={feeTermsAccepted}
                                            onChange={(e) => {
                                                setFeeTermsAccepted(e.target.checked);
                                                if (e.target.checked) setFieldErr("feeTermsAccepted", "");
                                            }}
                                            className="mt-1 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                            suppressHydrationWarning
                                        />
                                        <div className="flex flex-col">
                                            <span className={`text-[11px] font-bold uppercase tracking-wide ${feeTermsAccepted ? 'text-primary' : 'text-slate-600'}`}>
                                                Onboarding Fee (₹{onboardingFee})
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-medium leading-tight mt-1">
                                                I acknowledge a non-refundable one-time fee for document verification and listing services provided by the RentPe Team.
                                            </span>
                                        </div>
                                    </label>
                                    {errors.feeTermsAccepted && (
                                        <p className="text-[10px] text-red-600 font-bold uppercase italic flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" /> {errors.feeTermsAccepted}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Legal Disclaimer Footer */}
                        <div className="pt-4 border-t border-slate-100">
                             <div className="flex items-start gap-2 text-[9px] text-slate-400 font-medium italic">
                                <AlertTriangle className="h-3 w-3 text-slate-300 mt-0.5 shrink-0" />
                                <p>
                                    By submitting this form, you initiate property verification. Listing activation is contingent upon successful check by the RentPe Team. The fee covers verification and setup.
                                </p>
                             </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-center items-center gap-4 pt-6 mb-12">
                    <button 
                        type="button" 
                        onClick={() => router.back()} 
                        suppressHydrationWarning
                        className="px-8 h-12 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full transition-all active:scale-95 shadow-sm uppercase tracking-widest font-black text-xs"
                    >
                        CANCEL
                    </button>
                    <Button 
                        type="submit" 
                        disabled={saving || uploadingCount > 0} 
                        className="px-10 h-12 bg-indigo-500 hover:bg-indigo-600 text-white font-black uppercase tracking-widest shadow-lg shadow-indigo-200 transition-all duration-200 hover:scale-105 active:scale-95"
                        suppressHydrationWarning
                    >
                        {saving ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                        ) : (
                            "Submit For Approval"
                        )}
                    </Button>
                </div>
            </form>

            {/* Simple Lightbox for Viewing Images */}
            {viewImage && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <button 
                        onClick={() => setViewImage(null)} 
                        className="absolute top-6 right-6 text-white hover:text-gray-300"
                        suppressHydrationWarning
                    >
                        <X className="h-8 w-8" />
                    </button>
                    <img src={viewImage} alt="Full View" className="max-w-full max-h-full rounded-lg shadow-2xl" />
                </div>
            )}
        </div>
    );
}
