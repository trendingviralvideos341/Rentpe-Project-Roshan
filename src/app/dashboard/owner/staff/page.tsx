"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, Ban, CheckCircle, Camera, Upload, AlertTriangle } from "lucide-react";
import { getOwnerStaff, addOwnerStaff, updateStaffStatus } from "@/actions/staff";

const ownerPermissionsList = [
    { id: "view_bookings", label: "View Bookings" },
    { id: "approve_bookings", label: "Approve / Reject Bookings" },
    { id: "manage_tenants", label: "Manage Tenants" },
    { id: "mark_rent", label: "Mark Rent Paid" },
    { id: "block_tenant", label: "Block/Unblock Tenants" },
    { id: "edit_rooms", label: "Edit Room Allocation" },
    { id: "view_payments", label: "View Payments" },
    { id: "food_menu", label: "Manage Food Menu" },
    { id: "support", label: "Handle Support Tickets" },
];

const MAX_TOTAL_BYTES = 5 * 1024 * 1024;
function base64ToBytes(b64: string): number {
    if (!b64) return 0;
    const base = b64.includes(",") ? b64.split(",")[1] : b64;
    return Math.floor((base.length * 3) / 4);
}
function formatMB(bytes: number) { return (bytes / (1024 * 1024)).toFixed(2); }

const emptyForm = {
    name: "", email: "", phone: "", designation: "", staffAddress: "",
    permissions: [] as string[],
    idProof: "", idProofName: "",
    addressProof: "", addressProofName: "",
    photo: "",
};

