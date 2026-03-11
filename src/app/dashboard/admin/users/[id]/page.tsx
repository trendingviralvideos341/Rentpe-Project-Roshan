"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
    User, Mail, Phone, Calendar, Shield, Building, 
    FileText, ClipboardList, Ban, CheckCircle, ArrowLeft, 
    Save, RefreshCcw, Activity, LayoutDashboard, Clock
} from "lucide-react";
import { getUserById, adminUpdateUserProfile, updateUserStatus } from "@/actions/admin";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function UserDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();
    
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        role: ""
    });

    const fetchUser = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getUserById(id);
            if (data) {
                setUser(data);
                setFormData({
                    name: data.name || "",
                    email: data.email || "",
                    phone: (data.phone || "").replace("+91", ""),
                    role: data.role
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchUser(); }, [fetchUser]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await adminUpdateUserProfile(id, formData);
            setEditMode(false);
            fetchUser();
        } catch (e) {
            alert("Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async () => {
        const isBanned = user.status === "BANNED" || user.status === "SUSPENDED";
        const reason = prompt(`Reason for ${isBanned ? "unsuspending" : "suspending"} this user?`);
        if (!reason) return;

        setSaving(true);
        try {
            await updateUserStatus(id, isBanned ? "ACTIVE" : "BANNED", reason);
            fetchUser();
        } catch (e) {
            alert("Failed to update status");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-20 text-center animate-pulse">Loading user details...</div>;
    if (!user) return <div className="p-20 text-center text-red-500">User not found.</div>;

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-20">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                            {user.name} 
                            <Badge className={cn(
                                "uppercase text-[10px] font-black tracking-widest",
                                user.status === "BANNED" ? "bg-red-100 text-red-700 hover:bg-red-100" : "bg-green-100 text-green-700 hover:bg-green-100"
                            )}>
                                {user.status}
                            </Badge>
                        </h1>
                        <p className="text-slate-500 text-sm font-medium">{user.email} · ID: {user.displayId || user.id}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchUser} disabled={saving} className="rounded-xl border-slate-200">
                        <RefreshCcw className={cn("h-4 w-4 mr-2", saving && "animate-spin")} />
                    </Button>
                    <Button 
                        variant={user.status === "BANNED" ? "outline" : "destructive"} 
                        onClick={handleToggleStatus}
                        className="rounded-xl font-bold"
                    >
                        {user.status === "BANNED" ? <><CheckCircle className="h-4 w-4 mr-2" /> Unblock</> : <><Ban className="h-4 w-4 mr-2" /> Block</>}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Profile */}
                <div className="md:col-span-1 space-y-6">
                    <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                <User className="h-4 w-4" /> Profile Info
                            </CardTitle>
                            {!editMode ? (
                                <Button variant="ghost" size="sm" onClick={() => setEditMode(true)} className="h-7 text-[10px] font-black uppercase text-blue-600 hover:text-blue-700 hover:bg-blue-50">Edit</Button>
                            ) : (
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => setEditMode(false)} className="h-7 text-[10px] font-black uppercase text-slate-500">Cancel</Button>
                                    <Button variant="ghost" size="sm" onClick={handleSave} disabled={saving} className="h-7 text-[10px] font-black uppercase text-green-600 hover:text-green-700 hover:bg-green-50">Save</Button>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</label>
                                {editMode ? <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className="h-10 rounded-xl" /> : <div className="font-bold text-slate-800">{user.name}</div>}
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</label>
                                {editMode ? <Input value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} className="h-10 rounded-xl" /> : <div className="font-bold text-slate-800">{user.email}</div>}
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone Number</label>
                                {editMode ? (
                                    <div className="flex">
                                        <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 bg-muted text-xs font-bold text-muted-foreground">+91</span>
                                        <Input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} className="h-10 rounded-l-none rounded-r-xl" />
                                    </div>
                                ) : <div className="font-bold text-slate-800">{user.phone || "Not provided"}</div>}
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Role</label>
                                {editMode ? (
                                    <select 
                                        value={formData.role} 
                                        onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}
                                        className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        <option value="USER">USER</option>
                                        <option value="STUDENT">STUDENT</option>
                                        <option value="OWNER">OWNER</option>
                                        <option value="ADMIN">ADMIN</option>
                                        <option value="ONBOARDER">ONBOARDER</option>
                                        <option value="VERIFIER">VERIFIER</option>
                                    </select>
                                ) : (
                                    <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 uppercase font-black text-[10px] tracking-widest">
                                        {user.role}
                                    </Badge>
                                )}
                            </div>
                            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase">Loyalty Points</div>
                                    <div className="text-xl font-black text-indigo-600">{user.loyaltyPoints || 0}</div>
                                </div>
                                <div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase">Joined On</div>
                                    <div className="text-sm font-bold text-slate-700">{format(new Date(user.createdAt), "dd MMM yyyy")}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Suspension History */}
                    <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                            <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                <Shield className="h-4 w-4" /> Admin Actions Log
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            {user.actionNotes && user.actionNotes.length > 0 ? (
                                user.actionNotes.map((note: any) => (
                                    <div key={note.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={cn(
                                                "font-black uppercase text-[9px]",
                                                note.action === "BANNED" ? "text-red-600" : "text-green-600"
                                            )}>{note.action}</span>
                                            <span className="text-[9px] text-slate-400">{format(new Date(note.timestamp), "MMM dd, HH:mm")}</span>
                                        </div>
                                        <p className="font-medium text-slate-700">{note.reason}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center py-4 text-xs text-slate-400 italic">No previous actions recorded.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Activity & Related Data */}
                <div className="md:col-span-2 space-y-6">
                    {/* Role Specific Section */}
                    {user.role === "OWNER" ? (
                        <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
                            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                    <Building className="h-4 w-4" /> Properties Listed ({user.properties?.length || 0})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {user.properties?.map((p: any) => (
                                        <div key={p.id} className="p-4 rounded-2xl border border-slate-100 bg-white hover:border-blue-200 transition-colors shadow-sm group">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-black text-slate-800 group-hover:text-blue-600 transition-colors uppercase tracking-tight leading-none">{p.name}</h3>
                                                <Badge className={cn(
                                                    "text-[9px] font-black uppercase",
                                                    p.status === "LIVE" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                                                )}>{p.status}</Badge>
                                            </div>
                                            <div className="text-xs text-slate-500 flex items-center gap-1 mb-3">
                                                <Activity className="h-3 w-3" /> {p.city}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 mt-auto">
                                                <div className="text-[10px] font-black text-slate-400 uppercase">Rooms</div>
                                                <div className="text-[10px] font-black text-slate-400 uppercase text-right">{p.rooms?.length || 0} Rooms</div>
                                            </div>
                                        </div>
                                    ))}
                                    {user.properties?.length === 0 && (
                                        <p className="col-span-full text-center py-10 text-slate-400 italic">No properties listed yet.</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
                            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                    <ClipboardList className="h-4 w-4" /> Booking History ({user.bookings?.length || 0})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-slate-100">
                                    {user.bookings?.map((b: any) => (
                                        <div key={b.id} className="p-4 flex justify-between items-center hover:bg-slate-50/50 transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                                                    <Building className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-800 uppercase tracking-tight">{b.propertyName}</div>
                                                    <div className="text-xs text-slate-500 font-medium">Requested {format(new Date(b.createdAt), "PPP")}</div>
                                                </div>
                                            </div>
                                            <div className="text-right flex items-center gap-4">
                                                <div>
                                                    <div className="text-sm font-black text-slate-900">₹{b.amount.toLocaleString()}</div>
                                                    <Badge variant="outline" className={cn(
                                                        "text-[9px] font-black uppercase tracking-wider",
                                                        b.status === "PAID" ? "bg-green-100 text-green-700 border-green-200" : "bg-slate-100 text-slate-600"
                                                    )}>{b.status}</Badge>
                                                </div>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <ArrowLeft className="h-4 w-4 rotate-180" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {user.bookings?.length === 0 && (
                                        <p className="text-center py-10 text-slate-400 italic">No bookings made yet.</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Audit Logs */}
                    <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden border-indigo-100">
                        <CardHeader className="bg-indigo-50/30 border-b border-indigo-50">
                            <CardTitle className="text-sm font-black uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                                <Activity className="h-4 w-4" /> Security & Audit Trail
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="max-h-[500px] overflow-y-auto">
                                <div className="divide-y divide-slate-100">
                                    {user.auditLogs?.map((log: any) => (
                                        <div key={log.id} className="p-4 flex items-start gap-3 hover:bg-slate-50/50 transition-all">
                                            <div className={cn(
                                                "p-1.5 rounded-lg mt-0.5",
                                                log.actionType === "LOGIN" ? "bg-blue-100 text-blue-600" :
                                                log.actionType === "UPDATE" ? "bg-orange-100 text-orange-600" :
                                                log.actionType === "DELETE" ? "bg-red-100 text-red-600" :
                                                "bg-slate-100 text-slate-600"
                                            )}>
                                                {log.actionType === "LOGIN" ? <Clock className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <p className="text-xs font-bold text-slate-800 line-clamp-1">{log.description}</p>
                                                    <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">{format(new Date(log.createdAt), "MMM dd, HH:mm")}</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[9px] font-black uppercase tracking-tight bg-slate-100 text-slate-500 px-1.5 rounded">IP: {log.ipAddress || "Unknown"}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 italic truncate max-w-xs">{log.userAgent || "No client data"}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {user.auditLogs?.length === 0 && (
                                        <p className="text-center py-10 text-slate-400 italic">No security events found for this user.</p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
