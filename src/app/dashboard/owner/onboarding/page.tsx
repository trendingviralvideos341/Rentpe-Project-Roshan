"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCcw, CheckCircle, Edit2, ChevronDown, ChevronUp, UploadCloud, XCircle, Eye } from "lucide-react";
import { getBookings, approveBooking, markBookingPaid } from "@/actions/bookings";
import { getAvailableRooms } from "@/actions/rooms";
import { getTenantDocuments, verifyDocument, uploadTenantDocument } from "@/actions/documents";
import { getProperties } from "@/actions/properties";
import { validateEmail, validatePhone, validateName, normalizePhone } from "@/lib/validators";

const OCCUPATION_TYPES = ["Student", "Working Professional", "Other"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const TYPE_LABELS: Record<string, string> = {
    ID_PROOF: "🪪 ID Proof",
    ADDRESS_PROOF: "🏠 Address Proof",
    COLLEGE_COMPANY: "🎓 College / Company",
    SELFIE: "📸 Live Selfie",
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
    const [previewDoc, setPreviewDoc] = useState<any>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // ── Citizen mode ──
    const [citizenMode, setCitizenMode] = useState<"indian" | "international">(
        booking.guestCountry && booking.guestCountry !== "India" ? "international" : "indian"
    );
    const [pincodeLoading, setPincodeLoading] = useState(false);

    const [form, setForm] = useState({
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
    const [selectedRoomId, setSelectedRoomId] = useState("");
    const [editAmount, setEditAmount] = useState(booking.amount || "");
    const [editOccupancy, setEditOccupancy] = useState(booking.occupancy || "");

    // Auto-select property of the booking if available
    useEffect(() => {
        if (booking.propertyName) {
            const prop = properties.find(p => p.name === booking.propertyName);
            if (prop) setSelectedPropertyId(prop.id);
        }
    }, [booking.propertyName, properties]);

    // Filtered rooms
    const filteredRooms = selectedPropertyId
        ? rooms.filter(r => r.propertyId === selectedPropertyId)
        : rooms;

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
        const emailErr = validateEmail(form.email); if (emailErr) errs.email = emailErr;
        const phoneToValidate = citizenMode === "indian" ? `+91${form.phone}` : form.phone;
        const phoneErr = validatePhone(phoneToValidate); if (phoneErr) errs.phone = phoneErr;
        if (!form.address.trim()) errs.address = "Address is required";
        if (citizenMode === "indian" && form.pincode.length !== 6) errs.pincode = "Valid 6-digit PIN required";
        if (!form.city.trim()) errs.city = "City is required";
        if (!form.onboardingDate) errs.onboardingDate = "Onboarding date required";
        if (!form.occupationType) errs.occupationType = "Occupation type required";
        if (!form.occupationDetail.trim()) errs.occupationDetail = "Occupation detail required";

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
            const room = selectedRoomId ? rooms.find(r => r.id === selectedRoomId) : null;
            await approveBooking(booking.id, {
                roomId: room?.id || booking.roomId,
                amount: editAmount || booking.amount,
                occupancy: editOccupancy || booking.occupancy,
                roomAssigned: room ? `${room.roomNumber} (${editOccupancy || room.type})` : booking.roomAssigned,
                guestEmail: form.email,
                guestPhone: citizenMode === "indian" ? `+91${form.phone}` : form.phone,
                guestAddress: form.address,
                guestCity: form.city,
                guestPincode: form.pincode,
                guestCountry: form.country,
                occupationType: form.occupationType,
                occupationDetail: form.occupationDetail,
                onboardingDate: form.onboardingDate,
                pendingAmount: hasPending && pendingAmount ? pendingAmount : undefined,
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
        if (file.size > MAX_FILE_SIZE) { alert("File exceeds 5MB limit."); return; }
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                await uploadTenantDocument({ bookingId: booking.id, type: uploadType, fileData: ev.target?.result as string, fileName: file.name });
                fetchDocs();
            } catch { alert("Upload failed."); }
        };
        reader.readAsDataURL(file);
        e.target.value = "";
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
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {[
                                    ["Name", booking.guestName],
                                    ["Email", booking.guestEmail || "—"],
                                    ["Phone", booking.guestPhone || "—"],
                                    ["Occupation", booking.occupationType ? `${booking.occupationType} — ${booking.occupationDetail || ""}` : "—"],
                                    ["Move-in Date", booking.onboardingDate || "—"],
                                    ["Address", booking.guestAddress ? `${booking.guestAddress}, ${booking.guestCity} - ${booking.guestPincode}` : "—"],
                                ].map(([label, val]) => (
                                    <div key={label} className="bg-muted/30 border rounded p-2">
                                        <div className="text-[10px] uppercase text-muted-foreground font-bold">{label}</div>
                                        <div className="text-sm">{val}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="text-xs font-bold uppercase text-green-700">🏠 Room & PG Details</div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {[
                                    ["PG / Property", booking.propertyName || "—"],
                                    ["Requested Type", booking.occupancy || "—"],
                                    ["Allocated Room", booking.roomAssigned || "Not Allocated"],
                                    ["Rent Amount", booking.amount || "—"],
                                    ["Payment", booking.paymentMethod || "Online"],
                                    ["Booking Ref", booking.displayId],
                                ].map(([label, val]) => (
                                    <div key={label} className="bg-muted/30 border rounded p-2">
                                        <div className="text-[10px] uppercase text-muted-foreground font-bold">{label}</div>
                                        <div className="text-sm">{val}</div>
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
                            {/* Email */}
                            <div>
                                <input type="email" placeholder="student@email.com"
                                    className={`w-full border rounded p-2 text-sm bg-white ${fieldErrors.email ? "border-red-500 ring-1 ring-red-200" : ""}`}
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
                                            🇮🇳 +91
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
                            <div>
                                <input type="text" placeholder="House No, Street..."
                                    className={`w-full border rounded p-2 text-sm bg-white ${fieldErrors.address ? "border-red-500 ring-1 ring-red-200" : ""}`}
                                    value={form.address} onChange={e => {
                                        setForm(p => ({ ...p, address: e.target.value }));
                                        if (fieldErrors.address) setFieldErrors(p => ({ ...p, address: "" }));
                                    }} />
                                {fieldErrors.address && <p className="text-[10px] text-red-600 font-bold mt-0.5">{fieldErrors.address}</p>}
                            </div>
                            {/* Pincode with auto-fetch */}
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">
                                    Pincode * {pincodeLoading && <span className="text-blue-500 animate-pulse ml-1">Fetching...</span>}
                                </label>
                                <input type="text"
                                    placeholder={citizenMode === "indian" ? "6-digit Indian pincode" : "Postal code"}
                                    className={`w-full border rounded p-2 text-sm bg-white ${fieldErrors.pincode ? "border-red-500 ring-1 ring-red-200" : ""}`}
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
                                    City * {citizenMode === "indian" && form.city && <span className="text-green-600 text-[10px] ml-1">✓ Auto-filled</span>}
                                </label>
                                <input type="text" placeholder={citizenMode === "indian" ? "Auto-fetched from pincode" : "City name"}
                                    className={`w-full border rounded p-2 text-sm bg-white ${fieldErrors.city ? "border-red-500 ring-1 ring-red-200" : ""}`}
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
                                    <input type="text" className="w-full border rounded p-2 text-sm bg-muted cursor-not-allowed" value="India" readOnly />
                                ) : (
                                    <input type="text" placeholder="Country" className="w-full border rounded p-2 text-sm bg-white"
                                        value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} />
                                )}
                            </div>
                            {/* Onboarding Date */}
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Onboarding Date *</label>
                                <input type="date" className={`w-full border rounded p-2 text-sm bg-white ${fieldErrors.onboardingDate ? "border-red-500 ring-1 ring-red-200" : ""}`}
                                    value={form.onboardingDate} onChange={e => {
                                        setForm(p => ({ ...p, onboardingDate: e.target.value }));
                                        if (fieldErrors.onboardingDate) setFieldErrors(p => ({ ...p, onboardingDate: "" }));
                                    }} />
                                {fieldErrors.onboardingDate && <p className="text-[10px] text-red-600 font-bold mt-0.5">{fieldErrors.onboardingDate}</p>}
                            </div>
                        </div>

                        {/* Occupation */}
                        <div>
                            <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Occupation Type *</label>
                            <div className="flex gap-2 flex-wrap">
                                {OCCUPATION_TYPES.map(type => (
                                    <button key={type} type="button" onClick={() => {
                                        setForm(p => ({ ...p, occupationType: type }));
                                        if (fieldErrors.occupationType) setFieldErrors(p => ({ ...p, occupationType: "" }));
                                    }}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${form.occupationType === type ? "bg-blue-600 text-white border-blue-600" : fieldErrors.occupationType ? "border-red-400 text-red-600 hover:border-red-500" : "border-gray-300 text-gray-600 hover:border-blue-400"}`}>
                                        {type === "Student" ? "🎓 Student" : type === "Working Professional" ? "💼 Working Pro" : "👤 Other"}
                                    </button>
                                ))}
                            </div>
                            {fieldErrors.occupationType && <p className="text-[10px] text-red-600 font-bold mt-1">{fieldErrors.occupationType}</p>}
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">
                                {form.occupationType === "Student" ? "College / University *" : "Company / Organisation *"}
                            </label>
                            <input className={`w-full border rounded p-2 text-sm bg-white ${fieldErrors.occupationDetail ? "border-red-500 ring-1 ring-red-200" : ""}`}
                                value={form.occupationDetail} onChange={e => {
                                    setForm(p => ({ ...p, occupationDetail: e.target.value }));
                                    if (fieldErrors.occupationDetail) setFieldErrors(p => ({ ...p, occupationDetail: "" }));
                                }} />
                            {fieldErrors.occupationDetail && <p className="text-[10px] text-red-600 font-bold mt-0.5">{fieldErrors.occupationDetail}</p>}
                        </div>

                        {/* Room change */}
                        <div className="border-t pt-3 space-y-3">
                            <div>
                                <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Select Property (PG)</label>
                                <select className="w-full border rounded p-2 text-sm bg-white" value={selectedPropertyId} onChange={e => {
                                    setSelectedPropertyId(e.target.value);
                                    setSelectedRoomId(""); // Reset room when property changes
                                }}>
                                    <option value="">Select a property...</option>
                                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>

                            {selectedPropertyId && (
                                <div>
                                    <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Select Room Allocation</label>
                                    <div className="flex gap-2">
                                        <select className="flex-1 border rounded p-2 text-sm bg-white" value={selectedRoomId} onChange={e => {
                                            const r = filteredRooms.find(rm => rm.id === e.target.value);
                                            setSelectedRoomId(e.target.value);
                                            if (r) { setEditAmount(`₹${r.price.toLocaleString()}`); setEditOccupancy(r.type); }
                                        }}>
                                            <option value="">Keep current: {booking.roomAssigned || "Not Allocated"}</option>
                                            {filteredRooms.map(r => <option key={r.id} value={r.id}>{r.roomNumber} ({r.type}) — ₹{r.price.toLocaleString()}</option>)}
                                        </select>
                                        <input className="w-28 border rounded p-2 text-sm bg-white font-bold" value={editAmount}
                                            onChange={e => setEditAmount(e.target.value)} placeholder="Amount" />
                                    </div>
                                </div>
                            )}
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

                        <div className="flex gap-2 pt-2">
                            <Button className="bg-green-600 hover:bg-green-700 flex-1" onClick={handleSave} disabled={saving}>
                                {saving ? "Saving..." : showPendingPrompt ? "✅ Confirm & Save" : "✅ Save Changes"}
                            </Button>
                            <Button variant="ghost" className="flex-1" onClick={() => { setEditing(false); setShowPendingPrompt(false); }}>Cancel</Button>
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
                                    <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => fileRef.current?.click()}>
                                        <UploadCloud className="h-3 w-3 mr-1" />Upload
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
                        <Button className="w-full" onClick={() => setPreviewDoc(null)}>Close</Button>
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

    const fetchData = async () => {
        setLoading(true);
        try {
            const [b, r, p] = await Promise.all([getBookings(), getAvailableRooms(), getProperties()]);
            // Only show bookings that have been accepted (not still pending, not rejected)
            const onboardingBookings = b.filter((bk: any) =>
                bk.status === "APPROVED_PAYMENT_PENDING" ||
                bk.status === "APPROVED" ||
                bk.status === "PAID" ||
                bk.status === "CASH_PAID"
            );
            setBookings(onboardingBookings);
            setRooms(r);
            setProperties(p);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const filtered = bookings.filter(b => {
        if (filter === "PENDING_PAYMENT") return b.status === "APPROVED_PAYMENT_PENDING" || b.status === "APPROVED";
        if (filter === "PAID") return b.status === "PAID" || b.status === "CASH_PAID";
        return true;
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
                <Button variant="outline" size="sm" onClick={fetchData}>
                    <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
                </Button>
            </div>

            {/* Pipeline overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-amber-700">{awaitingPayment}</div>
                    <div className="text-sm text-amber-800 font-medium mt-1">Accepted — Awaiting Payment</div>
                    <div className="text-xs text-muted-foreground mt-1">Onboarding in progress</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-green-700">{paidCount}</div>
                    <div className="text-sm text-green-800 font-medium mt-1">Paid & Confirmed</div>
                    <div className="text-xs text-muted-foreground mt-1">Tenants created</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-blue-700">{bookings.length}</div>
                    <div className="text-sm text-blue-800 font-medium mt-1">Total Onboarding</div>
                    <div className="text-xs text-muted-foreground mt-1">All accepted bookings</div>
                </div>
            </div>

            {/* Filter */}
            <div className="flex gap-2 flex-wrap">
                {([
                    ["ALL", `📋 All (${bookings.length})`],
                    ["PENDING_PAYMENT", `⏳ Awaiting Payment (${awaitingPayment})`],
                    ["PAID", `✅ Paid (${paidCount})`],
                ] as const).map(([val, label]) => (
                    <Button
                        key={val}
                        size="sm"
                        onClick={() => setFilter(val)}
                        className={filter === val
                            ? val === "PENDING_PAYMENT" ? "bg-amber-500 hover:bg-amber-600 text-white"
                                : val === "PAID" ? "bg-green-600 hover:bg-green-700 text-white"
                                    : "bg-purple-600 hover:bg-purple-700 text-white"
                            : "bg-white border hover:bg-muted text-foreground"}
                    >
                        {label}
                    </Button>
                ))}
            </div>

            {/* Onboarding cards */}
            {filtered.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center text-muted-foreground">
                        <div className="text-4xl mb-3">📋</div>
                        <div className="font-semibold">No accepted bookings yet.</div>
                        <div className="text-sm mt-1">Once you accept a booking request, it will appear here for onboarding.</div>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {filtered.map(booking => (
                        <OnboardingCard key={booking.id} booking={booking} rooms={rooms} properties={properties} onRefresh={fetchData} />
                    ))}
                </div>
            )}
        </div>
    );
}
