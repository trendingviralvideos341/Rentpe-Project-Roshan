"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Camera, Upload, CheckCircle } from "lucide-react";

const AMENITIES_LIST = [
    "WiFi", "AC", "Geyser", "Laundry", "Parking", "CCTV", "Security Guard",
    "Power Backup", "Lift", "Gym", "Mess/Food", "Housekeeping", "Water Purifier",
    "Refrigerator", "TV", "Study Table", "Wardrobe", "Attached Bathroom"
];

const REQUIRED_PHOTOS = ["front", "back", "room", "bathroom"] as const;
const OPTIONAL_PHOTOS = ["common_area", "balcony", "other"] as const;
const PHOTO_LABELS: Record<string, string> = {
    front: "🏠 Front View", back: "🔙 Back View", room: "🛏️ Room", bathroom: "🚿 Bathroom",
    common_area: "🏛️ Common Area", balcony: "🌅 Balcony", other: "📷 Other"
};

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
function base64ToBytes(b64: string): number {
    if (!b64) return 0;
    const base = b64.includes(",") ? b64.split(",")[1] : b64;
    return Math.floor((base.length * 3) / 4);
}
function formatMB(bytes: number) { return (bytes / (1024 * 1024)).toFixed(2); }

export default function ListPropertyPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [cameraTarget, setCameraTarget] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [form, setForm] = useState({
        name: "", address: "", city: "", description: "",
        ownerName: "", pgLicence: "",
        amenities: [] as string[], amenitiesOther: "",
        photos: {} as Record<string, string>,
    });

    const totalPhotoBytes = Object.values(form.photos).reduce((sum, b64) => sum + base64ToBytes(b64), 0);
    const photoPercent = Math.min(100, (totalPhotoBytes / MAX_PHOTO_BYTES) * 100);
    const isAtPhotoLimit = totalPhotoBytes >= MAX_PHOTO_BYTES;

    const toggleAmenity = (a: string) => {
        setForm(p => ({
            ...p,
            amenities: p.amenities.includes(a) ? p.amenities.filter(x => x !== a) : [...p.amenities, a]
        }));
    };

    const handlePhotoUpload = (key: string, file: File) => {
        setUploadError(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            const b64 = e.target?.result as string;
            const newBytes = base64ToBytes(b64);
            const existingBytes = base64ToBytes(form.photos[key] || "");
            const projected = totalPhotoBytes - existingBytes + newBytes;
            if (projected > MAX_PHOTO_BYTES) {
                setUploadError(`❌ Photo too large. Would exceed 10MB limit by ${formatMB(projected - MAX_PHOTO_BYTES)} MB.`);
                return;
            }
            setForm(p => ({ ...p, photos: { ...p.photos, [key]: b64 } }));
        };
        reader.readAsDataURL(file);
    };

    const startCamera = async (key: string) => {
        setCameraTarget(key);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch { alert("Camera access denied."); setCameraTarget(null); }
    };

    const capturePhoto = () => {
        if (!canvasRef.current || !videoRef.current || !cameraTarget) return;
        const canvas = canvasRef.current;
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
        const b64 = canvas.toDataURL("image/jpeg", 0.8);
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach(t => t.stop());
        const newBytes = base64ToBytes(b64);
        const existingBytes = base64ToBytes(form.photos[cameraTarget] || "");
        if (totalPhotoBytes - existingBytes + newBytes > MAX_PHOTO_BYTES) {
            setUploadError("Photo too large. Compress existing photos first.");
            setCameraTarget(null);
            return;
        }
        setForm(p => ({ ...p, photos: { ...p.photos, [cameraTarget]: b64 } }));
        setCameraTarget(null);
    };

    const validateStep1 = () => {
        const e: Record<string, string> = {};
        if (!form.name.trim()) e.name = "Property name is required";
        if (!form.address.trim()) e.address = "Address is required";
        if (!form.city.trim()) e.city = "City is required";
        if (!form.description.trim()) e.description = "Description is required";
        if (!form.ownerName.trim()) e.ownerName = "Building owner name is required";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const validateStep2 = () => {
        const e: Record<string, string> = {};
        if (form.amenities.length === 0 && !form.amenitiesOther.trim()) {
            e.amenities = "Select at least one amenity or describe in 'Others'";
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const validateStep3 = () => {
        const e: Record<string, string> = {};
        for (const key of REQUIRED_PHOTOS) {
            if (!form.photos[key]) e[key] = `${PHOTO_LABELS[key]} is required`;
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateStep3()) return;
        setSubmitting(true);
        try {
            const amenitiesList = [...form.amenities];
            if (form.amenitiesOther.trim()) amenitiesList.push(`Other: ${form.amenitiesOther.trim()}`);

            const res = await fetch("/api/properties", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name, address: form.address, city: form.city,
                    description: form.description, ownerName: form.ownerName,
                    pgLicence: form.pgLicence || null,
                    amenities: JSON.stringify(amenitiesList),
                    images: JSON.stringify(form.photos),
                })
            });
            if (!res.ok) throw new Error(await res.text());
            router.push("/dashboard/owner?listed=1");
        } catch (e: any) {
            alert(`Failed to list property: ${e.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
            <div className="max-w-2xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        List Your Property
                    </h1>
                    <p className="text-muted-foreground">Fill in all details to get your PG/hostel listed on RentPe.</p>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center justify-center gap-4">
                    {[1, 2, 3].map(s => (
                        <div key={s} className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= s ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                                {step > s ? <CheckCircle className="h-5 w-5" /> : s}
                            </div>
                            <span className={`text-sm font-medium ${step >= s ? "text-blue-600" : "text-gray-400"}`}>
                                {s === 1 ? "Details" : s === 2 ? "Amenities" : "Photos"}
                            </span>
                            {s < 3 && <div className={`w-12 h-0.5 ${step > s ? "bg-blue-600" : "bg-gray-200"}`} />}
                        </div>
                    ))}
                </div>

                {/* Step 1: Basic Details */}
                {step === 1 && (
                    <Card className="border-2 border-blue-100">
                        <CardContent className="p-6 space-y-4">
                            <h2 className="text-xl font-bold">📋 Property Details</h2>
                            <p className="text-sm text-muted-foreground">All fields are mandatory.</p>

                            {[
                                { label: "Property / PG Name *", field: "name", placeholder: "e.g. Sunrise PG for Girls" },
                                { label: "Full Address *", field: "address", placeholder: "Street, Area, Landmark" },
                                { label: "City *", field: "city", placeholder: "Bangalore, Mumbai, etc." },
                                { label: "Building Owner Name *", field: "ownerName", placeholder: "Full name of building owner" },
                            ].map(({ label, field, placeholder }) => (
                                <div key={field} className="space-y-1">
                                    <label className="text-sm font-medium">{label}</label>
                                    <Input
                                        value={(form as any)[field]}
                                        onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                                        placeholder={placeholder}
                                        className={errors[field] ? "border-red-400" : ""}
                                    />
                                    {errors[field] && <p className="text-xs text-red-600">{errors[field]}</p>}
                                </div>
                            ))}

                            <div className="space-y-1">
                                <label className="text-sm font-medium">Description *</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                    placeholder="Describe your property — rules, nearby landmarks, target residents..."
                                    rows={4}
                                    className={`w-full border rounded-md p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.description ? "border-red-400" : "border-input"}`}
                                />
                                {errors.description && <p className="text-xs text-red-600">{errors.description}</p>}
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium">Govt. Registered PG/Hostel Licence Number <span className="text-muted-foreground font-normal">(Optional)</span></label>
                                <Input
                                    value={form.pgLicence}
                                    onChange={e => setForm(p => ({ ...p, pgLicence: e.target.value }))}
                                    placeholder="Leave blank if not applicable"
                                />
                            </div>

                            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => { if (validateStep1()) setStep(2); }}>
                                Next: Amenities →
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Step 2: Amenities */}
                {step === 2 && (
                    <Card className="border-2 border-purple-100">
                        <CardContent className="p-6 space-y-4">
                            <h2 className="text-xl font-bold">✨ Amenities</h2>
                            <p className="text-sm text-muted-foreground">Select all that apply. Use "Others" for anything not listed.</p>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {AMENITIES_LIST.map(a => (
                                    <label key={a} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm transition-colors ${form.amenities.includes(a) ? "bg-purple-100 border-purple-400 text-purple-800 font-medium" : "hover:bg-muted border-gray-200"}`}>
                                        <input type="checkbox" checked={form.amenities.includes(a)} onChange={() => toggleAmenity(a)} className="accent-purple-600" />
                                        {a}
                                    </label>
                                ))}
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium">Others (describe any additional amenities)</label>
                                <Input
                                    value={form.amenitiesOther}
                                    onChange={e => setForm(p => ({ ...p, amenitiesOther: e.target.value }))}
                                    placeholder="e.g. Swimming pool, Yoga room, Rooftop garden..."
                                />
                            </div>

                            {errors.amenities && <p className="text-sm text-red-600">{errors.amenities}</p>}

                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>← Back</Button>
                                <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={() => { if (validateStep2()) setStep(3); }}>
                                    Next: Photos →
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 3: Photos */}
                {step === 3 && (
                    <Card className="border-2 border-green-100">
                        <CardContent className="p-6 space-y-5">
                            <h2 className="text-xl font-bold">📸 Property Photos</h2>

                            {/* 10MB Storage Meter */}
                            <div className={`rounded-xl border-2 p-4 space-y-2 ${isAtPhotoLimit ? "border-red-500 bg-red-50" : photoPercent >= 80 ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-gray-50"}`}>
                                <div className="flex justify-between text-sm font-bold">
                                    <span>📦 Photo Storage</span>
                                    <span className={isAtPhotoLimit ? "text-red-600" : "text-gray-600"}>{formatMB(totalPhotoBytes)} MB / 10.00 MB</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div className={`h-2.5 rounded-full transition-all ${isAtPhotoLimit ? "bg-red-600" : photoPercent >= 80 ? "bg-orange-500" : "bg-green-500"}`} style={{ width: `${photoPercent}%` }} />
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-amber-700">
                                        Compress photos at <a href="https://compressjpeg.com" target="_blank" rel="noopener noreferrer" className="underline font-bold">compressjpeg.com</a> if needed.
                                    </p>
                                </div>
                            </div>

                            {uploadError && <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-sm text-red-700">{uploadError}</div>}

                            {/* Required Photos */}
                            <div>
                                <p className="text-sm font-bold text-red-600 mb-3">🔴 Required Photos (all 4 mandatory)</p>
                                <div className="grid grid-cols-2 gap-3">
                                    {REQUIRED_PHOTOS.map(key => (
                                        <PhotoUploadCard
                                            key={key}
                                            label={PHOTO_LABELS[key]}
                                            required
                                            photo={form.photos[key]}
                                            error={errors[key]}
                                            disabled={isAtPhotoLimit && !form.photos[key]}
                                            onUpload={file => handlePhotoUpload(key, file)}
                                            onCamera={() => startCamera(key)}
                                            onRemove={() => setForm(p => { const photos = { ...p.photos }; delete photos[key]; return { ...p, photos }; })}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Optional Photos */}
                            <div>
                                <p className="text-sm font-bold text-gray-500 mb-3">🟡 Optional Photos</p>
                                <div className="grid grid-cols-3 gap-3">
                                    {OPTIONAL_PHOTOS.map(key => (
                                        <PhotoUploadCard
                                            key={key}
                                            label={PHOTO_LABELS[key]}
                                            required={false}
                                            photo={form.photos[key]}
                                            disabled={isAtPhotoLimit && !form.photos[key]}
                                            onUpload={file => handlePhotoUpload(key, file)}
                                            onCamera={() => startCamera(key)}
                                            onRemove={() => setForm(p => { const photos = { ...p.photos }; delete photos[key]; return { ...p, photos }; })}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>← Back</Button>
                                <Button
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                >
                                    {submitting ? "Listing..." : "🚀 List Property"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Camera Modal */}
            {cameraTarget && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4">
                        <h2 className="text-xl font-bold text-center">📸 {PHOTO_LABELS[cameraTarget]}</h2>
                        <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg border" />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="flex gap-3">
                            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={capturePhoto}>📸 Capture</Button>
                            <Button variant="outline" className="flex-1" onClick={() => {
                                const stream = videoRef.current?.srcObject as MediaStream;
                                stream?.getTracks().forEach(t => t.stop());
                                setCameraTarget(null);
                            }}>Cancel</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function PhotoUploadCard({ label, required, photo, error, disabled, onUpload, onCamera, onRemove }: {
    label: string; required: boolean; photo?: string; error?: string;
    disabled?: boolean; onUpload: (f: File) => void; onCamera: () => void; onRemove: () => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    return (
        <div className={`border-2 rounded-xl p-3 space-y-2 ${error ? "border-red-400 bg-red-50" : photo ? "border-green-400 bg-green-50" : "border-dashed border-gray-300"}`}>
            <div className="text-xs font-bold flex items-center gap-1">
                {label} {required && <span className="text-red-500">*</span>}
            </div>
            {photo ? (
                <div className="space-y-1">
                    <img src={photo} alt={label} className="w-full h-20 object-cover rounded-lg" />
                    <Button size="sm" variant="outline" className="w-full h-6 text-[10px] text-red-600 border-red-300" onClick={onRemove}>✕ Remove</Button>
                </div>
            ) : (
                <div className="space-y-1">
                    <input type="file" accept="image/*" className="hidden" ref={inputRef} onChange={e => { if (e.target.files?.[0]) onUpload(e.target.files[0]); }} />
                    <Button size="sm" variant="outline" className="w-full h-7 text-[10px]" disabled={disabled} onClick={() => inputRef.current?.click()}>
                        <Upload className="h-3 w-3 mr-1" /> Upload
                    </Button>
                    <Button size="sm" className="w-full h-7 text-[10px] bg-blue-600 hover:bg-blue-700" disabled={disabled} onClick={onCamera}>
                        <Camera className="h-3 w-3 mr-1" /> Camera
                    </Button>
                </div>
            )}
            {error && <p className="text-[10px] text-red-600">{error}</p>}
        </div>
    );
}
