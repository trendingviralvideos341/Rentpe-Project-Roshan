// src/components/admin/OnboardedProperties.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  Building2, Filter, ChevronDown, BadgeCheck, MapPin, 
  Mail, Phone, Calendar, DoorOpen, Bed, CheckCircle as CheckCircle2, 
  UserCheck, Activity, IndianRupee, Star 
} from "lucide-react";
import { getOnboardedProperties } from "@/actions/superAdmin";
import { Badge } from "@/components/ui/badge";

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

const GENDER_LABELS: Record<string, string> = {
    MALE: 'Boys Only',
    FEMALE: 'Girls Only',
    COED: 'Co-Ed',
};

export function OnboardedProperties() {
    const [onboardedProperties, setOnboardedProperties] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getOnboardedProperties().then(data => {
            setOnboardedProperties(data || []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const [typeFilter, setTypeFilter] = useState<string>('ALL');
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>('ALL');

    const filteredProperties = useMemo(() => {
        if (typeFilter === 'ALL') return onboardedProperties;
        return onboardedProperties.filter(p => (p.propertyType || 'PG').toUpperCase() === typeFilter);
    }, [onboardedProperties, typeFilter]);

    const selectedProperty = useMemo(() => {
        if (selectedPropertyId === 'ALL') return null;
        return onboardedProperties.find(p => p.id === selectedPropertyId) || null;
    }, [onboardedProperties, selectedPropertyId]);

    const handleTypeFilter = (t: string) => {
        setTypeFilter(t);
        setSelectedPropertyId('ALL');
    };

    if (loading) return <div className="p-10 text-center text-slate-500">Loading properties...</div>;

    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="h-9 w-9 rounded-xl bg-violet-100 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-violet-600" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">Onboarded Properties</h2>
                    </div>
                    <p className="text-slate-500 text-xs font-medium ml-12 uppercase tracking-wide">
                        All fully registered &amp; live PG, Hostel, Flat listings on RentPe
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="px-4 py-2 bg-slate-50 rounded-xl text-slate-700 text-sm font-semibold border border-slate-200">
                        {onboardedProperties.length} Properties Live
                    </span>
                </div>
            </div>

            <div className="space-y-6">
                {/* Controls Row: Type Filter + Property Dropdown */}
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Type Filter Chips */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">
                            <Filter className="h-3.5 w-3.5" /> Filter
                        </div>
                        {PROPERTY_TYPE_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => handleTypeFilter(opt.value)}
                                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                                    typeFilter === opt.value
                                        ? 'bg-violet-600 text-white border-violet-600'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-600'
                                }`}
                            >
                                {opt.label}
                                {opt.value !== 'ALL' && (
                                    <span className="ml-1.5 opacity-70">
                                        ({onboardedProperties.filter(p => (p.propertyType || 'PG').toUpperCase() === opt.value).length})
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Property Dropdown Selector */}
                    <div className="md:ml-auto relative">
                        <div className="relative">
                            <select
                                id="property-select"
                                value={selectedPropertyId}
                                onChange={e => setSelectedPropertyId(e.target.value)}
                                className="appearance-none w-full md:w-72 pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all cursor-pointer"
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
                </div>

                {/* ── DETAIL VIEW / GRID VIEW ── */}
                {selectedProperty ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Property Header Card */}
                        <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-2xl border border-indigo-100 p-6">
                            <div className="flex flex-col md:flex-row gap-6">
                                {/* Left: Identity */}
                                <div className="flex-1 space-y-3">
                                    <div className="flex items-start gap-3 flex-wrap">
                                        <div className="h-12 w-12 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
                                            <Building2 className="h-6 w-6 text-indigo-600" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-xl font-bold text-slate-900">{selectedProperty.name}</h3>
                                                {selectedProperty.isVerified && (
                                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200">
                                                        <BadgeCheck className="h-3 w-3" /> Verified
                                                    </span>
                                                )}
                                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${TYPE_COLORS[selectedProperty.propertyType] || TYPE_COLORS.PG}`}>
                                                    {selectedProperty.propertyType || 'PG'}
                                                </span>
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full border border-slate-200">
                                                    {selectedProperty.genderType ? GENDER_LABELS[selectedProperty.genderType] || selectedProperty.genderType : 'N/A'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500 font-medium">
                                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                                <span>{selectedProperty.address}, {selectedProperty.city}</span>
                                            </div>
                                            <p className="text-[10px] font-mono text-slate-400 mt-1">{selectedProperty.displayId}</p>
                                        </div>
                                    </div>

                                    {selectedProperty.description && (
                                        <p className="text-sm text-slate-600 bg-white/60 p-3 rounded-xl border border-slate-100 leading-relaxed">
                                            {selectedProperty.description}
                                        </p>
                                    )}
                                </div>

                                {/* Right: Owner Info */}
                                <div className="md:w-64 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Property Owner</p>
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-lg">
                                            {selectedProperty.owner?.name?.charAt(0)?.toUpperCase() || 'O'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{selectedProperty.owner?.name || 'N/A'}</p>
                                            <p className="text-[10px] font-mono text-slate-400">{selectedProperty.owner?.displayId || ''}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2 pt-1">
                                        {selectedProperty.owner?.email && (
                                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                                <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                <span className="truncate">{selectedProperty.owner.email}</span>
                                            </div>
                                        )}
                                        {selectedProperty.owner?.phone && (
                                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                                <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                <span>{selectedProperty.owner.phone}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 text-xs text-slate-600">
                                            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                            <span>Since {selectedProperty.createdAt ? new Date(selectedProperty.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {[
                                { label: 'Total Rooms', value: selectedProperty.totalRooms, icon: DoorOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                                { label: 'Total Beds', value: selectedProperty.totalBeds, icon: Bed, color: 'text-purple-600', bg: 'bg-purple-50' },
                                { label: 'Available Beds', value: selectedProperty.availableBeds, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                { label: 'Active Tenants', value: selectedProperty.activeTenants, icon: UserCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
                                { label: 'Total Bookings', value: selectedProperty.totalBookings, icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50' },
                                { label: 'Revenue', value: `₹${(selectedProperty.totalRevenue || 0).toLocaleString('en-IN')}`, icon: IndianRupee, color: 'text-teal-600', bg: 'bg-teal-50' },
                            ].map(({ label, value, icon: Icon, color, bg }) => (
                                <div key={label} className={`${bg} rounded-2xl p-4 border border-transparent hover:border-slate-200 transition-all`}>
                                    <div className={`${color} mb-2`}><Icon className="h-5 w-5" /></div>
                                    <div className={`text-xl font-bold ${color}`}>{value}</div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Rating + Food */}
                        <div className="flex flex-wrap gap-3">
                            <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-xl">
                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />
                                <span className="font-bold text-yellow-700">{selectedProperty.avgRating || 'N/A'}</span>
                                <span className="text-xs text-yellow-600">({selectedProperty.reviewCount || 0} reviews)</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Food</span>
                                <span className="text-sm font-bold text-slate-700">{selectedProperty.foodType || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                                <span className={`h-2 w-2 rounded-full ${selectedProperty.status === 'LIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-500'}`}></span>
                                <span className="text-sm font-bold text-emerald-700">{selectedProperty.status}</span>
                            </div>
                        </div>

                        {/* Rooms Table */}
                        {selectedProperty.rooms && selectedProperty.rooms.length > 0 && (
                            <div>
                                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <DoorOpen className="h-4 w-4 text-indigo-500" /> Room Inventory
                                </h4>
                                <div className="overflow-x-auto rounded-xl border border-slate-100">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Room</th>
                                                <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                                                <th className="text-right py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Price/mo</th>
                                                <th className="text-right py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Beds</th>
                                                <th className="text-center py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedProperty.rooms.map((room: any, idx: number) => (
                                                <tr key={room.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                                                    <td className="py-3 px-4 font-bold text-slate-800">Room {room.roomNumber}</td>
                                                    <td className="py-3 px-4 text-slate-600 font-medium">{room.type}</td>
                                                    <td className="py-3 px-4 text-right font-bold text-indigo-600">₹{(room.price || 0).toLocaleString('en-IN')}</td>
                                                    <td className="py-3 px-4 text-right font-bold text-slate-600">{room.totalBeds || room.availability}</td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
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
                                <h3 className="text-lg font-bold text-slate-500">No Onboarded Properties</h3>
                                <p className="text-slate-400 text-sm mt-1">
                                    {typeFilter !== 'ALL' 
                                        ? `No ${typeFilter} type properties are currently live.`
                                        : 'No properties have been fully registered and activated yet.'}
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
                                        {/* Card Top Stripe */}
                                        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-500 group-hover:from-indigo-600 group-hover:to-violet-600 transition-all"></div>
                                        <div className="p-5 space-y-4">
                                            {/* Name + badges */}
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">{prop.name}</h3>
                                                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                                                        <MapPin className="h-3 w-3 shrink-0" />
                                                        <span className="truncate">{prop.city}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${TYPE_COLORS[prop.propertyType] || TYPE_COLORS.PG}`}>
                                                        {prop.propertyType || 'PG'}
                                                    </span>
                                                    {prop.isVerified && (
                                                        <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-600">
                                                            <BadgeCheck className="h-3 w-3" /> Verified
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Metrics grid */}
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="text-center bg-indigo-50 rounded-xl py-2">
                                                    <div className="text-lg font-bold text-indigo-600">{prop.totalBeds}</div>
                                                    <div className="text-[9px] font-bold text-indigo-400 uppercase">Beds</div>
                                                </div>
                                                <div className="text-center bg-emerald-50 rounded-xl py-2">
                                                    <div className="text-lg font-bold text-emerald-600">{prop.activeTenants}</div>
                                                    <div className="text-[9px] font-bold text-emerald-400 uppercase">Tenants</div>
                                                </div>
                                                <div className="text-center bg-amber-50 rounded-xl py-2">
                                                    <div className="text-lg font-bold text-amber-600">{prop.availableBeds}</div>
                                                    <div className="text-[9px] font-bold text-amber-400 uppercase">Vacant</div>
                                                </div>
                                            </div>

                                            {/* Revenue + Rating row */}
                                            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                                <div className="flex items-center gap-1">
                                                    <IndianRupee className="h-3.5 w-3.5 text-teal-500" />
                                                    <span className="text-xs font-bold text-slate-700">
                                                        ₹{(prop.totalRevenue || 0).toLocaleString('en-IN')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-300" />
                                                    <span className="text-xs font-bold text-slate-600">{prop.avgRating || '—'}</span>
                                                    <span className="text-[10px] text-slate-400">({prop.reviewCount || 0})</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className={`h-2 w-2 rounded-full ${prop.status === 'LIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-500'}`}></span>
                                                    <span className="text-[10px] font-bold text-slate-500">{prop.status}</span>
                                                </div>
                                            </div>

                                            {/* Owner row */}
                                            <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                                                <div className="h-6 w-6 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0">
                                                    {prop.owner?.name?.charAt(0)?.toUpperCase() || 'O'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-slate-600 truncate">{prop.owner?.name || 'Unknown Owner'}</p>
                                                </div>
                                                <Badge className="text-[9px] font-bold bg-slate-100 text-slate-500 hover:bg-slate-100 border-none">Owner</Badge>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
