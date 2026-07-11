"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
    Building, Users, IndianRupee, RefreshCcw, TrendingUp, 
    User, Shield, Mail, Phone, Calendar, CheckCircle, Bed, 
    ListFilter, Activity, CreditCard, UserCheck, Lock,
    AlertCircle, DoorOpen, BarChart3, Bell, Check
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";

import { getOwnerDashboardStats, getOwnerInventory } from "@/actions/dashboard";
import { getOwnerStaff } from "@/actions/staff";
import { getNotifications, getUnreadCount, markNotificationRead } from "@/actions/notifications";
import { InventoryGrid } from "@/components/dashboard/InventoryGrid";
import { TenantLifecycleManager } from "@/components/dashboard/TenantLifecycleManager";
import { OwnerPropertyPanel } from "@/components/dashboard/OwnerPropertyPanel";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar } from "recharts";

const COLORS = ['#8b5cf6', '#e2e8f0'];
const PIE_COLORS = ['#6366f1', '#e2e8f0', '#f59e0b'];

const TABS = [
    { id: "overview", label: "Overview", icon: TrendingUp },
    { id: "inventory", label: "Bed Management", icon: Bed },
    { id: "ops", label: "Operations", icon: Activity },
    { id: "profile", label: "Profile", icon: User },
    { id: "notifications", label: "Update Notifications", icon: Bell }
];

