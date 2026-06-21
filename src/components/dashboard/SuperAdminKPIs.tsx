"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
    TrendingUp, Users, Home, CreditCard, 
    AlertTriangle, Shield, CheckCircle2, 
    BarChart3, PieChart as PieChartIcon, 
    ArrowUpRight, Activity,
    Building2, MapPin, Star, Bed, DoorOpen,
    ChevronDown, Filter, UserCheck, IndianRupee,
    Phone, Mail, Calendar, BadgeCheck,
    Clock, Zap, BellRing, FileWarning, UserPlus,
    TrendingDown, Layers
} from "lucide-react";
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, 
    Tooltip, ResponsiveContainer, BarChart, Bar, 
    PieChart, Pie, Cell, Legend, LineChart, Line
} from "recharts";
import { formatDistanceToNow } from "date-fns";

interface SuperAdminKPIsProps {
    snapshot: any;
    revenueTrends: any;
    userGrowth: any;
    conversionAnalytics: any;
    onboardedProperties?: any[];
    recentActivity?: any[];
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

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

// Maps audit action types to human-readable labels + colours
const ACTION_META: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
    USER_CREATED:       { label: 'New User Registered',    color: 'text-emerald-600', bg: 'bg-emerald-50',  icon: UserPlus },
    BOOKING_CONFIRMED:  { label: 'Booking Confirmed',       color: 'text-indigo-600',  bg: 'bg-indigo-50',   icon: CheckCircle2 },
    PROPERTY_APPROVED:  { label: 'Property Approved',       color: 'text-blue-600',    bg: 'bg-blue-50',     icon: Building2 },
    PROPERTY_SUSPENDED: { label: 'Property Suspended',      color: 'text-red-600',     bg: 'bg-red-50',      icon: AlertTriangle },
    DISPUTE_OPENED:     { label: 'Dispute Opened',          color: 'text-amber-600',   bg: 'bg-amber-50',    icon: FileWarning },
    DISPUTE_RESOLVED:   { label: 'Dispute Resolved',        color: 'text-emerald-600', bg: 'bg-emerald-50',  icon: CheckCircle2 },
    FRAUD_FLAGGED:      { label: 'Fraud Alert Flagged',     color: 'text-red-600',     bg: 'bg-red-50',      icon: Shield },
    REVIEW_MODERATED:   { label: 'Review Moderated',        color: 'text-purple-600',  bg: 'bg-purple-50',   icon: Star },
    PAYOUT_PROCESSED:   { label: 'Payout Processed',        color: 'text-teal-600',    bg: 'bg-teal-50',     icon: IndianRupee },
    ROLE_UPGRADE:       { label: 'Role Upgraded',           color: 'text-violet-600',  bg: 'bg-violet-50',   icon: TrendingUp },
};

function getActionMeta(actionType: string) {
    return ACTION_META[actionType] || { label: actionType.replace(/_/g, ' '), color: 'text-slate-600', bg: 'bg-slate-50', icon: Activity };
}

