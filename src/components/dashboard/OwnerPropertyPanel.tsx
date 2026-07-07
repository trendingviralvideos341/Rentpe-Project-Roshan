"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Building2, MapPin, Star, Bed, DoorOpen,
    ChevronDown, Filter, UserCheck, IndianRupee,
    Activity, BadgeCheck, Users, AlertCircle,
    LogOut, Clock, Wrench, TrendingUp, RefreshCcw,
    ChevronRight, Eye
} from "lucide-react";
import { getOwnerPropertyPanel } from "@/actions/ownerPropertyPanel";

interface OwnerPropertyPanelProps {
    userRole?: 'OWNER' | 'STAFF';
}

const PROPERTY_TYPE_OPTIONS = [
    { value: 'ALL', label: 'All Types' },
    { value: 'PG', label: 'PG' },
    { value: 'HOSTEL', label: 'Hostel' },
    { value: 'FLAT', label: 'Flat' },
    { value: 'APARTMENT', label: 'Apartment' },
];

const TYPE_COLORS: Record<string, string> = {
    PG: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    HOSTEL: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    FLAT: 'bg-amber-100 text-amber-700 border-amber-200',
    APARTMENT: 'bg-purple-100 text-purple-700 border-purple-200',
};

const STATUS_COLORS: Record<string, string> = {
    LIVE: 'bg-emerald-500',
    APPROVED: 'bg-indigo-500',
    PENDING_VERIFICATION: 'bg-yellow-500',
    NEEDS_CORRECTION: 'bg-orange-500',
    REJECTED: 'bg-red-500',
    SUSPENDED: 'bg-red-600',
};

