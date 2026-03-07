"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminStats } from "@/actions/admin";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Shield, Mail, Phone, Calendar, CheckCircle, MessageSquareWarning, ArrowRight, EyeOff, Check, User, Activity, Users, CreditCard, Ticket, Building2, RefreshCcw, Star } from "lucide-react";
const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams, useRouter } from "next/navigation";
import { getFlaggedReviews, updateReviewStatus } from "@/actions/reviews";
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

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const [snap, rev, growth, conv] = await Promise.all([
                getSuperAdminBusinessSnapshot(),
                getPlatformRevenueTrends(6),
                getUserGrowthAnalytics(6),
                getBookingConversionAnalytics(6)
            ]);
            setSnapshot(snap);
            setRevenueTrends(rev);
            setUserGrowth(growth);
            setConversion(conv);
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
                <TabsList className="flex flex-wrap h-auto w-full max-w-md mb-8 p-1.5 bg-slate-100/80 rounded-2xl border shadow-inner">
                    <TabsTrigger
                        value="overview"
                        className="flex-1 rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-600 hover:text-blue-700 hover:bg-white/50 data-[state=active]:shadow-md transition-all font-bold py-3 text-sm whitespace-nowrap"
                    >
                        <Activity className="h-4 w-4 mr-2" /> Dashboard
                    </TabsTrigger>
                    <TabsTrigger
                        value="profile"
                        className="flex-1 rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-600 hover:text-blue-700 hover:bg-white/50 data-[state=active]:shadow-md transition-all font-bold py-3 text-sm whitespace-nowrap"
                    >
                        <User className="h-4 w-4 mr-2" /> My Profile
                    </TabsTrigger>
                    <TabsTrigger
                        value="reviews"
                        className="flex-1 rounded-xl data-[state=active]:bg-red-600 data-[state=active]:text-white text-slate-600 hover:text-red-700 hover:bg-white/50 data-[state=active]:shadow-md transition-all font-bold py-3 text-sm whitespace-nowrap"
                    >
                        <MessageSquareWarning className="h-4 w-4 mr-2" /> Moderation {flaggedReviews.length > 0 && <span className="ml-2 bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">{flaggedReviews.length}</span>}
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
                    <Card className="border-none shadow-xl overflow-hidden bg-gradient-to-br from-white to-blue-50/30">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white">
                            <div className="flex flex-col md:flex-row items-center gap-6">
                                <div className="h-24 w-24 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-2xl">
                                    <Shield className="h-12 w-12 text-white" />
                                </div>
                                <div className="text-center md:text-left">
                                    <h2 className="text-3xl font-black tracking-tight">{snapshot.user?.name || 'Unknown User'}</h2>
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
                                                <p className="text-sm font-bold text-blue-900">{snapshot.user?.email || 'Not set'}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-blue-100 shadow-sm group hover:border-blue-300 transition-all">
                                            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                                                <Phone className="h-5 w-5 text-blue-600 group-hover:text-white" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Phone Number</p>
                                                <p className="text-sm font-bold text-blue-900">{snapshot.user?.phone || 'Not set'}</p>
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
                                                <p className="text-sm font-bold text-blue-900">{snapshot.user?.createdAt ? new Date(snapshot.user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'N/A'}</p>
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
                                                <p className="text-slate-700 italic">"{review.comment}"</p>
                                            </div>

                                            <div>
                                                <h5 className="text-xs font-bold uppercase text-red-600 tracking-wider mb-1">Owner's Reason for Flagging:</h5>
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
            </Tabs>
        </div>
    );
}

