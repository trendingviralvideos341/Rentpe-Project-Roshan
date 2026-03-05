"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminStats } from "@/actions/admin";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { User, Activity, Users, CreditCard, Ticket, Building2, RefreshCcw } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams, useRouter } from "next/navigation";
import { Shield, Mail, Phone, Calendar, CheckCircle } from "lucide-react";

export default function AdminDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const searchParams = useSearchParams();
    const router = useRouter();
    const activeTab = searchParams.get("tab") || "overview";

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const data = await getAdminStats();
            setStats(data);
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

    if (loading) return <div className="p-20 text-center animate-pulse">Loading platform statistics...</div>;

    if (error || !stats) return (
        <div className="p-8 text-center text-red-500">
            <p>Failed to load platform statistics. Please ensure you are logged in as an Admin.</p>
            <Button variant="outline" className="mt-4" onClick={fetchStats}>Retry</Button>
        </div>
    );

    return (
        <div className="space-y-8 pb-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Platform Admin</h1>
                    <p className="text-muted-foreground">Overview of RentPe platform performance.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchStats}>
                        <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 mb-8 p-1 bg-muted/50 rounded-xl border border-blue-100">
                    <TabsTrigger
                        value="overview"
                        className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md transition-all font-bold py-2.5"
                    >
                        <Activity className="h-4 w-4 mr-2" /> Dashboard
                    </TabsTrigger>
                    <TabsTrigger
                        value="profile"
                        className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md transition-all font-bold py-2.5"
                    >
                        <User className="h-4 w-4 mr-2" /> My Profile
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                                <Users className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
                                <CreditCard className="h-4 w-4 text-emerald-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.totalBookings.toLocaleString()}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
                                <Ticket className="h-4 w-4 text-amber-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-amber-500">{stats.openTickets}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Active Properties</CardTitle>
                                <Building2 className="h-4 w-4 text-indigo-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-indigo-500">{stats.totalProperties}</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts Section */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle>Platform Growth (Last 6 Months)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] w-full mt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={stats.monthlyGrowth} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={10} />
                                            <YAxis axisLine={false} tickLine={false} tickMargin={10} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            />
                                            <Legend verticalAlign="top" height={36} iconType="circle" />
                                            <Area type="monotone" dataKey="users" name="Total Users" stroke="#8884d8" fillOpacity={1} fill="url(#colorUsers)" />
                                            <Area type="monotone" dataKey="bookings" name="Total Bookings" stroke="#82ca9d" fillOpacity={1} fill="url(#colorBookings)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Property Distribution</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col items-center justify-center">
                                <div className="h-[250px] w-full mt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={stats.propertyDistribution}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {stats.propertyDistribution.map((entry: any, index: number) => (
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

                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-blue-500" /> System Health</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-full border-4 border-green-500 border-t-transparent animate-spin flex items-center justify-center">
                                        <span className="text-xs font-bold text-green-600">{stats.systemHealth}</span>
                                    </div>
                                    <div>
                                        <p className="font-medium text-green-600">All systems operational</p>
                                        <p className="text-sm text-muted-foreground">API Latency: 45ms • DB Health: Excellent</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="profile" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Card className="border-none shadow-xl overflow-hidden bg-gradient-to-br from-white to-blue-50/30">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white">
                            <div className="flex flex-col md:flex-row items-center gap-6">
                                <div className="h-24 w-24 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-2xl">
                                    <Shield className="h-12 w-12 text-white" />
                                </div>
                                <div className="text-center md:text-left">
                                    <h2 className="text-3xl font-black tracking-tight">{stats.user?.name || 'Unknown User'}</h2>
                                    <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
                                        <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold border border-white/30 uppercase tracking-widest">
                                            Platform Administrator
                                        </span>
                                        <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
                                        <span className="text-xs font-bold text-blue-100 uppercase tracking-tighter">System Access: Root</span>
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
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Email Address</p>
                                                <p className="text-sm font-bold text-blue-900">{stats.user?.email || 'Not set'}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-blue-100 shadow-sm group hover:border-blue-300 transition-all">
                                            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                                                <Phone className="h-5 w-5 text-blue-600 group-hover:text-white" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Phone Number</p>
                                                <p className="text-sm font-bold text-blue-900">{stats.user?.phone || 'Not set'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h3 className="text-sm font-black text-blue-900/40 uppercase tracking-[0.2em]">Security & Verification</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-blue-100 shadow-sm group hover:border-blue-300 transition-all">
                                            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                                                <Calendar className="h-5 w-5 text-blue-600 group-hover:text-white" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Admin Since</p>
                                                <p className="text-sm font-bold text-blue-900">{stats.user?.createdAt ? new Date(stats.user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'N/A'}</p>
                                            </div>
                                        </div>

                                        <div className="p-4 border-2 border-green-200 bg-green-50 rounded-xl flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-green-200 flex items-center justify-center">
                                                    <CheckCircle className="h-6 w-6 text-green-700" />
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-bold text-green-700 uppercase">Account Integrity</div>
                                                    <div className="text-sm font-black text-green-800 tracking-tight">Verified System Admin</div>
                                                </div>
                                            </div>
                                            <div className="px-3 py-1 bg-green-600 text-white text-[10px] font-black rounded-full uppercase">L3 Security</div>
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

