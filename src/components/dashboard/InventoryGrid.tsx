"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bed, Home, User, Settings, AlertTriangle, CheckCircle2, Clock, Info, Eye, EyeOff, Wifi, X, Phone, IdCard, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOwnerInventory } from "@/actions/dashboard";
import { TENANT_STATUS } from "@/lib/constants/statuses";

const STATUS_COLORS: Record<string, string> = {
    AVAILABLE:    "bg-emerald-100 text-emerald-700 border-emerald-400 ring-2 ring-emerald-300",
    RESERVED:     "bg-amber-100 text-amber-700 border-amber-400 ring-2 ring-amber-300",
    TEMP_LOCKED:  "bg-amber-100 text-amber-700 border-amber-400 ring-2 ring-amber-300",
    LOCKED:       "bg-amber-100 text-amber-700 border-amber-400 ring-2 ring-amber-300",
    OCCUPIED:     "bg-orange-100 text-orange-700 border-orange-400 ring-2 ring-orange-300",
    MAINTENANCE:  "bg-red-100 text-red-700 border-red-300",
};

const STATUS_ICONS: Record<string, any> = {
    AVAILABLE:   CheckCircle2,
    RESERVED:    Clock,
    TEMP_LOCKED: Clock,
    LOCKED:      Clock,
    OCCUPIED:    User,
    MAINTENANCE: AlertTriangle,
};

function getStageLabel(bookingStatus?: string, tenantStatus?: string): { label: string; color: string } {
    if (tenantStatus === TENANT_STATUS.ACTIVE)        return { label: "✅ Active Tenant",          color: "bg-emerald-100 text-emerald-700" };
    if (tenantStatus === TENANT_STATUS.UPCOMING)      return { label: "🏠 Move-In Scheduled",       color: "bg-blue-100 text-blue-700" };
    if (tenantStatus === TENANT_STATUS.CHECKED_OUT)   return { label: "🚪 Checked Out",             color: "bg-slate-100 text-slate-600" };
    if (tenantStatus === TENANT_STATUS.BLOCKED)       return { label: "🚫 Blocked / Evicted",       color: "bg-red-100 text-red-700" };

    switch (bookingStatus) {
        case 'APPLIED':
        case 'PENDING_APPROVAL':          return { label: "📋 Application Submitted",   color: "bg-purple-100 text-purple-700" };
        case 'APPROVED_PENDING_TOKEN':    return { label: "💳 Payment Pending",           color: "bg-yellow-100 text-yellow-700" };
        case 'ROOM_RESERVED':             return { label: "🔒 Room Reserved",            color: "bg-indigo-100 text-indigo-700" };
        case 'KYC_PENDING':
        case 'APPROVED_KYC_PENDING':      return { label: "🪪 KYC / Verify ID Stage",   color: "bg-orange-100 text-orange-700" };
        case 'KYC_FAILED':                return { label: "❌ KYC Failed",              color: "bg-red-100 text-red-700" };
        case 'AGREEMENT_PENDING':         return { label: "📄 Agreement Stage",        color: "bg-blue-100 text-blue-700" };
        case 'BOOKING_CONFIRMED':         return { label: "✍️ Agreement Signed",         color: "bg-teal-100 text-teal-700" };
        case 'MOVE_IN_SCHEDULED':         return { label: "🏠 Move-In Scheduled",       color: "bg-cyan-100 text-cyan-700" };
        case 'ACTIVE':                    return { label: "✅ Active Tenant",           color: "bg-emerald-100 text-emerald-700" };
        case 'CHECKED_OUT':
        case 'COMPLETED':                 return { label: "🚪 Checked Out",             color: "bg-slate-100 text-slate-600" };
        case 'CANCELLED':                 return { label: "🚫 Cancelled",               color: "bg-red-100 text-red-700" };
        case 'TEMP_LOCKED':               return { label: "⏳ Booking Initiated",       color: "bg-amber-100 text-amber-700" };
        default:                          return { label: "—",                           color: "bg-slate-100 text-slate-500" };
    }
}

