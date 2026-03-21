"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter,
    DialogTrigger
} from "@/components/ui/dialog";
import { UserPlus, Ban, CheckCircle, Mail, Copy, Loader2, Info } from "lucide-react";
import { getOwnerStaff, addOwnerStaff, updateStaffStatus } from "@/actions/staff";
import { getProperties } from "@/actions/properties";
import { toast } from "sonner";

const ownerPermissionsList = [
    { id: "view_bookings", label: "View Bookings" },
    { id: "approve_bookings", label: "Approve / Reject Bookings" },
    { id: "manage_tenants", label: "Manage Tenants" },
    { id: "mark_rent", label: "Mark Rent Paid" },
    { id: "block_tenant", label: "Block/Unblock Tenants" },
    { id: "edit_rooms", label: "Edit Room Allocation" },
    { id: "view_payments", label: "View Payments" },
    { id: "food_menu", label: "Manage Food Menu" },
    { id: "support", label: "Handle Support Tickets" },
];

const emptyForm = {
    name: "", email: "", phone: "", designation: "", staffAddress: "", pincode: "", city: "", state: "", postOffice: "",
    permissions: [] as string[],
    propertyIds: [] as string[],
};

export default function OwnerStaffPage() {
    const [staff, setStaff] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ ...emptyForm });
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [pincodeLoading, setPincodeLoading] = useState(false);
    const [postOffices, setPostOffices] = useState<any[]>([]);
    const [ownerProperties, setOwnerProperties] = useState<any[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Status Dialog State
    const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
    const [statusDialogData, setStatusDialogData] = useState<{ id: string, name: string, targetStatus: "ACTIVE" | "BLOCKED" | "REMOVED" } | null>(null);
    const [statusReason, setStatusReason] = useState("");
    const [statusSubmitting, setStatusSubmitting] = useState(false);

    const fetchStaff = async () => {
        setLoading(true);
        try { setStaff(await getOwnerStaff()); }
        catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchProperties = async () => {
        try {
            const props = await getProperties();
            setOwnerProperties(props);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => { 
        fetchStaff(); 
        fetchProperties();
    }, []);

    const togglePerm = (id: string) => {
        setForm(prev => ({
            ...prev,
            permissions: prev.permissions.includes(id) ? prev.permissions.filter(p => p !== id) : [...prev.permissions, id]
        }));
    };

    const handlePincodeChange = async (pin: string) => {
        setForm(p => ({ ...p, pincode: pin }));
        if (pin.length === 6 && /^\d{6}$/.test(pin)) {
            setPincodeLoading(true);
            try {
                const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
                const data = await res.json();
                if (data && data[0] && data[0].Status === "Success") {
                    const offices = data[0].PostOffice;
                    setPostOffices(offices);
                    const first = offices[0];
                    setForm(p => ({
                        ...p,
                        city: first.District,
                        state: first.State,
                        postOffice: first.Name,
                    }));
                } else {
                    setPostOffices([]);
                }
            } catch (error) {
                console.error("Pincode fetch error:", error);
            } finally {
                setPincodeLoading(false);
            }
        }
    };

    const handleAddStaff = async () => {
        const errs: Record<string, string> = {};
        if (!form.name) errs.name = "Name is required";
        if (!form.email) errs.email = "Email is required";
        if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errs.email = "Invalid email format";
        if (!form.phone) errs.phone = "Phone is required";
        if (form.phone && form.phone.length !== 10) errs.phone = "Must be 10 digits";
        if (!form.designation) errs.designation = "Designation is required";
        if (!form.staffAddress) errs.staffAddress = "Address is required";
        if (!form.pincode) errs.pincode = "Pincode is required";
        if (form.permissions.length === 0) errs.permissions = "Select at least one permission";

        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }

        try {
            const fullAddress = `${form.staffAddress}, ${form.city}, ${form.state} - ${form.pincode}`;
            const res = await addOwnerStaff({
                name: form.name, email: form.email, phone: form.phone,
                designation: form.designation, staffAddress: fullAddress,
                permissions: form.permissions,
                propertyIds: form.propertyIds,
            });
            if (res.inviteLink) {
                setInviteLink(res.inviteLink);
            }
            setErrors({});
            setPostOffices([]);
            await fetchStaff();
        } catch (e: any) { alert(`Failed to add staff: ${e.message}`); }
    };

    const handleBlockStaff = (id: string, name: string) => {
        setStatusDialogData({ id, name, targetStatus: "BLOCKED" });
        setStatusReason("");
        setIsStatusDialogOpen(true);
    };

    const handleUnblockStaff = (id: string, name: string) => {
        setStatusDialogData({ id, name, targetStatus: "ACTIVE" });
        setStatusReason("");
        setIsStatusDialogOpen(true);
    };

    const confirmStatusUpdate = async () => {
        if (!statusDialogData) return;
        if (!statusReason.trim()) {
            toast.error("Please provide a reason");
            return;
        }

        setStatusSubmitting(true);
        try {
            await updateStaffStatus(statusDialogData.id, statusDialogData.targetStatus, statusReason);
            toast.success(`Staff ${statusDialogData.targetStatus === "ACTIVE" ? "restored" : "blocked"} successfully`);
            setIsStatusDialogOpen(false);
            fetchStaff();
        } catch (e: any) {
            toast.error(e.message || "Failed to update status");
        } finally {
            setStatusSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading staff...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Management & Staff Team</h1>
                    <p className="text-muted-foreground">Invite staff members and control their dashboard access.</p>
                </div>
                <Button onClick={() => { setShowAdd(!showAdd); setInviteLink(null); }}>
                    <UserPlus className="h-4 w-4 mr-2" /> Invite Staff
                </Button>
            </div>

            {showAdd && (
                <Card className="border-primary/30 border-2 shadow-xl animate-in slide-in-from-top-4 duration-300">
                    <CardContent className="p-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-lg">Send Staff Invitation</h3>
                            {inviteLink && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold uppercase tracking-wider">Invite Generated</span>}
                        </div>

                        {inviteLink ? (
                            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5 space-y-4 animate-in zoom-in-95">
                                <div className="flex items-center gap-3">
                                    <div className="bg-green-100 p-2 rounded-full">
                                        <Mail className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-green-800">Invitation Link Ready</p>
                                        <p className="text-xs text-green-700/80">Copy and share this link with your staff member. They can use it to set their password.</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Input value={inviteLink} readOnly className="bg-white border-green-200 font-mono text-xs h-10 shadow-inner" />
                                    <Button onClick={() => { navigator.clipboard.writeText(inviteLink); alert("Invite link copied to clipboard!"); }} className="bg-green-600 hover:bg-green-700 h-10 px-4">
                                        <Copy className="h-4 w-4 mr-2" /> Copy Link
                                    </Button>
                                </div>
                                <div className="pt-2">
                                    <Button variant="outline" className="w-full border-green-200 text-green-700 hover:bg-green-100" onClick={() => { setShowAdd(false); setInviteLink(null); setForm({ ...emptyForm }); }}>
                                        Done
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { label: "Full Name *", field: "name", placeholder: "" },
                                        { label: "Email *", field: "email", placeholder: "" },
                                        { label: "Phone *", field: "phone", placeholder: "" },
                                        { label: "Designation *", field: "designation", placeholder: "" },
                                    ].map(({ label, field, placeholder }) => (
                                        <div key={field} className="space-y-1">
                                            <label className="text-sm font-medium">{label}</label>
                                            {field === 'phone' ? (
                                                <div className="relative flex items-center">
                                                    <span className="absolute left-3 text-sm text-muted-foreground font-bold tracking-wider">+91</span>
                                                    <Input 
                                                        value={form.phone} 
                                                        onChange={e => setForm(p => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} 
                                                        placeholder={placeholder} 
                                                        className={`focus-visible:ring-primary h-10 pl-10 tracking-widest font-mono ${errors.phone ? "border-red-500 bg-red-50" : ""}`}
                                                    />
                                                    {errors.phone && <p className="text-[10px] text-red-600 font-bold mt-1 px-1">{errors.phone}</p>}
                                                </div>
                                            ) : (
                                                <Input 
                                                    type={field === 'email' ? 'email' : 'text'}
                                                    value={(form as any)[field]} 
                                                    onChange={e => {
                                                        setForm(p => ({ ...p, [field]: e.target.value }));
                                                        if (errors[field]) setErrors(prev => { const n = {...prev}; delete n[field]; return n; });
                                                    }} 
                                                    placeholder={placeholder} 
                                                    className={`focus-visible:ring-primary h-10 ${errors[field] ? "border-red-500 bg-red-50" : ""}`}
                                                />
                                            )}
                                            {field !== 'phone' && errors[field] && <p className="text-[10px] text-red-600 font-bold mt-1 px-1">{errors[field]}</p>}
                                        </div>
                                    ))}
                                    <div className="space-y-1 col-span-1 md:col-span-2">
                                        <label className="text-sm font-medium">Residential Street Address *</label>
                                        <Input 
                                            value={form.staffAddress} 
                                            onChange={e => {
                                                setForm(p => ({ ...p, staffAddress: e.target.value }));
                                                if (errors.staffAddress) setErrors(prev => { const n = {...prev}; delete n.staffAddress; return n; });
                                            }} 
                                            placeholder="" 
                                            className={`focus-visible:ring-primary h-10 ${errors.staffAddress ? "border-red-500 bg-red-50" : ""}`}
                                        />
                                        {errors.staffAddress && <p className="text-[10px] text-red-600 font-bold mt-1 px-1">{errors.staffAddress}</p>}
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium flex items-center gap-2">
                                            Pincode * 
                                            {pincodeLoading && <span className="text-blue-500 text-[10px] animate-pulse">Searching...</span>}
                                        </label>
                                        <Input 
                                            value={form.pincode} 
                                            onChange={e => {
                                                handlePincodeChange(e.target.value.replace(/\D/g, "").slice(0, 6));
                                                if (errors.pincode) setErrors(prev => { const n = {...prev}; delete n.pincode; return n; });
                                            }} 
                                            placeholder="" 
                                            className={`focus-visible:ring-primary h-10 font-mono tracking-wider ${errors.pincode ? "border-red-500 bg-red-50" : ""}`}
                                            maxLength={6}
                                        />
                                        {errors.pincode && <p className="text-[10px] text-red-600 font-bold mt-1 px-1">{errors.pincode}</p>}
                                    </div>
                                    {postOffices.length > 0 && (
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">Post Office *</label>
                                            <select 
                                                className="w-full h-10 border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary bg-white outline-none font-bold"
                                                value={form.postOffice}
                                                onChange={e => {
                                                    const po = postOffices.find(p => p.Name === e.target.value);
                                                    if(po) setForm({...form, postOffice: po.Name, city: po.District, state: po.State});
                                                }}
                                            >
                                                {postOffices.map(po => (
                                                    <option key={po.Name} value={po.Name}>{po.Name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {form.city && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">District / City</label>
                                                <Input 
                                                    value={form.city} 
                                                    onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                                                    className="focus-visible:ring-primary h-10 bg-primary/5 border-primary/10 font-bold"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">State</label>
                                                <Input 
                                                    value={form.state} 
                                                    onChange={e => setForm(p => ({ ...p, state: e.target.value }))}
                                                    className="focus-visible:ring-primary h-10 bg-primary/5 border-primary/10 font-bold"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <label className={`text-sm font-bold flex items-center gap-2 ${errors.permissions ? "text-red-600" : ""}`}>
                                        🛡️ Dashboard Access Permissions
                                        <span className="text-[10px] font-normal text-muted-foreground">(Select allowed features)</span>
                                    </label>
                                    <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 p-1 rounded-xl transition-all ${errors.permissions ? "ring-2 ring-red-500 ring-offset-2 bg-red-50" : ""}`}>
                                        {ownerPermissionsList.map(perm => (
                                            <label 
                                                key={perm.id} 
                                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer text-sm ${
                                                    form.permissions.includes(perm.id) 
                                                        ? "bg-primary/5 border-primary shadow-sm" 
                                                        : "hover:bg-muted border-transparent bg-muted/30"
                                                }`}
                                            >
                                                <input 
                                                    type="checkbox" 
                                                    checked={form.permissions.includes(perm.id)} 
                                                    onChange={() => {
                                                        togglePerm(perm.id);
                                                        if (errors.permissions) setErrors(prev => { const n = {...prev}; delete n.permissions; return n; });
                                                    }} 
                                                    className="w-4 h-4 accent-primary rounded cursor-pointer" 
                                                />
                                                <span className={form.permissions.includes(perm.id) ? "font-bold text-primary" : ""}>
                                                    {perm.label}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                    {errors.permissions && <p className="text-[10px] text-red-600 font-black uppercase tracking-tight px-1 animate-pulse">Error: {errors.permissions}</p>}
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-bold flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            🏢 Property Access
                                            <span className="text-[10px] font-normal text-muted-foreground">(Buildings they can manage)</span>
                                        </div>
                                        {ownerProperties.length > 0 && (
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-6 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5"
                                                onClick={() => {
                                                    const allIds = ownerProperties.map(p => p.id);
                                                    setForm(prev => ({
                                                        ...prev,
                                                        propertyIds: prev.propertyIds.length === allIds.length ? [] : allIds
                                                    }));
                                                }}
                                            >
                                                {form.propertyIds.length === ownerProperties.length ? "Deselect All" : "Select All Buildings"}
                                            </Button>
                                        )}
                                    </label>
                                    {ownerProperties.length === 0 ? (
                                        <div className="p-4 rounded-xl bg-muted/30 border-2 border-dashed border-muted text-center">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest italic">No properties found. Please list a property first.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {ownerProperties.map(prop => (
                                                <label 
                                                    key={prop.id} 
                                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer text-sm ${
                                                        form.propertyIds.includes(prop.id) 
                                                            ? "bg-blue-50/50 border-blue-400 shadow-sm" 
                                                            : "hover:bg-muted border-transparent bg-muted/30"
                                                    }`}
                                                >
                                                    <input 
                                                        type="checkbox" 
                                                        checked={form.propertyIds.includes(prop.id)} 
                                                        onChange={() => {
                                                            setForm(prev => ({
                                                                ...prev,
                                                                propertyIds: prev.propertyIds.includes(prop.id) 
                                                                    ? prev.propertyIds.filter(id => id !== prop.id)
                                                                    : [...prev.propertyIds, prop.id]
                                                            }));
                                                        }} 
                                                        className="w-4 h-4 accent-blue-600 rounded cursor-pointer" 
                                                    />
                                                    <div className="flex flex-col">
                                                        <span className={form.propertyIds.includes(prop.id) ? "font-bold text-blue-700" : ""}>
                                                            {prop.name}
                                                        </span>
                                                        <span className="text-[9px] text-muted-foreground font-mono">{prop.displayId} - {prop.city}</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <Button onClick={handleAddStaff} className="bg-primary hover:bg-primary/90 flex-1 h-11 font-bold">Generate Invite & Add Staff</Button>
                                    <Button variant="destructive" onClick={() => { setShowAdd(false); setInviteLink(null); setForm({ ...emptyForm }); setErrors({}); }} className="bg-red-600 hover:bg-red-700 h-11 px-6 font-black uppercase tracking-widest text-xs">Cancel</Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Staff Table */}
            <Card className="overflow-hidden border-none shadow-md">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="p-4 text-left font-bold text-xs uppercase tracking-wider text-muted-foreground">ID</th>
                                    <th className="p-4 text-left font-bold text-xs uppercase tracking-wider text-muted-foreground">Name & Contact</th>
                                    <th className="p-4 text-left font-bold text-xs uppercase tracking-wider text-muted-foreground">Designation</th>
                                    <th className="p-4 text-left font-bold text-xs uppercase tracking-wider text-muted-foreground">Permissions</th>
                                    <th className="p-4 text-left font-bold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                                    <th className="p-4 text-left font-bold text-xs uppercase tracking-wider text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-muted/30">
                                {staff.map((s: any) => {
                                    const perms = (() => { try { return JSON.parse(s.staffPermissions || "[]"); } catch { return []; } })();
                                    const isBlocked = s.status === "BLOCKED";
                                    const isInvited = s.status === "INVITED";
                                    
                                    return (
                                        <tr key={s.id} className={`hover:bg-muted/10 transition-colors ${isBlocked ? "bg-red-50/20" : ""}`}>
                                            <td className="p-4 font-mono text-[10px] text-muted-foreground">{s.displayId}</td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${isBlocked ? "bg-red-100 text-red-600" : isInvited ? "bg-blue-100 text-blue-600" : "bg-primary/10 text-primary"}`}>
                                                        {s.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className={`font-bold ${isBlocked ? "line-through text-muted-foreground" : "text-foreground"}`}>{s.name}</div>
                                                        <div className="text-[10px] text-muted-foreground flex flex-col">
                                                            <span>{s.email}</span>
                                                            <span>{s.phone}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full text-[10px] font-black uppercase shadow-sm border border-purple-200">
                                                    {s.occupationDetail || "Staff"}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                    {perms.length > 0 ? perms.map((p: string) => {
                                                        const perm = ownerPermissionsList.find(op => op.id === p);
                                                        return <span key={p} className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-[9px] font-bold border border-muted-foreground/10">{perm?.label || p}</span>;
                                                    }) : <span className="text-[10px] text-muted-foreground italic">No specific perms</span>}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {isInvited ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-700 border border-blue-200">
                                                            <Mail className="h-3 w-3" /> INVITED
                                                        </span>
                                                        {s.resetToken && (
                                                            <Button 
                                                                size="sm"
                                                                variant="outline" 
                                                                className="h-7 px-2 text-[9px] font-black uppercase tracking-tighter bg-green-50 text-green-700 hover:bg-green-100 border-green-200 rounded-lg shadow-sm gap-1"
                                                                onClick={() => {
                                                                    const link = `${window.location.origin}/join-team?token=${s.resetToken}`;
                                                                    navigator.clipboard.writeText(link);
                                                                    toast.success("Invitation link copied!");
                                                                }}
                                                            >
                                                                <Copy className="h-3 w-3" />
                                                                Invite Link
                                                            </Button>
                                                        )}
                                                    </div>
                                                ) : isBlocked ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-200">
                                                        <Ban className="h-3 w-3" /> BLOCKED
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-green-100 text-green-700 border border-green-200">
                                                        <CheckCircle className="h-3 w-3" /> ACTIVE
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                 {!isBlocked ? (
                                                     <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleBlockStaff(s.id, s.name)}>
                                                         Block Access
                                                     </Button>
                                                 ) : (
                                                     <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700" onClick={() => handleUnblockStaff(s.id, s.name)}>
                                                         Restore Access
                                                     </Button>
                                                 )}
                                             </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {staff.length === 0 && (
                        <div className="p-12 text-center">
                            <div className="bg-muted/30 inline-flex p-4 rounded-full mb-4">
                                <UsersIcon className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h3 className="font-bold">No Management or Staff Members Yet</h3>
                            <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                                Give your team access to the dashboard by inviting them with specific permissions.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-3xl border-2 border-primary/10 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black flex items-center gap-2">
                            {statusDialogData?.targetStatus === "ACTIVE" ? (
                                <><CheckCircle className="h-6 w-6 text-green-600" /> Restore Access</>
                            ) : (
                                <><Ban className="h-6 w-6 text-red-600" /> Block Access</>
                            )}
                        </DialogTitle>
                        <DialogDescription className="font-medium italic">
                            Are you sure you want to {statusDialogData?.targetStatus === "ACTIVE" ? "restore access for" : "block"} <span className="font-bold text-primary not-italic">{statusDialogData?.name}</span>?
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground px-1">Reason for {statusDialogData?.targetStatus === "ACTIVE" ? "Unblocking" : "Blocking"}</Label>
                            <Textarea 
                                placeholder="e.g. Terms of service violation, account compromise, etc."
                                value={statusReason}
                                onChange={e => setStatusReason(e.target.value)}
                                className="min-h-[100px] rounded-2xl resize-none focus:ring-primary border-2 border-muted"
                            />
                        </div>
                        
                        <div className="bg-muted/30 p-4 rounded-2xl flex items-start gap-3 border border-muted-foreground/10">
                            <Info className="h-5 w-5 text-primary mt-1" />
                            <p className="text-xs font-medium text-muted-foreground leading-relaxed italic">
                                This reason will be logged for audit purposes and may be visible to the staff member in their dashboard notification.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="gap-3 sm:gap-2">
                        <button 
                            onClick={() => setIsStatusDialogOpen(false)}
                            className="px-8 py-3 text-xs font-black border-2 border-red-600 text-red-600 bg-white hover:bg-red-50 rounded-full transition-all"
                            disabled={statusSubmitting}
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmStatusUpdate}
                            className={`px-8 py-3 text-xs rounded-full text-white font-black transition-all flex items-center gap-2 shadow-lg ${
                                statusDialogData?.targetStatus === "ACTIVE" 
                                ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" 
                                : "bg-red-600 hover:bg-red-700 shadow-red-200"
                            }`}
                            disabled={statusSubmitting}
                        >
                            {statusSubmitting ? (
                                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...</>
                            ) : (
                                <>
                                    {statusDialogData?.targetStatus === "ACTIVE" ? <CheckCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                                    {statusDialogData?.targetStatus === "ACTIVE" ? "Restore Access" : "Confirm Block"}
                                </>
                            )}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Helper icon
function UsersIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    );
}
