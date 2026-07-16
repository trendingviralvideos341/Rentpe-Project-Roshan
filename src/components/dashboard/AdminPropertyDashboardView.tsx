"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Building2, IndianRupee, Users, Bed, DoorOpen, AlertCircle,
    TrendingUp, Lock, Shield, Star, Mail, Phone, RefreshCcw,
    ChevronDown, MapPin, CheckCircle2, UserCheck, Calendar,
    ArrowUpRight, Activity, Home
} from "lucide-react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { getOwnersWithProperties, getAdminPropertyDashboard } from "@/actions/superAdmin";

const PIE_COLORS = ['#6366f1', '#e2e8f0'];
const TYPE_COLORS: Record<string, string> = {
    PG: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    HOSTEL: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    FLAT: 'bg-amber-100 text-amber-700 border-amber-200',
    APARTMENT: 'bg-purple-100 text-purple-700 border-purple-200',
};
const STATUS_COLORS: Record<string, string> = {
    ACTIVE_TENANT: 'bg-emerald-100 text-emerald-700',
    UPCOMING_MOVE_IN: 'bg-blue-100 text-blue-700',
    MOVE_OUT_SCHEDULED: 'bg-amber-100 text-amber-700',
};

interface Owner {
    id: string;
    name: string;
    email: string;
    displayId: string;
    properties: { id: string; name: string; propertyType: string; city: string; status: string }[];
}