export function InventoryGrid({ properties: initialProperties }: { properties: any[] }) {
    const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
    const [properties, setProperties] = useState<any[]>(initialProperties || []);
    const [pulse, setPulse] = useState(false);
    const [selectedBed, setSelectedBed] = useState<any>(null);

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // 30-second live polling
    const refresh = useCallback(async () => {
        try {
            const fresh = await getOwnerInventory();
            setProperties(fresh);
            setPulse(true);
            setTimeout(() => setPulse(false), 400);
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;

        const start = () => {
            if (!interval) interval = setInterval(refresh, 30000);
        };
        const stop = () => {
            if (interval) { clearInterval(interval); interval = null; }
        };
        const onVisibility = () => {
            if (document.visibilityState === 'visible') { refresh(); start(); }
            else stop();
        };

        // Start polling if tab is already visible
        if (document.visibilityState === 'visible') start();
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            stop();
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [refresh]);

    if (!properties || properties.length === 0) {
        return (
            <Card className="border-dashed border-2">
                <CardContent className="p-12 text-center text-muted-foreground">
                    <Home className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No inventory found. Add properties and rooms to get started.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-8">
            {/* Instructional Box */}
            <div className="bg-indigo-50 border-2 border-indigo-100 rounded-2xl p-4 flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shrink-0">
                    <Info className="h-5 w-5" />
                </div>
                <div className="flex-1">
                    <h4 className="font-black text-indigo-900 text-sm uppercase tracking-tight">Managing Your Beds</h4>
                    <p className="text-[13px] text-indigo-700 font-medium leading-relaxed mt-1">
                        To change or add beds, go to <span className="font-black underline">My Properties</span>, select the building name, go to the <span className="font-black underline">Bed tab</span> and edit there.
                    </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`h-2 w-2 rounded-full ${pulse ? 'bg-green-400 scale-125' : 'bg-green-500'} transition-all duration-300 animate-pulse`} />
                    <span className="text-[10px] font-black text-green-600 uppercase tracking-widest flex items-center gap-1">
                        <Wifi className="h-3 w-3" /> Live
                    </span>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-[11px] font-bold">
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Available
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg border border-amber-300">
                    <Clock className="h-3.5 w-3.5" /> Occupied / Reserved
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg border border-orange-300">
                    <User className="h-3.5 w-3.5" /> Occupied (Active Tenant)
                </span>
            </div>

            {properties.map((property) => {
                const isExpanded = expandedIds[property.id];
                return (
                    <Card key={property.id} className="overflow-hidden border-none shadow-lg bg-gradient-to-br from-white to-slate-50 transition-all duration-300">
                        <CardHeader className="bg-gradient-to-r from-indigo-900 via-blue-900 to-indigo-900 text-white p-6">
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-xl font-black flex items-center gap-2">
                                        <Home className="h-5 w-5 text-indigo-400" /> {property.name}
                                    </CardTitle>
                                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">{property.city} • {property.address}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button
                                        size="sm"
                                        onClick={() => toggleExpand(property.id)}
                                        className={`rounded-xl px-4 font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center gap-2 h-10 ${
                                            isExpanded
                                            ? "bg-slate-700 hover:bg-slate-600 text-white"
                                            : "bg-indigo-600 hover:bg-indigo-700 text-white"
                                        }`}
                                    >
                                        {isExpanded ? <><EyeOff className="h-3.5 w-3.5" /> Hide Bed</> : <><Eye className="h-3.5 w-3.5" /> View Beds</>}
                                    </Button>
                                    <Badge className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3 py-1 font-bold rounded-lg text-[10px] uppercase tracking-wider">
                                        {property.rooms?.length || 0} Rooms
                                    </Badge>
                                </div>
                            </div>
                        </CardHeader>

                        {isExpanded && (
                            <CardContent className="p-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {property.rooms && [...property.rooms]
                                        .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' }))
                                        .map((room: any) => (
                                        <div key={room.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all group">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h4 className="font-black text-slate-800 flex items-center gap-2">
                                                        Room {room.roomNumber}
                                                        <Badge variant="outline" className="text-[10px] font-bold uppercase">{room.type}</Badge>
                                                    </h4>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">₹{room.price}/month</p>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Settings className="h-4 w-4 text-slate-400" />
                                                </Button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                {room.beds?.map((bed: any) => {
                                                    const StatusIcon = STATUS_ICONS[bed.status] || Bed;
                                                    const isAvailable = bed.status === 'AVAILABLE';
                                                    return (
                                                        <div
                                                            key={bed.id}
                                                            onClick={() => !isAvailable && setSelectedBed({ ...bed, roomNumber: room.roomNumber })}
                                                            className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 ${STATUS_COLORS[bed.status] || "bg-slate-100 border-slate-200 text-slate-500"} ${!isAvailable ? 'cursor-pointer' : 'cursor-default'}`}
                                                        >
                                                            <StatusIcon className="h-5 w-5" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest">{bed.bedNumber}</span>
                                                        </div>
                                                    );
                                                })}
                                                {(!room.beds || room.beds.length === 0) && (
                                                    <div className="col-span-2 py-4 text-center text-[10px] font-bold text-slate-400 border border-dashed rounded-xl">
                                                        No beds configured
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        )}
                    </Card>
                );
            })}

            {/* Bed Detail Popup Modal */}
            {selectedBed && (() => {
                const bk = selectedBed.booking;
                const tn = selectedBed.tenant;
                const isTerminal = bk && ['CANCELLED', 'REJECTED', 'COMPLETED', 'CHECKED_OUT'].includes(bk.status);
                const isActive = bk && !isTerminal;
                const stage = getStageLabel(bk?.status, tn?.status);

                return (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => setSelectedBed(null)}
                    >
                        <div
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className={`p-5 flex items-center justify-between ${
                                tn?.status === TENANT_STATUS.ACTIVE  ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                                isTerminal              ? 'bg-gradient-to-r from-slate-500 to-slate-600' :
                                isActive                ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                                                          'bg-gradient-to-r from-slate-400 to-slate-500'
                            } text-white`}>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                                        <Bed className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-black text-lg tracking-tight">Bed {selectedBed.bedNumber}</p>
                                        <p className="text-[11px] font-bold opacity-80 uppercase tracking-widest">Room {selectedBed.roomNumber}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedBed(null)}
                                    className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Stage Badge */}
                            <div className={`mx-5 mt-4 px-4 py-2.5 rounded-xl text-sm font-black text-center ${stage.color}`}>
                                {stage.label}
                            </div>

                            {/* Content */}
                            <div className="p-5 space-y-3">
                                {tn ? (
                                    /* ── Active tenant ─────────────────────── */
                                    <>
                                        <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                                                <IdCard className="h-4 w-4 text-indigo-600" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tenant ID</p>
                                                <p className="text-sm font-black text-slate-800 font-mono">{tn.displayId || '—'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                                <User className="h-4 w-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</p>
                                                <p className="text-sm font-black text-slate-800">{tn.name || '—'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                                                <Phone className="h-4 w-4 text-emerald-600" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</p>
                                                <p className="text-sm font-black text-slate-800">{tn.phone || '—'}</p>
                                            </div>
                                        </div>
                                    </>
                                ) : bk ? (
                                    /* ── Booking exists (active or terminal) ── */
                                    <>
                                        {/* Booking Ref */}
                                        <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                                                <Activity className="h-4 w-4 text-purple-600" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    {isTerminal ? 'Last Booking Ref' : 'Booking Ref'}
                                                </p>
                                                <p className="text-sm font-black text-slate-800 font-mono">{bk.displayId}</p>
                                            </div>
                                        </div>

                                        {/* Guest Name */}
                                        {bk.guestName && (
                                            <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                                                <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                                    <User className="h-4 w-4 text-blue-600" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        {isTerminal ? 'Was Assigned To' : 'Guest Name'}
                                                    </p>
                                                    <p className="text-sm font-black text-slate-800">{bk.guestName}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Phone */}
                                        {bk.guestPhone && (
                                            <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                                                <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                                                    <Phone className="h-4 w-4 text-emerald-600" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</p>
                                                    <p className="text-sm font-black text-slate-800">{bk.guestPhone}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Move-in date (only for active bookings) */}
                                        {!isTerminal && bk.moveInDate && (
                                            <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                                                <div className="h-8 w-8 rounded-lg bg-cyan-100 flex items-center justify-center shrink-0">
                                                    <Clock className="h-4 w-4 text-cyan-600" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Move-in Date</p>
                                                    <p className="text-sm font-black text-slate-800">{bk.moveInDate}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Terminal state — show reason */}
                                        {isTerminal && (
                                            <div className={`p-3.5 rounded-xl border ${
                                                bk.status === 'COMPLETED' || bk.status === 'CHECKED_OUT'
                                                    ? 'bg-slate-50 border-slate-200'
                                                    : 'bg-red-50 border-red-200'
                                            }`}>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                    {bk.status === 'COMPLETED'   ? '✅ What Happened' :
                                                     bk.status === 'CHECKED_OUT' ? '🚪 What Happened' :
                                                     bk.status === 'CANCELLED'   ? '🚫 Cancellation Reason' :
                                                                                   '❌ Rejection Reason'}
                                                </p>
                                                <p className="text-sm font-bold text-slate-700">
                                                    {bk.status === 'COMPLETED'   ? 'Tenant completed stay and checked out.' :
                                                     bk.status === 'CHECKED_OUT' ? 'Tenant has checked out.' :
                                                     bk.cancelReason || bk.rejectionReason || 'No reason provided.'}
                                                </p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    /* ── Truly free bed ─────────────────────── */
                                    <div className="py-6 text-center text-slate-400">
                                        <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-400" />
                                        <p className="text-sm font-bold">This bed is available</p>
                                        <p className="text-[11px] text-slate-400 mt-1">No current or past bookings</p>
                                    </div>
                                )}
                            </div>

                            <div className="px-5 pb-5">
                                <button
                                    onClick={() => setSelectedBed(null)}
                                    className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

