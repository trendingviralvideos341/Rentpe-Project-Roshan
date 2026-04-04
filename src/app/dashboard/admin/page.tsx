"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminStats } from "@/actions/admin";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Shield, Mail, Phone, Calendar, CheckCircle, MessageSquareWarning, ArrowRight, EyeOff, Check, User, Activity, Users, CreditCard, Ticket, Building2, RefreshCcw, Star, AlertTriangle } from "lucide-react";
const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useSearchParams, useRouter } from "next/navigation";
import { getFlaggedReviews, updateReviewStatus } from "@/actions/reviews";
import { getSecurityLogs } from "@/actions/auth";
import {
    getSuperAdminBusinessSnapshot,
    getPlatformRevenueTrends,
    getUserGrowthAnalytics,
    getBookingConversionAnalytics
} from "@/actions/superAdmin";
import { SuperAdminKPIs } from "@/components/dashboard/SuperAdminKPIs";
import { formatDistanceToNow } from "date-fns";

export default function AdminDashboard() {
    const [snapshot, setSnapshot] = useState<any>(null);
    const [revenueTrends, setRevenueTrends] = useState<any>(null);
    const [userGrowth, setUserGrowth] = useState<any>(null);
    const [conversion, setConversion] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const searchParams = useSearchParams();
    const router = useRouter();
    const activeTab = searchParams.get("tab") || "overview";
    const [flaggedReviews, setFlaggedReviews] = useState<any[]>([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [securityLogs, setSecurityLogs] = useState<any[]>([]);
    const [securityLoading, setSecurityLoading] = useState(false);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            // First try getAdminStats (accessible to all admins)
            const basicStats = await getAdminStats();
            
            // Try Super Admin specific stats (might fail for non-super admins)
            let snap = null;
            let rev = null;
            let growth = null;
            let conv = null;

            try {
                [snap, rev, growth, conv] = await Promise.all([
                    getSuperAdminBusinessSnapshot(),
                    getPlatformRevenueTrends(6),
                    getUserGrowthAnalytics(6),
                    getBookingConversionAnalytics(6)
                ]);
            } catch (e) {
                console.warn("User is not a Super Admin, limited dashboard access.", e);
                // If snap failed, use basicStats data to fill the snapshot for the UI
                snap = {
                    ...basicStats,
                    user: basicStats.user
                };
            }

            setSnapshot(snap);
            setRevenueTrends(rev);
            setUserGrowth(growth);
            setConversion(conv);
        } catch (e) {
            console.error("fetchStats Error:", e);
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

    const fetchFlaggedReviews = useCallback(async () => {
        setReviewsLoading(true);
        try {
            const data = await getFlaggedReviews();
            setFlaggedReviews(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setReviewsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === "reviews") {
            fetchFlaggedReviews();
        }
    }, [activeTab, fetchFlaggedReviews]);

    const fetchSecurityLogs = useCallback(async () => {
        setSecurityLoading(true);
        try {
            const data = await getSecurityLogs();
            setSecurityLogs(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setSecurityLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === "security") {
            fetchSecurityLogs();
        }
    }, [activeTab, fetchSecurityLogs]);

    const handleReviewAction = async (id: string, action: "PUBLISHED" | "HIDDEN") => {
        try {
            await updateReviewStatus(id, action);
            await fetchFlaggedReviews(); // Refresh
        } catch (error) {
            console.error("Failed to update status:", error);
            alert("Failed to moderate review.");
        }
    };

    if (loading) return <div className="p-20 text-center animate-pulse">Loading platform statistics...</div>;

    if (error || !snapshot) return (
        <div className="p-8 text-center text-red-500">
            <p>Failed to load platform statistics. Please ensure you are logged in as a Super Admin.</p>
            <Button variant="outline" className="mt-4" onClick={fetchStats}>Retry</Button>
        </div>
    );

    return (
        <div className="space-y-8 pb-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">
                        {snapshot.user?.adminRole === 'SUPER_ADMIN' ? 'Platform Admin' : 'Employee Portal Dashboard'}
                    </h1>
                    <p className="text-muted-foreground">
                        {snapshot.user?.adminRole === 'SUPER_ADMIN' 
                            ? 'Overview of RentPe platform performance.' 
                            : 'Management hub for platform operations and customer support.'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchStats}>
                        <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="flex flex-wrap h-auto w-full max-w-3xl mb-8 p-1.5 bg-white/40 backdrop-blur-md rounded-2xl border border-white/40 shadow-xl shadow-indigo-900/5">
                    <TabsTrigger
                        value="overview"
                        className="flex-1 rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-600 hover:text-blue-800 hover:bg-white hover:shadow-lg hover:-translate-y-0.5 data-[state=active]:shadow-md transition-all duration-300 font-bold py-3 text-sm whitespace-nowrap"
                    >
                        <Activity className="h-4 w-4 mr-2" /> Dashboard
                    </TabsTrigger>
                    <TabsTrigger
                        value="profile"
                        className="flex-1 rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-600 hover:text-blue-800 hover:bg-white hover:shadow-lg hover:-translate-y-0.5 data-[state=active]:shadow-md transition-all duration-300 font-bold py-3 text-sm whitespace-nowrap"
                    >
                        <User className="h-4 w-4 mr-2" /> My Profile
                    </TabsTrigger>
                    <TabsTrigger
                        value="reviews"
                        className="flex-1 rounded-xl data-[state=active]:bg-red-600 data-[state=active]:text-white text-slate-600 hover:text-red-800 hover:bg-white hover:shadow-lg hover:-translate-y-0.5 data-[state=active]:shadow-md transition-all duration-300 font-bold py-3 text-sm whitespace-nowrap"
                    >
                        <MessageSquareWarning className="h-4 w-4 mr-2" /> Moderation {flaggedReviews.length > 0 && <span className="ml-2 bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">{flaggedReviews.length}</span>}
                    </TabsTrigger>
                    <TabsTrigger
                        value="security"
                        className="flex-1 rounded-xl data-[state=active]:bg-slate-900 data-[state=active]:text-white text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-lg hover:-translate-y-0.5 data-[state=active]:shadow-md transition-all duration-300 font-bold py-3 text-sm whitespace-nowrap"
                    >
                        <Shield className="h-4 w-4 mr-2" /> Security Log
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <SuperAdminKPIs
                        snapshot={snapshot}
                        revenueTrends={revenueTrends}
                        userGrowth={userGrowth}
                        conversionAnalytics={conversion}
                    />
                </TabsContent>

                <TabsContent value="profile" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Card className="border-none shadow-xl overflow-hidden bg-white/80 backdrop-blur-md">
                        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 text-white relative overflow-hidden">
                            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
                            <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
                                <div className="h-24 w-24 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-2xl">
                                    <Shield className="h-12 w-12 text-white" />
                                </div>
                                <div className="text-center md:text-left">
                                    <h2 className="text-3xl font-black tracking-tight">{snapshot.user?.name || 'RentPe Admin'}</h2>
                                    <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 mt-2">
                                        <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold border border-white/30 uppercase tracking-widest">
                                            Platform Administrator
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
                                            <span className="text-xs font-bold text-blue-100 uppercase tracking-tighter">System Access: {snapshot.user?.adminRole?.replace('_', ' ') || 'ROOT'}</span>
                                        </div>
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
                                                <p className="text-sm font-bold text-blue-900">{snapshot.user?.email || 'admin@rentpe.in'}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-blue-100 shadow-sm group hover:border-blue-300 transition-all">
                                            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                                                <Phone className="h-5 w-5 text-blue-600 group-hover:text-white" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Phone Number</p>
                                                <p className="text-sm font-bold text-blue-900">{snapshot.user?.phone || '+91 9876543210'}</p>
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
                                                <p className="text-sm font-bold text-blue-900">
                                                    {snapshot.user?.createdAt ? new Date(snapshot.user.createdAt).toLocaleString('en-IN', { 
                                                        day: '2-digit', month: 'long', year: 'numeric', 
                                                        hour: '2-digit', minute: '2-digit', hour12: true 
                                                    }) : 'N/A'}
                                                </p>
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

                {/* Reviews Moderation Tab */}
                <TabsContent value="reviews" className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                    <div className="flex justify-between items-center bg-red-50 p-6 rounded-2xl border border-red-100">
                        <div>
                            <h2 className="text-xl font-bold text-red-900 flex items-center"><MessageSquareWarning className="mr-2 h-5 w-5" /> Pending Review Moderations</h2>
                            <p className="text-red-700 text-sm mt-1">Tenant reviews that have been flagged by Property Owners as inappropriate or defamatory.</p>
                        </div>
                        <Button variant="outline" onClick={fetchFlaggedReviews} disabled={reviewsLoading} className="bg-white border-red-200 text-red-700 hover:bg-red-50">
                            <RefreshCcw className={`h-4 w-4 mr-2 ${reviewsLoading ? "animate-spin" : ""}`} /> Refresh Queue
                        </Button>
                    </div>

                    {flaggedReviews.length === 0 ? (
                        <div className="text-center py-20 bg-slate-50 rounded-2xl border shadow-sm">
                            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-slate-800">No Pending Moderations</h3>
                            <p className="text-slate-500 mt-2">The platform review queue is clear! All flagged reports have been closed.</p>
                        </div>
                    ) : (
                        <div className="grid gap-6">
                            {flaggedReviews.map((review: any) => (
                                <Card key={review.id} className="border-red-200 shadow-sm overflow-hidden">
                                    <div className="bg-red-50 p-3 flex justify-between items-center text-xs font-semibold text-red-800 border-b border-red-100">
                                        <span>FLAGGED FOR REVIEW</span>
                                        <span>{formatDistanceToNow(new Date(review.updatedAt), { addSuffix: true })}</span>
                                    </div>
                                    <div className="p-6 md:flex justify-between gap-8">
                                        <div className="flex-1 space-y-4">
                                            <div>
                                                <h4 className="text-lg font-bold text-slate-900">{review.property.name}</h4>
                                                <p className="text-sm text-muted-foreground">{review.property.city}</p>
                                            </div>

                                            <div className="bg-slate-50 p-4 rounded-xl border">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="font-bold text-slate-800">{review.tenant.name}</span>
                                                    <span className="text-xs text-slate-500">wrote:</span>
                                                    <span className="ml-auto flex shrink-0">
                                                        {[...Array(5)].map((_, i) => (
                                                            <Star key={i} className={`h-3 w-3 ${i < review.rating ? "fill-yellow-400 text-yellow-500" : "fill-transparent text-gray-300"}`} />
                                                        ))}
                                                    </span>
                                                </div>
                                                <p className="text-slate-700 italic">&quot;{review.comment}&quot;</p>
                                            </div>

                                            <div>
                                                <h5 className="text-xs font-bold uppercase text-red-600 tracking-wider mb-1">Owner&apos;s Reason for Flagging:</h5>
                                                <p className="text-sm text-slate-800 bg-red-100/50 p-3 rounded-lg">{review.flagReason}</p>
                                            </div>
                                        </div>

                                        <div className="shrink-0 w-full md:w-48 mt-6 md:mt-0 flex flex-col justify-center space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                            <p className="text-xs font-bold text-center text-slate-500 uppercase tracking-widest mb-2">Admin Actions</p>
                                            <Button
                                                onClick={() => handleReviewAction(review.id, "HIDDEN")}
                                                variant="destructive"
                                                className="w-full"
                                            >
                                                <EyeOff className="mr-2 h-4 w-4" /> Remove Review
                                            </Button>
                                            <Button
                                                onClick={() => handleReviewAction(review.id, "PUBLISHED")}
                                                variant="outline"
                                                className="w-full text-green-700 border-green-200 hover:bg-green-50"
                                            >
                                                <Check className="mr-2 h-4 w-4" /> Restore & Unflag
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Security Logs Tab */}
                <TabsContent value="security" className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                    <div className="flex justify-between items-center bg-slate-900 text-white p-6 rounded-2xl border border-slate-800">
                        <div>
                            <h2 className="text-xl font-bold flex items-center"><Shield className="mr-2 h-5 w-5 text-blue-400" /> Security Audit Log</h2>
                            <p className="text-slate-400 text-sm mt-1">Real-time monitoring of failed login attempts and critical account modifications.</p>
                        </div>
                        <Button variant="outline" onClick={fetchSecurityLogs} disabled={securityLoading} className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all">
                            <RefreshCcw className={`h-4 w-4 mr-2 ${securityLoading ? "animate-spin" : ""}`} /> Refresh Audit
                        </Button>
                    </div>

                    {securityLogs.length === 0 ? (
                        <div className="text-center py-20 bg-slate-50 rounded-2xl border shadow-sm">
                            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-slate-800">System Secure</h3>
                            <p className="text-slate-500 mt-2">No critical security events or failed login patterns detected recently.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {securityLogs.map((log: any) => (
                                <Card key={log.id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="p-5 flex items-start gap-4">
                                        <div className={`mt-1 p-2 rounded-full shrink-0 ${log.actionType === 'LOGIN_FAILURE' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                            {log.actionType === 'LOGIN_FAILURE' ? <AlertTriangle className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start gap-2">
                                                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{(log.actionType || "LOG").replace(/_/g, ' ')}</h4>
                                                <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded uppercase">
                                                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-700 mt-1">{log.description}</p>
                                            <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100">
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase">Target Entity</p>
                                                    <p className="text-xs font-bold text-slate-900">{log.entityType}: {log.entityId}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase">Event ID</p>
                                                    <p className="text-xs font-mono text-slate-500">{log.id.slice(-8).toUpperCase()}</p>
                                                </div>
                                                <div className="ml-auto">
                                                    <Badge variant="outline" className={`${log.action === 'LOGIN_FAILURE' ? 'text-red-700 border-red-200 bg-red-50' : 'text-amber-700 border-amber-200 bg-amber-50'}`}>
                                                        High Priority
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