export function AdminPropertyDashboardView({ initialOwners }: { initialOwners: Owner[] }) {
    const [owners, setOwners] = useState<Owner[]>(initialOwners);
    const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
    const [dashboard, setDashboard] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [refreshingOwners, setRefreshingOwners] = useState(false);

    const selectedOwner = owners.find(o => o.id === selectedOwnerId);
    const ownerProperties = selectedOwner?.properties || [];

    const handleOwnerChange = (ownerId: string) => {
        setSelectedOwnerId(ownerId);
        setSelectedPropertyId('');
        setDashboard(null);
        setError('');
    };

    const handlePropertyChange = async (propertyId: string) => {
        setSelectedPropertyId(propertyId);
        setDashboard(null);
        setError('');
        if (!propertyId) return;
        setLoading(true);
        try {
            const data = await getAdminPropertyDashboard(propertyId);
            setDashboard(data);
        } catch (e: any) {
            setError(e.message || 'Failed to load property dashboard');
        } finally {
            setLoading(false);
        }
    };

    const refreshOwners = useCallback(async () => {
        setRefreshingOwners(true);
        try {
            const data = await getOwnersWithProperties();
            setOwners(data as Owner[]);
        } catch { /* silent */ }
        finally { setRefreshingOwners(false); }
    }, []);

    const kpis = dashboard?.kpis;
    const occupancyData = dashboard ? [
        { name: 'Occupied', value: kpis.occupiedBeds },
        { name: 'Vacant', value: kpis.vacantBeds },
    ] : [];

    return (
        <div className="space-y-8">
            {/* ── Selector Row ── */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 border border-white/10 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-indigo-300" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-white">Property Dashboard Viewer</h2>
                        <p className="text-xs text-slate-400 font-medium">Select any owner and property to view its full dashboard</p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={refreshOwners}
                        disabled={refreshingOwners}
                        className="ml-auto bg-white/5 border-white/10 text-white hover:bg-white/10"
                    >
                        <RefreshCcw className={`h-3.5 w-3.5 mr-1.5 ${refreshingOwners ? 'animate-spin' : ''}`} />
                        Refresh List
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Owner Dropdown */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                            1. Select Owner
                        </label>
                        <div className="relative">
                            <select
                                id="admin-owner-select"
                                value={selectedOwnerId}
                                onChange={e => handleOwnerChange(e.target.value)}
                                className="w-full appearance-none bg-white/10 border border-white/20 text-white rounded-xl px-4 py-3 pr-10 text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                            >
                                <option value="" className="bg-slate-800">— Choose an Owner —</option>
                                {owners.map(o => (
                                    <option key={o.id} value={o.id} className="bg-slate-800">
                                        {o.name} ({o.properties.length} {o.properties.length === 1 ? 'property' : 'properties'})
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        </div>
                        {selectedOwner && (
                            <p className="text-xs text-indigo-300 font-medium flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {selectedOwner.email}
                            </p>
                        )}
                    </div>

                    {/* Property Dropdown */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                            2. Select Property
                        </label>
                        <div className="relative">
                            <select
                                id="admin-property-select"
                                value={selectedPropertyId}
                                onChange={e => handlePropertyChange(e.target.value)}
                                disabled={!selectedOwnerId}
                                className="w-full appearance-none bg-white/10 border border-white/20 text-white rounded-xl px-4 py-3 pr-10 text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <option value="" className="bg-slate-800">— Choose a Property —</option>
                                {ownerProperties.map(p => (
                                    <option key={p.id} value={p.id} className="bg-slate-800">
                                        {p.name} · {p.city} [{p.status}]
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        </div>
                        {!selectedOwnerId && (
                            <p className="text-xs text-slate-500 font-medium">Select an owner first</p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Loading State ── */}
            {loading && (
                <div className="flex items-center justify-center py-24 animate-pulse">
                    <div className="text-center space-y-3">
                        <Activity className="h-10 w-10 text-indigo-400 mx-auto animate-spin" />
                        <p className="text-slate-500 font-semibold">Loading property dashboard...</p>
                    </div>
                </div>
            )}

            {/* ── Error State ── */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
                    <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                    <p className="text-red-700 font-bold">{error}</p>
                </div>
            )}

            {/* ── Empty State ── */}
            {!loading && !error && !dashboard && (
                <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-black text-slate-400">No Property Selected</h3>
                    <p className="text-slate-400 text-sm mt-1">Select an owner and property above to view the full dashboard</p>
                </div>
            )}

            {/* ── Property Dashboard ── */}
            {!loading && !error && dashboard && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    {/* Property + Owner Header */}
                    <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 rounded-2xl p-6 text-white relative overflow-hidden shadow-xl">
                        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:24px_24px]" />
                        <div className="relative z-10 flex flex-col md:flex-row justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${TYPE_COLORS[dashboard.property.propertyType] || 'bg-slate-100 text-slate-600'}`}>
                                        {dashboard.property.propertyType}
                                    </span>
                                    {dashboard.property.isVerified && (
                                        <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-[10px] font-black text-emerald-200 flex items-center gap-1">
                                            <CheckCircle2 className="h-2.5 w-2.5" /> Verified
                                        </span>
                                    )}
                                    <span className="px-2 py-0.5 bg-white/10 border border-white/20 rounded-full text-[10px] font-black text-white/70">
                                        {dashboard.property.status}
                                    </span>
                                </div>
                                <h2 className="text-2xl font-black">{dashboard.property.name}</h2>
                                <p className="text-indigo-200 text-sm flex items-center gap-1 mt-1">
                                    <MapPin className="h-3.5 w-3.5" /> {dashboard.property.city} · {dashboard.property.address}
                                </p>
                                {kpis.avgRating > 0 && (
                                    <div className="flex items-center gap-1 mt-2">
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(kpis.avgRating) ? 'fill-yellow-300 text-yellow-300' : 'fill-white/20 text-white/20'}`} />
                                        ))}
                                        <span className="text-xs font-bold text-white/70 ml-1">{kpis.avgRating} ({kpis.totalReviews} reviews)</span>
                                    </div>
                                )}
                            </div>
                            {/* Owner card */}
                            <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl p-4 min-w-56 shrink-0">
                                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">Owner Info</p>
                                <p className="font-black text-base">{dashboard.owner.name}</p>
                                <p className="text-xs text-indigo-200 flex items-center gap-1 mt-1"><Mail className="h-3 w-3" /> {dashboard.owner.email}</p>
                                {dashboard.owner.phone && <p className="text-xs text-indigo-200 flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" /> {dashboard.owner.phone}</p>}
                                <p className="text-xs text-indigo-200 flex items-center gap-1 mt-0.5"><Home className="h-3 w-3" /> {dashboard.owner.totalPropertiesOwned} properties total</p>
                            </div>
                        </div>
                    </div>

                    {/* ── KPI Cards Row ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                        <Card className="border-l-4 border-l-emerald-500 hover:shadow-lg transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rent Revenue</CardTitle>
                                <div className="h-7 w-7 bg-emerald-100 rounded-lg flex items-center justify-center">
                                    <IndianRupee className="h-3.5 w-3.5 text-emerald-600" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-black text-slate-900">₹{kpis.totalRevenue.toLocaleString('en-IN')}</div>
                                <p className="text-[10px] mt-1 text-emerald-600 font-bold flex items-center gap-1">
                                    <TrendingUp className="h-2.5 w-2.5" /> Current FY · April to March · Rent only
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-orange-400 bg-orange-50/20 hover:shadow-lg transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Deposits Held</CardTitle>
                                <div className="h-7 w-7 bg-orange-100 rounded-lg flex items-center justify-center">
                                    <Lock className="h-3.5 w-3.5 text-orange-500" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-black text-orange-700">₹{kpis.totalDepositsHeld.toLocaleString('en-IN')}</div>
                                <p className="text-[10px] mt-1 text-orange-500 font-bold flex items-center gap-1">
                                    <Shield className="h-2.5 w-2.5" /> Refundable liability
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Active Tenants</CardTitle>
                                <div className="h-7 w-7 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <Users className="h-3.5 w-3.5 text-blue-600" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-black text-slate-900">{kpis.activeTenants}</div>
                                <p className="text-[10px] mt-1 text-slate-500 font-bold">{kpis.upcomingMoveOuts} move-outs scheduled</p>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-teal-500 hover:shadow-lg transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vacant Beds</CardTitle>
                                <div className="h-7 w-7 bg-teal-100 rounded-lg flex items-center justify-center">
                                    <DoorOpen className="h-3.5 w-3.5 text-teal-600" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-black text-slate-900">{kpis.vacantBeds}</div>
                                <p className="text-[10px] mt-1 text-slate-500 font-bold">of {kpis.totalBeds} total · {kpis.occupiedBeds} occupied</p>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-purple-500 hover:shadow-lg transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Bookings</CardTitle>
                                <div className="h-7 w-7 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <Activity className="h-3.5 w-3.5 text-purple-600" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-black text-slate-900">{kpis.totalBookings}</div>
                                <p className="text-[10px] mt-1 text-slate-500 font-bold">All time bookings</p>
                            </CardContent>
                        </Card>

                        <Card className={`border-l-4 hover:shadow-lg transition-shadow ${kpis.pendingBookings > 0 ? 'border-l-amber-500 bg-amber-50/30' : 'border-l-slate-300'}`}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pending</CardTitle>
                                <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${kpis.pendingBookings > 0 ? 'bg-amber-100' : 'bg-slate-100'}`}>
                                    <AlertCircle className={`h-3.5 w-3.5 ${kpis.pendingBookings > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-xl font-black ${kpis.pendingBookings > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{kpis.pendingBookings}</div>
                                <p className="text-[10px] mt-1 text-slate-500 font-bold">Booking requests</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Charts Row ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Revenue Trend Chart */}
                        <Card className="lg:col-span-2 shadow-lg border-none">
                            <CardHeader className="border-b bg-slate-50/50 p-5">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle className="text-base font-black text-slate-800">Revenue Trend · Current FY (April–March)</CardTitle>
                                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Rent only · Deposits excluded · IST-aligned</CardDescription>
                                    </div>
                                    <TrendingUp className="h-4 w-4 text-indigo-400" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-5">
                                <div className="h-52">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={dashboard.revenueHistory}>
                                            <defs>
                                                <linearGradient id="adminRevGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                                            <Tooltip
                                                formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Rent Revenue']}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                                            />
                                            <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fill="url(#adminRevGrad)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Occupancy Donut */}
                        <Card className="shadow-lg border-none">
                            <CardHeader className="border-b bg-slate-50/50 p-5">
                                <CardTitle className="text-base font-black text-slate-800">Bed Occupancy</CardTitle>
                                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    {kpis.totalBeds > 0 ? `${Math.round((kpis.occupiedBeds / kpis.totalBeds) * 100)}% occupied` : 'No beds configured'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-5">
                                {kpis.totalBeds > 0 ? (
                                    <div className="relative h-52">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={occupancyData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                                                    {occupancyData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                                                </Pie>
                                                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                                                <Tooltip formatter={(v: any) => [`${v} beds`, '']} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="text-center">
                                                <div className="text-2xl font-black text-slate-800">{Math.round((kpis.occupiedBeds / kpis.totalBeds) * 100)}%</div>
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Occupied</div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-52 flex items-center justify-center text-slate-400">
                                        <div className="text-center">
                                            <Bed className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                            <p className="text-sm font-semibold">No beds configured</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Rooms Table ── */}
                    {dashboard.roomsBreakdown.length > 0 && (
                        <Card className="shadow-lg border-none">
                            <CardHeader className="border-b bg-slate-50/50 p-5">
                                <CardTitle className="text-base font-black text-slate-800">Room Inventory ({dashboard.roomsBreakdown.length} rooms)</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b bg-slate-50">
                                                <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Room</th>
                                                <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Type</th>
                                                <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Price/mo</th>
                                                <th className="text-center p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Total Beds</th>
                                                <th className="text-center p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Occupied</th>
                                                <th className="text-center p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Vacant</th>
                                                <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {dashboard.roomsBreakdown.map((room: any) => (
                                                <tr key={room.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-4 font-black text-slate-800">#{room.roomNumber}</td>
                                                    <td className="p-4">
                                                        <Badge variant="outline" className="text-[10px] font-bold">{room.type}</Badge>
                                                    </td>
                                                    <td className="p-4 font-bold text-slate-700">₹{(room.price || 0).toLocaleString('en-IN')}</td>
                                                    <td className="p-4 text-center font-bold text-slate-700">{room.totalBeds}</td>
                                                    <td className="p-4 text-center">
                                                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black">{room.occupiedBeds}</span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-black ${room.vacantBeds > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{room.vacantBeds}</span>
                                                    </td>
                                                    <td className="p-4">
                                                        <Badge variant="outline" className={`text-[10px] font-bold ${room.status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : room.status === 'OCCUPIED' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-500'}`}>
                                                            {room.status || 'N/A'}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* ── Recent Tenants ── */}
                    {dashboard.recentTenants.length > 0 && (
                        <Card className="shadow-lg border-none">
                            <CardHeader className="border-b bg-slate-50/50 p-5">
                                <CardTitle className="text-base font-black text-slate-800">Current & Upcoming Tenants</CardTitle>
                                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Active, upcoming move-ins, and scheduled move-outs</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-slate-100">
                                    {dashboard.recentTenants.map((t: any) => (
                                        <div key={t.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
                                            <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                                <UserCheck className="h-4 w-4 text-indigo-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-sm text-slate-800 truncate">{t.name}</p>
                                                {t.phone && <p className="text-xs text-slate-500 flex items-center gap-1"><Phone className="h-2.5 w-2.5" />{t.phone}</p>}
                                            </div>
                                            <div className="text-right shrink-0">
                                                {t.startDate && (
                                                    <p className="text-[10px] text-slate-400 flex items-center gap-1 justify-end">
                                                        <Calendar className="h-2.5 w-2.5" />
                                                        {new Date(t.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </p>
                                                )}
                                                <Badge className={`text-[9px] font-black mt-1 ${STATUS_COLORS[t.status] || 'bg-slate-100 text-slate-600'}`}>
                                                    {(t.status || '').replace(/_/g, ' ')}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}
