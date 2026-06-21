"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RefreshCcw, CheckCircle, Edit2, ChevronDown, ChevronUp, UploadCloud, XCircle, Eye, Search, Building2, Info } from "lucide-react";
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
    const [editAmount, setEditAmount] = useState(booking.amount || "");
    const [editOccupancy, setEditOccupancy] = useState(booking.occupancy || "");
    const [consentConfirmed, setConsentConfirmed] = useState(false);

    useEffect(() => {
        if (booking.propertyName) {
            const prop = properties.find(p => p.name === booking.propertyName);
            if (prop) setSelectedPropertyId(prop.id);
        }
    }, [booking.propertyName, properties]);

    const filteredRooms = rooms.filter(r => {
        if (selectedPropertyId && r.propertyId !== selectedPropertyId) return false;
        if (selectedBedType && selectedBedType !== "ALL" && r.type !== selectedBedType) return false;
        return true;
    });

    const [showPendingPrompt, setShowPendingPrompt] = useState(false);
    const [hasPending, setHasPending] = useState(false);
    const [pendingAmount, setPendingAmount] = useState("");

    const fetchDocs = async () => {
        setDocsLoading(true);
        try { setDocs(await getTenantDocuments(booking.id)); } catch { }
        finally { setDocsLoading(false); }
    };

    useEffect(() => { if (docsExpanded) fetchDocs(); }, [docsExpanded]);

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
            } catch { } finally { setPincodeLoading(false); }
        }
    };

    const handleSave = async () => {
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
            toast.error("Please fix the errors highlighted in red.");
            return;
        }
        setFieldErrors({});

        if (booking.status === "PAID" || booking.status === "CASH_PAID") {
            if (!showPendingPrompt) {
                setShowPendingPrompt(true);
                return;
            }
        }

        setSaving(true);
        try {
            const room = selectedRoomId ? rooms.find(r => r.id === selectedRoomId) : null;
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
            });
            setEditing(false);
            setShowPendingPrompt(false);
            setHasPending(false);
            setPendingAmount("");
            toast.success("Details updated successfully");
            onRefresh();
        } catch { toast.error("Save failed."); }
        finally { setSaving(false); }
    };

    const handleCashPaid = async () => {
        if (!confirm("Mark this booking as PAID via Cash and create Tenant record?")) return;
        try { await markBookingPaid(booking.id, "CASH"); toast.success("Marked as paid"); onRefresh(); } catch { toast.error("Failed."); }
    };

    const handleVerify = async (docId: string) => {
        try { await verifyDocument(docId, "VERIFIED"); toast.success("Document verified"); fetchDocs(); } catch { toast.error("Failed."); }
    };

    const handleReject = async (docId: string) => {
        if (!rejectNote.trim()) { toast.error("Enter rejection reason."); return; }
        try {
            await verifyDocument(docId, "REJECTED", rejectNote);
            setRejectTarget(null); setRejectNote(""); toast.success("Document rejected"); fetchDocs();
        } catch { toast.error("Failed."); }
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
        ? <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider ring-1 ring-indigo-200">✅ PAID (RESERVED)</span>
        : booking.status === "CASH_PAID"
            ? <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider ring-1 ring-emerald-200">💵 PAID (Cash)</span>
            : booking.status === "APPROVED_KYC_PENDING"
                ? <span className="bg-blue-100 text-blue-800 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider ring-1 ring-blue-200">📝 KYC PENDING</span>
                : <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider ring-1 ring-amber-200">⏳ Awaiting Payment</span>;

    return (
        <Card className={`overflow-hidden transition-all duration-300 border-2 rounded-2xl shadow-sm hover:shadow-md ${booking.status === "PAID" || booking.status === "CASH_PAID" ? "border-green-100 bg-green-50/5" : "border-amber-100 bg-amber-50/5"}`}>
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-extrabold text-lg text-slate-800 tracking-tight">{booking.guestName}</h3>
                            {statusBadge}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-600">{booking.displayId}</span>
                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                            <span className="text-primary">{booking.propertyName}</span>
                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                            <span>{booking.roomAssigned || "Room TBD"}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-widest text-indigo-600 mt-2">
                           <span className="flex items-center gap-1">📅 MOVE-IN: {booking.onboardingDate || booking.moveInDate || "—"}</span>
                           <span className="w-1.5 h-1.5 bg-indigo-100 rounded-full"></span>
                           <span className="flex items-center gap-1">👤 {booking.occupationType || "N/A"}</span>
                        </div>
                    </div>
                    <div className="flex gap-2 items-center">
                        <button 
                            className="h-9 px-6 text-[10px] font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full transition-all active:scale-95 shadow-sm uppercase tracking-widest border border-indigo-100" 
                            onClick={() => { setEditing(!editing); setShowPendingPrompt(false); }}
                        >
                            {editing ? "CANCEL" : "EDIT"}
                        </button>
                        {booking.status !== "PAID" && booking.status !== "CASH_PAID" && booking.paymentMethod === "CASH" && (
                            <Button size="sm" className="h-9 px-4 rounded-xl font-black bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100" onClick={handleCashPaid}>
                                MARK PAID
                            </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl hover:bg-slate-100" onClick={() => setExpanded(!expanded)}>
                            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </Button>
                    </div>
                </div>

                {/* Grid stats */}
                {!expanded && !editing && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                       {[
                           { icon: "📧", label: "EMAIL", value: booking.guestEmail || "—" },
                           { icon: "📱", label: "PHONE", value: booking.guestPhone || "—" },
                           { icon: "🏙️", label: "CITY", value: booking.guestCity || "—" },
                           { icon: "💰", label: "RENT", value: `₹${Number(booking.amount).toLocaleString() || "—"}` },
                       ].map(item => (
                           <div key={item.label} className="p-3 rounded-2xl bg-white border-2 border-slate-50 shadow-sm transition-all hover:border-indigo-100">
                               <div className="text-[9px] font-black text-slate-400 tracking-widest uppercase flex items-center gap-1">
                                   <span className="opacity-0 group-hover:opacity-100 transition-opacity">{item.icon}</span> {item.label}
                               </div>
                               <div className="text-xs font-bold text-slate-700 truncate mt-1">{item.value}</div>
                           </div>
                       ))}
                    </div>
                )}

                {/* Details view */}
                {expanded && !editing && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-4 duration-300">
                        <div className="space-y-4">
                            <div className="text-[10px] font-black uppercase text-indigo-600 tracking-widest flex items-center gap-2 px-1">
                                <span className="w-6 h-0.5 bg-indigo-600 rounded-full"></span> PROFILE INFORMATION
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { label: "FULL NAME", value: booking.guestName },
                                    { label: "EMAIL ID", value: booking.guestEmail || "—" },
                                    { label: "CONTACT NUMBER", value: booking.guestPhone || "—" },
                                    { label: "OCCUPATION", value: booking.occupationType ? `${booking.occupationType} — ${booking.occupationDetail || ""}` : "—" },
                                    { label: "ADDRESS", value: booking.guestAddress ? `${booking.guestAddress}, ${booking.guestCity} - ${booking.guestPincode}` : "—" },
                                    { label: "MEMBER SINCE", value: new Date(booking.createdAt).toLocaleDateString() },
                                ].map(item => (
                                    <div key={item.label} className="p-3 rounded-xl bg-slate-50 border-2 border-transparent transition-all hover:bg-white hover:border-indigo-100 group">
                                        <div className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">{item.label}</div>
                                        <div className="text-xs font-bold text-slate-800 mt-1 break-words">{item.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="text-[10px] font-black uppercase text-teal-600 tracking-widest flex items-center gap-2 px-1">
                                <span className="w-6 h-0.5 bg-teal-600 rounded-full"></span> BOOKING & ALLOCATION
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { label: "ASSIGNED PG", value: booking.propertyName || "—" },
                                    { label: "BED CONFIG", value: booking.occupancy || "—" },
                                    { label: "ALLOCATED UNIT", value: booking.roomAssigned || "NOT ALLOCATED" },
                                    { label: "MONTHLY RENT", value: `₹${Number(booking.amount).toLocaleString()}` },
                                    { label: "SETTLEMENT", value: booking.paymentMethod === 'CASH' ? "💸 DIRECT CASH" : "⚡ ONLINE PAY" },
                                    { label: "SYSTEM ID", value: booking.displayId },
                                ].map(item => (
                                    <div key={item.label} className="p-3 rounded-xl bg-teal-50/30 border-2 border-transparent transition-all hover:bg-white hover:border-teal-100 group">
                                        <div className="text-[9px] font-bold text-teal-600/60 tracking-wider uppercase">{item.label}</div>
                                        <div className="text-xs font-bold text-slate-800 mt-1">{item.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Form */}
                {editing && (
                    <div className="mt-6 space-y-5 bg-indigo-50/30 border-2 border-indigo-100 rounded-3xl p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b-2 border-indigo-100 pb-4 mb-4">
                            <h4 className="font-black text-sm text-indigo-950 uppercase tracking-widest flex items-center gap-2">
                                <Edit2 className="h-4 w-4" /> Edit Tenant Details
                            </h4>
                            <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border-2 border-indigo-50">
                                <button type="button" onClick={() => { setCitizenMode("indian"); setForm(p => ({ ...p, country: "India" })); }}
                                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${citizenMode === "indian" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-indigo-600"}`}>
                                    DOMESTIC
                                </button>
                                <button type="button" onClick={() => setCitizenMode("international")}
                                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${citizenMode === "international" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-indigo-600"}`}>
                                    INTERNATIONAL
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 block px-1">Legal Full Name</label>
                                <Input className={`h-11 rounded-xl border-2 font-bold ${fieldErrors.guestName ? "border-red-400 bg-red-50" : "border-slate-100 focus:border-indigo-300"}`} value={form.guestName} onChange={e => setForm(p => ({ ...p, guestName: onlyLetters(e.target.value) }))} />
                                {fieldErrors.guestName && <p className="text-[10px] text-red-600 font-bold mt-1 px-1">{fieldErrors.guestName}</p>}
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 block px-1">Email Address</label>
                                <Input className={`h-11 rounded-xl border-2 font-bold ${fieldErrors.email ? "border-red-400 bg-red-50" : "border-slate-100 focus:border-indigo-300"}`} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                                {fieldErrors.email && <p className="text-[10px] text-red-600 font-bold mt-1 px-1">{fieldErrors.email}</p>}
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 block px-1">Contact Phone</label>
                                <div className="flex">
                                    {citizenMode === "indian" && <span className="h-11 flex items-center px-4 bg-slate-100 border-2 border-r-0 border-slate-100 rounded-l-xl text-[11px] font-black text-slate-400">+91</span>}
                                    <Input className={`h-11 rounded-xl border-2 font-bold ${citizenMode === "indian" ? "rounded-l-none" : ""} ${fieldErrors.phone ? "border-red-400 bg-red-50" : "border-slate-100 focus:border-indigo-300"}`} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: citizenMode === "indian" ? onlyDigits(e.target.value).slice(0, 10) : e.target.value }))} />
                                </div>
                                {fieldErrors.phone && <p className="text-[10px] text-red-600 font-bold mt-1 px-1">{fieldErrors.phone}</p>}
                            </div>
                            <div className="sm:col-span-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 block px-1">Street Address</label>
                                <Input className={`h-11 rounded-xl border-2 font-bold ${fieldErrors.address ? "border-red-400 bg-red-50" : "border-slate-100 focus:border-indigo-300"}`} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
                                {fieldErrors.address && <p className="text-[10px] text-red-600 font-bold mt-1 px-1">{fieldErrors.address}</p>}
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 block px-1">Zip / Pincode {pincodeLoading && "..."}</label>
                                <Input className={`h-11 rounded-xl border-2 font-bold ${fieldErrors.pincode ? "border-red-400 bg-red-50" : "border-slate-100 focus:border-indigo-300"}`} value={form.pincode} onChange={e => handlePincodeChange(e.target.value)} />
                                {fieldErrors.pincode && <p className="text-[10px] text-red-600 font-bold mt-1 px-1">{fieldErrors.pincode}</p>}
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 block px-1">City / District</label>
                                <Input className={`h-11 rounded-xl border-2 font-bold ${fieldErrors.city ? "border-red-400 bg-red-50" : "border-slate-100 focus:border-indigo-300"}`} value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
                                {fieldErrors.city && <p className="text-[10px] text-red-600 font-bold mt-1 px-1">{fieldErrors.city}</p>}
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 block px-1">Onboarding Date</label>
                                <Input type="date" className="h-11 rounded-xl border-2 font-bold border-slate-100 focus:border-indigo-300" value={form.onboardingDate} onChange={e => setForm(p => ({ ...p, onboardingDate: e.target.value }))} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 block px-1">Occupation Type</label>
                                <select className="w-full h-11 px-4 rounded-xl border-2 border-slate-100 font-bold text-sm bg-white focus:border-indigo-300" value={form.occupationType} onChange={e => setForm(p => ({ ...p, occupationType: e.target.value }))}>
                                    {OCCUPATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Legal Consent Checkbox for Managers */}
                        <div className={`mt-4 p-4 rounded-2xl border-2 transition-all ${consentConfirmed ? "border-emerald-200 bg-emerald-50/30" : "border-amber-100 bg-amber-50/30"}`}>
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                                    checked={consentConfirmed}
                                    onChange={e => setConsentConfirmed(e.target.checked)}
                                />
                                <div className="space-y-1">
                                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-wide">Managerial Declaration & Consent</p>
                                    <p className="text-[10px] text-slate-600 leading-relaxed">
                                        I confirm that I have obtained the tenant's explicit consent to process their personal data and have verified their original identity documents. I understand that Misrepresentation of tenant data is a violation of the property management agreement.
                                    </p>
                                </div>
                            </label>
                        </div>

                        <div className="flex gap-3 pt-4 border-t-2 border-indigo-100">
                             <Button 
                                className="flex-1 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 disabled:opacity-40" 
                                onClick={handleSave} 
                                disabled={saving || !consentConfirmed}
                             >
                                 {saving ? "SYNCING..." : "UPDATE & VERIFY"}
                             </Button>
                             <button 
                                 className="h-12 px-8 text-xs font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full transition-all active:scale-95 shadow-sm uppercase tracking-widest" 
                                 onClick={() => setEditing(false)}
                             >
                                 CANCEL
                             </button>
                        </div>
                    </div>
                )}

                {/* Docs section */}
                <div className="mt-6 pt-5 border-t-2 border-slate-50">
                    <button onClick={() => setDocsExpanded(!docsExpanded)} className="w-full flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors py-2 group">
                        <span className="flex items-center gap-2">
                           📎 ATTACHED DOCUMENTS
                           {pendingDocs.length > 0 && <span className="bg-red-500 text-white h-5 w-5 rounded-full flex items-center justify-center animate-pulse shadow-md shadow-red-100">{pendingDocs.length}</span>}
                        </span>
                        {docsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {docsExpanded && (
                        <div className="mt-4 space-y-4 animate-in fade-in duration-300">
                            {docs.length === 0 && !docsLoading && (
                                <div className="text-center p-8 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 text-slate-400 font-medium italic text-xs">
                                    No documents attached yet.
                                </div>
                            )}

                            {docs.map(doc => (
                                <div key={doc.id} className="p-4 rounded-2xl bg-white border-2 border-slate-50 shadow-sm flex items-center justify-between flex-wrap gap-4 transition-all hover:border-indigo-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-xl">
                                            {doc.type === 'ID_PROOF' ? '🪪' : doc.type === 'ADDRESS_PROOF' ? '🏠' : doc.type === 'SELFIE' ? '📸' : '🎓'}
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{TYPE_LABELS[doc.type] || doc.type}</div>
                                            <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                                {doc.status === 'VERIFIED' ? <span className="text-emerald-600">VERIFIED</span> : doc.status === 'REJECTED' ? <span className="text-red-500">REJECTED</span> : <span className="text-amber-500 animate-pulse">PENDING REVIEW</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" className="h-8 rounded-lg font-bold text-[10px]" onClick={() => setPreviewDoc(doc)}>VIEW</Button>
                                        {doc.status === 'PENDING' && (
                                            <>
                                                <Button size="sm" className="h-8 rounded-lg font-bold text-[10px] bg-emerald-600" onClick={() => handleVerify(doc.id)}>APPROVE</Button>
                                                <Button size="sm" variant="destructive" className="h-8 rounded-lg font-bold text-[10px]" onClick={() => setRejectTarget(doc.id)}>DECLINE</Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Self Upload */}
                            <div className="p-5 rounded-3xl bg-indigo-50/50 border-2 border-dashed border-indigo-200/50">
                                <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-4">MANAGER ACTIONS: QUICK UPLOAD</div>
                                <div className="flex gap-2 items-center flex-wrap">
                                    <select className="h-10 px-4 rounded-xl border-2 border-white bg-white font-bold text-xs outline-none focus:border-indigo-300 transition-all text-slate-700" value={uploadType} onChange={e => setUploadType(e.target.value)}>
                                        {DOC_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t].split(' ')[1]}</option>)}
                                    </select>
                                    <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
                                    <Button size="sm" className="h-10 rounded-xl font-black bg-indigo-600 hover:bg-indigo-700 px-6 text-[10px] tracking-widest uppercase shadow-lg shadow-indigo-100" onClick={() => fileRef.current?.click()} disabled={uploadingCount > 0}>
                                        {uploadingCount > 0 ? "UPLOADING..." : "UPLOAD DOCUMENT"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>

            {/* Preview Modal */}
            {previewDoc && (
                <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
                    <DialogContent className="max-w-2xl overflow-hidden p-0 rounded-3xl border-4 border-slate-900 shadow-2xl">
                        <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                            <div className="space-y-1">
                                <h3 className="font-black text-lg tracking-tight">{TYPE_LABELS[previewDoc.type]}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{previewDoc.status}</p>
                            </div>
                             <button 
                                 className="px-6 py-2 text-[10px] font-black bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-full transition-all active:scale-95 shadow-sm uppercase tracking-widest" 
                                 onClick={() => setPreviewDoc(null)}
                             >
                                 CLOSE
                             </button>
                        </div>
                        <div className="p-8 bg-slate-50 flex items-center justify-center min-h-[400px]">
                            {previewDoc.fileData?.includes("pdf") ? (
                                <div className="text-center space-y-4">
                                    <div className="text-6xl text-slate-300">📄</div>
                                    <p className="font-bold text-slate-500">Document available in PDF format</p>
                                    <Button asChild className="rounded-xl font-bold bg-indigo-600"><a href={previewDoc.fileData} download>DOWNLOAD PDF</a></Button>
                                </div>
                            ) : (
                                <img src={previewDoc.fileData} className="max-w-full max-h-[70vh] rounded-2xl shadow-2xl border-4 border-white object-contain" alt="Document" />
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </Card>
    );
}

export function OnboardingContainer() {
    const [bookings, setBookings] = useState<any[]>([]);
    const [rooms, setRooms] = useState<any[]>([]);
    const [properties, setProperties] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [propertyFilter, setPropertyFilter] = useState("ALL");

    const fetchData = async () => {
        setLoading(true);
        try {
            const [b, r, p] = await Promise.all([getBookings(), getAvailableRooms(), getProperties()]);
            const onboardingBookings = b.filter((bk: any) =>
                bk.status === "APPROVED_KYC_PENDING" ||
                bk.status === "APPROVED_PAYMENT_PENDING" ||
                bk.status === "APPROVED" ||
                bk.status === "PAID" ||
                bk.status === "CASH_PAID"
            );
            setBookings(onboardingBookings);
            setRooms(r);
            setProperties(p);
        } catch (e) {
            console.error(e);
            toast.error("Failed to fetch onboarding data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const filtered = bookings.filter(b => {
        const matchesSearch = b.guestName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             b.displayId.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesProp = propertyFilter === "ALL" || b.propertyName === propertyFilter;
        return matchesSearch && matchesProp;
    });

    if (loading && bookings.length === 0) return (
        <div className="p-12 flex flex-col items-center justify-center min-h-[500px] space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="font-black text-[10px] tracking-[0.2em] text-slate-400 uppercase">Syncing Onboarding Data...</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Onboarding <span className="text-indigo-600">Portal</span></h1>
                    <p className="text-slate-500 font-medium">Manage student documentation, KYC verification, and room allocations.</p>
                </div>
                <div className="flex gap-3 flex-wrap">
                    <div className="relative group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                        <Input 
                            className="h-11 w-full md:w-64 pl-10 rounded-2xl border-2 border-slate-100 focus:border-indigo-300 transition-all font-bold placeholder:text-slate-300"
                            placeholder="Search by name or ID..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <select 
                        className="h-11 px-4 rounded-2xl border-2 border-slate-100 font-bold text-xs bg-white focus:border-indigo-300 transition-all text-slate-700 outline-none"
                        value={propertyFilter}
                        onChange={e => setPropertyFilter(e.target.value)}
                    >
                        <option value="ALL">All Properties</option>
                        {properties.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-2 border-slate-100 transition-all hover:bg-slate-50" onClick={fetchData}>
                        <RefreshCcw className="h-5 w-5 text-slate-600" />
                    </Button>
                </div>
            </div>

            <div className="bg-amber-50/60 border border-amber-200/80 rounded-3xl p-5 flex gap-4 text-amber-900 shadow-sm">
                <Info className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-sm font-black uppercase tracking-wider">Student Online KYC Bypassed (Physical Check-in Active)</p>
                    <p className="text-xs text-amber-700 leading-relaxed font-medium">
                        For student tenants, online document upload has been disabled. They have been instructed to bring physical documents (ID proof, address proof, etc.) at check-in. Please verify these physically and complete onboarding, or use the quick-upload tool below on each tenant's card to upload scanned copies for your records.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {filtered.map(b => (
                    <OnboardingCard key={b.id} booking={b} rooms={rooms} properties={properties} onRefresh={fetchData} />
                ))}

                {filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-20 rounded-[32px] border-4 border-dashed border-slate-100 bg-slate-50/50">
                        <div className="w-16 h-16 rounded-3xl bg-white border-2 border-slate-100 flex items-center justify-center text-4xl mb-6 shadow-sm">
                            👤
                        </div>
                        <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">No Active Onboarding</h3>
                        <p className="text-slate-400 font-medium text-center max-w-xs mt-2 italic text-sm">
                            New bookings will appear here once they've been accepted and are ready for KYC/Onboarding.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
