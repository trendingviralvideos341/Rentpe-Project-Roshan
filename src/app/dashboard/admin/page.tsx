// src/app/dashboard/admin/page.tsx
"use client";

import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSearchParams, useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

import {
  LayoutDashboard, Home, User, Shield, Settings,
  Mail, Phone, Calendar, CheckCircle, MessageSquareWarning,
  ArrowRight, EyeOff, Check, Activity, Users, CreditCard,
  Ticket, Building2, RefreshCcw, Star, AlertTriangle, BadgeCheck
} from "lucide-react";

import { getAdminStats } from "@/actions/admin";
import { updateReviewStatus, getFlaggedReviews } from "@/actions/reviews";
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
import { Badge } from "@/components/ui/badge";

// Redesigned components
import { AdminKPICards }       from "@/components/admin/AdminKPICards";
import { AttentionQueue }      from "@/components/admin/AttentionQueue";
import { ActivityFeed }        from "@/components/admin/ActivityFeed";
import { RevenueChart }        from "@/components/admin/RevenueChart";
import { UserGrowthChart }     from "@/components/admin/UserGrowthChart";
import { BookingFunnelChart }  from "@/components/admin/BookingFunnelChart";
import { InventoryStatusCard } from "@/components/admin/InventoryStatusCard";
import { OnboardedProperties } from "@/components/admin/OnboardedProperties";
import { QuickStatRow }        from "@/components/admin/QuickStatRow";

const TABS = [
  { id: "overview",           label: "Dashboard",          icon: LayoutDashboard },
  { id: "property-dashboard", label: "Property Dashboard", icon: Home },
  { id: "profile",            label: "My Profile",          icon: User },
  { id: "reviews",            label: "Moderation",          icon: Shield },
  { id: "security",           label: "Security Log",        icon: Settings },
];

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
            const basicStats = await getAdminStats();
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
                const props = await getOnboardedProperties().catch(() => []);
                setOnboardedProperties(props || []);
            } catch (e) {
                console.warn("User is not a Super Admin, limited dashboard access.", e);
                snap = {
                    ...basicStats,
                    user: basicStats.user
                };
            }

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
        if (ownersWithProperties.length > 0) return;
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
            await fetchFlaggedReviews();
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

    return (
        <div className="min-h-screen bg-slate-50">
            {/* ── Page header ── */}
            <div className="bg-white border-b border-slate-100 px-6 py-5">
                <div className="flex items-center justify-between mb-1">
                    <div>
                        <h1 className="text-xl font-semibold text-slate-900">
                            {snapshot.user?.adminRole === 'SUPER_ADMIN' ? 'Platform Admin' : 'Staff Portal Dashboard'}
                        </h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            {snapshot.user?.adminRole === 'SUPER_ADMIN' 
                                ? 'Overview of Rentpe platform performance.' 
                                : 'Management hub for platform operations and customer support.'}
                        </p>
                    </div>
                    <button
                        onClick={fetchStats}
                        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800
                                   border border-slate-200 rounded-xl px-3 py-2 hover:bg-slate-50 transition"
                    >
                        <RefreshCcw className="h-3.5 w-3.5" />
                        Refresh
                    </button>
                </div>

                {/* Tab bar */}
                <div className="flex gap-0 mt-4 border-b border-slate-100 -mb-[1px]">
                  {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => handleTabChange(id)}
                      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition
                        ${activeTab === id
                          ? "border-violet-600 text-violet-600"
                          : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200"
                        }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                      {id === "reviews" && flaggedReviews.length > 0 && (
                        <span className="ml-1 bg-red-100 text-red-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {flaggedReviews.length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
            </div>

            {/* ── Body Content ── */}
            <div className="px-6 py-6 max-w-screen-xl mx-auto">
                {activeTab === "overview" && (
                    <div className="space-y-6">
                        {/* KPI cards row */}
                        <AdminKPICards />

                        {/* Attention + Activity */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                          <AttentionQueue />
                          <ActivityFeed />
                        </div>

                        {/* Revenue + Inventory */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                          <div className="lg:col-span-2">
                            <RevenueChart />
                          </div>
                          <InventoryStatusCard />
                        </div>

                        {/* User growth + Booking funnel */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                          <UserGrowthChart />
                          <BookingFunnelChart />
                        </div>

                        {/* Quick stat row */}
                        <QuickStatRow />

                        {/* Onboarded properties */}
                        <OnboardedProperties />
                    </div>
                )}

                {/* Property Dashboard Tab */}
                {activeTab === "property-dashboard" && (
                    <div className="space-y-6">
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
                    </div>
                )}

                {/* My Profile Tab */}
                {activeTab === "profile" && (
                    <Card className="border-none shadow-xl overflow-hidden bg-white">
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
                )}

                {/* Reviews Moderation Tab */}
                {activeTab === "reviews" && (
                    <div className="space-y-6">
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
                                    <Card key={review.id} className="border-red-200 shadow-sm overflow-hidden bg-white">
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
                    </div>
                )}

                {/* Security Logs Tab */}
                {activeTab === "security" && (
                    <div className="space-y-6">
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
                                    <Card key={log.id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow bg-white">
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
                    </div>
                )}
            </div>
        </div>
    );
}
