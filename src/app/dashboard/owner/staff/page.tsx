"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, Ban, CheckCircle, Mail, Copy } from "lucide-react";
import { getOwnerStaff, addOwnerStaff, updateStaffStatus } from "@/actions/staff";

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
    name: "", email: "", phone: "", designation: "", staffAddress: "", pincode: "", city: "", state: "",
    permissions: [] as string[],
};

export default function OwnerStaffPage() {
    const [staff, setStaff] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ ...emptyForm });
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [pincodeLoading, setPincodeLoading] = useState(false);

    const fetchStaff = async () => {
        setLoading(true);
        try { setStaff(await getOwnerStaff()); }
        catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchStaff(); }, []);

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
                    const first = data[0].PostOffice[0];
                    setForm(p => ({
                        ...p,
                        pincode: pin,
                        city: first.District,
                        state: first.State,
                    }));
                }
            } catch (error) {
                console.error("Pincode fetch error:", error);
            } finally {
                setPincodeLoading(false);
            }
        }
    };

    const handleAddStaff = async () => {
        if (!form.name || !form.email || !form.phone || !form.designation || !form.staffAddress || !form.pincode) {
            alert("All fields (name, email, phone, designation, address, pincode) are mandatory.");
            return;
        }
        if (form.permissions.length === 0) {
            alert("Select at least one permission.");
            return;
        }
        try {
            const fullAddress = `${form.staffAddress}, ${form.city}, ${form.state} - ${form.pincode}`;
            const res = await addOwnerStaff({
                name: form.name, email: form.email, phone: form.phone,
                designation: form.designation, staffAddress: fullAddress,
                permissions: form.permissions,
            });
            if (res.inviteLink) {
                setInviteLink(res.inviteLink);
            }
            await fetchStaff();
        } catch (e: any) { alert(`Failed to add staff: ${e.message}`); }
    };

    const handleBlockStaff = async (id: string) => {
        const reason = prompt("Reason for blocking this staff member:");
        if (!reason) return;
        try { await updateStaffStatus(id, "BLOCKED", reason); fetchStaff(); }
        catch { alert("Failed to block staff."); }
    };

    const handleUnblockStaff = async (id: string) => {
        const reason = prompt("Reason for unblocking this staff member:");
        if (!reason) return;
        try { await updateStaffStatus(id, "ACTIVE", reason); fetchStaff(); }
        catch { alert("Failed to unblock staff."); }
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
                                        { label: "Full Name *", field: "name", placeholder: "Full name" },
                                        { label: "Email *", field: "email", placeholder: "email@pg.com" },
                                        { label: "Phone *", field: "phone", placeholder: "9XXXXXXXXX" },
                                        { label: "Designation *", field: "designation", placeholder: "Property Manager" },
                                    ].map(({ label, field, placeholder }) => (
                                        <div key={field} className="space-y-1">
                                            <label className="text-sm font-medium">{label}</label>
                                            <Input 
                                                value={(form as any)[field]} 
                                                onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} 
                                                placeholder={placeholder} 
                                                className="focus-visible:ring-primary h-10"
                                            />
                                        </div>
                                    ))}
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium flex items-center gap-2">
                                            Pincode * 
                                            {pincodeLoading && <span className="text-blue-500 text-[10px] animate-pulse">Searching...</span>}
                                        </label>
                                        <Input 
                                            value={form.pincode} 
                                            onChange={e => handlePincodeChange(e.target.value.replace(/\D/g, "").slice(0, 6))} 
                                            placeholder="6 digits" 
                                            className="focus-visible:ring-primary h-10 font-mono tracking-wider"
                                            maxLength={6}
                                        />
                                        {form.city && form.state && form.pincode.length === 6 && (
                                            <p className="text-xs text-green-600 font-medium pt-1">✅ {form.city}, {form.state}</p>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium">Residential Address *</label>
                                        <Input 
                                            value={form.staffAddress} 
                                            onChange={e => setForm(p => ({ ...p, staffAddress: e.target.value }))} 
                                            placeholder="House, Street, Area" 
                                            className="focus-visible:ring-primary h-10"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-bold flex items-center gap-2">
                                        🛡️ Dashboard Access Permissions
                                        <span className="text-[10px] font-normal text-muted-foreground">(Select allowed features)</span>
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
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
                                                    onChange={() => togglePerm(perm.id)} 
                                                    className="w-4 h-4 accent-primary rounded cursor-pointer" 
                                                />
                                                <span className={form.permissions.includes(perm.id) ? "font-bold text-primary" : ""}>
                                                    {perm.label}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <Button onClick={handleAddStaff} className="bg-primary hover:bg-primary/90 flex-1 h-11 font-bold">Generate Invite & Add Staff</Button>
                                    <Button variant="outline" onClick={() => { setShowAdd(false); setForm({ ...emptyForm }); }} className="h-11 px-6">Cancel</Button>
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
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-700 border border-blue-200">
                                                        <Mail className="h-3 w-3" /> INVITED
                                                    </span>
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
                                                    <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleBlockStaff(s.id)}>
                                                        Block Access
                                                    </Button>
                                                ) : (
                                                    <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700" onClick={() => handleUnblockStaff(s.id)}>
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
