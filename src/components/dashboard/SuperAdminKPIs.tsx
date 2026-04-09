"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
    TrendingUp, Users, Home, CreditCard, 
    AlertTriangle, Shield, CheckCircle2, 
    BarChart3, PieChart as PieChartIcon, 
    ArrowUpRight, ArrowDownRight, Activity
} from "lucide-react";
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, 
    Tooltip, ResponsiveContainer, BarChart, Bar, 
    PieChart, Pie, Cell, Legend 
} from "recharts";

interface SuperAdminKPIsProps {
    snapshot: any;
    revenueTrends: any;
    userGrowth: any;
    conversionAnalytics: any;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function SuperAdminKPIs({ snapshot, revenueTrends, userGrowth, conversionAnalytics }: SuperAdminKPIsProps) {
    const safe = (val: any, fallback: any = 0) => val ?? fallback;
    const safeDiv = (a: any, b: any) => b ? Math.round((safe(a) / safe(b, 1)) * 100) : 0;

    if (!snapshot) return null;

    const healthStatus = safe(snapshot.revenue?.platformEarned) > 0 ? "EXCELLENT" : "STABLE";

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
                                <ArrowUpRight className="h-3 w-3" /> 18.5%
                            </div>
                            <span className="text-[10px] font-bold text-indigo-100/60 uppercase tracking-tighter">vs Last Month</span>
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
                            <span className="text-[10px] font-bold text-emerald-100/60 uppercase tracking-tighter">Live across {safe(snapshot.properties?.live)} PG Properties</span>
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
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Total confirmed bookings</span>
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

            {/* ── Visual Analytics ── */}
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
                        <div className="h-[300px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={revenueTrends?.monthly ?? []}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
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
                        <div className="h-[250px] w-full mt-4">
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
                        </div>
                        <div className="w-full mt-6 space-y-4">
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
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">User Growth</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-between items-end">
                            <div>
                                <div className="text-2xl font-black text-slate-800">{safe(snapshot.users?.total).toLocaleString()}</div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Registered Base</p>
                            </div>
                            <div className="text-right">
                                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none text-[9px] font-bold">MoM +8%</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
