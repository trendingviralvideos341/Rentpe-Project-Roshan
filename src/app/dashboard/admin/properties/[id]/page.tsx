"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPropertyByIdForAdmin, exemptPropertyFee, rejectProperty, requestPropertyCorrections } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
    ArrowLeft, Building2, User, Phone, Mail, MapPin, Star, RefreshCcw,
    CheckCircle, XCircle, AlertCircle, Image as ImageIcon, Eye, BedDouble,
    FileText, Shield, Calendar, Home, ExternalLink
} from "lucide-react";
import Link from "next/link";

function statusColor(status: string) {
    const map: Record<string, string> = {
        APPROVED: "bg-green-100 text-green-800 border-green-200",
        PENDING_VERIFICATION: "bg-amber-100 text-amber-800 border-amber-200",
        VERIFYING_DOCUMENTS: "bg-blue-100 text-blue-800 border-blue-200",
        REJECTED: "bg-red-100 text-red-800 border-red-200",
        NEEDS_CORRECTION: "bg-orange-100 text-orange-800 border-orange-200",
        SUSPENDED: "bg-slate-100 text-slate-700 border-slate-200",
        VERIFIED_SUCCESSFULLY: "bg-emerald-100 text-emerald-800 border-emerald-200",
        APPROVED_PENDING_PAYMENT: "bg-purple-100 text-purple-800 border-purple-200",
    };
    return map[status] || "bg-gray-100 text-gray-700 border-gray-200";
}

