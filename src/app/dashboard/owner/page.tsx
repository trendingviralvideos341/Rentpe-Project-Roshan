"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, Users, IndianRupee, Clock, RefreshCcw } from "lucide-react";
import { getOwnerDashboardStats } from "@/actions/dashboard";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";

export default function OwnerDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const data = await getOwnerDashboardStats();
            if (!data || (data as any).error === "Unauthorized") {
                window.location.href = "/login";
                return;
            }
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

    if (loading) return <div className="p-20 text-center animate-pulse">Loading dashboard statistics...</div>;

    if (error || !stats) return (
        <div className="p-8 text-center text-red-500">
            <p>Failed to load dashboard statistics. Please ensure you are logged in as an Owner.</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.href = "/login"}>Login Again</Button>
            <Button variant="ghost" className="mt-4 ml-2" onClick={fetchStats}>Retry</Button>
        </div>
    );

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Dashboard</h1>
                    <p className="text-muted-foreground">Welcome back, here's what's happening today.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchStats}>
                    <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
                </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <IndianRupee className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{stats.totalRevenue.toLocaleString('en-IN')}</div>
                        <p className="text-xs text-muted-foreground">Life-time paid rent on platform</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Tenants</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">+{stats.tenantCount}</div>
                        <p className="text-xs text-muted-foreground">Across all your properties</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Properties Listed</CardTitle>
                        <Building className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.propertyCount}</div>
                        <p className="text-xs text-muted-foreground">Active property listings</p>
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
                                <div key={log.id} className="flex items-start gap-4 p-4 rounded-lg border bg-muted/5 hover:bg-muted/10 transition-colors">
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
        </div>
    );
}