export default function OwnerDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [inventory, setInventory] = useState<any[]>([]);
    const [staffTeam, setStaffTeam] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const searchParams = useSearchParams();
    const router = useRouter();
    const activeTab = searchParams.get("tab") || "overview";

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const [statsData, inventoryData, staffData, notifs, count] = await Promise.all([
                getOwnerDashboardStats(),
                getOwnerInventory(),
                getOwnerStaff().catch(() => []),
                getNotifications('OWNER').catch(() => []),
                getUnreadCount('OWNER').catch(() => 0)
            ]);

            if (!statsData || (statsData as any).error === "Unauthorized") {
                router.push("/login");
                return;
            }
            setStats(statsData);
            setInventory(inventoryData);
            setStaffTeam(staffData || []);
            setNotifications(notifs.filter((n: any) => n.category !== 'TOKEN' && !n.message?.toLowerCase().includes('pay token')));
            setUnreadCount(count);
        } catch (e) {
            console.error(e);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleMarkRead = async (id: string) => {
        try {
            await markNotificationRead(id);
            setUnreadCount(prev => Math.max(0, prev - 1));
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (e) { }
    };

    const formatTime = (date: string) => {
        const d = new Date(date);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return d.toLocaleDateString();
    };

    const handleTabChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", value);
        router.push(`?${params.toString()}`);
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 space-y-6">
            <div className="w-16 h-16 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
            <div className="space-y-2 text-center">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Syncing Business Data</h3>
                <p className="text-sm text-slate-400 font-medium">Retrieving your properties, tenants, and revenue metrics...</p>
            </div>
        </div>
    );

    if (error || !stats) return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-red-500/10">
                <Shield className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-2">Access Synchronization Failed</h2>
            <p className="text-slate-500 max-w-md mb-8 font-medium">We encountered a secure handshake issue while retrieving your data. Please re-authenticate to restore full access.</p>
            <div className="flex gap-4">
                <Button 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-8 h-12 rounded-2xl shadow-lg shadow-indigo-200 uppercase tracking-tight"
                    onClick={() => router.push("/login")}
                >
                    Re-Authenticate
                </Button>
                <Button 
                    variant="outline" 
                    className="border-slate-200 text-slate-600 font-bold px-8 h-12 rounded-2xl"
                    onClick={fetchStats}
                >
                    Retry Connection
                </Button>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 pb-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Owner Dashboard</h1>
                    <p className="text-muted-foreground">Welcome back, here&apos;s what&apos;s happening today.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchStats}>
                        <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <div className="flex gap-0 bg-slate-100 p-1.5 rounded-2xl w-full mt-4 mb-8">
                    {TABS.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => handleTabChange(id)}
                            className={`flex flex-1 items-center justify-center gap-2 px-4 py-3.5
                                text-sm font-bold rounded-xl transition-all whitespace-nowrap
                                relative
                                ${activeTab === id
                                  ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-200 scale-[1.02]"
                                  : "text-slate-600 hover:bg-slate-200 hover:text-slate-800"
                                }`}
                        >
                            <div className="relative flex items-center">
                                <Icon className="h-5 w-5 mr-2 hidden sm:inline-block" /> 
                                {label}
                                {id === "notifications" && unreadCount > 0 && (
                                    <span className="absolute -top-3 -right-6 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse shadow-sm shadow-red-500/50">
                                        {unreadCount > 9 ? "9+" : unreadCount}
                                    </span>
                                )}
                            </div>
                            {/* Separator line — hide on active and last tab */}
                            {activeTab !== id && id !== TABS[TABS.length - 1].id && (
                              <span className="absolute right-0 top-[20%] h-[60%] w-px bg-slate-300" />
                            )}
                        </button>
                    ))}
                </div>

                <TabsContent value="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* ── KPI Cards ── */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                        <Card className="xl:col-span-1 bg-gradient-to-br from-violet-600 to-violet-800 border-l-4 border-l-violet-300 text-white">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xs font-black uppercase tracking-widest text-white/70">Total Revenue</CardTitle>
                                <div className="h-8 w-8 bg-white/10 rounded-lg flex items-center justify-center">
                                    <IndianRupee className="h-4 w-4 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-white">₹{(stats.totalRevenue ?? 0).toLocaleString('en-IN')}</div>
                                <p className="text-xs mt-1 flex items-center gap-1 text-white/70 font-bold">
                                    <TrendingUp className="h-3 w-3" /> Rent only · Excl. deposits
                                </p>
                            </CardContent>
                        </Card>

                        {/* ── Deposits Held — Liability (CA/GST Compliant) ── */}
                        <Card className="xl:col-span-1 bg-gradient-to-br from-orange-600 to-orange-800 border-l-4 border-l-orange-300 text-white">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xs font-black uppercase tracking-widest text-white/70">Deposits Held</CardTitle>
                                <div className="h-8 w-8 bg-white/10 rounded-lg flex items-center justify-center">
                                    <Lock className="h-4 w-4 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-white">₹{(stats.totalDepositsHeld ?? 0).toLocaleString('en-IN')}</div>
                                <p className="text-xs mt-1 text-white/70 font-bold flex items-center gap-1">
                                    <Shield className="h-3 w-3" /> Refundable liability
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="xl:col-span-1 bg-gradient-to-br from-teal-600 to-teal-700 border-l-4 border-l-teal-300 text-white">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xs font-black uppercase tracking-widest text-white/70">Active Tenants</CardTitle>
                                <div className="h-8 w-8 bg-white/10 rounded-lg flex items-center justify-center">
                                    <Users className="h-4 w-4 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-white">{stats.tenantCount ?? 0}</div>
                                <p className="text-xs mt-1 text-white/70 font-bold">Across all properties</p>
                            </CardContent>
                        </Card>

                        <Card className="xl:col-span-1 bg-gradient-to-br from-violet-600 to-indigo-700 border-l-4 border-l-violet-300 text-white">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xs font-black uppercase tracking-widest text-white/70">Properties</CardTitle>
                                <div className="h-8 w-8 bg-white/10 rounded-lg flex items-center justify-center">
                                    <Building className="h-4 w-4 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-white">{stats.propertyCount ?? 0}</div>
                                <p className="text-xs mt-1 text-white/70 font-bold">Active listings</p>
                            </CardContent>
                        </Card>

                        <Card className="xl:col-span-1 bg-gradient-to-br from-blue-600 to-blue-800 border-l-4 border-l-blue-300 text-white">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xs font-black uppercase tracking-widest text-white/70">Vacant Beds</CardTitle>
                                <div className="h-8 w-8 bg-white/10 rounded-lg flex items-center justify-center">
                                    <DoorOpen className="h-4 w-4 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-white">{stats.availableBeds ?? 0}</div>
                                <p className="text-xs mt-1 text-white/70 font-bold">of {stats.totalBeds ?? 0} total beds</p>
                            </CardContent>
                        </Card>

                        <Card className="xl:col-span-1 bg-gradient-to-br from-slate-600 to-slate-700 border-l-4 border-l-slate-400 text-white">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xs font-black uppercase tracking-widest text-white/70">Pending</CardTitle>
                                <div className="h-8 w-8 bg-white/10 rounded-lg flex items-center justify-center">
                                    <AlertCircle className="h-4 w-4 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-white">
                                    {stats.pendingBookingCount ?? 0}
                                </div>
                                <p className="text-xs mt-1 text-white/70 font-bold">Booking requests</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Charts ── */}
                    <div className="grid gap-6 md:grid-cols-3">
                        {/* Revenue Trend Chart */}
                        <Card className="md:col-span-2 hover:shadow-lg transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div>
                                    <CardTitle className="text-base font-black">Revenue Trends</CardTitle>
                                    <p className="text-xs text-slate-400 font-bold mt-0.5">Last 6 months · Confirmed bookings</p>
                                </div>
                                <BarChart3 className="h-5 w-5 text-slate-300" />
                            </CardHeader>
                            <CardContent>
                                {(stats.revenueHistory ?? []).every((r: any) => r.revenue === 0) ? (
                                    <div className="h-[240px] flex flex-col items-center justify-center gap-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <BarChart3 className="h-10 w-10 text-slate-200" />
                                        <p className="text-sm font-black text-slate-400">No revenue recorded yet</p>
                                        <p className="text-xs text-slate-300">Revenue appears here once bookings are confirmed & paid</p>
                                    </div>
                                ) : (
                                    <div className="h-[240px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={stats.revenueHistory ?? []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.3}/>
                                                        <stop offset="100%" stopColor="#10b981" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                                                <XAxis dataKey="month" axisLine={false} tickLine={false} tickMargin={10} tick={{ fontSize: 12, fontWeight: 700 }} />
                                                <YAxis axisLine={false} tickLine={false} tickMargin={10} tick={{ fontSize: 11 }} tickFormatter={(val) => val >= 1000 ? `₹${(val/1000).toFixed(0)}k` : `₹${val}`} />
                                                <Tooltip
                                                    formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']}
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontWeight: 700 }}
                                                />
                                                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#tealGradient)" dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Occupancy Donut */}
                        <Card className="hover:shadow-lg transition-shadow">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-black">Occupancy</CardTitle>
                                <p className="text-xs text-slate-400 font-bold">
                                    {stats.totalBeds ?? 0} total beds
                                </p>
                            </CardHeader>
                            <CardContent className="flex flex-col items-center justify-center">
                                {(stats.totalBeds ?? 0) === 0 ? (
                                    <div className="h-[200px] flex flex-col items-center justify-center gap-3 w-full bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <Bed className="h-10 w-10 text-slate-200" />
                                        <p className="text-sm font-black text-slate-400">No beds configured</p>
                                        <p className="text-xs text-slate-300 text-center">Add rooms & beds to see occupancy</p>
                                    </div>
                                ) : (
                                    <div className="relative h-[200px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={stats.occupancyStats ?? []}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={58}
                                                    outerRadius={80}
                                                    paddingAngle={3}
                                                    dataKey="value"
                                                    startAngle={90}
                                                    endAngle={-270}
                                                >
                                                    {(stats.occupancyStats ?? []).map((entry: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} strokeWidth={0} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    formatter={(value: any, name: any) => [value, name]}
                                                    contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontWeight: 700 }}
                                                />
                                                <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8}
                                                    formatter={(value) => <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{value}</span>}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        {/* Center label */}
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingBottom: 36 }}>
                                            <span className="text-2xl font-bold text-violet-600">
                                                {stats.totalBeds > 0 ? Math.round(((stats.occupiedBeds ?? 0) / stats.totalBeds) * 100) : 0}%
                                            </span>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Occupied</span>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Property Panel — full property overview with filters */}
                    <OwnerPropertyPanel userRole="OWNER" />

                    {/* Activity Log Link */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 border rounded-xl">
                        <p className="text-sm font-bold text-slate-600">View full activity history in Activity Log</p>
                        <Link href="/dashboard/owner/activity-log">
                            <Button variant="outline" size="sm">Activity Log →</Button>
                        </Link>
                    </div>
                </TabsContent>

                <TabsContent value="inventory" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <InventoryGrid properties={inventory} />
                </TabsContent>

                <TabsContent value="ops" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <TenantLifecycleManager ownerId={stats.user.id} />
                </TabsContent>

                <TabsContent value="profile" className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                    {/* Owner Profile Card */}
                    <Card className="border-none shadow-xl overflow-hidden bg-gradient-to-br from-white to-blue-50/30">
                        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-8 text-white">
                            <div className="flex flex-col md:flex-row items-center gap-6">
                                <div className="h-24 w-24 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-2xl">
                                    <Building className="h-12 w-12 text-white" />
                                </div>
                                <div className="text-center md:text-left flex-1">
                                    <h2 className="text-3xl font-black tracking-tight">{stats.user?.name || "Verified Business Partner"}</h2>
                                    <div className="flex flex-col md:flex-row items-center md:justify-start gap-2 mt-2">
                                        <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold border border-white/30 uppercase tracking-widest">
                                            {stats.user?.displayId || "OWNER"}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
                                            <span className="text-xs font-bold text-blue-100 uppercase tracking-tighter">Verified Partner</span>
                                        </div>
                                    </div>
                                    {/* Owner Access Chips */}
                                    <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                                        <span className="text-[10px] font-black bg-white/10 px-2 py-0.5 rounded border border-white/10">Property Management</span>
                                        <span className="text-[10px] font-black bg-white/10 px-2 py-0.5 rounded border border-white/10">Tenant Lifecycle</span>
                                        <span className="text-[10px] font-black bg-white/10 px-2 py-0.5 rounded border border-white/10">Revenue Tracking</span>
                                        <span className="text-[10px] font-black bg-white/10 px-2 py-0.5 rounded border border-white/10">Inventory Control</span>
                                        <span className="text-[10px] font-black bg-white/10 px-2 py-0.5 rounded border border-white/10">Ticket Management</span>
                                        {staffTeam.filter(s => s.status === 'ACTIVE').length > 0 && (
                                            <span className="text-[10px] font-black bg-emerald-400/20 px-2 py-0.5 rounded border border-emerald-300/30">
                                                Team: {staffTeam.filter(s => s.status === 'ACTIVE').length} Active Member{staffTeam.filter(s => s.status === 'ACTIVE').length > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <CardContent className="p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <h3 className="text-sm font-black text-blue-900/40 uppercase tracking-[0.2em]">Contact Information</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-blue-100 shadow-sm group hover:border-blue-300 transition-all">
                                            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                                                <Mail className="h-5 w-5 text-blue-600 group-hover:text-white" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Business Email</p>
                                                <p className="text-sm font-bold text-blue-900">{stats.user?.email || "partner@rentpe.com"}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-blue-100 shadow-sm group hover:border-blue-300 transition-all">
                                            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                                                <Phone className="h-5 w-5 text-blue-600 group-hover:text-white" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Registered Phone</p>
                                                <p className="text-sm font-bold text-blue-900">{stats.user?.phone || "+91 99999 99999"}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h3 className="text-sm font-black text-blue-900/40 uppercase tracking-[0.2em]">Partner Stats</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-blue-100 shadow-sm group hover:border-blue-300 transition-all">
                                            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                                                <Calendar className="h-5 w-5 text-blue-600 group-hover:text-white" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Partner Since</p>
                                                <p className="text-sm font-bold text-blue-900">
                                                    {stats.user?.createdAt ? new Date(stats.user.createdAt).toLocaleString('en-IN', { 
                                                        day: '2-digit', month: 'long', year: 'numeric', 
                                                        hour: '2-digit', minute: '2-digit', hour12: true 
                                                    }) : "January 2024"}
                                                </p>
                                            </div>
                                        </div>



                                        <div className="p-4 border-2 border-emerald-200 bg-emerald-50 rounded-xl flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-emerald-200 flex items-center justify-center">
                                                    <CheckCircle className="h-6 w-6 text-emerald-700" />
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-bold text-emerald-700 uppercase">Partner Status</div>
                                                    <div className="text-sm font-black text-emerald-800 tracking-tight">VERIFIED KYC</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── Security & Password ── */}
                            <div className="mt-8 pt-8 border-t border-slate-100">
                                <div className="p-8 bg-white border-2 border-slate-100 rounded-[32px] shadow-sm">
                                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                                        <div className="flex items-start gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                                                <Lock className="h-6 w-6 text-blue-600" />
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-black text-slate-800">Security & Account Access</h4>
                                                <p className="text-sm text-slate-500 font-medium">Protect your business account and manage staff access keys.</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2 w-full md:w-auto">
                                            <Button
                                                variant="outline"
                                                className="w-full md:w-auto border-2 border-blue-100 text-blue-700 font-black h-12 px-8 rounded-2xl hover:bg-blue-50 transition-all uppercase tracking-tight text-[11px]"
                                                onClick={() => {
                                                    import("sonner").then(({ toast }) => {
                                                        toast("Send password reset link?", {
                                                            description: "A secure link will be sent to your registered business email.",
                                                            action: {
                                                                label: "Send Link",
                                                                onClick: async () => {
                                                                    const { forgotPassword } = await import("@/actions/auth");
                                                                    const formData = new FormData();
                                                                    formData.append('email', stats.user?.email || "");
                                                                    const toastId = toast.loading("Sending secure reset link...");
                                                                    const result = await forgotPassword(formData);
                                                                    if (result.success) {
                                                                        toast.success("Reset link sent! Check your email.", { id: toastId });
                                                                    } else {
                                                                        toast.error(result.error || "Failed to send reset link.", { id: toastId });
                                                                    }
                                                                }
                                                            }
                                                        });
                                                    });
                                                }}
                                            >
                                                Change Password →
                                            </Button>
                                            <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest">
                                                Secure token sent via email
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Owner Team Section — Live, updates when staff roles change */}
                    <Card className="border-none shadow-lg">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg font-black flex items-center gap-2">
                                        <Users className="h-5 w-5 text-blue-600" /> My Team
                                    </CardTitle>
                                    <p className="text-xs text-muted-foreground mt-1">All active staff and their system access roles</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/owner/staff')} className="text-xs">
                                    Manage Team
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {staffTeam.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Users className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm">No team members yet.</p>
                                    <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push('/dashboard/owner/staff')}>
                                        Add Staff Member
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {staffTeam.map((member) => {
                                        const permissions: string[] = (() => { try { return JSON.parse(member.permissions || '[]'); } catch { return []; } })();
                                        const isActive = member.status === 'ACTIVE';
                                        return (
                                            <div key={member.id} className={`p-5 rounded-2xl border transition-all ${
                                                isActive ? 'bg-white border-blue-100 shadow-sm hover:shadow-md hover:border-blue-300' : 'bg-gray-50 border-gray-100 opacity-60'
                                            }`}>
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center font-black text-lg ${
                                                            isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'
                                                        }`}>
                                                            {member.name?.charAt(0)?.toUpperCase() || '?'}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-slate-800">{member.name}</p>
                                                            <p className="text-xs text-muted-foreground font-medium">{member.designation}</p>
                                                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{member.displayId}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ${
                                                        isActive ? 'bg-emerald-100 text-emerald-700' :
                                                        member.status === 'BLOCKED' ? 'bg-red-100 text-red-700' :
                                                        'bg-gray-100 text-gray-600'
                                                    }`}>{member.status}</span>
                                                </div>

                                                {/* Permissions chips */}
                                                {permissions.length > 0 ? (
                                                    <div className="mt-4">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                                            <Lock className="h-3 w-3" /> System Access
                                                        </p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {permissions.map((perm: string) => (
                                                                <span key={perm} className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                                                    isActive ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-gray-100 text-gray-500 border-gray-200'
                                                                }`}>
                                                                    {perm}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                                                        <UserCheck className="h-3 w-3" /> No specific permissions assigned
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="notifications" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Card className="border-none shadow-xl overflow-hidden bg-white">
                        <CardHeader className="border-b bg-slate-50/50 pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-xl font-black flex items-center gap-2 text-slate-800">
                                        <Bell className="h-6 w-6 text-indigo-600" /> Notifications & Updates
                                    </CardTitle>
                                    <p className="text-sm text-slate-500 font-medium mt-1">
                                        Stay updated on property changes, payments, and system alerts.
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {notifications.length === 0 ? (
                                <div className="p-16 text-center text-slate-400">
                                    <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                    <h3 className="text-lg font-bold text-slate-600">You're all caught up!</h3>
                                    <p className="text-sm">No new notifications at this time.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                                    {notifications.map((n) => {
                                        const isSystem = n.type === 'SYSTEM' || n.category?.includes('SYSTEM');
                                        const isPayment = n.type === 'PAYMENT' || n.category?.includes('PAYMENT');
                                        const rowBg = !n.isRead
                                            ? isSystem ? 'bg-red-50 border-l-4 border-l-red-500'
                                            : isPayment ? 'bg-green-50 border-l-4 border-l-green-500'
                                            : 'bg-indigo-50 border-l-4 border-l-indigo-500'
                                            : 'hover:bg-slate-50 border-l-4 border-l-transparent';
                                        
                                        const badgeCls = isSystem
                                            ? 'bg-red-100 text-red-700 border-red-200'
                                            : isPayment ? 'bg-green-100 text-green-700 border-green-200'
                                            : 'bg-indigo-100 text-indigo-700 border-indigo-200';
                                            
                                        const textCls = !n.isRead ? 'font-bold text-slate-900' : 'text-slate-600 font-medium';

                                        return (
                                            <div
                                                key={n.id}
                                                onClick={() => !n.isRead && handleMarkRead(n.id)}
                                                className={`p-5 transition-all cursor-pointer ${rowBg} ${!n.isRead ? 'shadow-sm z-10 relative' : ''}`}
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                                                            <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-black tracking-widest border ${badgeCls}`}>
                                                                {n.category || n.type}
                                                            </span>
                                                            <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                                                                <Calendar className="h-3 w-3" /> {formatTime(n.createdAt)}
                                                            </span>
                                                        </div>
                                                        <p className={`text-base leading-snug ${textCls}`}>{n.message}</p>
                                                    </div>
                                                    {!n.isRead && (
                                                        <button 
                                                            className="shrink-0 h-8 w-8 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                                                            title="Mark as read"
                                                        >
                                                            <Check className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

