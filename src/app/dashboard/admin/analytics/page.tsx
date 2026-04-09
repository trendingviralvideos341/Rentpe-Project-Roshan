"use client";

import { useState, useEffect, useCallback } from "react";
import { getAdminAnalytics } from "@/actions/adminPhase2";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend } from "recharts";
import { BarChart3, Users, Building2, TrendingUp, Ticket, MessageSquareWarning, RefreshCcw, Calendar } from "lucide-react";
import { toast } from "sonner";

const DAY_OPTIONS = [
    { key: 7, label: "7D" },
    { key: 14, label: "14D" },
    { key: 30, label: "30D" },
    { key: 60, label: "60D" },
    { key: 90, label: "90D" },
];

const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16"];

export default function AnalyticsPage() {
    const [data, setData] = useState<any>(null);
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getAdminAnalytics(days);
            setData(result);
        } catch { toast.error("Failed to load analytics"); }
        finally { setLoading(false); }
    }, [days]);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) {
        return (
            <div className="space-y-4 pb-20">
                <div className="h-10 bg-slate-100 rounded-xl w-64 animate-pulse" />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />)}
                </div>
                <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
                <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
            </div>
        );
    }

    const s = data?.summary || {};

    return (
        <div className="space-y-4 md:space-y-6 pb-20 md:pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
                        <BarChart3 className="h-7 w-7 text-indigo-600" /> Platform Analytics
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Real-time platform performance and growth metrics</p>
                </div>
                <div className="flex gap-2">
                    {/* Day Range Selector */}
                    <div className="flex bg-white border rounded-xl overflow-hidden">
                        {DAY_OPTIONS.map(opt => (
                            <button key={opt.key} onClick={() => setDays(opt.key)}
                                className={`px-3 py-2 text-xs font-bold transition-colors ${days === opt.key ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <button onClick={fetchData} className="p-2 border rounded-xl hover:bg-slate-50">
                        <RefreshCcw className="h-4 w-4 text-slate-500" />
                    </button>
                </div>
            </div>

            {/* KPI Summary Cards - 2x3 mobile, 3x2 or 6 cols desktop */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                {[
                    { label: "Total Users", value: s.totalUsers?.toLocaleString(), icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
                    { label: "Live Properties", value: `${s.liveProperties} / ${s.totalProperties}`, icon: Building2, color: "text-green-600", bg: "bg-green-50" },
                    { label: `New Users (${days}d)`, value: s.newUsersThisPeriod, icon: TrendingUp, color: "text-violet-600", bg: "bg-violet-50" },
                    { label: `New Bookings (${days}d)`, value: s.newBookingsThisPeriod, icon: Calendar, color: "text-amber-600", bg: "bg-amber-50" },
                    { label: "Open Tickets", value: s.openTickets, icon: Ticket, color: "text-orange-600", bg: "bg-orange-50" },
                    { label: "Open Disputes", value: s.openDisputes, icon: MessageSquareWarning, color: "text-red-600", bg: "bg-red-50" },
                ].map(card => {
                    const Icon = card.icon;
                    return (
                        <Card key={card.label} className="border-0 shadow-sm">
                            <CardContent className="p-4">
                                <div className={`w-9 h-9 ${card.bg} rounded-xl flex items-center justify-center mb-3`}>
                                    <Icon className={`h-5 w-5 ${card.color}`} />
                                </div>
                                <p className="text-2xl font-black text-slate-900">{card.value ?? "—"}</p>
                                <p className="text-xs text-muted-foreground font-medium mt-0.5">{card.label}</p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* User Growth Chart */}
            <Card className="border-0 shadow-sm">
                <CardContent className="p-4 md:p-6">
                    <h2 className="font-bold text-slate-800 mb-4">👥 User Registrations (Daily)</h2>
                    <div className="h-48 md:h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data?.daily} margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
                                <defs>
                                    <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorOwners" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                                <Tooltip formatter={(v, n) => [v, n === 'newStudents' ? 'Students' : 'Owners']} labelFormatter={l => `Date: ${l}`} />
                                <Area type="monotone" dataKey="newStudents" stroke="#6366f1" strokeWidth={2} fill="url(#colorStudents)" name="Students" />
                                <Area type="monotone" dataKey="newOwners" stroke="#10b981" strokeWidth={2} fill="url(#colorOwners)" name="Owners" />
                                <Legend formatter={v => v === 'newStudents' ? 'Students' : 'Owners'} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Bookings & Revenue Chart */}
            <Card className="border-0 shadow-sm">
                <CardContent className="p-4 md:p-6">
                    <h2 className="font-bold text-slate-800 mb-4">📅 Daily Bookings</h2>
                    <div className="h-48 md:h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.daily} margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                                <Tooltip labelFormatter={l => `Date: ${l}`} />
                                <Bar dataKey="bookings" fill="#6366f1" radius={[4, 4, 0, 0]} name="Bookings" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Property Registrations + Top Cities — 2 col on desktop */}
            <div className="grid md:grid-cols-2 gap-4">
                <Card className="border-0 shadow-sm">
                    <CardContent className="p-4 md:p-6">
                        <h2 className="font-bold text-slate-800 mb-4">🏠 New Properties (Daily)</h2>
                        <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data?.daily} margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                                    <Tooltip labelFormatter={l => `Date: ${l}`} />
                                    <Line type="monotone" dataKey="properties" stroke="#10b981" strokeWidth={2} dot={false} name="Properties" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                    <CardContent className="p-4 md:p-6">
                        <h2 className="font-bold text-slate-800 mb-4">📍 Top Cities (New Listings)</h2>
                        {data?.topCities?.length === 0 ? (
                            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No city data for this period</div>
                        ) : (
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={data?.topCities} dataKey="count" nameKey="city" cx="50%" cy="50%" outerRadius={80} label={({ city, percent }) => `${city} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                            {data?.topCities?.map((_: any, index: number) => (
                                                <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
