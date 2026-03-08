"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, Users, IndianRupee, Clock, RefreshCcw, TrendingUp } from "lucide-react";
import { getOwnerDashboardStats } from "@/actions/dashboard";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ['#8b5cf6', '#e2e8f0'];

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams, useRouter } from "next/navigation";
import { User, Shield, Mail, Phone, Calendar, CheckCircle, Bed, ListFilter, Activity } from "lucide-react";
import { InventoryGrid } from "@/components/dashboard/InventoryGrid";
import { TenantLifecycleManager } from "@/components/dashboard/TenantLifecycleManager";
import { getOwnerInventory } from "@/actions/dashboard";

export default function OwnerDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [inventory, setInventory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const searchParams = useSearchParams();
    const router = useRouter();
    const activeTab = searchParams.get("tab") || "overview";

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const [statsData, inventoryData] = await Promise.all([
                getOwnerDashboardStats(),
                getOwnerInventory()
            ]);

            if (!statsData || (statsData as any).error === "Unauthorized") {
                window.location.href = "/login";
                return;
            }
            setStats(statsData);
            setInventory(inventoryData);
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

    if (loading) return <div className="p-20 text-center animate-pulse">Loading dashboard statistics...</div>;

    if (error || !stats) return (
        <div className="p-8 text-center text-red-500">
            <p>Failed to load dashboard statistics. Please ensure you are logged in as an Owner.</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.href = "/login"}>Login Again</Button>
            <Button variant="ghost" className="mt-4 ml-2" onClick={fetchStats}>Retry</Button>
        </div>
    );

    return (
        <div className="space-y-8 pb-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Owner Dashboard</h1>
                    <p className="text-muted-foreground">Welcome back, here's what's happening today.</p>
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
                        className="flex-1 rounded-xl data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-600 hover:text-indigo-700 hover:bg-white/50 data-[state=active]:shadow-md transition-all font-bold py-3 text-sm whitespace-nowrap"
                    >
                        <TrendingUp className="h-4 w-4 mr-2" /> Overview
                    </TabsTrigger>
                    <TabsTrigger
                        value="inventory"
                        className="flex-1 rounded-xl data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-600 hover:text-indigo-700 hover:bg-white/50 data-[state=active]:shadow-md transition-all font-bold py-3 text-sm whitespace-nowrap"
                    >
                        <Bed className="h-4 w-4 mr-2" /> Inventory
                    </TabsTrigger>
                    <TabsTrigger
                        value="ops"
                        className="flex-1 rounded-xl data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-600 hover:text-indigo-700 hover:bg-white/50 data-[state=active]:shadow-md transition-all font-bold py-3 text-sm whitespace-nowrap"
                    >
                        <Activity className="h-4 w-4 mr-2" /> Operations
                    </TabsTrigger>
                    <TabsTrigger
                        value="profile"
                        className="flex-1 rounded-xl data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-600 hover:text-indigo-700 hover:bg-white/50 data-[state=active]:shadow-md transition-all font-bold py-3 text-sm whitespace-nowrap"
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
                                                    <p className="text-sm font-bold">{log.action.replace(/_/g, ' ')}</p>
                                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                                                        {new Date(log.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground uppercase mt-0.5">{log.targetType}</p>
                                                {log.details && (
                                                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                                                        <span className="text-[10px] font-bold text-amber-700 uppercase">📝 Notes: </span>
                                                        <span className="text-xs text-amber-900">{log.details}</span>
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

                <TabsContent value="profile" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Card className="border-none shadow-xl overflow-hidden bg-gradient-to-br from-white to-blue-50/30">
                        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-8 text-white">
                            <div className="flex flex-col md:flex-row items-center gap-6">
                                <div className="h-24 w-24 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-2xl">
                                    <Building className="h-12 w-12 text-white" />
                                </div>
                                <div className="text-center md:text-left">
                                    <h2 className="text-3xl font-black tracking-tight">{stats.user?.name || "Premium Partner"}</h2>
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
                                                    <div className="text-sm font-black text-emerald-800 tracking-tight">Active & Verified</div>
                                                </div>
                                            </div>
                                        </div>
                                </div>
                            </div>
                        </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

