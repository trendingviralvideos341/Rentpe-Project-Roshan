"use client";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminStats } from "@/actions/admin";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Shield, Mail, Phone, Calendar, CheckCircle, MessageSquareWarning, ArrowRight, EyeOff, Check, User, Activity, Users, CreditCard, Ticket, Building2, RefreshCcw, Star, AlertTriangle, Bell, XCircle, Home } from "lucide-react";
const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];
import Link from "next/link";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useSearchParams, useRouter } from "next/navigation";
import { getFlaggedReviews, updateReviewStatus } from "@/actions/reviews";
import { getSecurityLogs } from "@/actions/auth";
import {
    getSuperAdminBusinessSnapshot,
    getPlatformRevenueTrends,
    getUserGrowthAnalytics,
    getBookingConversionAnalytics,
    getOnboardedProperties,
    getOwnersWithProperties,
    getRecentPlatformActivity
} from "@/actions/superAdmin";
import { AdminPropertyDashboardView } from "@/components/dashboard/AdminPropertyDashboardView";
import { SuperAdminKPIs } from "@/components/dashboard/SuperAdminKPIs";
import { formatDistanceToNow } from "date-fns";

export default function AdminDashboard() {
    const [snapshot, setSnapshot] = useState<any>(null);
    const [revenueTrends, setRevenueTrends] = useState<any>(null);
    const [userGrowth, setUserGrowth] = useState<any>(null);
    const [conversion, setConversion] = useState<any>(null);
    const [onboardedProperties, setOnboardedProperties] = useState<any[]>([]);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const searchParams = useSearchParams();
    const router = useRouter();
    const activeTab = searchParams.get("tab") || "overview";
    const [flaggedReviews, setFlaggedReviews] = useState<any[]>([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [securityLogs, setSecurityLogs] = useState<any[]>([]);
    const [securityLoading, setSecurityLoading] = useState(false);
    const [ownersWithProperties, setOwnersWithProperties] = useState<any[]>([]);
    const [ownersLoading, setOwnersLoading] = useState(false);

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
                // Fetch onboarded properties for Super Admin
                const props = await getOnboardedProperties().catch(() => []);
                setOnboardedProperties(props || []);
            } catch (e) {
                // no-op — handled below
                console.warn("User is not a Super Admin, limited dashboard access.", e);
                // If snap failed, use basicStats data to fill the snapshot for the UI
                snap = {
                    ...basicStats,
                    user: basicStats.user
                };
            }

            // Fetch activity feed — available to all admins
            const activity = await getRecentPlatformActivity(25).catch(() => []);
            setRecentActivity(activity || []);

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

    const fetchOwnersWithProperties = useCallback(async () => {
        if (ownersWithProperties.length > 0) return; // already loaded
        setOwnersLoading(true);
        try {
            const data = await getOwnersWithProperties();
            setOwnersWithProperties(data || []);
        } catch (error) {
            console.error("fetchOwnersWithProperties Error:", error);
        } finally {
            setOwnersLoading(false);
        }
    }, [ownersWithProperties.length]);

    useEffect(() => {
        if (activeTab === "property-dashboard") {
            fetchOwnersWithProperties();
        }
    }, [activeTab, fetchOwnersWithProperties]);

    const handleReviewAction = async (id: string, action: "PUBLISHED" | "HIDDEN") => {
        try {
            await updateReviewStatus(id, action);
            await fetchFlaggedReviews(); // Refresh
        } catch (error) {
            console.error("Failed to update status:", error);
            toast.error("Failed to moderate review.");
        }
    };

    if (loading) return <div className="p-20 text-center animate-pulse">Loading platform statistics...</div>;

    if (error || !snapshot) return (
        <div className="p-8 text-center text-red-500">
            <p>Failed to load platform statistics. Please ensure you are logged in as a Super Admin.</p>
            <Button variant="outline" className="mt-4" onClick={fetchStats}>Retry</Button>
        </div>
    );

    const openDisputesCount = snapshot?.disputes?.open ?? 0;
    const fraudAlertsCount = snapshot?.fraud?.open ?? 0;
    const pendingPropertiesCount = Math.max(0, (snapshot?.properties?.total ?? 0) - (snapshot?.properties?.live ?? 0));
    const supportTicketsCount = snapshot?.support?.tickets ?? 0;
    const attentionCount = openDisputesCount + fraudAlertsCount + pendingPropertiesCount + supportTicketsCount;

    const TABS = [
        { id: "overview", label: "Dashboard", icon: <Activity className="h-5 w-5" /> },
        { id: "property-dashboard", label: "Property Dashboard", icon: <Building2 className="h-5 w-5" /> },
        { id: "profile", label: "My Profile", icon: <User className="h-5 w-5" /> },
        { 
            id: "reviews", 
            label: "Moderation", 
            icon: <MessageSquareWarning className="h-5 w-5" />,
            badge: flaggedReviews.length > 0 && (
                <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full leading-none">
                    {flaggedReviews.length}
                </span>
            )
        },
        { id: "security", label: "Security Log", icon: <Shield className="h-5 w-5" /> },
        { id: "attention", label: "Requires Attention", icon: <Bell className="h-5 w-5" /> }
    ];

    return (
        <div className="space-y-8 pb-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">
                        {snapshot.user?.adminRole === 'SUPER_ADMIN' ? 'Platform Admin' : 'Staff Portal Dashboard'}
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
                <div className="flex gap-0 bg-slate-100 p-1.5 rounded-2xl w-full mt-4">
                    {TABS.map(({ id, label, icon, badge }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => handleTabChange(id)}
                            className={`flex flex-1 items-center justify-center gap-2 px-3 py-3
                                        text-sm font-semibold rounded-xl transition-all whitespace-nowrap
                                        relative
                                        ${activeTab === id
                                          ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-200"
                                          : "text-slate-600 hover:bg-slate-200 hover:text-slate-800"
                                        }`}
                        >
                            {icon}
                            <span>{label}</span>
                            {badge}
                            {id === "attention" && attentionCount > 0 && (
                              <span className="bg-white/25 text-white text-[9px] font-bold
                                               px-1.5 py-0.5 rounded-full leading-none">
                                {attentionCount}
                              </span>
                            )}
                            {activeTab !== id && id !== TABS[TABS.length - 1].id && (
                              <span className="absolute right-0 top-[20%] h-[60%] w-px bg-slate-300" />
                            )}
                        </button>
                    ))}
                </div>

                <TabsContent value="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <SuperAdminKPIs
                        snapshot={snapshot}
                        revenueTrends={revenueTrends}
                        userGrowth={userGrowth}
                        conversionAnalytics={conversion}
                        onboardedProperties={onboardedProperties}
                        recentActivity={recentActivity}
                    />
                </TabsContent>

                {/* Property Dashboard Tab */}
                <TabsContent value="property-dashboard" className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-indigo-500" /> Property Dashboard Viewer
                            </h2>
                            <p className="text-slate-500 text-sm mt-1">
                                Select any owner and property to view its complete operational dashboard — revenue, occupancy, rooms, tenants, and deposits.
                            </p>
                        </div>
                    </div>
                    {ownersLoading ? (
                        <div className="flex items-center justify-center py-20 animate-pulse">
                            <div className="text-center space-y-2">
                                <Building2 className="h-8 w-8 text-indigo-400 mx-auto" />
                                <p className="text-slate-500 font-semibold text-sm">Loading owners and properties...</p>
                            </div>
                        </div>
                    ) : (
                        <AdminPropertyDashboardView initialOwners={ownersWithProperties} />
                    )}
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
                {/* Requires Attention Tab */}
                <TabsContent value="attention" className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                    <div className="px-6 py-6 max-w-screen-xl mx-auto">
                        <div className="mb-5">
                            <h2 className="text-base font-bold text-slate-800">Action Items</h2>
                            <p className="text-xs text-slate-400 mt-1">
                                Click any card to navigate directly. No data changes here.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

                            {/* Open Disputes */}
                            <Link href="/dashboard/admin/disputes"
                                className="rounded-2xl border-[1.5px] border-red-200 bg-gradient-to-br
                                           from-red-50 to-rose-50 overflow-hidden hover:-translate-y-1
                                           hover:shadow-lg hover:shadow-red-100 transition-all group">
                                <div className="p-5">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="h-11 w-11 rounded-2xl bg-red-100 flex items-center
                                                        justify-center text-xl">🚨</div>
                                        <span className="text-4xl font-extrabold text-red-600 leading-none">
                                            {openDisputesCount}
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-red-900">Open Disputes</p>
                                    <p className="text-xs text-red-400 mt-1">
                                        Active disputes requiring admin resolution
                                    </p>
                                </div>
                                <div className="flex items-center justify-between px-5 py-2.5
                                                border-t border-red-100 bg-red-50/50">
                                    <span className="text-xs text-red-300 font-medium">✓ No pending disputes</span>
                                    <span className="text-xs font-bold text-red-500
                                                     group-hover:underline">Go to Disputes →</span>
                                </div>
                            </Link>

                            {/* Fraud Alerts */}
                            <Link href="/dashboard/admin/fraud"
                                className="rounded-2xl border-[1.5px] border-orange-200 bg-gradient-to-br
                                           from-orange-50 to-amber-50 overflow-hidden hover:-translate-y-1
                                           hover:shadow-lg hover:shadow-orange-100 transition-all group">
                                <div className="p-5">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="h-11 w-11 rounded-2xl bg-orange-100 flex items-center
                                                        justify-center text-xl">⚠️</div>
                                        <span className="text-4xl font-extrabold text-orange-600 leading-none">
                                            {fraudAlertsCount}
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-orange-900">Fraud Alerts</p>
                                    <p className="text-xs text-orange-400 mt-1">
                                        Flagged accounts and suspicious activity
                                    </p>
                                </div>
                                <div className="flex items-center justify-between px-5 py-2.5
                                                border-t border-orange-100 bg-orange-50/50">
                                    <span className="text-xs text-orange-300 font-medium">✓ No active alerts</span>
                                    <span className="text-xs font-bold text-orange-500
                                                     group-hover:underline">Go to Fraud →</span>
                                </div>
                            </Link>

                            {/* Properties Pending */}
                            <Link href="/dashboard/admin/properties?status=pending"
                                className="rounded-2xl border-[1.5px] border-blue-200 bg-gradient-to-br
                                           from-blue-50 to-sky-50 overflow-hidden hover:-translate-y-1
                                           hover:shadow-lg hover:shadow-blue-100 transition-all group">
                                <div className="p-5">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="h-11 w-11 rounded-2xl bg-blue-100 flex items-center
                                                        justify-center text-xl">🏠</div>
                                        <span className="text-4xl font-extrabold text-blue-600 leading-none">
                                            {pendingPropertiesCount}
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-blue-900">Properties Pending</p>
                                    <p className="text-xs text-blue-400 mt-1">
                                        Awaiting admin verification and approval
                                    </p>
                                </div>
                                <div className="flex items-center justify-between px-5 py-2.5
                                                border-t border-blue-100 bg-blue-50/50">
                                    <span className="text-xs text-blue-300 font-medium">✓ All verified</span>
                                    <span className="text-xs font-bold text-blue-500
                                                     group-hover:underline">Go to Approvals →</span>
                                </div>
                            </Link>

                            {/* Support Tickets */}
                            <Link href="/dashboard/admin/tickets"
                                className="rounded-2xl border-[1.5px] border-violet-200 bg-gradient-to-br
                                           from-violet-50 to-purple-50 overflow-hidden hover:-translate-y-1
                                           hover:shadow-lg hover:shadow-violet-100 transition-all group">
                                <div className="p-5">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="h-11 w-11 rounded-2xl bg-violet-100 flex items-center
                                                        justify-center text-xl">🎫</div>
                                        <span className="text-4xl font-extrabold text-violet-600 leading-none">
                                            {supportTicketsCount}
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-violet-900">Support Tickets</p>
                                    <p className="text-xs text-violet-400 mt-1">
                                        Open tickets from owners and tenants
                                    </p>
                                </div>
                                <div className="flex items-center justify-between px-5 py-2.5
                                                border-t border-violet-100 bg-violet-50/50">
                                    <span className="text-xs text-violet-300 font-medium">✓ No open tickets</span>
                                    <span className="text-xs font-bold text-violet-500
                                                     group-hover:underline">Go to Tickets →</span>
                                </div>
                            </Link>

                        </div>

                        {/* All clear banner */}
                        {attentionCount === 0 && (
                            <div className="flex items-center gap-4 bg-gradient-to-r from-emerald-50
                                            to-teal-50 border-[1.5px] border-emerald-200 rounded-2xl
                                            px-5 py-4">
                                <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center
                                                justify-center text-base flex-shrink-0">✅</div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-emerald-800">All clear right now</p>
                                    <p className="text-xs text-emerald-600 mt-0.5">
                                        No pending items. Full activity history in Security Audit Log.
                                    </p>
                                </div>
                                <Link href="/dashboard/admin/audit-log"
                                    className="text-xs font-bold text-violet-600 bg-white border
                                               border-violet-100 px-3 py-2 rounded-xl hover:bg-violet-50
                                               transition whitespace-nowrap">
                                    Security Audit Log →
                                </Link>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