// Empty state placeholder component for charts
function ChartEmptyState({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
    return (
        <div className="h-full w-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                <Icon className="h-7 w-7 text-slate-300" />
            </div>
            <div>
                <p className="text-sm font-black text-slate-500">{title}</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[200px]">{subtitle}</p>
            </div>
        </div>
    );
}

export function SuperAdminKPIs({ snapshot, revenueTrends, userGrowth, conversionAnalytics, onboardedProperties = [], recentActivity = [] }: SuperAdminKPIsProps) {
    const safe = (val: any, fallback: any = 0) => val ?? fallback;
    const safeDiv = (a: any, b: any) => b ? Math.round((safe(a) / safe(b, 1)) * 100) : 0;

    // Property panel state
    const [typeFilter, setTypeFilter] = useState<string>('ALL');
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>('ALL');

    // Filtered properties list (based on type filter)
    const filteredProperties = useMemo(() => {
        if (typeFilter === 'ALL') return onboardedProperties;
        return onboardedProperties.filter(p => (p.propertyType || 'PG').toUpperCase() === typeFilter);
    }, [onboardedProperties, typeFilter]);

    // Selected property (for detail view)
    const selectedProperty = useMemo(() => {
        if (selectedPropertyId === 'ALL') return null;
        return onboardedProperties.find(p => p.id === selectedPropertyId) || null;
    }, [onboardedProperties, selectedPropertyId]);

    // When type filter changes, reset property selection to ALL
    const handleTypeFilter = (t: string) => {
        setTypeFilter(t);
        setSelectedPropertyId('ALL');
    };

    if (!snapshot) return null;

    // Derive data for empty-state detection
    const hasRevenueData = (revenueTrends?.monthly ?? []).some((m: any) => (m.platformEarned ?? 0) > 0 || (m.grossVolume ?? 0) > 0);
    const hasInventoryData = (safe(snapshot.inventory?.occupied) + safe(snapshot.inventory?.available) + safe(snapshot.inventory?.reserved) + safe(snapshot.inventory?.maintenance)) > 0;
    const hasUserGrowthData = (userGrowth ?? []).length > 0;
    const hasConversionData = (conversionAnalytics ?? []).length > 0;

    // Pending actions derived from snapshot
    const pendingActions = [
        {
            label: 'Open Disputes',
            count: safe(snapshot.disputes?.open),
            color: 'text-amber-600',
            bg: 'bg-amber-50 border-amber-100',
            icon: FileWarning,
            urgent: safe(snapshot.disputes?.open) > 0,
        },
        {
            label: 'Fraud Alerts',
            count: safe(snapshot.fraud?.open),
            color: 'text-red-600',
            bg: 'bg-red-50 border-red-100',
            icon: Shield,
            urgent: safe(snapshot.fraud?.open) > 0,
        },
        {
            label: 'Properties Pending',
            count: Math.max(0, safe(snapshot.properties?.total) - safe(snapshot.properties?.live)),
            color: 'text-indigo-600',
            bg: 'bg-indigo-50 border-indigo-100',
            icon: Building2,
            urgent: false,
        },
        {
            label: 'Support Tickets',
            count: safe(snapshot.support?.tickets),
            color: 'text-purple-600',
            bg: 'bg-purple-50 border-purple-100',
            icon: BellRing,
            urgent: false,
        },
    ];

    return (
        <div className="space-y-8 pb-12">
            {/* ── Strategic KPI Top Row ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-none shadow-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white relative overflow-hidden group hover:scale-[1.02] transition-all duration-500">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/20 transition-all"></div>
                    <CardHeader className="pb-2 relative z-10">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-indigo-200" />
                            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-100/80">Platform Revenue</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-4xl font-black tracking-tight">₹{safe(snapshot.revenue?.platformEarned).toLocaleString('en-IN')}</div>
                        <div className="flex items-center gap-1.5 mt-3">
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black text-white border border-white/20">
                                <ArrowUpRight className="h-3 w-3" /> Total Earned
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white relative overflow-hidden group hover:scale-[1.02] transition-all duration-500">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/20 transition-all"></div>
                    <CardHeader className="pb-2 relative z-10">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-emerald-100" />
                            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100/80">Active Tenants</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-4xl font-black tracking-tight">{safe(snapshot.tenants?.active).toLocaleString()}</div>
                        <div className="flex items-center gap-1.5 mt-3">
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black text-white border border-white/20">
                                <Activity className="h-3 w-3 text-emerald-200" /> STABLE
                            </div>
                            <span className="text-[10px] font-bold text-emerald-100/60 uppercase tracking-tighter">Live across {safe(snapshot.properties?.live)} Properties</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-xl bg-gradient-to-br from-slate-800 via-slate-900 to-black text-white relative overflow-hidden group hover:scale-[1.02] transition-all duration-500">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/10 transition-all"></div>
                    <CardHeader className="pb-2 relative z-10">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-slate-400" />
                            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Conversion Rate</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-4xl font-black tracking-tight">{safe(snapshot.bookings?.conversionRate)}%</div>
                        <div className="flex items-center gap-1.5 mt-3">
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-700/50 backdrop-blur-md rounded-full text-[10px] font-black text-slate-300 border border-slate-700">
                                <CheckCircle2 className="h-3 w-3 text-slate-400" /> {safe(snapshot.bookings?.confirmed)}
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Confirmed bookings</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-amber-100">Pending Disputes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black">{safe(snapshot.disputes?.open)}</div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-100 mt-2 text-right justify-end w-full">
                            <Shield className="h-3 w-3" /> REQUIRES MODERATION
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Pending Actions + Activity Feed ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Pending Actions Panel */}
                <Card className="lg:col-span-2 border-none shadow-xl bg-white overflow-hidden">
                    <CardHeader className="border-b bg-gradient-to-r from-rose-50 to-amber-50 p-5">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-xl bg-rose-100 flex items-center justify-center">
                                <Zap className="h-4 w-4 text-rose-600" />
                            </div>
                            <div>
                                <CardTitle className="text-sm font-black text-slate-800">Requires Your Attention</CardTitle>
                                <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Open action items</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-5 space-y-3">
                        {pendingActions.map(({ label, count, color, bg, icon: Icon, urgent }) => (
                            <div key={label} className={`flex items-center justify-between p-3 rounded-xl border ${bg} transition-all hover:scale-[1.01]`}>
                                <div className="flex items-center gap-3">
                                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${bg}`}>
                                        <Icon className={`h-4 w-4 ${color}`} />
                                    </div>
                                    <span className="text-sm font-bold text-slate-700">{label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {urgent && count > 0 && (
                                        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                                    )}
                                    <span className={`text-xl font-black ${color}`}>{count}</span>
                                </div>
                            </div>
                        ))}
                        <div className="pt-2 border-t border-slate-100">
                            <div className="flex items-center justify-between text-xs text-slate-400">
                                <span className="font-bold uppercase tracking-widest">Total Users</span>
                                <span className="font-black text-slate-700">{safe(snapshot.users?.total).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                                <span className="font-bold uppercase tracking-widest">Attendance Today</span>
                                <span className="font-black text-slate-700">{safe(snapshot.support?.attendanceToday)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Activity Feed */}
                <Card className="lg:col-span-3 border-none shadow-xl bg-white overflow-hidden">
                    <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-purple-50 p-5">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                                <Clock className="h-4 w-4 text-indigo-600" />
                            </div>
                            <div>
                                <CardTitle className="text-sm font-black text-slate-800">Platform Activity Feed</CardTitle>
                                <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent events across the platform</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {recentActivity.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                                <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                                    <Activity className="h-6 w-6 text-slate-300" />
                                </div>
                                <p className="text-sm font-black text-slate-500">No Activity Yet</p>
                                <p className="text-xs text-slate-400 mt-1">Platform events will appear here as they happen — bookings, registrations, approvals, and more.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50 max-h-[320px] overflow-y-auto">
                                {recentActivity.map((item: any) => {
                                    const meta = getActionMeta(item.actionType);
                                    const Icon = meta.icon;
                                    return (
                                        <div key={item.id} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors">
                                            <div className={`mt-0.5 h-7 w-7 rounded-lg ${meta.bg} flex items-center justify-center shrink-0`}>
                                                <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-black text-slate-800 truncate">{item.description || meta.label}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[10px] text-slate-400 font-bold">{item.actorName}</span>
                                                    <span className="text-[10px] text-slate-300">·</span>
                                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>{item.actorRole}</span>
                                                </div>
                                            </div>
                                            <span className="text-[9px] text-slate-400 font-bold shrink-0 mt-1">
                                                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Visual Analytics Row 1: Revenue + Inventory ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Revenue & Growth Chart */}
                <Card className="lg:col-span-2 border-none shadow-xl bg-white">
                    <CardHeader className="border-b bg-slate-50/50 p-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="text-lg font-black text-slate-800">Revenue Performance</CardTitle>
                                <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest">Platform Earned vs Gross Volume</CardDescription>
                            </div>
                            <BarChart3 className="h-5 w-5 text-indigo-500" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="h-[280px] w-full mt-4">
                            {hasRevenueData ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={revenueTrends?.monthly ?? []}>
                                        <defs>
                                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} tickFormatter={(val) => `₹${val/1000}k`} />
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                                            labelStyle={{ fontWeight: 'black', marginBottom: '4px' }}
                                        />
                                        <Area type="monotone" dataKey="platformEarned" name="Net Revenue" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
                                        <Area type="monotone" dataKey="grossVolume" name="Gross Volume" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 5" fill="transparent" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <ChartEmptyState
                                    icon={TrendingUp}
                                    title="No Revenue Data Yet"
                                    subtitle="Revenue charts will populate once bookings start generating platform fees."
                                />
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Inventory Health */}
                <Card className="border-none shadow-xl bg-white text-slate-800">
                    <CardHeader className="border-b bg-slate-50/50 p-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="text-lg font-black text-slate-800">Inventory Status</CardTitle>
                                <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest">Global Bed Allocation</CardDescription>
                            </div>
                            <PieChartIcon className="h-5 w-5 text-indigo-500" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 flex flex-col items-center">
                        <div className="h-[220px] w-full mt-4">
                            {hasInventoryData ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Occupied', value: safe(snapshot.inventory?.occupied) },
                                                { name: 'Available', value: safe(snapshot.inventory?.available) },
                                                { name: 'Reserved', value: safe(snapshot.inventory?.reserved) },
                                                { name: 'Maintenance', value: safe(snapshot.inventory?.maintenance) },
                                            ].filter(d => d.value > 0)}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={8}
                                            dataKey="value"
                                        >
                                            {COLORS.map((color, index) => (
                                                <Cell key={`cell-${index}`} fill={color} stroke="none" />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <ChartEmptyState
                                    icon={Bed}
                                    title="No Bed Data Yet"
                                    subtitle="Inventory breakdown will appear once rooms and beds are configured."
                                />
                            )}
                        </div>
                        <div className="w-full mt-4 space-y-2">
                            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-dotted">
                                <span className="text-[10px] font-black uppercase text-slate-400">Occupancy Rate</span>
                                <span className="text-sm font-black text-indigo-600">
                                    {safeDiv(snapshot.inventory?.occupied, snapshot.inventory?.beds)}%
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Visual Analytics Row 2: User Growth + Conversion Funnel ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* User Growth Chart */}
                <Card className="border-none shadow-xl bg-white">
                    <CardHeader className="border-b bg-slate-50/50 p-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="text-lg font-black text-slate-800">User Growth</CardTitle>
                                <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest">Students & Owners joining over time</CardDescription>
                            </div>
                            <Users className="h-5 w-5 text-emerald-500" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="h-[260px] w-full mt-2">
                            {hasUserGrowthData ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={userGrowth ?? []}>
                                        <defs>
                                            <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} allowDecimals={false} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                                            labelStyle={{ fontWeight: 'black', marginBottom: '4px' }}
                                        />
                                        <Legend verticalAlign="top" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', paddingBottom: '8px' }} />
                                        <Line type="monotone" dataKey="newStudents" name="Students" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1', stroke: 'white', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                        <Line type="monotone" dataKey="newOwners" name="Owners" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', stroke: 'white', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <ChartEmptyState
                                    icon={UserPlus}
                                    title="No Growth Data Yet"
                                    subtitle="User growth trends will appear as students and owners join the platform."
                                />
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Booking Conversion Funnel */}
                <Card className="border-none shadow-xl bg-white">
                    <CardHeader className="border-b bg-slate-50/50 p-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="text-lg font-black text-slate-800">Booking Funnel</CardTitle>
                                <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest">Requested → Accepted → Confirmed</CardDescription>
                            </div>
                            <Layers className="h-5 w-5 text-amber-500" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="h-[260px] w-full mt-2">
                            {hasConversionData ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={conversionAnalytics ?? []} barCategoryGap="30%">
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} allowDecimals={false} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                                            labelStyle={{ fontWeight: 'black', marginBottom: '4px' }}
                                        />
                                        <Legend verticalAlign="top" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', paddingBottom: '8px' }} />
                                        <Bar dataKey="requested" name="Requested" fill="#e2e8f0" radius={[4,4,0,0]} />
                                        <Bar dataKey="accepted" name="Accepted" fill="#818cf8" radius={[4,4,0,0]} />
                                        <Bar dataKey="confirmed" name="Confirmed" fill="#6366f1" radius={[4,4,0,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <ChartEmptyState
                                    icon={TrendingDown}
                                    title="No Booking Data Yet"
                                    subtitle="Booking conversion funnel will show as guests start making booking requests."
                                />
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Platform Governance Grid ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-none shadow-lg bg-white group hover:shadow-indigo-100 transition-all duration-500">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-indigo-500" />
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Fraud & Security</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-between items-end">
                            <div>
                                <div className="text-2xl font-black text-slate-800">{safe(snapshot.fraud?.open)}</div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Open Fraud Alerts</p>
                            </div>
                            <Button variant="ghost" size="sm" className="h-7 text-[10px] font-black text-indigo-600 hover:bg-indigo-50">Audit Details</Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg bg-white group hover:shadow-emerald-100 transition-all duration-500">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Property Verification</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-between items-end">
                            <div>
                                <div className="text-2xl font-black text-slate-800">{safe(snapshot.properties?.live)}</div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Live Listings</p>
                            </div>
                            <Button variant="ghost" size="sm" className="h-7 text-[10px] font-black text-emerald-600 hover:bg-emerald-50">View Registry</Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg bg-white group hover:shadow-amber-100 transition-all duration-500">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <ArrowUpRight className="h-4 w-4 text-amber-500" />
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">User Base</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-between items-end">
                            <div>
                                <div className="text-2xl font-black text-slate-800">{safe(snapshot.users?.total).toLocaleString()}</div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Total Registered</p>
                            </div>
                            <div className="text-right space-y-1">
                                <div className="text-[9px] font-black text-slate-400">Students: <span className="text-indigo-600">{safe(snapshot.users?.students)}</span></div>
                                <div className="text-[9px] font-black text-slate-400">Owners: <span className="text-emerald-600">{safe(snapshot.users?.owners)}</span></div>
                                <div className="text-[9px] font-black text-slate-400">Admins: <span className="text-purple-600">{safe(snapshot.users?.admins)}</span></div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════════
                ONBOARDED PROPERTIES PANEL
            ══════════════════════════════════════════════════════════════════════════ */}
            <Card className="border-none shadow-2xl bg-white overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-700 p-6 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center border border-white/30">
                                    <Building2 className="h-5 w-5 text-white" />
                                </div>
                                <h2 className="text-xl font-black text-white tracking-tight">Onboarded Properties</h2>
                            </div>
                            <p className="text-indigo-200 text-xs font-bold ml-12 uppercase tracking-widest">
                                All fully registered &amp; live PG, Hostel, Flat listings on RentPe
                            </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="px-4 py-2 bg-white/20 backdrop-blur rounded-xl text-white text-sm font-black border border-white/30">
                                {onboardedProperties.length} Properties Live
                            </span>
                        </div>
                    </div>
                </div>

                <CardContent className="p-6 space-y-6">
                    {/* Controls Row: Type Filter + Property Dropdown */}
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Type Filter Chips */}
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
                    </div>

                    {/* ── DETAIL VIEW: Single Property ── */}
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
                                                    <h3 className="text-xl font-black text-slate-900">{selectedProperty.name}</h3>
                                                    {selectedProperty.isVerified && (
                                                        <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full border border-emerald-200">
                                                            <BadgeCheck className="h-3 w-3" /> Verified
                                                        </span>
                                                    )}
                                                    <span className={`px-2 py-0.5 text-[10px] font-black rounded-full border ${TYPE_COLORS[selectedProperty.propertyType] || TYPE_COLORS.PG}`}>
                                                        {selectedProperty.propertyType || 'PG'}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-black rounded-full border border-slate-200">
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
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Property Owner</p>
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center font-black text-indigo-700 text-lg">
                                                {selectedProperty.owner?.name?.charAt(0)?.toUpperCase() || 'O'}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 text-sm">{selectedProperty.owner?.name || 'N/A'}</p>
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
                                        <div className={`text-xl font-black ${color}`}>{value}</div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Rating + Food */}
                            <div className="flex flex-wrap gap-3">
                                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-xl">
                                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />
                                    <span className="font-black text-yellow-700">{selectedProperty.avgRating || 'N/A'}</span>
                                    <span className="text-xs text-yellow-600">({selectedProperty.reviewCount} reviews)</span>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Food</span>
                                    <span className="text-sm font-black text-slate-700">{selectedProperty.foodType || 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                                    <span className={`h-2 w-2 rounded-full ${selectedProperty.status === 'LIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-500'}`}></span>
                                    <span className="text-sm font-black text-emerald-700">{selectedProperty.status}</span>
                                </div>
                            </div>

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
                                                    <th className="text-center py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedProperty.rooms.map((room: any, idx: number) => (
                                                    <tr key={room.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                                                        <td className="py-3 px-4 font-black text-slate-800">Room {room.roomNumber}</td>
                                                        <td className="py-3 px-4 text-slate-600 font-medium">{room.type}</td>
                                                        <td className="py-3 px-4 text-right font-black text-indigo-600">₹{(room.price || 0).toLocaleString('en-IN')}</td>
                                                        <td className="py-3 px-4 text-right font-bold text-slate-600">{room.totalBeds || room.availability}</td>
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
                                    <h3 className="text-lg font-black text-slate-500">No Onboarded Properties</h3>
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

                                                {/* Metrics grid */}
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div className="text-center bg-indigo-50 rounded-xl py-2">
                                                        <div className="text-lg font-black text-indigo-600">{prop.totalBeds}</div>
                                                        <div className="text-[9px] font-bold text-indigo-400 uppercase">Beds</div>
                                                    </div>
                                                    <div className="text-center bg-emerald-50 rounded-xl py-2">
                                                        <div className="text-lg font-black text-emerald-600">{prop.activeTenants}</div>
                                                        <div className="text-[9px] font-bold text-emerald-400 uppercase">Tenants</div>
                                                    </div>
                                                    <div className="text-center bg-amber-50 rounded-xl py-2">
                                                        <div className="text-lg font-black text-amber-600">{prop.availableBeds}</div>
                                                        <div className="text-[9px] font-bold text-amber-400 uppercase">Vacant</div>
                                                    </div>
                                                </div>

                                                {/* Revenue + Rating row */}
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
                                                        <span className={`h-2 w-2 rounded-full ${prop.status === 'LIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-500'}`}></span>
                                                        <span className="text-[10px] font-black text-slate-500">{prop.status}</span>
                                                    </div>
                                                </div>

                                                {/* Owner row */}
                                                <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                                                    <div className="h-6 w-6 rounded-lg bg-slate-100 flex items-center justify-center font-black text-slate-600 text-xs shrink-0">
                                                        {prop.owner?.name?.charAt(0)?.toUpperCase() || 'O'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-slate-600 truncate">{prop.owner?.name || 'Unknown Owner'}</p>
                                                    </div>
                                                    <Badge className="text-[9px] font-black bg-slate-100 text-slate-500 hover:bg-slate-100 border-none">Owner</Badge>
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
        </div>
    );
}