function PhotoBox({ label, urls, slotsCount = 1 }: { label: string; urls: string[]; slotsCount?: number }) {
    const [lightbox, setLightbox] = useState<string | null>(null);
    return (
        <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 px-1">
                <ImageIcon className="h-3 w-3" /> {label} <span className="text-slate-300 ml-1">({urls.length}/{slotsCount})</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {Array.from({ length: slotsCount }).map((_, i) => {
                    const url = urls[i];
                    return (
                        <div key={i} className="aspect-square relative">
                            {url ? (
                                <button
                                    className="w-full h-full rounded-2xl overflow-hidden border-2 border-indigo-100 hover:border-indigo-400 transition-all group shadow-sm hover:shadow-md bg-white"
                                    onClick={() => setLightbox(url)}
                                >
                                    <img src={url} alt={`${label} ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                        <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                                        <CheckCircle className="h-3 w-3" />
                                    </div>
                                    <div className="absolute bottom-2 left-2 bg-black/40 backdrop-blur-sm text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-md border border-white/20">
                                        {label} {i + 1}
                                    </div>
                                </button>
                            ) : (
                                <div className="w-full h-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center p-2 text-center group">
                                    <ImageIcon className="h-6 w-6 text-slate-300 mb-1 group-hover:text-slate-400 transition-colors" />
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{label} {i + 1}</span>
                                    <span className="text-[7px] font-bold text-slate-300 uppercase tracking-tighter">Not Uploaded</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {lightbox && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setLightbox(null)}>
                    <img src={lightbox} alt="Preview" className="max-w-full max-h-full rounded-2xl shadow-2xl border-4 border-white/10" />
                    <button className="absolute top-6 right-6 text-white bg-black/50 hover:bg-black/70 rounded-full p-3 transition-colors" onClick={() => setLightbox(null)}>
                        <XCircle className="h-6 w-6" />
                    </button>
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-white text-sm font-bold">
                        {label} - Slot {urls.indexOf(lightbox!) + 1}
                    </div>
                </div>
            )}
        </div>
    );
}

function parsePhotos(raw?: string | null): string[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
        if (typeof parsed === "string") return [parsed];
    } catch { }
    if (typeof raw === "string" && raw.startsWith("http")) return [raw];
    return [];
}

export default function AdminPropertyDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [property, setProperty] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionModal, setActionModal] = useState<{ type: "reject" | "correction" | "approve" } | null>(null);
    const [reason, setReason] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getPropertyByIdForAdmin(id);
            setProperty(data);
        } catch {
            toast.error("Failed to load property details");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetch(); }, [fetch]);

    const handleAction = async () => {
        if (!property || !actionModal) return;
        if (actionModal.type !== "approve" && !reason.trim()) {
            toast.error("Please provide a reason");
            return;
        }
        setActionLoading(true);
        try {
            if (actionModal.type === "approve") {
                await exemptPropertyFee(property.id, "Admin approved from property review page");
                toast.success(`"${property.name}" is now LIVE!`);
            } else if (actionModal.type === "reject") {
                await rejectProperty(property.id, reason);
                toast.success("Property rejected & owner notified.");
            } else {
                await requestPropertyCorrections(property.id, reason);
                toast.success("Correction request sent to owner.");
            }
            setActionModal(null);
            setReason("");
            fetch();
        } catch (e: any) {
            toast.error(e.message || "Action failed");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4 pb-24">
                <div className="h-10 w-64 bg-slate-100 rounded-xl animate-pulse" />
                <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
                <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
            </div>
        );
    }

    if (!property) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-center">
                <Building2 className="h-12 w-12 text-slate-300 mb-4" />
                <p className="font-bold text-slate-600 text-lg">Property not found</p>
                <Link href="/dashboard/admin/properties">
                    <Button variant="outline" className="mt-4">← Back to Queue</Button>
                </Link>
            </div>
        );
    }

    const p = property;
    const isLive = p.status === "APPROVED";

    // Parse all photo arrays
    const heroImages = parsePhotos(p.images);
    const buildingPhotos = parsePhotos(p.buildingPhotos);
    const interiorPhotos = parsePhotos(p.interiorPhotos);
    const commonAreaPhotos = parsePhotos(p.commonAreaPhotos);
    const amenitiesPhotos = parsePhotos(p.amenitiesPhotos);
    const roomsPhotos = parsePhotos(p.roomsPhotos);
    const roomsAndBathroomPhotos = parsePhotos(p.roomsAndBathroomPhotos);
    const exteriorPhotos = parsePhotos(p.exteriorPhotos);
    const parkingPhotos = parsePhotos(p.parkingPhotos);
    const washroomPhotos = parsePhotos(p.washroomPhotos);
    const hallPhotos = parsePhotos(p.hallPhotos);
    const lobbyPhotos = parsePhotos(p.lobbyPhotos);
    const livePhoto = p.livePhotoUrl ? [p.livePhotoUrl] : [];
    const aadhaarPhotos = parsePhotos(p.aadhaarProof);
    const panPhotos = parsePhotos(p.panProof);
    const licencePhotos = parsePhotos(p.pgLicenceUrl);

    const allPhotosCount = [heroImages, buildingPhotos, interiorPhotos, commonAreaPhotos,
        amenitiesPhotos, roomsPhotos, roomsAndBathroomPhotos, exteriorPhotos, parkingPhotos, washroomPhotos,
        hallPhotos, lobbyPhotos, livePhoto, aadhaarPhotos, panPhotos, licencePhotos].reduce((s, a) => s + a.length, 0);

    const bedStats = (p.rooms || []).reduce((acc: any, r: any) => {
        acc.total += (r.beds || []).length;
        acc.available += (r.beds || []).filter((b: any) => b.status === "AVAILABLE").length;
        return acc;
    }, { total: 0, available: 0 });

    const amenities = (() => {
        try { return JSON.parse(p.amenities || "[]"); } catch { return []; }
    })();

    return (
        <div className="space-y-5 pb-40">
            {/* Header */}
            <div className="flex items-center gap-3 flex-wrap">
                <Link href="/dashboard/admin/properties">
                    <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                        <ArrowLeft className="h-4 w-4" /> Back to Queue
                    </Button>
                </Link>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl md:text-2xl font-black text-slate-900 truncate">{p.name}</h1>
                        <Badge className={`border text-xs font-bold ${statusColor(p.status)}`}>
                            {p.status.replace(/_/g, " ")}
                        </Badge>
                        {p.isVerified && (
                            <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                                <Shield className="h-3 w-3" /> Verified
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{p.displayId} · {p.propertyType} · {p.city}</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetch}>
                    <RefreshCcw className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Hero Images */}
            {heroImages.length > 0 && (
                <Card className="overflow-hidden border-0 shadow-md">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1 h-64">
                        {heroImages.slice(0, 4).map((url, i) => (
                            <div key={i} className={`overflow-hidden relative ${i === 0 ? "col-span-2 row-span-2 md:col-span-2" : ""}`}>
                                <img src={url} alt={`Property ${i + 1}`} className="w-full h-full object-cover" />
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { icon: Home, label: "Property Type", value: p.propertyType, color: "text-indigo-600" },
                    { icon: BedDouble, label: "Total Beds", value: `${bedStats.total} (${bedStats.available} free)`, color: "text-emerald-600" },
                    { icon: ImageIcon, label: "Photos Uploaded", value: `${allPhotosCount}`, color: "text-blue-600" },
                    { icon: Star, label: "Avg. Rating", value: p.averageRating > 0 ? `${p.averageRating} / 5` : "No ratings yet", color: "text-amber-600" },
                ].map(stat => (
                    <Card key={stat.label} className="border shadow-sm">
                        <CardContent className="p-4">
                            <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
                            <p className="text-lg font-black text-slate-900">{stat.value}</p>
                            <p className="text-xs text-slate-500 font-semibold">{stat.label}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left Column — Details */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Owner Info */}
                    <Card className="border shadow-sm">
                        <CardContent className="p-5 space-y-3">
                            <h3 className="font-black text-slate-800 flex items-center gap-2">
                                <User className="h-4 w-4 text-indigo-600" /> Owner Information
                            </h3>
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-black text-lg shrink-0">
                                    {p.owner?.name?.[0]?.toUpperCase() || "?"}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className="font-bold text-slate-900">{p.owner?.name || "—"}</p>
                                    <p className="text-xs text-slate-500 font-mono">{p.owner?.displayId || "—"}</p>
                                    <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-600">
                                        <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5 text-slate-400" /> {p.owner?.email || "—"}</span>
                                        <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-slate-400" /> {p.owner?.phone || "—"}</span>
                                    </div>
                                    {p.owner?.createdAt && (
                                        <span className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                                            <Calendar className="h-3 w-3" />
                                            Joined {new Date(p.owner.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Property Details */}
                    <Card className="border shadow-sm">
                        <CardContent className="p-5 space-y-4">
                            <h3 className="font-black text-slate-800 flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-indigo-600" /> Property Details
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    ["Full Address", `${p.address}, ${p.city}`],
                                    ["Gender Type", p.genderType || "—"],
                                    ["Food Service", p.foodType?.replace(/_/g, " ") || "—"],
                                    ["Food Price/Month", p.foodPricePerMonth ? `₹${p.foodPricePerMonth}` : "N/A"],
                                    ["Notice Period", p.noticePeriod ? `${p.noticePeriod} days` : "—"],
                                    ["Cancellation Policy", p.cancellationPolicy || "—"],
                                    ["RERA ID", p.reraId || "N/A"],
                                    ["PG Licence No.", p.licenseNumber || "—"],
                                    ["Terms Accepted", p.termsAccepted ? "✅ Yes" : "❌ No"],
                                    ["Submitted", new Date(p.createdAt).toLocaleDateString("en-IN")],
                                ].map(([label, value]) => (
                                    <div key={label} className="bg-slate-50 rounded-xl p-3">
                                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-0.5">{label}</p>
                                        <p className="text-sm font-semibold text-slate-800 break-words">{value as string}</p>
                                    </div>
                                ))}
                            </div>
                            {p.description && (
                                <div className="bg-slate-50 rounded-xl p-3">
                                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Description</p>
                                    <p className="text-sm text-slate-700 leading-relaxed">{p.description}</p>
                                </div>
                            )}
                            {amenities.length > 0 && (
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Amenities</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {amenities.map((a: string) => (
                                            <span key={a} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-semibold">
                                                {a}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Rooms & Beds */}
                    {p.rooms?.length > 0 && (
                        <Card className="border shadow-sm">
                            <CardContent className="p-5 space-y-3">
                                <h3 className="font-black text-slate-800 flex items-center gap-2">
                                    <BedDouble className="h-4 w-4 text-indigo-600" /> Rooms & Beds ({p.rooms.length} rooms)
                                </h3>
                                <div className="space-y-2">
                                    {p.rooms.map((room: any) => {
                                        const avail = (room.beds || []).filter((b: any) => b.status === "AVAILABLE").length;
                                        const total = room.beds?.length || room.availability || 0;
                                        const pct = total > 0 ? Math.round((avail / total) * 100) : 0;
                                        return (
                                            <div key={room.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-black text-sm shrink-0">
                                                    {room.roomNumber}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-slate-800">{room.type}</p>
                                                    <p className="text-xs text-slate-500">₹{room.price?.toLocaleString("en-IN")}/month · {total} beds</p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className={`text-xs font-black ${avail === 0 ? "text-red-600" : avail <= 2 ? "text-orange-600" : "text-emerald-600"}`}>
                                                        {avail}/{total} free
                                                    </p>
                                                    <div className="w-16 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                                                        <div className={`h-full rounded-full ${pct >= 60 ? "bg-emerald-500" : pct >= 30 ? "bg-orange-400" : "bg-red-400"}`}
                                                            style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Property Photos & Visuals */}
                    <Card className="border shadow-sm">
                        <CardContent className="p-0">
                            <div className="p-5 border-b bg-slate-50/50">
                                <h3 className="font-black text-slate-800 flex items-center gap-2">
                                    <ImageIcon className="h-4 w-4 text-indigo-600" /> Photo & Document Review
                                </h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                                    Total Uploaded: {allPhotosCount} items across all categories
                                </p>
                            </div>

                            <div className="p-5 space-y-8">
                                {/* Property Visuals */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2">
                                        <div className="h-1 flex-1 bg-slate-100 rounded-full" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">1. Property Assets</span>
                                        <div className="h-1 flex-1 bg-slate-100 rounded-full" />
                                    </div>
                                    <PhotoBox label="Building Photos" urls={buildingPhotos} slotsCount={4} />
                                    <PhotoBox label="Common Areas" urls={commonAreaPhotos} slotsCount={4} />
                                    <PhotoBox label="Rooms & Bathrooms" urls={roomsAndBathroomPhotos} slotsCount={4} />
                                    <PhotoBox label="Parking Area" urls={parkingPhotos} slotsCount={4} />
                                    <PhotoBox label="Amenities Photos" urls={amenitiesPhotos} slotsCount={4} />
                                    {interiorPhotos.length > 0 && <PhotoBox label="Interior Detail" urls={interiorPhotos} slotsCount={interiorPhotos.length} />}
                                    {(hallPhotos.length > 0 || lobbyPhotos.length > 0) && (
                                        <PhotoBox label="Hall / Lobby" urls={[...hallPhotos, ...lobbyPhotos]} slotsCount={Math.max(4, hallPhotos.length + lobbyPhotos.length)} />
                                    )}
                                </div>

                                {/* Legal Documentation */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2">
                                        <div className="h-1 flex-1 bg-slate-100 rounded-full" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">2. Legal Documentation</span>
                                        <div className="h-1 flex-1 bg-slate-100 rounded-full" />
                                    </div>
                                    <div className="space-y-6">
                                        <PhotoBox label="Owner Aadhaar (Front/Back)" urls={aadhaarPhotos} slotsCount={2} />
                                        <PhotoBox label="Owner PAN (Front/Back)" urls={panPhotos} slotsCount={2} />
                                        <PhotoBox label="Property / PG Licence" urls={licencePhotos} slotsCount={2} />
                                        <PhotoBox label="Current Photo / Selfie" urls={livePhoto} slotsCount={1} />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Admin Notes */}
                    {p.adminNotes && (
                        <Card className="border border-orange-200 bg-orange-50 shadow-sm">
                            <CardContent className="p-4">
                                <p className="text-xs font-black uppercase text-orange-700 mb-1.5">⚠️ Previous Admin Note</p>
                                <p className="text-sm text-orange-800">{p.adminNotes}</p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right Column — Quick Actions Sidebar */}
                <div className="space-y-4">
                    <Card className="border shadow-sm sticky top-4">
                        <CardContent className="p-5 space-y-3">
                            <h3 className="font-black text-slate-800">⚡ Quick Actions</h3>
                            <p className="text-xs text-slate-500">Current: <strong className={`${statusColor(p.status)} px-2 py-0.5 rounded-full border`}>{p.status.replace(/_/g, " ")}</strong></p>
                            <div className="space-y-2 pt-1">
                                {!isLive && (
                                    <Button className="w-full bg-green-600 hover:bg-green-700 text-white"
                                        onClick={() => setActionModal({ type: "approve" })}>
                                        <CheckCircle className="h-4 w-4 mr-2" /> Approve & Make LIVE
                                    </Button>
                                )}
                                <Button variant="outline" className="w-full text-orange-600 border-orange-200 hover:bg-orange-50"
                                    onClick={() => setActionModal({ type: "correction" })}>
                                    <AlertCircle className="h-4 w-4 mr-2" /> Request Corrections
                                </Button>
                                <Button variant="destructive" className="w-full"
                                    onClick={() => setActionModal({ type: "reject" })}>
                                    <XCircle className="h-4 w-4 mr-2" /> Reject Property
                                </Button>
                            </div>
                            <div className="pt-3 border-t space-y-1.5 text-xs text-slate-500">
                                <p><span className="font-bold">Submitted:</span> {new Date(p.createdAt).toLocaleDateString("en-IN")}</p>
                                <p><span className="font-bold">Last Updated:</span> {new Date(p.updatedAt).toLocaleDateString("en-IN")}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Map placeholder if coordinates exist */}
                    {p.latitude && p.longitude && (
                        <Card className="border shadow-sm overflow-hidden">
                            <a href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`} target="_blank" rel="noopener noreferrer"
                                className="block group relative overflow-hidden">
                                <img
                                    src={`https://maps.googleapis.com/maps/api/staticmap?center=${p.latitude},${p.longitude}&zoom=15&size=400x200&markers=color:red%7C${p.latitude},${p.longitude}&key=NO_KEY`}
                                    alt="Map"
                                    className="w-full h-40 object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                                <div className="p-3 bg-white">
                                    <p className="text-xs text-slate-500 flex items-center gap-1">
                                        <MapPin className="h-3 w-3 text-indigo-500" />
                                        {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                                        <ExternalLink className="h-3 w-3 ml-auto text-indigo-400" />
                                    </p>
                                </div>
                            </a>
                        </Card>
                    )}
                </div>
            </div>

            {/* Action Modal */}
            {actionModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-6">
                    <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 space-y-4 shadow-2xl">
                        <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                            {actionModal.type === "approve" && <><CheckCircle className="h-5 w-5 text-green-500" /> Approve Property</>}
                            {actionModal.type === "reject" && <><XCircle className="h-5 w-5 text-red-500" /> Reject Property</>}
                            {actionModal.type === "correction" && <><AlertCircle className="h-5 w-5 text-orange-500" /> Request Corrections</>}
                        </h3>
                        <p className="text-sm text-slate-600 font-medium">"{p.name}"</p>

                        {actionModal.type === "approve" && (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
                                This will set the property to <strong>LIVE</strong> and notify the owner. The onboarding fee will be waived.
                            </div>
                        )}
                        {(actionModal.type === "reject" || actionModal.type === "correction") && (
                            <textarea
                                className="w-full border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                rows={3}
                                placeholder={actionModal.type === "reject"
                                    ? "Reason for rejection (owner will be notified)..."
                                    : "What needs to be corrected? Be specific."}
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                            />
                        )}
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => { setActionModal(null); setReason(""); }}>
                                Cancel
                            </Button>
                            <Button
                                className={`flex-1 ${actionModal.type === "approve" ? "bg-green-600 hover:bg-green-700" : actionModal.type === "reject" ? "bg-red-600 hover:bg-red-700" : "bg-orange-600 hover:bg-orange-700"}`}
                                disabled={actionLoading || (actionModal.type !== "approve" && !reason.trim())}
                                onClick={handleAction}
                            >
                                {actionLoading ? "Processing..." : actionModal.type === "approve" ? "Make LIVE" : actionModal.type === "reject" ? "Reject & Notify" : "Send Request"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
