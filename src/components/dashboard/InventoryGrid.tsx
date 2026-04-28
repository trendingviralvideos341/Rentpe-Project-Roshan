"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bed, Home, User, Settings, AlertTriangle, CheckCircle2, Clock, Info, Eye, EyeOff, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOwnerInventory } from "@/actions/dashboard";

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

const STATUS_LABEL: Record<string, string> = {
    AVAILABLE:   "Available",
    RESERVED:    "Occupied",
    TEMP_LOCKED: "Occupied",
    LOCKED:      "Occupied",
    OCCUPIED:    "Occupied",
    MAINTENANCE: "Maintenance",
};

export function InventoryGrid({ properties: initialProperties }: { properties: any[] }) {
    const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
    const [properties, setProperties] = useState<any[]>(initialProperties || []);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [pulse, setPulse] = useState(false);

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // 10-second live polling (industry standard for property dashboards)
    const refresh = useCallback(async () => {
        try {
            const fresh = await getOwnerInventory();
            setProperties(fresh);
            setLastUpdated(new Date());
            setPulse(true);
            setTimeout(() => setPulse(false), 400);
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        const interval = setInterval(refresh, 30000);
        return () => clearInterval(interval);
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
                {/* Live indicator */}
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
                                            ? "bg-slate-700 hover:bg-slate-600 text-white shadow-slate-950/20"
                                            : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-900/20"
                                        }`}
                                    >
                                        {isExpanded ? (
                                            <><EyeOff className="h-3.5 w-3.5" /> Hide Bed</>
                                        ) : (
                                            <><Eye className="h-3.5 w-3.5" /> View Beds</>
                                        )}
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
                                    {property.rooms && [...property.rooms].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' })).map((room: any) => (
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
                                                    const label = STATUS_LABEL[bed.status] || bed.status;
                                                    const tooltipText = `${label}${bed.tenant ? ` — ${bed.tenant.name} (${bed.tenant.displayId})` : ""}`;
                                                    return (
                                                        <div
                                                            key={bed.id}
                                                            title={tooltipText}
                                                            className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all hover:scale-105 ${STATUS_COLORS[bed.status] || "bg-slate-100 border-slate-200 text-slate-500"}`}
                                                        >
                                                            <StatusIcon className="h-5 w-5" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest">{bed.bedNumber}</span>
                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isAvailable ? 'bg-emerald-200 text-emerald-800' : 'bg-orange-200 text-orange-800'}`}>
                                                                {label}
                                                            </span>
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
        </div>
    );
}
