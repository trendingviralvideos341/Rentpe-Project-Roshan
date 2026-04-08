"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
    Building, Users, IndianRupee, Clock, RefreshCcw, TrendingUp, 
    User, Shield, Mail, Phone, Calendar, CheckCircle, Bed, 
    ListFilter, Activity, CreditCard, UserCheck, Lock 
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { getOwnerDashboardStats, getOwnerInventory } from "@/actions/dashboard";
import { getOwnerStaff } from "@/actions/staff";
import { InventoryGrid } from "@/components/dashboard/InventoryGrid";
import { TenantLifecycleManager } from "@/components/dashboard/TenantLifecycleManager";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ['#8b5cf6', '#e2e8f0'];

export default function OwnerDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [inventory, setInventory] = useState<any[]>([]);
    const [staffTeam, setStaffTeam] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const searchParams = useSearchParams();
    const router = useRouter();
    const activeTab = searchParams.get("tab") || "overview";

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const [statsData, inventoryData, staffData] = await Promise.all([
                getOwnerDashboardStats(),
                getOwnerInventory(),
                getOwnerStaff().catch(() => [])
            ]);

            if (!statsData || (statsData as any).error === "Unauthorized") {
                router.push("/login");
                return;
            }
            setStats(statsData);
            setInventory(inventoryData);
            setStaffTeam(staffData || []);
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
        <div className="space-y-8 pb-8">
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
                <TabsList className="flex flex-wrap h-auto w-full max-w-2xl mb-8 p-1.5 bg-slate-100/80 rounded-2xl border shadow-inner">
                    <TabsTrigger
                        value="overview"
                        className="flex-1 font-bold py-3 text-sm whitespace-nowrap"
                    >
                        <TrendingUp className="h-4 w-4 mr-2" /> Overview
                    </TabsTrigger>
                    <TabsTrigger
                        value="inventory"
                        className="flex-1 font-bold py-3 text-sm whitespace-nowrap"
                    >
                        <Bed className="h-4 w-4 mr-2" /> Bed Management
                    </TabsTrigger>
                    <TabsTrigger
                        value="ops"
                        className="flex-1 font-bold py-3 text-sm whitespace-nowrap"
                    >
                        <Activity className="h-4 w-4 mr-2" /> Operations
                    </TabsTrigger>
                    <TabsTrigger
                        value="profile"
                        className="flex-1 font-bold py-3 text-sm whitespace-nowrap"
                    >
                        <User className="h-4 w-4 mr-2" /> Profile
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Stats Grid */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                                <IndianRupee className="h-4 w-4 text-emerald-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">₹{stats.totalRevenue.toLocaleString('en-IN')}</div>
                                <p className="text-xs text-muted-foreground mt-1 flex items-center text-emerald-600">
                                    <TrendingUp className="h-3 w-3 mr-1" /> +12% from last month
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Active Tenants</CardTitle>
                                <Users className="h-4 w-4 text-blue-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">+{stats.tenantCount}</div>
                                <p className="text-xs text-muted-foreground mt-1">Across all your properties</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Properties Listed</CardTitle>
                                <Building className="h-4 w-4 text-purple-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.propertyCount}</div>
                                <p className="text-xs text-muted-foreground mt-1">Active property listings</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts Section */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle>Revenue Trends</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[250px] w-full mt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={stats.revenueHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                                            <XAxis dataKey="month" axisLine={false} tickLine={false} tickMargin={10} />
                                            <YAxis axisLine={false} tickLine={false} tickMargin={10} tickFormatter={(val) => `₹${val / 1000}k`} />
                                            <Tooltip
                                                formatter={(value: any) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            />
                                            <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Occupancy Rate</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col items-center justify-center">
                                <div className="h-[200px] w-full mt-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={stats.occupancyStats}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {stats.occupancyStats.map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Recent Activity */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Activity Log</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {stats.recentActivity.length === 0 ? (
                                <p className="text-muted-foreground text-center py-4">No recent activity found.</p>
                            ) : (
                                <div className="space-y-3">
                                    {stats.recentActivity.map((log: any) => (
                                        <div key={log.id} className="flex items-start gap-4 p-4 rounded-lg border bg-muted/5 hover:bg-muted/10 transition-colors z-10">
                                            <div className="p-2 bg-primary/10 rounded-full mt-0.5 shrink-0">
                                                <Clock className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <p className="text-sm font-bold">{log.actionType?.replace(/_/g, ' ') || 'ACTION'}</p>
                                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                                                        {new Date(log.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground uppercase mt-0.5">{log.entityType}</p>
                                                {log.description && (
                                                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                                                        <span className="text-[10px] font-bold text-amber-700 uppercase">📝 Notes: </span>
                                                        <span className="text-xs text-amber-900">{log.description}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
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

                                        <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center justify-between group hover:bg-indigo-50 transition-colors">
                                            <div>
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Loyalty Points</p>
                                                <p className="text-xl font-black text-indigo-700">{stats.user?.loyaltyPoints || 0} Points</p>
                                            </div>
                                            <CreditCard className="h-8 w-8 text-indigo-200 group-hover:text-indigo-400 transition-colors" />
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
                                                onClick={async () => {
                                                    const confirmReset = window.confirm("We will send a secure password reset link to your registered business email. Proceed?");
                                                    if (!confirmReset) return;
                                                    const { forgotPassword } = await import("@/actions/auth");
                                                    const { toast } = await import("sonner");
                                                    const formData = new FormData();
                                                    formData.append('email', stats.user?.email || "");
                                                    const toastId = toast.loading("Sending secure reset link...");
                                                    const result = await forgotPassword(formData);
                                                    if (result.success) {
                                                        toast.success("Reset link sent! Please check your email.", { id: toastId });
                                                    } else {
                                                        toast.error(result.error || "Failed to send reset link.", { id: toastId });
                                                    }
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
            </Tabs>
        </div>
    );
}

