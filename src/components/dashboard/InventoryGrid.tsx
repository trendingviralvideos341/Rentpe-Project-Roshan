"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bed, Home, User, Settings, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InventoryGridProps {
    properties: any[];
}

const STATUS_COLORS: Record<string, string> = {
    AVAILABLE: "bg-emerald-100 text-emerald-700 border-emerald-200",
    RESERVED: "bg-blue-100 text-blue-700 border-blue-200",
    OCCUPIED: "bg-indigo-100 text-indigo-700 border-indigo-200",
    MAINTENANCE: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_ICONS: Record<string, any> = {
    AVAILABLE: CheckCircle2,
    RESERVED: Clock,
    OCCUPIED: User,
    MAINTENANCE: AlertTriangle,
};

export function InventoryGrid({ properties }: InventoryGridProps) {
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
            {properties.map((property) => (
                <Card key={property.id} className="overflow-hidden border-none shadow-lg bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="bg-slate-900 text-white p-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="text-xl font-black flex items-center gap-2">
                                    <Home className="h-5 w-5 text-indigo-400" /> {property.name}
                                </CardTitle>
                                <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">{property.city} • {property.address}</p>
                            </div>
                            <div className="text-right">
                                <Badge className="bg-indigo-500 hover:bg-indigo-600 text-white border-none px-3 py-1 font-bold">
                                    {property.rooms?.length || 0} Rooms
                                </Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
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
                                            const tooltipText = `${bed.status}${bed.tenant ? ` - ${bed.tenant.name} (${bed.tenant.displayId})` : ""}`;
                                            return (
                                                <div 
                                                    key={bed.id} 
                                                    title={tooltipText}
                                                    className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:scale-105 ${STATUS_COLORS[bed.status] || "bg-slate-100 border-slate-200 text-slate-500"}`}
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
                </Card>
            ))}
        </div>
    );
}