export default function OwnerStaffPage() {
    const [staff, setStaff] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ ...emptyForm });
    const [cameraActive, setCameraActive] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const idRef = useRef<HTMLInputElement>(null);
    const addrRef = useRef<HTMLInputElement>(null);

    const usedBytes = base64ToBytes(form.idProof) + base64ToBytes(form.addressProof) + base64ToBytes(form.photo);
    const usedPercent = Math.min(100, (usedBytes / MAX_TOTAL_BYTES) * 100);
    const isAtLimit = usedBytes >= MAX_TOTAL_BYTES;

    const fetchStaff = async () => {
        setLoading(true);
        try { setStaff(await getOwnerStaff()); }
        catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchStaff(); }, []);

    const togglePerm = (id: string) => {
        setForm(prev => ({
            ...prev,
            permissions: prev.permissions.includes(id) ? prev.permissions.filter(p => p !== id) : [...prev.permissions, id]
        }));
    };

    const handleFileUpload = (field: "idProof" | "addressProof", nameField: "idProofName" | "addressProofName", file: File) => {
        setUploadError(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            const b64 = e.target?.result as string;
            const newBytes = base64ToBytes(b64);
            const existingBytes = base64ToBytes(form[field]);
            const projected = usedBytes - existingBytes + newBytes;
            if (projected > MAX_TOTAL_BYTES) {
                setUploadError(`❌ File too large. Would exceed 5MB limit by ${formatMB(projected - MAX_TOTAL_BYTES)} MB.`);
                return;
            }
            setForm(p => ({ ...p, [field]: b64, [nameField]: file.name }));
        };
        reader.readAsDataURL(file);
    };

    const startCamera = async () => {
        setCameraActive(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch { alert("Camera access denied."); setCameraActive(false); }
    };

    const capturePhoto = () => {
        if (!canvasRef.current || !videoRef.current) return;
        const canvas = canvasRef.current;
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
        const b64 = canvas.toDataURL("image/jpeg", 0.75);
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach(t => t.stop());
        setCameraActive(false);
        const newBytes = base64ToBytes(b64);
        const existingBytes = base64ToBytes(form.photo);
        if (usedBytes - existingBytes + newBytes > MAX_TOTAL_BYTES) {
            setUploadError("Photo too large. Compress existing docs first.");
            return;
        }
        setForm(p => ({ ...p, photo: b64 }));
    };

    const handleAddStaff = async () => {
        if (!form.name || !form.email || !form.phone || !form.designation || !form.staffAddress) {
            alert("All fields (name, email, phone, designation, address) are mandatory.");
            return;
        }
        if (!form.idProof || !form.addressProof || !form.photo) {
            alert("ID verification, address verification, and photo are all mandatory.");
            return;
        }
        if (form.permissions.length === 0) {
            alert("Select at least one permission.");
            return;
        }
        try {
            await addOwnerStaff({
                name: form.name, email: form.email, phone: form.phone,
                designation: form.designation, staffAddress: form.staffAddress,
                permissions: form.permissions,
                idProof: form.idProof, addressProof: form.addressProof, photo: form.photo,
            });
            setShowAdd(false);
            setForm({ ...emptyForm });
            setUploadError(null);
            fetchStaff();
        } catch (e: any) { alert(`Failed to add staff: ${e.message}`); }
    };

    const handleBlockStaff = async (id: string) => {
        const reason = prompt("Reason for blocking this staff member:");
        if (!reason) return;
        try { await updateStaffStatus(id, "BLOCKED", reason); fetchStaff(); }
        catch { alert("Failed to block staff."); }
    };

    const handleUnblockStaff = async (id: string) => {
        const reason = prompt("Reason for unblocking this staff member:");
        if (!reason) return;
        try { await updateStaffStatus(id, "ACTIVE", reason); fetchStaff(); }
        catch { alert("Failed to unblock staff."); }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading staff...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">My Staff</h1>
                    <p className="text-muted-foreground">Add subordinates and control what they can access.</p>
                </div>
                <Button onClick={() => setShowAdd(!showAdd)}>
                    <UserPlus className="h-4 w-4 mr-2" /> Add Staff
                </Button>
            </div>

            {showAdd && (
                <Card className="border-primary/30 border-2">
                    <CardContent className="p-6 space-y-5">
                        <h3 className="font-bold text-lg">Add New Staff Member</h3>

                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { label: "Full Name *", field: "name", placeholder: "Full name" },
                                { label: "Email *", field: "email", placeholder: "email@pg.com" },
                                { label: "Phone *", field: "phone", placeholder: "9XXXXXXXXX" },
                                { label: "Designation *", field: "designation", placeholder: "Property Manager" },
                            ].map(({ label, field, placeholder }) => (
                                <div key={field} className="space-y-1">
                                    <label className="text-sm font-medium">{label}</label>
                                    <Input value={(form as any)[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} placeholder={placeholder} />
                                </div>
                            ))}
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-sm font-medium">Address *</label>
                                <Input value={form.staffAddress} onChange={e => setForm(p => ({ ...p, staffAddress: e.target.value }))} placeholder="Full residential address" />
                            </div>
                        </div>

                        {/* 5MB Storage Meter */}
                        <div className={`rounded-xl border-2 p-4 space-y-2 ${isAtLimit ? "border-red-500 bg-red-50" : usedPercent >= 80 ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-gray-50"}`}>
                            <div className="flex justify-between text-sm font-bold">
                                <span>📦 Document Storage</span>
                                <span className={isAtLimit ? "text-red-600" : "text-gray-600"}>{formatMB(usedBytes)} MB / 5.00 MB</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div className={`h-2.5 rounded-full transition-all ${isAtLimit ? "bg-red-600" : usedPercent >= 80 ? "bg-orange-500" : "bg-green-500"}`} style={{ width: `${usedPercent}%` }} />
                            </div>
                            <p className="text-xs font-bold text-red-600">🔴 Remaining: {formatMB(MAX_TOTAL_BYTES - usedBytes)} MB</p>
                            <div className="flex items-start gap-2 p-2 bg-red-100 border border-red-200 rounded-lg">
                                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-red-700">
                                    <strong>Tip:</strong> Compress files at <a href="https://compressjpeg.com" target="_blank" rel="noopener noreferrer" className="underline font-bold">compressjpeg.com</a> or <a href="https://www.ilovepdf.com/compress_pdf" target="_blank" rel="noopener noreferrer" className="underline font-bold">ilovepdf.com</a>
                                </p>
                            </div>
                        </div>

                        {uploadError && <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-sm text-red-700 font-medium">{uploadError}</div>}

                        {/* Document Uploads */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* ID Proof */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold">🪪 ID Verification *</label>
                                <p className="text-xs text-muted-foreground">Aadhaar / PAN / Passport</p>
                                <input type="file" accept="image/*,application/pdf" className="hidden" ref={idRef} onChange={e => { if (e.target.files?.[0]) handleFileUpload("idProof", "idProofName", e.target.files[0]); }} />
                                <Button size="sm" variant="outline" className="w-full" onClick={() => idRef.current?.click()} disabled={isAtLimit}>
                                    <Upload className="h-3 w-3 mr-1" /> {form.idProof ? `✅ ${form.idProofName}` : "Upload ID"}
                                </Button>
                            </div>

                            {/* Address Proof */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold">🏠 Address Verification *</label>
                                <p className="text-xs text-muted-foreground">Utility bill / Bank statement</p>
                                <input type="file" accept="image/*,application/pdf" className="hidden" ref={addrRef} onChange={e => { if (e.target.files?.[0]) handleFileUpload("addressProof", "addressProofName", e.target.files[0]); }} />
                                <Button size="sm" variant="outline" className="w-full" onClick={() => addrRef.current?.click()} disabled={isAtLimit}>
                                    <Upload className="h-3 w-3 mr-1" /> {form.addressProof ? `✅ ${form.addressProofName}` : "Upload Address Proof"}
                                </Button>
                            </div>

                            {/* Photo */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold">📸 Staff Photo *</label>
                                <p className="text-xs text-muted-foreground">Live camera capture</p>
                                {form.photo ? (
                                    <div className="space-y-1">
                                        <img src={form.photo} alt="Staff photo" className="w-full h-24 object-cover rounded-lg border" />
                                        <Button size="sm" variant="outline" className="w-full text-xs" onClick={startCamera}>Retake</Button>
                                    </div>
                                ) : (
                                    <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700" onClick={startCamera} disabled={isAtLimit}>
                                        <Camera className="h-3 w-3 mr-1" /> Take Photo
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Permissions */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Authorized Permissions *</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {ownerPermissionsList.map(perm => (
                                    <label key={perm.id} className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs ${form.permissions.includes(perm.id) ? "bg-primary/10 border-primary" : "hover:bg-muted"}`}>
                                        <input type="checkbox" checked={form.permissions.includes(perm.id)} onChange={() => togglePerm(perm.id)} className="accent-primary" />
                                        {perm.label}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button onClick={handleAddStaff} className="bg-green-600 hover:bg-green-700">Add Staff Member</Button>
                            <Button variant="outline" onClick={() => { setShowAdd(false); setForm({ ...emptyForm }); setUploadError(null); }}>Cancel</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Camera Modal */}
            {cameraActive && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
                        <h2 className="text-xl font-bold text-center">📸 Capture Staff Photo</h2>
                        <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg border" />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="flex gap-3">
                            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={capturePhoto}>📸 Capture</Button>
                            <Button variant="outline" className="flex-1" onClick={() => {
                                const stream = videoRef.current?.srcObject as MediaStream;
                                stream?.getTracks().forEach(t => t.stop());
                                setCameraActive(false);
                            }}>Cancel</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Staff Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted border-b">
                                <tr>
                                    <th className="p-4 text-left font-medium">ID</th>
                                    <th className="p-4 text-left font-medium">Name</th>
                                    <th className="p-4 text-left font-medium">Designation</th>
                                    <th className="p-4 text-left font-medium">Authorized For</th>
                                    <th className="p-4 text-left font-medium">Status & History</th>
                                    <th className="p-4 text-left font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staff.map((s: any) => {
                                    const perms = JSON.parse(s.permissions || "[]");
                                    const isBlocked = s.status === "BLOCKED" || s.status === "REMOVED";
                                    return (
                                        <tr key={s.id} className={`border-b hover:bg-muted/5 ${isBlocked ? "bg-red-50/50" : ""}`}>
                                            <td className="p-4 font-mono text-xs">{s.displayId}</td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    {s.photo && <img src={s.photo} alt="" className="w-8 h-8 rounded-full object-cover border" />}
                                                    <div>
                                                        <div className={`font-medium ${isBlocked ? "line-through text-red-400" : ""}`}>{s.name}</div>
                                                        <div className="text-[10px] text-muted-foreground">{s.email} • {s.phone}</div>
                                                        <div className="text-[10px] text-muted-foreground italic">Added: {new Date(s.addedOn).toLocaleDateString()}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4"><span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{s.designation}</span></td>
                                            <td className="p-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {perms.map((p: string) => {
                                                        const perm = ownerPermissionsList.find(op => op.id === p);
                                                        return <span key={p} className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px]">{perm?.label || p}</span>;
                                                    })}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {isBlocked
                                                    ? <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 uppercase">🚫 Blocked</span>
                                                    : <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 uppercase">✅ Active</span>
                                                }
                                                {s.actionNotes?.length > 0 && (
                                                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                                                        {s.actionNotes.map((note: any, i: number) => (
                                                            <div key={i} className={`text-[9px] p-1 rounded border ${note.action === "BLOCKED" || note.action === "REMOVED" ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"}`}>
                                                                <div className="font-bold uppercase">{note.action === "BLOCKED" || note.action === "REMOVED" ? "🚫 Blocked" : "✅ Unblocked"}</div>
                                                                <div>Reason: {note.reason}</div>
                                                                <div>{new Date(note.timestamp).toLocaleString()}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {!isBlocked ? (
                                                    <Button size="sm" variant="destructive" className="h-7 text-[10px]" onClick={() => handleBlockStaff(s.id)}>
                                                        <Ban className="h-3 w-3 mr-1" /> Block
                                                    </Button>
                                                ) : (
                                                    <Button size="sm" variant="outline" className="h-7 text-[10px] border-green-300 text-green-700 hover:bg-green-50" onClick={() => handleUnblockStaff(s.id)}>
                                                        <CheckCircle className="h-3 w-3 mr-1" /> Unblock
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {staff.length === 0 && <div className="p-8 text-center text-muted-foreground">No staff members added yet.</div>}
                </CardContent>
            </Card>
        </div>
    );
}