export function OwnerPropertyPanel({ userRole = 'OWNER' }: OwnerPropertyPanelProps) {
    const [properties, setProperties] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState<string>('ALL');
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>('ALL');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getOwnerPropertyPanel();
            setProperties(data || []);
        } catch (e) {
            console.error("Failed to load property panel:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filteredProperties = useMemo(() => {
        if (typeFilter === 'ALL') return properties;
        return properties.filter(p => (p.propertyType || 'PG').toUpperCase() === typeFilter);
    }, [properties, typeFilter]);

    const selectedProperty = useMemo(() => {
        if (selectedPropertyId === 'ALL') return null;
        return properties.find(p => p.id === selectedPropertyId) || null;
    }, [properties, selectedPropertyId]);

    const handleTypeFilter = (t: string) => {
        setTypeFilter(t);
        setSelectedPropertyId('ALL');
    };

    // Aggregate stats across all visible properties
    const aggregateStats = useMemo(() => {
        const props = filteredProperties;
        return {
            totalProperties: props.length,
            totalBeds: props.reduce((s, p) => s + p.totalBeds, 0),
            occupiedBeds: props.reduce((s, p) => s + p.occupiedBeds, 0),
            availableBeds: props.reduce((s, p) => s + p.availableBeds, 0),
            activeTenants: props.reduce((s, p) => s + p.activeTenants, 0),
            pendingRequests: props.reduce((s, p) => s + p.pendingBookingRequests, 0),
            upcomingMoveOuts: props.reduce((s, p) => s + p.upcomingMoveOuts, 0),
            totalRevenue: props.reduce((s, p) => s + p.totalRevenue, 0),
            avgOccupancy: props.length > 0
                ? Math.round(props.reduce((s, p) => s + p.occupancyRate, 0) / props.length)
                : 0,
        };
    }, [filteredProperties]);

    if (loading) {
        return (
            <Card className="border-none shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-6">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center border border-white/30">
                            <Building2 className="h-5 w-5 text-white" />
                        </div>
                        <h2 className="text-xl font-black text-white tracking-tight">My Properties</h2>
                    </div>
                </div>
                <CardContent className="p-12 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                    <p className="text-sm text-slate-400 font-bold">Loading property data...</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-none shadow-2xl bg-white overflow-hidden">
            {/* ── Header ── */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center border border-white/30">
                                <Building2 className="h-5 w-5 text-white" />
                            </div>
                            <h2 className="text-xl font-black text-white tracking-tight">
                                {userRole === 'STAFF' ? 'Assigned Properties' : 'My Properties'}
                            </h2>
                        </div>
                        <p className="text-indigo-200 text-xs font-bold ml-12 uppercase tracking-widest">
                            {userRole === 'STAFF'
                                ? 'Properties assigned to you by your owner'
                                : 'Complete overview of all your registered PG, Hostel & Flat listings'
                            }
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Button variant="ghost" size="sm" onClick={fetchData}
                            className="text-white/80 hover:text-white hover:bg-white/10 border border-white/20 rounded-xl h-9 text-xs font-black"
                        >
                            <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Refresh
                        </Button>
                        <span className="px-4 py-2 bg-white/20 backdrop-blur rounded-xl text-white text-sm font-black border border-white/30">
                            {properties.length} {properties.length === 1 ? 'Property' : 'Properties'}
                        </span>
                    </div>
                </div>
            </div>

            <CardContent className="p-6 space-y-6">
                {/* ── Aggregate Quick Stats ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                    {[
                        { label: 'Total Beds', value: aggregateStats.totalBeds, icon: Bed, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
                        { label: 'Occupied', value: aggregateStats.occupiedBeds, icon: UserCheck, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                        { label: 'Vacant', value: aggregateStats.availableBeds, icon: DoorOpen, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                        { label: 'Active Tenants', value: aggregateStats.activeTenants, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
                        { label: 'Occupancy', value: `${aggregateStats.avgOccupancy}%`, icon: TrendingUp, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100' },
                    ].map(({ label, value, icon: Icon, color, bg, border }) => (
                        <div key={label} className={`${bg} rounded-2xl p-3 border ${border} transition-all hover:shadow-md`}>
                            <div className="flex items-center gap-2 mb-1">
                                <Icon className={`h-4 w-4 ${color}`} />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                            </div>
                            <div className={`text-2xl font-black ${color}`}>{value}</div>
                        </div>
                    ))}
                </div>

                {/* ── Alerts Row ── */}
                {(aggregateStats.pendingRequests > 0 || aggregateStats.upcomingMoveOuts > 0) && (
                    <div className="flex flex-wrap gap-3">
                        {aggregateStats.pendingRequests > 0 && (
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl animate-in fade-in">
                                <AlertCircle className="h-4 w-4 text-amber-600" />
                                <span className="text-xs font-black text-amber-700">{aggregateStats.pendingRequests} Pending Booking Request{aggregateStats.pendingRequests > 1 ? 's' : ''}</span>
                            </div>
                        )}
                        {aggregateStats.upcomingMoveOuts > 0 && (
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-xl animate-in fade-in">
                                <LogOut className="h-4 w-4 text-orange-600" />
                                <span className="text-xs font-black text-orange-700">{aggregateStats.upcomingMoveOuts} Upcoming Move-Out{aggregateStats.upcomingMoveOuts > 1 ? 's' : ''}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Controls: Type Filter + Dropdown ── */}
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">
                            <Filter className="h-3.5 w-3.5" /> Filter
                        </div>
                        {PROPERTY_TYPE_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => handleTypeFilter(opt.value)}
                                className={`px-4 py-1.5 rounded-full text-xs font-black border transition-all duration-200 ${
                                    typeFilter === opt.value
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                                }`}
                            >
                                {opt.label}
                                {opt.value !== 'ALL' && (
                                    <span className="ml-1.5 opacity-70">
                                        ({properties.filter(p => (p.propertyType || 'PG').toUpperCase() === opt.value).length})
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="md:ml-auto relative">
                        <select
                            id="owner-property-select"
                            value={selectedPropertyId}
                            onChange={e => setSelectedPropertyId(e.target.value)}
                            className="appearance-none w-full md:w-72 pl-4 pr-10 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer"
                        >
                            <option value="ALL">— View All Properties —</option>
                            {filteredProperties.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} ({p.city}) · {p.propertyType || 'PG'}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                {/* ── Detail View: Single Property ── */}
                {selectedProperty ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Property Header */}
                        <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-2xl border border-indigo-100 p-6">
                            <div className="flex flex-col md:flex-row gap-5">
                                <div className="flex-1 space-y-3">
                                    <div className="flex items-start gap-3 flex-wrap">
                                        <div className="h-12 w-12 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
                                            <Building2 className="h-6 w-6 text-indigo-600" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-xl font-black text-slate-900">{selectedProperty.name}</h3>
                                                {selectedProperty.isVerified && (
                                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full border border-emerald-200">
                                                        <BadgeCheck className="h-3 w-3" /> Verified
                                                    </span>
                                                )}
                                                <span className={`px-2 py-0.5 text-[10px] font-black rounded-full border ${TYPE_COLORS[selectedProperty.propertyType] || TYPE_COLORS.PG}`}>
                                                    {selectedProperty.propertyType || 'PG'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500">
                                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                                <span>{selectedProperty.address}, {selectedProperty.city}</span>
                                            </div>
                                            <p className="text-[10px] font-mono text-slate-400 mt-1">{selectedProperty.displayId}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[selectedProperty.status] || 'bg-slate-400'} ${selectedProperty.status === 'LIVE' ? 'animate-pulse' : ''}`}></span>
                                    <span className="text-sm font-black text-slate-700">{selectedProperty.status}</span>
                                </div>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                            {[
                                { label: 'Rooms', value: selectedProperty.totalRooms, icon: DoorOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                                { label: 'Total Beds', value: selectedProperty.totalBeds, icon: Bed, color: 'text-purple-600', bg: 'bg-purple-50' },
                                { label: 'Occupied', value: selectedProperty.occupiedBeds, icon: UserCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
                                { label: 'Vacant', value: selectedProperty.availableBeds, icon: DoorOpen, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                { label: 'Reserved', value: selectedProperty.reservedBeds, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                                { label: 'Maintenance', value: selectedProperty.maintenanceBeds, icon: Wrench, color: 'text-red-600', bg: 'bg-red-50' },
                                { label: 'Tenants', value: selectedProperty.activeTenants, icon: Users, color: 'text-teal-600', bg: 'bg-teal-50' },
                                { label: 'Occupancy', value: `${selectedProperty.occupancyRate}%`, icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50' },
                            ].map(({ label, value, icon: Icon, color, bg }) => (
                                <div key={label} className={`${bg} rounded-xl p-3 text-center transition-all hover:shadow-md`}>
                                    <Icon className={`h-4 w-4 ${color} mx-auto mb-1`} />
                                    <div className={`text-xl font-black ${color}`}>{value}</div>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Revenue + Rating + Alerts */}
                        <div className="flex flex-wrap gap-3">
                            <div className="flex items-center gap-2 px-4 py-2 bg-teal-50 border border-teal-200 rounded-xl">
                                <IndianRupee className="h-4 w-4 text-teal-500" />
                                <span className="font-black text-teal-700">₹{(selectedProperty.totalRevenue || 0).toLocaleString('en-IN')}</span>
                                <span className="text-[10px] text-teal-500 font-bold">Revenue</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-xl">
                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />
                                <span className="font-black text-yellow-700">{selectedProperty.avgRating || 'N/A'}</span>
                                <span className="text-xs text-yellow-600">({selectedProperty.reviewCount} reviews)</span>
                            </div>
                            {selectedProperty.pendingBookingRequests > 0 && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                                    <AlertCircle className="h-4 w-4 text-amber-600" />
                                    <span className="text-xs font-black text-amber-700">{selectedProperty.pendingBookingRequests} Pending Request{selectedProperty.pendingBookingRequests > 1 ? 's' : ''}</span>
                                </div>
                            )}
                            {selectedProperty.upcomingMoveOuts > 0 && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-xl">
                                    <LogOut className="h-4 w-4 text-orange-600" />
                                    <span className="text-xs font-black text-orange-700">{selectedProperty.upcomingMoveOuts} Move-Out{selectedProperty.upcomingMoveOuts > 1 ? 's' : ''} Scheduled</span>
                                </div>
                            )}
                            {selectedProperty.foodType && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Food</span>
                                    <span className="text-sm font-black text-slate-700">{selectedProperty.foodType}</span>
                                </div>
                            )}
                        </div>

                        {/* Assigned Staff (Owner only) */}
                        {userRole === 'OWNER' && selectedProperty.assignedStaff?.length > 0 && (
                            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                    <Users className="h-3.5 w-3.5" /> Assigned Staff ({selectedProperty.assignedStaff.length})
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {selectedProperty.assignedStaff.map((staff: any) => (
                                        <div key={staff.id} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-100 shadow-sm">
                                            <div className="h-6 w-6 rounded-lg bg-indigo-100 flex items-center justify-center font-black text-indigo-700 text-xs">
                                                {staff.name?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                            <span className="text-xs font-bold text-slate-700">{staff.name}</span>
                                            <span className={`h-1.5 w-1.5 rounded-full ${staff.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Rooms Table */}
                        {selectedProperty.rooms && selectedProperty.rooms.length > 0 && (
                            <div>
                                <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <DoorOpen className="h-4 w-4 text-indigo-500" /> Room Inventory
                                </h4>
                                <div className="overflow-x-auto rounded-xl border border-slate-100">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="text-left py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Room</th>
                                                <th className="text-left py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                                                <th className="text-right py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Price/mo</th>
                                                <th className="text-right py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Beds</th>
                                                <th className="text-right py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Occupied</th>
                                                <th className="text-right py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vacant</th>
                                                <th className="text-center py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedProperty.rooms.map((room: any, idx: number) => (
                                                <tr key={room.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                                                    <td className="py-3 px-4 font-black text-slate-800">Room {room.roomNumber}</td>
                                                    <td className="py-3 px-4 text-slate-600 font-medium">{room.type}</td>
                                                    <td className="py-3 px-4 text-right font-black text-indigo-600">₹{(room.price || 0).toLocaleString('en-IN')}</td>
                                                    <td className="py-3 px-4 text-right font-bold text-slate-600">{room.totalBeds}</td>
                                                    <td className="py-3 px-4 text-right font-bold text-blue-600">{room.occupiedBeds}</td>
                                                    <td className="py-3 px-4 text-right font-bold text-emerald-600">{room.availableBeds}</td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                            room.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-700' :
                                                            room.status === 'OCCUPIED' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-slate-100 text-slate-600'
                                                        }`}>{room.status}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* ── ALL PROPERTIES GRID VIEW ── */
                    <div className="space-y-4">
                        {filteredProperties.length === 0 ? (
                            <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                <h3 className="text-lg font-black text-slate-500">No Properties Found</h3>
                                <p className="text-slate-400 text-sm mt-1">
                                    {typeFilter !== 'ALL'
                                        ? `No ${typeFilter} type properties found.`
                                        : userRole === 'STAFF'
                                            ? 'No properties have been assigned to you yet.'
                                            : 'You haven\'t registered any properties yet.'
                                    }
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                {filteredProperties.map(prop => (
                                    <div
                                        key={prop.id}
                                        className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 cursor-pointer group overflow-hidden"
                                        onClick={() => setSelectedPropertyId(prop.id)}
                                    >
                                        {/* Top Stripe */}
                                        <div className={`h-1.5 w-full ${
                                            prop.status === 'LIVE' ? 'bg-gradient-to-r from-emerald-400 to-teal-500' :
                                            prop.status === 'APPROVED' ? 'bg-gradient-to-r from-indigo-500 to-purple-500' :
                                            'bg-gradient-to-r from-slate-300 to-slate-400'
                                        }`}></div>

                                        <div className="p-5 space-y-4">
                                            {/* Name + badges */}
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-black text-slate-900 truncate group-hover:text-indigo-700 transition-colors">{prop.name}</h3>
                                                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                                                        <MapPin className="h-3 w-3 shrink-0" />
                                                        <span className="truncate">{prop.city}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                    <span className={`px-2 py-0.5 text-[10px] font-black rounded-full border ${TYPE_COLORS[prop.propertyType] || TYPE_COLORS.PG}`}>
                                                        {prop.propertyType || 'PG'}
                                                    </span>
                                                    {prop.isVerified && (
                                                        <span className="flex items-center gap-0.5 text-[9px] font-black text-emerald-600">
                                                            <BadgeCheck className="h-3 w-3" /> Verified
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Metrics */}
                                            <div className="grid grid-cols-4 gap-2">
                                                <div className="text-center bg-violet-50 rounded-xl py-2">
                                                    <div className="text-lg font-black text-violet-600">{prop.totalBeds}</div>
                                                    <div className="text-[8px] font-bold text-violet-600/70 uppercase">Beds</div>
                                                </div>
                                                <div className="text-center bg-blue-50 rounded-xl py-2">
                                                    <div className="text-lg font-black text-blue-600">{prop.occupiedBeds}</div>
                                                    <div className="text-[8px] font-bold text-blue-600/70 uppercase">Filled</div>
                                                </div>
                                                <div className="text-center bg-green-50 rounded-xl py-2">
                                                    <div className="text-lg font-black text-green-600">{prop.availableBeds}</div>
                                                    <div className="text-[8px] font-bold text-green-600/70 uppercase">Vacant</div>
                                                </div>
                                                <div className="text-center bg-orange-50 rounded-xl py-2">
                                                    <div className="text-lg font-black text-orange-600">{prop.occupancyRate}%</div>
                                                    <div className="text-[8px] font-bold text-orange-600/70 uppercase">Occ.</div>
                                                </div>
                                            </div>

                                            {/* Revenue + Rating + Status */}
                                            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                                <div className="flex items-center gap-1">
                                                    <IndianRupee className="h-3.5 w-3.5 text-teal-500" />
                                                    <span className="text-xs font-black text-slate-700">
                                                        ₹{(prop.totalRevenue || 0).toLocaleString('en-IN')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-300" />
                                                    <span className="text-xs font-black text-slate-600">{prop.avgRating || '—'}</span>
                                                    <span className="text-[10px] text-slate-400">({prop.reviewCount})</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[prop.status] || 'bg-slate-400'} ${prop.status === 'LIVE' ? 'animate-pulse' : ''}`}></span>
                                                    <span className="text-[10px] font-black text-slate-500">{prop.status}</span>
                                                </div>
                                            </div>

                                            {/* Alert badges */}
                                            {(prop.pendingBookingRequests > 0 || prop.upcomingMoveOuts > 0) && (
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {prop.pendingBookingRequests > 0 && (
                                                        <span className="flex items-center gap-1 text-[9px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                                            <AlertCircle className="h-2.5 w-2.5" /> {prop.pendingBookingRequests} Pending
                                                        </span>
                                                    )}
                                                    {prop.upcomingMoveOuts > 0 && (
                                                        <span className="flex items-center gap-1 text-[9px] font-black text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                                                            <LogOut className="h-2.5 w-2.5" /> {prop.upcomingMoveOuts} Move-out
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* View detail CTA */}
                                            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <Users className="h-3.5 w-3.5 text-slate-400" />
                                                    <span className="text-xs font-bold text-slate-600">{prop.activeTenants} Active Tenants</span>
                                                </div>
                                                <span className="flex items-center gap-1 text-[10px] font-black text-indigo-500 group-hover:underline">
                                                    <Eye className="h-3 w-3" /> Details
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
