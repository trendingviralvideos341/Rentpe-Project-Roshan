"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getBookings, cancelBooking } from "@/actions/bookings";
import { getTenantDocuments, uploadTenantDocument } from "@/actions/documents";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCcw, FileText, BedDouble, Calendar, CreditCard, CheckCircle, XCircle, UploadCloud, ChevronDown, ChevronUp, AlertTriangle, Phone, Mail, User, History, Shield, Building2 } from "lucide-react";
import { getStudentPaymentHistory } from "@/actions/payments";
import RentReceipt from "@/components/bookings/RentReceipt";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { generateInvoicePDF } from "@/utils/invoiceGenerator";
import { Download } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
    ID_PROOF: "🪪 ID Proof",
    ADDRESS_PROOF: "🏠 Address Proof",
    COLLEGE_COMPANY: "🎓 College / Company Letter",
    SELFIE: "📸 Live Selfie",
};
const DOC_TYPES = ["ID_PROOF", "ADDRESS_PROOF", "COLLEGE_COMPANY", "SELFIE"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function DocumentSection({ booking }: { booking: any }) {
    const [docs, setDocs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploadType, setUploadType] = useState("ID_PROOF");
    const [previewDoc, setPreviewDoc] = useState<any>(null);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const fetchDocs = useCallback(async () => {
        setLoading(true);
        try {
            const d = await getTenantDocuments(booking.id);
            setDocs(d);
        } catch { } finally { setLoading(false); }
    }, [booking.id]);

    useEffect(() => { fetchDocs(); }, [fetchDocs]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_FILE_SIZE) { alert("File size exceeds 5MB limit. Please upload a smaller file."); return; }
        setUploading(true);
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const base64 = ev.target?.result as string;
            try {
                await uploadTenantDocument({ bookingId: booking.id, type: uploadType, fileData: base64, fileName: file.name });
                await fetchDocs();
            } catch { alert("Upload failed. Please try again."); }
            finally { setUploading(false); }
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    const rejectedDocs = docs.filter(d => d.status === "REJECTED");
    const pendingDocs = docs.filter(d => d.status === "PENDING");
    const verifiedDocs = docs.filter(d => d.status === "VERIFIED");

    return (
        <div className="mt-4 space-y-3">
            {/* Rejected docs — need re-upload — shown in red */}
            {rejectedDocs.length > 0 && (
                <div className="bg-red-50 border-2 border-red-500 rounded-lg p-3">
                    <div className="text-red-700 font-bold text-sm mb-2 animate-pulse">
                        🔴 {rejectedDocs.length} Document{rejectedDocs.length > 1 ? "s" : ""} Rejected — Please Re-upload
                    </div>
                    <div className="space-y-2">
                        {rejectedDocs.map(doc => (
                            <div key={doc.id} className="bg-white border border-red-300 rounded p-2 flex justify-between items-start gap-2 flex-wrap">
                                <div>
                                    <div className="font-semibold text-sm">{TYPE_LABELS[doc.type] || doc.type}</div>
                                    <div className="text-[11px] text-red-600 font-medium">Reason: {doc.rejectedNote || "Document declined"}</div>
                                    <div className="text-[10px] text-muted-foreground">Uploaded: {new Date(doc.uploadedAt).toLocaleString()}</div>
                                </div>
                                <Button size="sm" variant="outline" className="h-7 text-[11px] border-red-400 text-red-600 hover:bg-red-50" onClick={() => setPreviewDoc(doc)}>
                                    View
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Pending docs — waiting review */}
            {pendingDocs.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
                    <div className="text-amber-800 font-bold text-sm mb-2">
                        ⏳ {pendingDocs.length} Document{pendingDocs.length > 1 ? "s" : ""} Pending Review
                    </div>
                    <div className="space-y-1.5">
                        {pendingDocs.map(doc => (
                            <div key={doc.id} className="bg-white border border-amber-200 rounded p-2 flex justify-between items-center">
                                <div>
                                    <div className="font-semibold text-sm">{TYPE_LABELS[doc.type] || doc.type}</div>
                                    <div className="text-[10px] text-muted-foreground">{doc.fileName} • {new Date(doc.uploadedAt).toLocaleString()}</div>
                                </div>
                                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">PENDING</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Verified docs */}
            {verifiedDocs.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-green-700 font-bold text-sm mb-2">✅ {verifiedDocs.length} Verified Document{verifiedDocs.length > 1 ? "s" : ""}</div>
                    <div className="space-y-1.5">
                        {verifiedDocs.map(doc => (
                            <div key={doc.id} className="bg-white border border-green-200 rounded p-2 flex justify-between items-center">
                                <div className="font-semibold text-sm">{TYPE_LABELS[doc.type] || doc.type}</div>
                                <div className="flex items-center gap-2">
                                    <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle className="h-3 w-3" />Verified</span>
                                    <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setPreviewDoc(doc)}>View</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {docs.length === 0 && !loading && (
                <div className="text-center text-sm text-muted-foreground py-3 bg-white border rounded">
                    No documents uploaded yet. Please upload required documents below.
                </div>
            )}

            {/* Upload section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-xs font-bold text-blue-700 mb-2">📤 Upload Document (Max 5MB per file)</div>
                <div className="flex gap-2 items-center flex-wrap">
                    <select
                        className="border rounded p-1.5 text-xs bg-white flex-1"
                        value={uploadType}
                        onChange={e => setUploadType(e.target.value)}
                    >
                        {DOC_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                    </select>
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUpload} />
                    <Button
                        size="sm"
                        className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                        disabled={uploading}
                        onClick={() => fileRef.current?.click()}
                    >
                        <UploadCloud className="h-3.5 w-3.5 mr-1" />
                        {uploading ? "Uploading..." : "Upload"}
                    </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">Accepted: Images (JPG, PNG) and PDF • Max 5MB</p>
            </div>

            {/* Preview modal */}
            {previewDoc && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreviewDoc(null)}>
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-bold">{TYPE_LABELS[previewDoc.type] || previewDoc.type}</h2>
                            <Button variant="ghost" size="sm" onClick={() => setPreviewDoc(null)}>✕</Button>
                        </div>
                        <div className={`text-xs font-bold px-2 py-1 rounded w-fit ${previewDoc.status === "VERIFIED" ? "bg-green-100 text-green-700" : previewDoc.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                            {previewDoc.status} {previewDoc.rejectedNote ? `— ${previewDoc.rejectedNote}` : ""}
                        </div>
                        {previewDoc.fileData?.startsWith("data:image") ? (
                            <img src={previewDoc.fileData} alt="Document" className="w-full rounded-lg border max-h-96 object-contain" />
                        ) : previewDoc.fileData?.startsWith("data:application/pdf") ? (
                            <div className="p-4 bg-muted rounded text-center text-sm">
                                📄 PDF — <a href={previewDoc.fileData} download={previewDoc.fileName} className="text-blue-600 underline">Download</a>
                            </div>
                        ) : (
                            <div className="p-4 bg-muted rounded text-center text-sm text-muted-foreground">Preview not available</div>
                        )}
                        <Button className="w-full" onClick={() => setPreviewDoc(null)}>Close</Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function StudentDashboardPage() {
    const [bookings, setBookings] = useState<any[]>([]);
    const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState<any>(null);
    const [expandedDocs, setExpandedDocs] = useState<string | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    const searchParams = useSearchParams();
    const router = useRouter();
    const activeTab = searchParams.get('tab') || 'bookings';

    const onTabChange = (value: string) => {
        router.push(`/dashboard/student?tab=${value}`);
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const [bData, pData] = await Promise.all([
                getBookings(),
                getStudentPaymentHistory()
            ]);
            setBookings(bData);
            setPaymentHistory(pData);
        } catch (e) {
            console.error(e);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleCancel = async (bookingId: string) => {
        if (!confirm("Are you sure you want to cancel this booking request? This action cannot be undone.")) return;
        setCancellingId(bookingId);
        try {
            await cancelBooking(bookingId);
            await fetchData();
        } catch (e: any) {
            alert(e.message || "Failed to cancel booking.");
        } finally {
            setCancellingId(null);
        }
    };

    const handleDownloadReceipt = (payment: any) => {
        try {
            const userName = bookings[0]?.guestName || "User";
            generateInvoicePDF({
                invoiceId: payment.id || Math.random().toString(36).substring(2, 10).toUpperCase(),
                date: new Date(payment.date).toLocaleDateString("en-IN"),
                description: payment.description,
                month: new Date(payment.date).toLocaleString("en-IN", { month: 'long', year: 'numeric' }),
                amount: payment.amount,
                tenantName: userName,
                paymentMethod: "Online / Validated",
            });
        } catch (e: any) {
            console.error("PDF GEN ERROR:", e);
            alert("Failed to generate PDF. Please try again.");
        }
    };

    if (loading) return <div className="p-20 text-center animate-pulse">Loading bookings...</div>;
    if (error) return (
        <div className="p-8 text-center text-red-500">
            <p>Failed to load data. Please ensure you are logged in.</p>
            <Button variant="outline" className="mt-4" onClick={fetchData}>Retry</Button>
        </div>
    );

    return (
        <div className="container mx-auto py-8 px-4 max-w-4xl">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold mb-2">My Dashboard</h1>
                    <p className="text-muted-foreground">Track your bookings, onboarding status and payment history.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData}>
                    <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
                <TabsList className="flex flex-wrap md:flex-nowrap w-full mb-8 p-1.5 bg-slate-100/80 rounded-2xl border shadow-inner h-auto">
                    <TabsTrigger value="bookings" className="flex-1 rounded-xl data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-md transition-all font-bold py-3 text-sm whitespace-nowrap">
                        <Calendar className="h-4 w-4 mr-2 hidden sm:block" /> My Bookings
                    </TabsTrigger>
                    <TabsTrigger value="payments" className="flex-1 rounded-xl data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-md transition-all font-bold py-3 text-sm whitespace-nowrap">
                        <CreditCard className="h-4 w-4 mr-2 hidden sm:block" /> Payments
                    </TabsTrigger>
                    <TabsTrigger value="profile" className="flex-1 rounded-xl data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-md transition-all font-bold py-3 text-sm whitespace-nowrap">
                        <User className="h-4 w-4 mr-2 hidden sm:block" /> My Profile
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="bookings" className="space-y-4">
                    {bookings.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center">
                                <p className="text-muted-foreground">No bookings yet. Browse PGs and send a booking request!</p>
                                <Button className="mt-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold" asChild>
                                    <Link href="/search">🔍 Find PG</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {bookings.map((booking: any) => {
                                const isApproved = booking.status === "APPROVED_PAYMENT_PENDING" || booking.status === "APPROVED";
                                const isPaid = booking.status === "PAID" || booking.status === "CASH_PAID";
                                const isCancelled = booking.status === "CANCELLED";
                                const isCashPending = booking.status === "CASH_PENDING";
                                const showDocs = isApproved || isPaid;
                                const hasPendingAmount = isPaid && booking.pendingAmount && parseFloat(booking.pendingAmount) > 0;

                                return (
                                    <Card key={booking.id} className={`${isApproved ? "border-green-400 border-2" : isPaid ? "border-blue-300 border-2" : hasPendingAmount ? "border-red-400 border-2" : isCancelled ? "border-gray-300 opacity-70" : ""}`}>
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start flex-wrap gap-2">
                                                <div>
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                                                        <Building2 className="h-3 w-3" /> Property
                                                    </div>
                                                    <CardTitle className="flex items-center gap-2">
                                                        {booking.propertyName}
                                                    </CardTitle>
                                                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mt-2">
                                                        <User className="h-3 w-3" /> Guest: <span className="text-foreground font-bold">{booking.guestName}</span>
                                                    </div>
                                                    <CardDescription className="mt-1">
                                                        Ref: {booking.displayId} • {new Date(booking.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                                                    </CardDescription>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-lg">{booking.amount}</p>
                                                </div>
                                            </div>
                                        </CardHeader>

                                        <CardContent className="space-y-3">
                                            {/* ── Pending Payment RED Banner ── */}
                                            {hasPendingAmount && (
                                                <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 animate-pulse">
                                                    <div className="flex items-center gap-2 text-red-700 font-bold text-sm mb-1">
                                                        <AlertTriangle className="h-5 w-5" />
                                                        ⚠️ Pending Payment: ₹{booking.pendingAmount}
                                                    </div>
                                                    <p className="text-xs text-red-600">The owner has updated your booking details. Please pay the remaining balance to complete the process.</p>
                                                    <Button className="mt-2 bg-red-600 hover:bg-red-700 text-white font-bold" size="sm" asChild>
                                                        <Link href={`/secure/payment?id=${booking.id}&amount=${booking.pendingAmount}`}>💳 Pay ₹{booking.pendingAmount} Now</Link>
                                                    </Button>
                                                </div>
                                            )}

                                            {/* ── Status ── */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-medium">Status:</span>
                                                {booking.status === "PENDING_APPROVAL" && (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-1 rounded w-fit">⏳ Waiting for Owner Approval</span>
                                                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                                            <Calendar className="h-3 w-3" />
                                                            <span>Requested Move-in: <strong>{new Date(booking.moveInDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></span>
                                                        </div>
                                                    </div>
                                                )}
                                                {isApproved && (
                                                    <>
                                                        <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">✅ Booking Accepted</span>
                                                        <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded">🔄 Onboarding Pending</span>
                                                    </>
                                                )}
                                                {booking.status === "PAID" && (
                                                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">✨ Paid &amp; Confirmed</span>
                                                )}
                                                {booking.status === "CASH_PAID" && (
                                                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded">💵 Paid (Cash)</span>
                                                )}
                                                {isCashPending && (
                                                    <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded">💵 Waiting Cash — Pending</span>
                                                )}
                                                {booking.status === "REJECTED" && (
                                                    <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded">❌ Rejected by Owner</span>
                                                )}
                                                {isCancelled && (
                                                    <span className="bg-gray-200 text-gray-600 text-xs font-bold px-2 py-1 rounded">🚫 Cancelled by You</span>
                                                )}
                                            </div>

                                            {/* ── Booking Accepted — Contact OWNER (not student's own details) ── */}
                                            {isApproved && (
                                                <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-4">
                                                    <div className="text-blue-700 font-bold text-sm mb-2">📞 Contact Property Owner for Onboarding</div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                                        {[
                                                            ["👤 Owner Name", booking.ownerName || "—"],
                                                            ["📧 Owner Email", booking.ownerEmail || "—"],
                                                            ["📱 Owner Phone", booking.ownerPhone || "—"],
                                                            ["📍 Property", `${booking.propertyName}${booking.propertyCity ? `, ${booking.propertyCity}` : ""}`],
                                                        ].map(([label, val]) => (
                                                            <div key={label} className="bg-white border border-blue-200 rounded p-2">
                                                                <div className="text-[10px] font-bold text-blue-400 uppercase">{label}</div>
                                                                <div className="text-sm font-semibold text-blue-900">{val}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="mt-2 text-xs text-blue-600 font-medium">
                                                        Please contact the property owner to complete the onboarding process and finalize your move-in.
                                                    </div>
                                                </div>
                                            )}

                                            {/* ── Room Allocation Details ── */}
                                            {(isApproved || isPaid) && (
                                                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-3">
                                                    <p className="text-xs font-bold text-purple-700 mb-2">📋 Allocation Details</p>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                                        {booking.roomAssigned && (
                                                            <div className="flex items-center gap-1">
                                                                <BedDouble className="h-3 w-3 text-purple-500" />
                                                                <span className="font-medium">Room:</span> {booking.roomAssigned}
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-1">
                                                            <span className="font-medium">Type:</span> {booking.occupancy}
                                                        </div>
                                                        {(booking.onboardingDate || booking.moveInDate) && (
                                                            <div className="flex items-center gap-1">
                                                                <Calendar className="h-3 w-3 text-purple-500" />
                                                                <span className="font-medium">Move-in:</span> {booking.onboardingDate || booking.moveInDate}
                                                            </div>
                                                        )}
                                                        {booking.paymentMethod && (
                                                            <div className="flex items-center gap-1">
                                                                <CreditCard className="h-3 w-3 text-purple-500" />
                                                                <span className="font-medium">Payment:</span> {booking.paymentMethod}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* ── Action Buttons ── */}
                                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                                <div className="flex gap-2">
                                                    {showDocs && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setExpandedDocs(expandedDocs === booking.id ? null : booking.id)}
                                                            className="text-xs"
                                                        >
                                                            <FileText className="h-4 w-4 mr-1.5" />
                                                            Documents {expandedDocs === booking.id ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                                                        </Button>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    {/* Cancel button for pending bookings */}
                                                    {booking.status === "PENDING_APPROVAL" && (
                                                        <Button
                                                            size="sm"
                                                            className="bg-red-500 hover:bg-red-600 text-white font-bold"
                                                            onClick={() => handleCancel(booking.id)}
                                                            disabled={cancellingId === booking.id}
                                                        >
                                                            {cancellingId === booking.id ? "Cancelling..." : "❌ Cancel Request"}
                                                        </Button>
                                                    )}
                                                    {isPaid && (
                                                        <Button variant="outline" size="sm" onClick={() => setSelectedBooking(booking)}>
                                                            <FileText className="h-4 w-4 mr-2" /> View Receipt
                                                        </Button>
                                                    )}
                                                    {isApproved && booking.paymentMethod !== "CASH" ? (
                                                        <Button className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold shadow-md" asChild>
                                                            <Link href={`/secure/payment?id=${booking.id}`}>💳 Pay Now</Link>
                                                        </Button>
                                                    ) : (!isPaid && booking.status !== "REJECTED" && !isApproved && !isCashPending && !isCancelled) && (
                                                        <Button variant="outline" disabled>Pay Now</Button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* ── Document Section (expanded) ── */}
                                            {expandedDocs === booking.id && showDocs && (
                                                <div className="border-t pt-3">
                                                    <div className="text-xs font-bold text-blue-700 uppercase mb-2">📎 Document Verification</div>
                                                    <DocumentSection booking={booking} />
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}

                            {selectedBooking && (
                                <RentReceipt booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
                            )}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="payments">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History className="h-5 w-5 text-blue-500" /> Payment History
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {paymentHistory.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No payment history available yet.
                                </div>
                            ) : (
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                                <TableHead className="text-center">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paymentHistory.map((p, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="font-medium">
                                                        {new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </TableCell>
                                                    <TableCell>{p.description}</TableCell>
                                                    <TableCell>
                                                        <span className="text-[10px] bg-muted px-2 py-1 rounded font-medium uppercase tracking-wider">
                                                            {p.type.replace('_', ' ')}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold">₹{p.amount.toLocaleString('en-IN')}</TableCell>
                                                    <TableCell className="text-center">
                                                        <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-1 rounded block w-fit mx-auto">
                                                            {p.status}
                                                        </span>
                                                        {p.status === 'PAID' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="mt-1 h-6 text-[10px] text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                                                onClick={() => handleDownloadReceipt(p)}
                                                            >
                                                                <Download className="h-3 w-3 mr-1" />
                                                                Receipt
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="profile">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5 text-purple-500" /> Personal Profile
                            </CardTitle>
                            <CardDescription>Your account details and verification status.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="p-4 bg-muted/30 rounded-lg border">
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Full Name</div>
                                        <div className="text-sm font-semibold">{bookings[0]?.guestName || "User"}</div>
                                    </div>
                                    <div className="p-4 bg-muted/30 rounded-lg border">
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Email ID</div>
                                        <div className="text-sm font-semibold">{bookings[0]?.guestEmail || "N/A"}</div>
                                    </div>
                                    <div className="p-4 bg-muted/30 rounded-lg border">
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Contact Number</div>
                                        <div className="text-sm font-semibold">{bookings[0]?.guestPhone || "N/A"}</div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="p-4 bg-muted/30 rounded-lg border">
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Occupation</div>
                                        <div className="text-sm font-semibold">
                                            {bookings[0]?.occupationType || "N/A"}
                                            {bookings[0]?.occupationDetail && ` (${bookings[0].occupationDetail})`}
                                        </div>
                                    </div>
                                    <div className="p-4 bg-muted/30 rounded-lg border">
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Member Since</div>
                                        <div className="text-sm font-semibold">
                                            {bookings[0]?.createdAt ? new Date(bookings[0].createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : "N/A"}
                                        </div>
                                    </div>
                                    <div className="p-4 border-2 border-green-200 bg-green-50 rounded-lg flex items-center justify-between">
                                        <div>
                                            <div className="text-[10px] font-bold text-green-700 uppercase">Account Status</div>
                                            <div className="text-sm font-bold text-green-800">Verified {bookings[0]?.user?.role || "Tenant"}</div>
                                        </div>
                                        <CheckCircle className="h-6 w-6 text-green-600" />
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <h4 className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1">
                                    <Shield className="h-3.5 w-3.5" /> Security Note
                                </h4>
                                <p className="text-[11px] text-blue-600 leading-relaxed">
                                    Your profile data is directly linked to your booking requests and is shared only with verified PG owners you book with for onboarding purposes.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
