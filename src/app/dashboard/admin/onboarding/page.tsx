"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCcw, CheckCircle, Edit2, ChevronDown, ChevronUp, UploadCloud, XCircle, Eye, Search, Building2, ClipboardList } from "lucide-react";
import { getBookings, approveBooking, markBookingPaid } from "@/actions/bookings";
import { getAvailableRooms } from "@/actions/rooms";
import { getTenantDocuments, verifyDocument, uploadTenantDocument } from "@/actions/documents";
import { getProperties } from "@/actions/properties";
import { validateEmail, validatePhone, validateName, normalizePhone } from "@/lib/validators";
import { toast } from "sonner";

const OCCUPATION_TYPES = ["Student", "Working Professional", "Other"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const TYPE_LABELS: Record<string, string> = {
    ID_PROOF: "🪪 ID Proof",
    ADDRESS_PROOF: "🏠 Address Proof",
    COLLEGE_COMPANY: "🎓 College / Company",
    SELFIE: "📸 Current Selfie",
};
const DOC_TYPES = ["ID_PROOF", "ADDRESS_PROOF", "COLLEGE_COMPANY", "SELFIE"];

// ── Input helpers ──
const onlyDigits = (v: string) => v.replace(/[^0-9]/g, "");
const onlyLetters = (v: string) => v.replace(/[^a-zA-Z\s]/g, "");
const onlyAmount = (v: string) => {
    // Allow digits and at most one dot with up to 2 decimals
    const clean = v.replace(/[^0-9.]/g, "");
    const parts = clean.split(".");
    if (parts.length > 2) return parts[0] + "." + parts[1];
    if (parts.length === 2) return parts[0] + "." + parts[1].slice(0, 2);
    return clean;
};

function OnboardingCard({ booking, rooms, properties, onRefresh }: { booking: any; rooms: any[]; properties: any[]; onRefresh: () => void }) {
    const [expanded, setExpanded] = useState(false);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [docsExpanded, setDocsExpanded] = useState(false);
    const [docs, setDocs] = useState<any[]>([]);
    const [docsLoading, setDocsLoading] = useState(false);
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);
    const [rejectNote, setRejectNote] = useState("");
    const [uploadType, setUploadType] = useState("ID_PROOF");
    const [uploadingCount, setUploadingCount] = useState(0);
    const [previewDoc, setPreviewDoc] = useState<any>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // ── Citizen mode ──
    const [citizenMode, setCitizenMode] = useState<"indian" | "international">(
        booking.guestCountry && booking.guestCountry !== "India" ? "international" : "indian"
    );
    const [pincodeLoading, setPincodeLoading] = useState(false);

    const [form, setForm] = useState({
        guestName: booking.guestName || "",
        email: booking.guestEmail || "",
        phone: booking.guestPhone?.replace(/^\+91/, "") || "",
        address: booking.guestAddress || "",
        city: booking.guestCity || "",
        pincode: booking.guestPincode || "",
        country: booking.guestCountry || "India",
        occupationType: booking.occupationType || "",
        occupationDetail: booking.occupationDetail || "",
        onboardingDate: booking.onboardingDate || "",
    });
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [selectedPropertyId, setSelectedPropertyId] = useState("");
    const [selectedBedType, setSelectedBedType] = useState(booking.occupancy || "ALL");
    const [selectedRoomId, setSelectedRoomId] = useState("");
    const [depositMonths, setDepositMonths] = useState<1 | 2>(1);
    const [editAmount, setEditAmount] = useState(booking.amount || "");
    const [editOccupancy, setEditOccupancy] = useState(booking.occupancy || "");
    const [platformFeeAmount, setPlatformFeeAmount] = useState<string>(String(booking.platformFeeAmount || "499"));

    // Auto-select property of the booking if available
    useEffect(() => {
        if (booking.propertyName) {
            const prop = properties.find(p => p.name === booking.propertyName);
            if (prop) setSelectedPropertyId(prop.id);
        }
    }, [booking.propertyName, properties]);

    // Filtered rooms
    const filteredRooms = rooms.filter(r => {
        if (selectedPropertyId && r.propertyId !== selectedPropertyId) return false;
        if (selectedBedType && selectedBedType !== "ALL" && r.type !== selectedBedType) return false;
        return true;
    });

    // ── Pending amount prompt state ──
    const [showPendingPrompt, setShowPendingPrompt] = useState(false);
    const [hasPending, setHasPending] = useState(false);
    const [pendingAmount, setPendingAmount] = useState("");

    const fetchDocs = async () => {
        setDocsLoading(true);
        try { setDocs(await getTenantDocuments(booking.id)); } catch { }
        finally { setDocsLoading(false); }
    };

    useEffect(() => { if (docsExpanded) fetchDocs(); }, [docsExpanded]);

    // ── Pincode auto-fetch (Indian) ──
    const handlePincodeChange = async (value: string) => {
        const pin = onlyDigits(value).slice(0, 6);
        setForm(p => ({ ...p, pincode: pin }));

        if (citizenMode === "indian" && pin.length === 6) {
            setPincodeLoading(true);
            try {
                const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
                const data = await res.json();
                if (data?.[0]?.Status === "Success" && data[0].PostOffice?.length > 0) {
                    const po = data[0].PostOffice[0];
                    setForm(p => ({
                        ...p,
                        city: po.District || po.Division || p.city,
                        country: "India",
                    }));
                }
            } catch {
                // Silent fail — user can type manually
            } finally {
                setPincodeLoading(false);
            }
        }
    };

    const handleSave = async () => {
        // ── Validation ──
        const errs: Record<string, string> = {};
        if (!form.guestName.trim()) errs.guestName = "Full Name is required";
        const emailErr = validateEmail(form.email); if (emailErr) errs.email = emailErr;
        const phoneToValidate = citizenMode === "indian" ? `+91${form.phone}` : form.phone;
        const phoneErr = validatePhone(phoneToValidate); if (phoneErr) errs.phone = phoneErr;
        if (!form.address.trim()) errs.address = "Address is required";
        if (citizenMode === "indian" && form.pincode.length !== 6) errs.pincode = "Valid 6-digit PIN required";
        if (!form.city.trim()) errs.city = "City is required";
        if (!form.onboardingDate) errs.onboardingDate = "Onboarding date required";
        if (!form.occupationType) errs.occupationType = "Occupation type required";
        if (!form.occupationDetail.trim()) errs.occupationDetail = "Occupation detail required";
        if (!selectedRoomId && !booking.roomId && !booking.roomAssigned) errs.roomSelection = "Room allocation is required";

        if (Object.keys(errs).length > 0) {
            setFieldErrors(errs);
            alert("Please fix the errors highlighted in red.");
            return;
        }
        setFieldErrors({});

        // If booking is already PAID, ask about pending amount
        if (booking.status === "PAID" || booking.status === "CASH_PAID") {
            if (!showPendingPrompt) {
                setShowPendingPrompt(true);
                return; // Wait for user to decide
            }
            // If prompt is shown, proceed with their choice
        }

        setSaving(true);
        try {
            const room = selectedRoomId ? rooms.find((r: any) => r.id === selectedRoomId) : null;
            const roomPrice = room ? Number(room.price) : Number(String(editAmount).replace(/[^0-9.]/g, '')) || 0;
            const depositAmt = roomPrice * depositMonths;
            await approveBooking(booking.id, {
                roomId: room?.id || booking.roomId,
                amount: editAmount || booking.amount,
                occupancy: editOccupancy || booking.occupancy,
                roomAssigned: room ? `${room.roomNumber} (${editOccupancy || room.type})` : booking.roomAssigned,
                guestName: form.guestName,
                guestEmail: form.email,
                guestPhone: citizenMode === "indian" ? `+91${form.phone}` : form.phone,
                guestAddress: form.address,
                guestCity: form.city,
                guestPincode: form.pincode,
                guestCountry: form.country,
                occupationType: form.occupationType,
                occupationDetail: form.occupationDetail,
                onboardingDate: form.onboardingDate,
                pendingAmount: hasPending && pendingAmount ? Number(pendingAmount.replace(/[^0-9.]/g, '')) : undefined,
                depositAmount: depositAmt,
                depositMonths,
                platformFeeAmount: Number(platformFeeAmount.replace(/[^0-9.]/g, '')) || 0,
            });
            setEditing(false);
            setShowPendingPrompt(false);
            setHasPending(false);
            setPendingAmount("");
            onRefresh();
        } catch { alert("Save failed."); }
        finally { setSaving(false); }
    };

    const handleCashPaid = async () => {
        if (!confirm("Mark this booking as PAID via Cash and create Tenant record?")) return;
        try { await markBookingPaid(booking.id, "CASH"); onRefresh(); } catch { alert("Failed."); }
    };

    const handleVerify = async (docId: string) => {
        try { await verifyDocument(docId, "VERIFIED"); fetchDocs(); } catch { alert("Failed."); }
    };

    const handleReject = async (docId: string) => {
        if (!rejectNote.trim()) { alert("Enter rejection reason."); return; }
        try {
            await verifyDocument(docId, "REJECTED", rejectNote);
            setRejectTarget(null); setRejectNote(""); fetchDocs();
        } catch { alert("Failed."); }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_FILE_SIZE) { 
            toast.error("File exceeds 5MB limit."); 
            return; 
        }

        const toastId = toast.loading(`Uploading ${TYPE_LABELS[uploadType]}...`);
        setUploadingCount(prev => prev + 1);
        try {
            await uploadTenantDocument({ bookingId: booking.id, type: uploadType, fileData: file, fileName: file.name });
            toast.success("Document uploaded successfully!", { id: toastId });
            fetchDocs();
        } catch (error: any) {
            console.error("Upload Error:", error);
            toast.error(`Upload failed: ${error.message || 'Server error'}`, { id: toastId });
        } finally {
            setUploadingCount(prev => Math.max(0, prev - 1));
            e.target.value = "";
        }
    };

    const pendingDocs = docs.filter(d => d.status === "PENDING");
    const verifiedDocs = docs.filter(d => d.status === "VERIFIED");
    const rejectedDocs = docs.filter(d => d.status === "REJECTED");

    const statusBadge = booking.status === "PAID"
        ? <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-0.5 rounded">✅ PAID</span>
        : booking.status === "CASH_PAID"
            ? <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded">💵 PAID (Cash)</span>
            : <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded">⏳ Awaiting Payment</span>;

    return (
        <Card className={`border-l-4 ${booking.status === "PAID" || booking.status === "CASH_PAID" ? "border-l-green-500" : "border-l-amber-500"}`}>
            <CardContent className="p-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <div className="font-bold text-base flex items-center gap-2">
                            {booking.guestName}
                            {statusBadge}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                            {booking.displayId} • <span className="text-purple-700 font-medium">{booking.propertyName}</span> • {booking.roomAssigned || "Room TBD"} • Accepted {new Date(booking.updatedAt || booking.createdAt).toLocaleDateString("en-IN")}
                        </div>
                        <div className="text-xs text-blue-700 mt-0.5">
                            📅 Move-in: {booking.onboardingDate || booking.moveInDate || "—"} &nbsp;|&nbsp; {booking.occupationType || "Occupation N/A"} — {booking.occupationDetail || ""}
                        </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setEditing(!editing); setShowPendingPrompt(false); }}>
                            <Edit2 className="h-3 w-3 mr-1" /> {editing ? "Cancel Edit" : "Edit Details"}
                        </Button>
                        {booking.status !== "PAID" && booking.status !== "CASH_PAID" && booking.paymentMethod === "CASH" && (
                            <Button size="sm" className="h-8 text-xs bg-orange-500 hover:bg-orange-600" onClick={handleCashPaid}>
                                ✅ Mark Cash Paid
                            </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setExpanded(!expanded)}>
                            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>

                {/* Quick stats */}
                {!expanded && !editing && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
                        {[
                            ["📧 Email", booking.guestEmail || "—"],
                            ["📱 Phone", booking.guestPhone || "—"],
                            ["🏙 City", booking.guestCity || "—"],
                            ["💰 Amount", booking.amount || "—"],
                        ].map(([label, val]) => (
                            <div key={label} className="bg-muted/40 rounded p-2">
                                <div className="text-muted-foreground">{label}</div>
                                <div className="font-semibold">{val}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Full Detail View ── */}
                {expanded && !editing && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <div className="text-xs font-bold uppercase text-purple-700">👤 Student Details</div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                {[
                                    ["Name", booking.guestName],
                                    ["Email", booking.guestEmail || "—"],
                                    ["Phone", booking.guestPhone || "—"],
                                    ["Occupation", booking.occupationType ? `${booking.occupationType} — ${booking.occupationDetail || ""}` : "—"],
                                    ["Move-in Date", booking.onboardingDate || "—"],
                                    ["Address", booking.guestAddress ? `${booking.guestAddress}, ${booking.guestCity} - ${booking.guestPincode}` : "—"],
                                ].map(([label, val]) => (
                                    <div key={label} className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 transition-colors hover:bg-white hover:border-indigo-100">
                                        <div className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">{label}</div>
                                        <div className="text-sm font-semibold text-slate-700 mt-0.5">{val}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="text-xs font-bold uppercase text-indigo-700 flex items-center gap-2">
                                <Building2 className="h-3 w-3" /> Property & Allocation
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                {[
                                    ["Property / PG", booking.propertyName || "—"],
                                    ["Occupancy", booking.occupancy || "—"],
                                    ["Allocated Room", booking.roomAssigned || "Not Allocated"],
                                    ["Total Rent", booking.amount || "—"],
                                    ["Method", booking.paymentMethod || "Online"],
                                    ["ID REF", booking.displayId],
                                ].map(([label, val]) => (
                                    <div key={label} className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 transition-colors hover:bg-white hover:border-indigo-100">
                                        <div className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">{label}</div>
                                        <div className="text-sm font-semibold text-slate-700 mt-0.5">{val}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Edit Form ── */}
                {editing && (
                    <div className="mt-4 space-y-3 border border-purple-200 bg-purple-50/40 rounded-lg p-4">
                        <div className="text-sm font-bold text-purple-800 mb-2">✏️ Edit Onboarding Details</div>

                        {/* ── Citizen Toggle ── */}
                        <div>
                            <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Citizen Type</label>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => { setCitizenMode("indian"); setForm(p => ({ ...p, country: "India" })); }}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${citizenMode === "indian" ? "bg-orange-500 text-white border-orange-500" : "border-gray-300 text-gray-600 hover:border-orange-400"}`}>
                                    India
                                </button>
                                <button type="button" onClick={() => setCitizenMode("international")}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${citizenMode === "international" ? "bg-blue-500 text-white border-blue-500" : "border-gray-300 text-gray-600 hover:border-blue-400"}`}>
                                    International
                                </button>
                            </div>
                        </div>

                        {/* Contact fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Full Name */}
                            <div className="sm:col-span-2">
                                <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Full Name * (Alphabets only)</label>
                                <input type="text" placeholder="Student's Full Name"
                                    className={`w-full border-2 rounded-lg p-2 text-sm bg-white font-medium focus:border-purple-300 focus:ring-0 ${fieldErrors.guestName ? "border-red-500 bg-red-50" : "border-purple-50"}`}
                                    value={form.guestName} onChange={e => {
                                        setForm(p => ({ ...p, guestName: onlyLetters(e.target.value) }));
                                        if (fieldErrors.guestName) setFieldErrors(p => ({ ...p, guestName: "" }));
                                    }} />
                                {fieldErrors.guestName && <p className="text-[10px] text-red-600 font-bold mt-0.5">{fieldErrors.guestName}</p>}
                            </div>
                            {/* Email */}
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Email ID *</label>
                                <input type="email" placeholder="student@email.com"
                                    className={`w-full border-2 rounded-lg p-2 text-sm bg-white focus:border-purple-300 focus:ring-0 ${fieldErrors.email ? "border-red-500 bg-red-50" : "border-purple-50"}`}
                                    value={form.email} onChange={e => {
                                        setForm(p => ({ ...p, email: e.target.value }));
                                        if (fieldErrors.email) setFieldErrors(p => ({ ...p, email: "" }));
                                    }} />
                                {fieldErrors.email && <p className="text-[10px] text-red-600 font-bold mt-0.5">{fieldErrors.email}</p>}
                            </div>
                            {/* Phone */}
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Phone *</label>
                                <div className="flex">
                                    {citizenMode === "indian" && (
                                        <span className="inline-flex items-center px-2 rounded-l-md border border-r-0 bg-muted text-xs font-semibold text-muted-foreground select-none">
                                            +91
                                        </span>
                                    )}
                                    <input type="tel" placeholder={citizenMode === "indian" ? "10-digit number" : "Phone number"}
                                        className={`w-full border rounded p-2 text-sm bg-white ${citizenMode === "indian" ? "rounded-l-none" : ""} ${fieldErrors.phone ? "border-red-500 ring-1 ring-red-200" : ""}`}
                                        maxLength={citizenMode === "indian" ? 10 : 20}
                                        value={form.phone}
                                        onChange={e => {
                                            const v = citizenMode === "indian" ? onlyDigits(e.target.value).slice(0, 10) : e.target.value;
                                            setForm(p => ({ ...p, phone: v }));
                                            if (fieldErrors.phone) setFieldErrors(p => ({ ...p, phone: "" }));
                                        }} />
                                </div>
                                {fieldErrors.phone && <p className="text-[10px] text-red-600 font-bold mt-0.5">{fieldErrors.phone}</p>}
                            </div>
                            {/* Address */}
                            <div className="sm:col-span-2">
                                <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Street Address *</label>
                                <input type="text" placeholder="House No, Street, Area..."
                                    className={`w-full border-2 rounded-lg p-2 text-sm bg-white focus:border-purple-300 focus:ring-0 ${fieldErrors.address ? "border-red-500 bg-red-50" : "border-purple-50"}`}
                                    value={form.address} onChange={e => {
                                        setForm(p => ({ ...p, address: e.target.value }));
                                        if (fieldErrors.address) setFieldErrors(p => ({ ...p, address: "" }));
                                    }} />
                                {fieldErrors.address && <p className="text-[10px] text-red-600 font-bold mt-0.5">{fieldErrors.address}</p>}
                            </div>
                            {/* Pincode with auto-fetch */}
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">
                                    Pincode / Zip * {pincodeLoading && <span className="text-blue-500 animate-pulse ml-1 text-[10px]">🔄 Searching...</span>}
                                </label>
                                <input type="text"
                                    placeholder={citizenMode === "indian" ? "6-digit Indian PIN" : "Postal code"}
                                    className={`w-full border-2 rounded-lg p-2 text-sm bg-white focus:border-purple-300 focus:ring-0 ${fieldErrors.pincode ? "border-red-500 bg-red-50" : "border-purple-50"}`}
                                    maxLength={citizenMode === "indian" ? 6 : 15}
                                    value={form.pincode}
                                    onChange={e => {
                                        const v = e.target.value;
                                        if (citizenMode === "indian") handlePincodeChange(v);
                                        else setForm(p => ({ ...p, pincode: v }));
                                        if (fieldErrors.pincode) setFieldErrors(p => ({ ...p, pincode: "" }));
                                    }} />
                                {fieldErrors.pincode && <p className="text-[10px] text-red-600 font-bold mt-0.5">{fieldErrors.pincode}</p>}
                            </div>
                            {/* City */}
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">
                                    City * {citizenMode === "indian" && form.city && <span className="text-green-600 text-[10px] ml-1 font-bold">✓ Verified</span>}
                                </label>
                                <input type="text" placeholder={citizenMode === "indian" ? "Auto-fetches..." : "City name"}
                                    className={`w-full border-2 rounded-lg p-2 text-sm bg-white focus:border-purple-300 focus:ring-0 ${fieldErrors.city ? "border-red-500 bg-red-50" : "border-purple-50"}`}
                                    value={form.city}
                                    onChange={e => {
                                        const v = citizenMode === "indian" ? onlyLetters(e.target.value) : e.target.value;
                                        setForm(p => ({ ...p, city: v }));
                                        if (fieldErrors.city) setFieldErrors(p => ({ ...p, city: "" }));
                                    }} />
                                {fieldErrors.city && <p className="text-[10px] text-red-600 font-bold mt-0.5">{fieldErrors.city}</p>}
                            </div>
                            {/* Country */}
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Country</label>
                                {citizenMode === "indian" ? (
                                    <div className="w-full border-2 border-purple-50 rounded-lg p-2 text-sm bg-muted text-muted-foreground flex items-center gap-2 select-none">
                                        India (Domestic)
                                    </div>
                                ) : (
                                    <input type="text" placeholder="e.g. United Kingdom"
                                        className="w-full border-2 border-purple-50 rounded-lg p-2 text-sm bg-white focus:border-purple-300 focus:ring-0"
                                        value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} />
                                )}
                            </div>
                            {/* Onboarding Date */}
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">🗓 Onboarding Date *</label>
                                <input type="date"
                                    className={`w-full border-2 rounded-lg p-2 text-sm bg-white focus:border-purple-300 focus:ring-0 ${fieldErrors.onboardingDate ? "border-red-500 bg-red-50" : "border-purple-50"}`}
                                    value={form.onboardingDate} onChange={e => {
                                        setForm(p => ({ ...p, onboardingDate: e.target.value }));
                                        if (fieldErrors.onboardingDate) setFieldErrors(p => ({ ...p, onboardingDate: "" }));
                                    }} />
                                {fieldErrors.onboardingDate && <p className="text-[10px] text-red-600 font-bold mt-0.5">{fieldErrors.onboardingDate}</p>}
                            </div>
                        </div>

                        {/* Occupation */}
                        <div className="space-y-4 pt-2">
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Occupation Type *</label>
                                <div className="flex gap-2 flex-wrap">
                                    {OCCUPATION_TYPES.map(type => (
                                        <button key={type} type="button"
                                            onClick={() => {
                                                setForm(p => ({ ...p, occupationType: type }));
                                                if (fieldErrors.occupationType) setFieldErrors(p => ({ ...p, occupationType: "" }));
                                            }}
                                            className={`px-4 py-2 rounded-full text-xs font-bold border-2 transition-all shadow-sm ${form.occupationType === type ? "bg-purple-600 text-white border-purple-600 ring-2 ring-purple-100" : fieldErrors.occupationType ? "border-red-400 text-red-600 bg-red-50 hover:border-red-500" : "border-purple-50 bg-white text-gray-600 hover:border-purple-200"}`}>
                                            {type === "Student" ? "🎓 Student" : type === "Working Professional" ? "💼 Working Pro" : "👤 Other"}
                                        </button>
                                    ))}
                                </div>
                                {fieldErrors.occupationType && <p className="text-[10px] text-red-600 font-bold mt-1">{fieldErrors.occupationType}</p>}
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">
                                    {form.occupationType === "Student" ? "College / University Name *" : "Company / Organisation Name *"}
                                </label>
                                <input className={`w-full border-2 rounded-lg p-2 text-sm bg-white font-medium focus:border-purple-300 focus:ring-0 ${fieldErrors.occupationDetail ? "border-red-500 bg-red-50" : "border-purple-50"}`}
                                    placeholder={form.occupationType === "Student" ? "e.g. IIT Delhi" : "e.g. Google India"}
                                    value={form.occupationDetail} onChange={e => {
                                        setForm(p => ({ ...p, occupationDetail: e.target.value }));
                                        if (fieldErrors.occupationDetail) setFieldErrors(p => ({ ...p, occupationDetail: "" }));
                                    }} />
                                {fieldErrors.occupationDetail && <p className="text-[10px] text-red-600 font-bold mt-0.5">{fieldErrors.occupationDetail}</p>}
                            </div>
                        </div>

                        {/* Room & Property Allocation */}
                        <div className="border-t pt-4 mt-2 space-y-4">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase text-purple-800 mb-1">
                                <RefreshCcw className="h-3 w-3" /> Allocate Room *
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Select Property (PG)</label>
                                    <select
                                        className="w-full border-2 border-purple-100 rounded-lg p-2 text-sm bg-white focus:border-purple-300 focus:ring-0 transition-all"
                                        value={selectedPropertyId}
                                        onChange={e => {
                                            setSelectedPropertyId(e.target.value);
                                            setSelectedRoomId(""); // Reset room selection
                                        }}
                                    >
                                        <option value="">Select a property...</option>
                                        {properties.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Bed Type Filter</label>
                                    <select
                                        className="w-full border-2 border-purple-100 rounded-lg p-2 text-sm bg-white focus:border-purple-300 focus:ring-0 transition-all"
                                        value={selectedBedType}
                                        onChange={e => {
                                            setSelectedBedType(e.target.value);
                                            setSelectedRoomId("");
                                        }}
                                    >
                                        <option value="ALL">All Bed Types</option>
                                        <option value="Single Sharing">Single Sharing</option>
                                        <option value="Double Sharing">Double Sharing</option>
                                        <option value="Three Sharing">Three Sharing</option>
                                        <option value="Four Sharing">Four Sharing</option>
                                        <option value="Five Sharing">Five Sharing</option>
                                        <option value="Six Sharing">Six Sharing</option>
                                    </select>
                                    {selectedPropertyId && selectedBedType !== "ALL" && (
                                        <div className="mt-2 text-[11px]">
                                            {(() => {
                                                const totalBeds = filteredRooms.reduce((sum, r) => sum + (r.availability || 0), 0);
                                                if (totalBeds === 0) return <span className="text-red-600 font-bold">🔴 No beds available in {selectedBedType}</span>;
                                                return <span className="text-blue-700 font-bold">🛏️ {totalBeds} total {selectedBedType} beds available</span>;
                                            })()}
                                        </div>
                                    )}
                                </div>

                                {selectedPropertyId && (
                                    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Select Room Number</label>
                                        <div className="flex gap-2">
                                            <select
                                                className="flex-1 border-2 border-purple-100 rounded-lg p-2 text-sm bg-white focus:border-purple-300 focus:ring-0 transition-all font-medium"
                                                value={selectedRoomId}
                                                onChange={e => {
                                                    const r = filteredRooms.find(rm => rm.id === e.target.value);
                                                    setSelectedRoomId(e.target.value);
                                                    if (r) {
                                                        setEditAmount(`₹${r.price.toLocaleString()}`);
                                                        setEditOccupancy(r.type);
                                                    }
                                                }}
                                            >
                                                <option value="">{booking.roomAssigned ? `Keep current: ${booking.roomAssigned.split(' ')[1] || booking.roomAssigned}` : "Select Room No."}</option>
                                                {filteredRooms.map(r => {
                                                    const avail = r.availability || 0;
                                                    let colorClass = "text-green-600 font-bold";
                                                    if (avail < 5) colorClass = "text-red-600 font-bold";
                                                    else if (avail >= 5 && avail <= 15) colorClass = "text-orange-500 font-bold";

                                                    return (
                                                        <option key={r.id} value={r.id} className={colorClass}>
                                                            Room {r.roomNumber}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            <div className="relative w-32">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground select-none">₹</span>
                                                <input
                                                    className="w-full border-2 border-purple-100 rounded-lg p-2 pl-5 text-sm bg-white font-bold text-purple-900 focus:border-purple-300 focus:ring-0"
                                                    value={editAmount.replace(/[^0-9.]/g, '')}
                                                    onChange={e => setEditAmount(`₹${onlyAmount(e.target.value)}`)}
                                                    placeholder="Amount"
                                                />
                                            </div>
                                        </div>
                                        {filteredRooms.length === 0 && (
                                            <p className="text-[10px] text-amber-600 font-bold mt-1 italic">⚠️ No rooms match criteria.</p>
                                        )}
                                        {selectedRoomId && (
                                            <div className="mt-2 text-xs">
                                                {(() => {
                                                    const selRoom = filteredRooms.find(r => r.id === selectedRoomId);
                                                    if (!selRoom) return null;
                                                    const avail = selRoom.availability || 0;
                                                    if (avail < 5) return <span className="text-red-600 font-bold">🔴 Only {avail} beds left in this room!</span>;
                                                    if (avail >= 5 && avail <= 15) return <span className="text-orange-500 font-bold">🟠 {avail} beds remaining</span>;
                                                    return <span className="text-green-600 font-bold">🟢 {avail} beds available</span>;
                                                })()}
                                            </div>
                                        )}
                                        {fieldErrors.roomSelection && <p className="text-[10px] text-red-600 font-bold mt-1">{fieldErrors.roomSelection}</p>}
                                    </div>
                                )}

                                    {/* ── Security Deposit Selector (appears after room is selected) ── */}
                                    {selectedRoomId && (() => {
                                        const selRoom = filteredRooms.find((r: any) => r.id === selectedRoomId);
                                        if (!selRoom) return null;
                                        const rent = Number(selRoom.price) || 0;
                                        const deposit1M = rent * 1;
                                        const deposit2M = rent * 2;
                                        const depositAmt = rent * depositMonths;
                                        const totalPayable = rent + depositAmt;
                                        return (
                                            <div className="mt-4 p-4 border-2 border-indigo-200 rounded-2xl bg-indigo-50 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                                                    <span className="text-[11px] font-black uppercase tracking-widest text-indigo-700">Security Deposit — Select Months</span>
                                                    <span className="text-[9px] bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full font-bold ml-auto">MTA 2021 · Max 2 Months</span>
                                                </div>

                                                {/* 1M / 2M toggle */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    {([1, 2] as const).map(m => (
                                                        <button
                                                            key={m}
                                                            type="button"
                                                            onClick={() => setDepositMonths(m)}
                                                            className={`h-20 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${
                                                                depositMonths === m
                                                                    ? 'border-indigo-500 bg-white shadow-lg ring-4 ring-indigo-100 scale-[1.02]'
                                                                    : 'border-indigo-100 bg-white/60 hover:border-indigo-300'
                                                            }`}
                                                        >
                                                            <span className={`text-xs font-black uppercase tracking-widest ${depositMonths === m ? 'text-indigo-700' : 'text-slate-500'}`}>
                                                                {m} Month{m > 1 ? 's' : ''} Deposit
                                                            </span>
                                                            <span className={`text-xl font-black ${depositMonths === m ? 'text-indigo-900' : 'text-slate-400'}`}>
                                                                ₹{(m === 1 ? deposit1M : deposit2M).toLocaleString('en-IN')}
                                                            </span>
                                                            {depositMonths === m && (
                                                                <span className="text-[9px] bg-indigo-100 text-indigo-600 font-bold px-2 py-0.5 rounded-full">Selected ✓</span>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Payment Breakdown */}
                                                <div className="bg-white rounded-xl border border-indigo-100 overflow-hidden">
                                                    <div className="px-4 py-2 bg-slate-900 flex items-center gap-2">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Payment Breakdown</span>
                                                    </div>
                                                    <div className="divide-y divide-slate-100">
                                                        <div className="flex justify-between items-center px-4 py-2.5">
                                                            <span className="text-xs font-medium text-slate-600">Monthly Rent (1st month)</span>
                                                            <span className="text-sm font-black text-slate-900">₹{rent.toLocaleString('en-IN')}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center px-4 py-2.5">
                                                            <div>
                                                                <span className="text-xs font-medium text-emerald-700">Security Deposit ({depositMonths} month{depositMonths > 1 ? 's' : ''})</span>
                                                                <span className="ml-2 text-[9px] bg-emerald-100 text-emerald-600 font-bold px-1.5 py-0.5 rounded-full">Refundable</span>
                                                            </div>
                                                            <span className="text-sm font-black text-emerald-700">₹{depositAmt.toLocaleString('en-IN')}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center px-4 py-3 bg-slate-50">
                                                            <span className="text-sm font-black text-slate-900">Total Due Now</span>
                                                            <span className="text-lg font-black text-slate-900">₹{totalPayable.toLocaleString('en-IN')}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Platform Fee Input */}
                                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] font-black uppercase tracking-widest text-amber-700">Platform Fee</span>
                                                        <span className="text-[9px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full ml-auto">Non-Refundable</span>
                                                    </div>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-800 select-none">₹</span>
                                                        <input
                                                            className="w-full border-2 border-amber-300 rounded-lg p-2 pl-7 text-sm bg-white font-bold text-amber-900 focus:border-amber-500 focus:ring-0"
                                                            value={platformFeeAmount}
                                                            onChange={e => setPlatformFeeAmount(onlyAmount(e.target.value))}
                                                            placeholder="e.g. 499"
                                                        />
                                                    </div>
                                                    <p className="text-[9px] text-amber-600 font-semibold">This fee will appear in the student's rental agreement.</p>
                                                </div>
                                                <p className="text-[9px] text-indigo-500 font-semibold text-center">
                                                    Deposit is refundable within 30 days of vacating · Deductions only for documented damage (not normal wear & tear)
                                                </p>
                                            </div>
                                        );
                                    })()}

                                </div>
                            </div>

                        {/* ── Pending Amount Prompt (for PAID bookings) ── */}
                        {showPendingPrompt && (
                            <div className="border-2 border-amber-400 bg-amber-50 rounded-lg p-4 space-y-3">
                                <div className="text-sm font-bold text-amber-800">💰 Is there a pending balance for this tenant?</div>
                                <p className="text-xs text-amber-700">This booking is already PAID. If you changed room/amount, specify any additional payment needed.</p>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => { setHasPending(true); }}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold border-2 transition-all ${hasPending ? "bg-red-500 text-white border-red-500" : "border-gray-300 text-gray-600 hover:border-red-400"}`}>
                                        ✅ Yes, Pending Amount
                                    </button>
                                    <button type="button" onClick={() => { setHasPending(false); setPendingAmount(""); }}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold border-2 transition-all ${!hasPending && showPendingPrompt ? "bg-green-500 text-white border-green-500" : "border-gray-300 text-gray-600 hover:border-green-400"}`}>
                                        ❌ No Pending Amount
                                    </button>
                                </div>
                                {hasPending && (
                                    <div>
                                        <label className="text-xs font-bold text-red-700 block mb-1">Enter Pending Amount (₹) — numbers only, up to 2 decimals</label>
                                        <input type="text" placeholder="e.g. 1500.00"
                                            className="w-full border-2 border-red-300 rounded p-2 text-sm bg-white font-bold text-red-800"
                                            value={pendingAmount}
                                            onChange={e => setPendingAmount(onlyAmount(e.target.value))} />
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3 pt-4">
                            <Button className="bg-indigo-600 hover:bg-indigo-700 font-black flex-1 rounded-full shadow-lg shadow-indigo-100 transition-all active:scale-95 py-6 uppercase tracking-widest text-xs" onClick={handleSave} disabled={saving}>
                                {saving ? "Saving..." : showPendingPrompt ? "✅ Confirm & Save" : "✅ Save Changes"}
                            </Button>
                            <button 
                                onClick={() => { setEditing(false); setShowPendingPrompt(false); }}
                                className="px-8 py-3 text-xs font-black bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-full transition-all active:scale-95 shadow-sm uppercase tracking-widest flex-1"
                            >
                                CANCEL
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Documents Section ── */}
                <div className="mt-3 border-t pt-3">
                    <button
                        onClick={() => setDocsExpanded(!docsExpanded)}
                        className="flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
                    >
                        📎 Document Verification
                        {pendingDocs.length > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">{pendingDocs.length}</span>
                        )}
                        {docsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>

                    {docsExpanded && (
                        <div className="mt-3 space-y-3">
                            {/* Pending */}
                            {pendingDocs.length > 0 && (
                                <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3">
                                    <div className="text-red-700 font-bold text-xs mb-2">🔴 {pendingDocs.length} Pending Review</div>
                                    {pendingDocs.map(doc => (
                                        <div key={doc.id} className="bg-white border border-red-200 rounded p-2 mb-2 flex items-center justify-between flex-wrap gap-2">
                                            <div>
                                                <div className="font-semibold text-sm">{TYPE_LABELS[doc.type] || doc.type}</div>
                                                <div className="text-[10px] text-muted-foreground">{doc.fileName} • {new Date(doc.uploadedAt).toLocaleString()}</div>
                                            </div>
                                            <div className="flex gap-1.5 flex-wrap items-center">
                                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPreviewDoc(doc)}><Eye className="h-3 w-3 mr-1" />View</Button>
                                                <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleVerify(doc.id)}><CheckCircle className="h-3 w-3 mr-1" />Approve</Button>
                                                {rejectTarget === doc.id ? (
                                                    <div className="flex gap-1">
                                                        <input className="border rounded px-2 py-1 text-xs w-32" placeholder="Reason..." value={rejectNote} onChange={e => setRejectNote(e.target.value)} />
                                                        <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleReject(doc.id)}>Reject</Button>
                                                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setRejectTarget(null); setRejectNote(""); }}>✕</Button>
                                                    </div>
                                                ) : (
                                                    <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-600" onClick={() => setRejectTarget(doc.id)}><XCircle className="h-3 w-3 mr-1" />Decline</Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Verified */}
                            {verifiedDocs.length > 0 && (
                                <div className="space-y-1">
                                    <div className="text-xs font-bold text-green-700">✅ Verified</div>
                                    {verifiedDocs.map(doc => (
                                        <div key={doc.id} className="bg-green-50 border border-green-200 rounded p-2 flex justify-between items-center">
                                            <span className="text-sm font-medium">{TYPE_LABELS[doc.type] || doc.type}</span>
                                            <div className="flex gap-1.5">
                                                <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded">✅ Approved</span>
                                                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setPreviewDoc(doc)}>View</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Rejected */}
                            {rejectedDocs.length > 0 && (
                                <div className="space-y-1">
                                    <div className="text-xs font-bold text-red-700">❌ Rejected — Awaiting Re-upload</div>
                                    {rejectedDocs.map(doc => (
                                        <div key={doc.id} className="bg-red-50 border border-red-300 rounded p-2 flex justify-between items-center">
                                            <div>
                                                <span className="text-sm font-medium">{TYPE_LABELS[doc.type] || doc.type}</span>
                                                {doc.rejectedNote && <div className="text-[10px] text-red-600">Reason: {doc.rejectedNote}</div>}
                                            </div>
                                            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setPreviewDoc(doc)}>View</Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {docs.length === 0 && !docsLoading && (
                                <div className="text-center text-xs text-muted-foreground py-3 border rounded bg-white">No documents uploaded yet.</div>
                            )}

                            {/* Owner upload */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="text-xs font-bold text-blue-700 mb-2">📤 Upload Document (max 5MB)</div>
                                <div className="flex gap-2 items-center flex-wrap">
                                    <select className="border rounded p-1.5 text-xs bg-white" value={uploadType} onChange={e => setUploadType(e.target.value)}>
                                        {DOC_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                                    </select>
                                    <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUpload} />
                                    <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => fileRef.current?.click()} disabled={uploadingCount > 0}>
                                        <UploadCloud className="h-3 w-3 mr-1" />
                                        {uploadingCount > 0 ? "Syncing..." : "Upload"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>

            {/* Doc Preview Modal */}
            {previewDoc && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreviewDoc(null)}>
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-bold">{TYPE_LABELS[previewDoc.type] || previewDoc.type}</h2>
                            <Button variant="ghost" size="sm" onClick={() => setPreviewDoc(null)}>✕</Button>
                        </div>
                        <div className={`text-xs font-bold px-2 py-1 rounded w-fit ${previewDoc.status === "VERIFIED" ? "bg-green-100 text-green-700" : previewDoc.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                            {previewDoc.status}{previewDoc.rejectedNote ? ` — ${previewDoc.rejectedNote}` : ""}
                        </div>
                        {previewDoc.fileData?.startsWith("data:image") ? (
                            <img src={previewDoc.fileData} alt="Document" className="w-full rounded-lg border max-h-96 object-contain" />
                        ) : previewDoc.fileData?.startsWith("data:application/pdf") ? (
                            <div className="p-4 bg-muted rounded text-center text-sm">📄 PDF — <a href={previewDoc.fileData} download={previewDoc.fileName} className="text-blue-600 underline">Download</a></div>
                        ) : (
                            <div className="p-4 bg-muted rounded text-center text-sm text-muted-foreground">Preview not available</div>
                        )}
                        <button 
                            className="w-full py-4 text-xs font-black bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-full transition-all active:scale-95 shadow-sm uppercase tracking-widest"
                            onClick={() => setPreviewDoc(null)}
                        >
                            CLOSE PREVIEW
                        </button>
                    </div>
                </div>
            )}
        </Card>
    );
}

export default function OnboardingPage() {
    const [bookings, setBookings] = useState<any[]>([]);
    const [rooms, setRooms] = useState<any[]>([]);
    const [properties, setProperties] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"ALL" | "PENDING_PAYMENT" | "PAID">("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [dateFilter, setDateFilter] = useState<"ALL" | "7D" | "30D">("7D");
    const [propertyFilter, setPropertyFilter] = useState("ALL");
    const [roomTypeFilter, setRoomTypeFilter] = useState("ALL");
    const [paymentFilter, setPaymentFilter] = useState("ALL");

    const fetchData = async () => {
        setLoading(true);
        try {
            const [b, r, p] = await Promise.all([getBookings(), getAvailableRooms(), getProperties()]);
            // Only show bookings that have been accepted and NOT yet fully paid (staying in onboarding)
            const onboardingBookings = b.filter((bk: any) =>
                bk.status === "APPROVED_PAYMENT_PENDING" ||
                bk.status === "APPROVED"
            );
            setBookings(onboardingBookings);
            setRooms(r);
            setProperties(p);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const filtered = bookings.filter(b => {
        // Status Filter
        const matchesStatus = filter === "ALL" || 
            (filter === "PENDING_PAYMENT" && (b.status === "APPROVED_PAYMENT_PENDING" || b.status === "APPROVED" || b.status === "APPROVED_KYC_PENDING")) ||
            (filter === "PAID" && (b.status === "PAID" || b.status === "CASH_PAID"));
        
        if (!matchesStatus) return false;

        // Multi-Filters
        if (propertyFilter !== "ALL" && b.propertyName !== propertyFilter) return false;
        if (roomTypeFilter !== "ALL" && b.occupancy !== roomTypeFilter) return false;
        if (paymentFilter !== "ALL" && (b.paymentMethod || "Online") !== paymentFilter) return false;

        // Date Filter
        if (dateFilter !== "ALL") {
            const date = new Date(b.createdAt);
            const now = new Date();
            const diffDays = (now.getTime() - date.getTime()) / (1000 * 3600 * 24);
            if (dateFilter === "7D" && diffDays > 7) return false;
            if (dateFilter === "30D" && diffDays > 30) return false;
        }

        // Search Filter
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            b.guestName?.toLowerCase().includes(q) ||
            b.displayId?.toLowerCase().includes(q) ||
            b.propertyName?.toLowerCase().includes(q) ||
            b.guestPhone?.toLowerCase().includes(q) ||
            b.roomAssigned?.toLowerCase().includes(q)
        );
    });

    const awaitingPayment = bookings.filter(b => b.status === "APPROVED_PAYMENT_PENDING" || b.status === "APPROVED").length;
    const paidCount = bookings.filter(b => b.status === "PAID" || b.status === "CASH_PAID").length;

    if (loading) return <div className="p-12 text-center animate-pulse text-muted-foreground">Loading onboarding data...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-bold">Onboarding</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage student onboarding after booking acceptance. Verify details, allocate rooms and collect documents.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                        toast.success("Export Started", { description: "Preparing CSV export for your records..." });
                    }} className="rounded-xl border-slate-200">
                        <UploadCloud className="h-4 w-4 mr-2 rotate-180" /> Export CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={fetchData}>
                        <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
                    </Button>
                </div>
            </div>

            {/* Pipeline overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-amber-700">{awaitingPayment}</div>
                    <div className="text-sm text-amber-800 font-medium mt-1 uppercase tracking-tighter">Awaiting Payment</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">ONBOARDING IN PROGRESS</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-green-700">{paidCount}</div>
                    <div className="text-sm text-green-800 font-medium mt-1 uppercase tracking-tighter">Paid & Confirmed</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">TENANTS CREATED</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-blue-700">{bookings.length}</div>
                    <div className="text-sm text-blue-800 font-medium mt-1 uppercase tracking-tighter">Total Onboarding</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">ALL ACCEPTED BOOKINGS</div>
                </div>
            </div>

            {/* Unified Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[280px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by name, room, or ID..."
                            className="pl-11 h-10 border-slate-200 bg-slate-50/30 focus:bg-white rounded-xl text-sm transition-all shadow-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <select
                        value={propertyFilter}
                        onChange={(e) => setPropertyFilter(e.target.value)}
                        className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all min-w-[160px]"
                    >
                        <option value="ALL">All Properties (PGs)</option>
                        {Array.from(new Set(bookings.map(b => b.propertyName).filter(Boolean))).map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>

                    <select
                        value={roomTypeFilter}
                        onChange={(e) => setRoomTypeFilter(e.target.value)}
                        className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all min-w-[140px]"
                    >
                        <option value="ALL">All Room Types</option>
                        {Array.from(new Set(bookings.map(b => b.occupancy).filter(Boolean))).map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>

                    <select
                        value={paymentFilter}
                        onChange={(e) => setPaymentFilter(e.target.value)}
                        className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all min-w-[140px]"
                    >
                        <option value="ALL">All Payments</option>
                        {Array.from(new Set(bookings.map(b => b.paymentMethod || "Online").filter(Boolean))).map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <div className="flex bg-slate-100/50 p-1 rounded-xl w-fit border border-slate-200">
                        {([
                            ["7D", "Last 7 Days"],
                            ["30D", "Last 30 Days"],
                            ["ALL", "Lifetime"],
                        ] as const).map(([val, label]) => (
                            <button
                                key={val}
                                onClick={() => setDateFilter(val)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest ${
                                    dateFilter === val
                                        ? "bg-indigo-600 text-white shadow-md"
                                        : "text-slate-500 hover:text-slate-700"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="flex bg-slate-100/50 p-1 rounded-xl w-fit border border-slate-200 ml-auto">
                        {([
                            ["ALL", "📋 All Records"],
                            ["PENDING_PAYMENT", "⏳ Awaiting Payment"],
                            ["PAID", "✅ Paid & Confirmed"],
                        ] as const).map(([val, label]) => (
                            <button
                                key={val}
                                onClick={() => setFilter(val)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest ${
                                    filter === val
                                        ? "bg-indigo-600 text-white shadow-md"
                                        : "text-slate-500 hover:text-slate-700"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>


            {/* Onboarding cards */}
            {filtered.length === 0 ? (
                <Card className="rounded-2xl border-dashed border-2 bg-slate-50/50">
                    <CardContent className="p-20 text-center text-muted-foreground">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ClipboardList className="h-8 w-8 text-slate-300" />
                        </div>
                        <div className="text-xl font-bold text-slate-900">No Onboarding Records</div>
                        <div className="text-sm mt-1 max-w-xs mx-auto text-slate-500">
                            Once you accept a booking request, it will appear here for you to verify documents and allocate rooms.
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filtered.map(booking => (
                        <OnboardingCard key={booking.id} booking={booking} rooms={rooms} properties={properties} onRefresh={fetchData} />
                    ))}
                </div>
            )}
        </div>
    );
}
