"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, UserPlus, Shield, ShieldOff, ShieldCheck, RefreshCcw, Pencil, X, Check, AlertTriangle, Search, CheckCircle2, XCircle, Edit3, Filter } from "lucide-react";
import { getTeamMembers, addTeamMember, updateTeamMemberStatus, updateTeamMemberPermissions } from "@/actions/team";
import { getActiveEmployees } from "@/actions/employee";
import { getAdminEmployees, createAdminEmployee, updateAdminEmployee } from "@/actions/adminEmployees";
import { validateEmail, validatePhone, validateName, normalizePhone } from "@/lib/validators";
import { toast } from "sonner";
import { useSearchParams, useRouter } from "next/navigation";

// ─── SHARED CONSTANTS ─────────────────────────────────────────

const rolePermissions = [
    { id: "onboarder", label: "🏃 Onboarder", desc: "Can onboard property owners" },
    { id: "verifier", label: "🔍 Verifier", desc: "Can verify owner documents" },
    { id: "sub_admin", label: "🔑 Sub Admin", desc: "Limited admin access" },
];
const operationalPermissions = [
    { id: "login_issues", label: "Login & Auth Issues" }, { id: "payment_failed", label: "Payment Failed / Refunds" },
    { id: "booking_disputes", label: "Booking Disputes" }, { id: "user_verification", label: "User Verification (KYC)" },
    { id: "ban_users", label: "Block / Unblock Users" }, { id: "property_moderation", label: "Property Moderation" },
    { id: "support_tickets", label: "Support Tickets" }, { id: "transaction_view", label: "View Transactions" }, { id: "reports", label: "Reports & Analytics" },
];
const allPermissions = [...rolePermissions, ...operationalPermissions];
const ALL_ROLES = ["Support Agent", "Finance Ops", "Customer Care", "Operations", "Field Executive", "Team Lead"];

const DEPARTMENTS = ["Verification Team", "Customer Support", "Operations", "Finance", "Technology"];
const MODULES = [
    { id: "owners", label: "Owner Management" }, { id: "users", label: "User Management" },
    { id: "properties", label: "Property Approval" }, { id: "bookings", label: "Booking Operations" },
    { id: "payments", label: "Financial Tracking" }, { id: "tickets", label: "Support Tickets" },
    { id: "audit", label: "Audit Logs" }, { id: "staff", label: "Staff Management" },
];

// ─── RBAC / TEAM TAB ─────────────────────────────────────────

function BlockModal({ member, onConfirm, onCancel }: { member: any; onConfirm: (r: string) => void; onCancel: () => void }) {
    const [reason, setReason] = useState("");
    const isBlocked = member.status === "REVOKED";
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${isBlocked ? "bg-green-100" : "bg-red-100"}`}><AlertTriangle className={`h-5 w-5 ${isBlocked ? "text-green-600" : "text-red-600"}`} /></div>
                    <div><h3 className="font-bold text-lg">{isBlocked ? "Unblock" : "Block"} Account</h3><p className="text-sm text-muted-foreground">{member.name} · {member.email}</p></div>
                </div>
                <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder={isBlocked ? "Why are you restoring?" : "Why are you blocking?"}
                    className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm resize-none h-28 focus:outline-none focus:border-red-500 transition-all font-medium" />
                <div className="flex gap-3 justify-end pt-4">
                    <button onClick={onCancel} className="px-8 py-3 text-xs font-black bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-full transition-all">CANCEL</button>
                    <button disabled={!reason.trim()} onClick={() => onConfirm(reason)}
                        className={`px-8 py-2.5 text-xs rounded-full text-white font-black transition-all flex items-center gap-2 shadow-lg ${isBlocked ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>
                        {isBlocked ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                        {isBlocked ? "Restore" : "Block"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function PermissionCheckboxes({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
    return (
        <div className="grid grid-cols-3 gap-2">
            {allPermissions.map(perm => {
                const isChecked = selected.includes(perm.id);
                const checkedColor = perm.id === "onboarder" ? "border-blue-400 bg-blue-50" : perm.id === "verifier" ? "border-indigo-400 bg-indigo-50" : perm.id === "sub_admin" ? "border-purple-400 bg-purple-50" : "bg-primary/10 border-primary";
                return (
                    <label key={perm.id} className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer text-sm transition ${isChecked ? checkedColor : "hover:bg-muted border-border"}`}>
                        <input type="checkbox" checked={isChecked} onChange={() => onToggle(perm.id)} className="accent-primary w-4 h-4 mt-0.5 shrink-0" />
                        <div><p className="text-xs font-medium leading-tight">{perm.label}</p></div>
                    </label>
                );
            })}
        </div>
    );
}

function PermissionBadge({ permId }: { permId: string }) {
    const isRole = rolePermissions.find(rp => rp.id === permId);
    const perm = allPermissions.find(ap => ap.id === permId);
    if (!perm) return <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px]">{permId}</span>;
    if (isRole) {
        const color = permId === "onboarder" ? "bg-blue-100 text-blue-700 border-blue-200" : permId === "verifier" ? "bg-indigo-100 text-indigo-700 border-indigo-200" : "bg-purple-100 text-purple-700 border-purple-200";
        return <span className={`${color} border px-2 py-0.5 rounded-full text-[10px] font-bold`}>{perm.label}</span>;
    }
    return <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px]">{perm.label}</span>;
}

function RBACTab() {
    const [team, setTeam] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [adding, setAdding] = useState(false);
    const [addErrors, setAddErrors] = useState<Record<string, string>>({});
    const [newMember, setNewMember] = useState({ name: "", email: "", phone: "", role: "", permissions: [] as string[] });
    const [activeEmployees, setActiveEmployees] = useState<any[]>([]);
    const [empSearch, setEmpSearch] = useState("");
    const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editPermissions, setEditPermissions] = useState<string[]>([]);
    const [editRole, setEditRole] = useState("");
    const [saving, setSaving] = useState(false);
    const [blockTarget, setBlockTarget] = useState<any | null>(null);
    const [processing, setProcessing] = useState(false);

    const fetchTeam = useCallback(async () => {
        setLoading(true);
        try { setTeam(await getTeamMembers() as any); } catch { }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchTeam(); }, [fetchTeam]);
    useEffect(() => { getActiveEmployees().then(setActiveEmployees).catch(() => { }); }, []);

    const filteredEmps = activeEmployees.filter(e =>
        e.name.toLowerCase().includes(empSearch.toLowerCase()) || e.email.toLowerCase().includes(empSearch.toLowerCase()) || e.displayId.toLowerCase().includes(empSearch.toLowerCase())
    );

    function selectEmployee(emp: any) {
        setSelectedEmpId(emp.id);
        setNewMember(p => ({ ...p, name: emp.name, email: emp.email, phone: emp.phone ? emp.phone.replace(/^\+91/, '') : '' }));
        setEmpSearch(emp.name);
    }

    function setField(field: string, value: string) {
        setNewMember(p => ({ ...p, [field]: value }));
        setAddErrors(p => { const n = { ...p }; delete n[field]; return n; });
    }

    function validateForm() {
        const errors: Record<string, string> = {};
        const nameErr = validateName(newMember.name); if (nameErr) errors.name = nameErr;
        const emailErr = validateEmail(newMember.email); if (emailErr) errors.email = emailErr;
        if (!newMember.phone || newMember.phone.length !== 10 || !/^\d{10}$/.test(newMember.phone)) errors.phone = "Phone must be 10 digits.";
        if (!newMember.role) errors.role = "Select a role";
        if (newMember.permissions.length === 0) errors.permissions = "Select at least one permission";
        return errors;
    }

    async function handleAddMember() {
        const errors = validateForm();
        if (Object.keys(errors).length > 0) { setAddErrors(errors); return; }
        setAdding(true);
        try {
            await addTeamMember({ name: newMember.name, email: newMember.email, phone: `+91${newMember.phone}`, role: newMember.role, permissions: newMember.permissions });
            setShowAdd(false); setNewMember({ name: "", email: "", phone: "", role: "", permissions: [] }); setAddErrors({}); fetchTeam();
        } catch (e: any) { setAddErrors({ submit: e.message || "Failed to add member." }); }
        finally { setAdding(false); }
    }

    async function handleBlockConfirm(reason: string) {
        if (!blockTarget) return;
        setProcessing(true);
        try {
            const newStatus = blockTarget.status === "REVOKED" ? "ACTIVE" : "REVOKED";
            await updateTeamMemberStatus(blockTarget.id, newStatus, reason); fetchTeam();
        } catch (e: any) { toast.error(e.message || "Failed to update status."); }
        finally { setProcessing(false); setBlockTarget(null); }
    }

    async function saveEdit(memberId: string) {
        setSaving(true);
        try { await updateTeamMemberPermissions(memberId, editPermissions, editRole); setEditingId(null); fetchTeam(); }
        catch (e: any) { toast.error("Failed to save: " + e.message); }
        finally { setSaving(false); }
    }

    return (
        <div className="space-y-6">
            {blockTarget && <BlockModal member={blockTarget} onConfirm={handleBlockConfirm} onCancel={() => setBlockTarget(null)} />}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-slate-900">Team Governance (RBAC)</h2>
                    <p className="text-muted-foreground text-sm">Manage internal staff roles and platform permissions.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchTeam} disabled={loading}><RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
                    <Button onClick={() => { setShowAdd(!showAdd); setAddErrors({}); setNewMember({ name: "", email: "", phone: "", role: "", permissions: [] }); }} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        <UserPlus className="h-4 w-4 mr-2" />Onboard Member
                    </Button>
                </div>
            </div>

            {showAdd && (
                <Card className="border-none shadow-2xl shadow-indigo-900/10 overflow-hidden animate-in slide-in-from-top-4 duration-300">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white"><h3 className="font-black text-xl">Onboard New Team Member</h3><p className="text-indigo-100 text-sm mt-1">Configure internal access and permissions.</p></div>
                    <CardContent className="p-6 space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Select Role *</label>
                            <div className="flex flex-wrap gap-2">
                                {ALL_ROLES.map(role => (
                                    <button key={role} type="button" onClick={() => setField("role", role)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition border-2 ${newMember.role === role ? "border-violet-500 bg-violet-50 text-violet-700" : "border-border text-muted-foreground hover:bg-muted"}`}>
                                        {role}
                                    </button>
                                ))}
                            </div>
                            {addErrors.role && <p className="text-xs text-red-500">{addErrors.role}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">👤 Select Employee <span className="text-xs text-muted-foreground font-normal">(from HR system)</span></label>
                            {activeEmployees.length === 0 ? (
                                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">⚠️ No active employees found.</p>
                            ) : (
                                <div className="relative">
                                    <Input value={empSearch} onChange={e => { setEmpSearch(e.target.value); setSelectedEmpId(null); }} placeholder="Search by name, email or EMP-ID…" />
                                    {empSearch && !selectedEmpId && filteredEmps.length > 0 && (
                                        <div className="absolute z-20 top-full mt-1 w-full bg-white border rounded-xl shadow-xl max-h-56 overflow-y-auto">
                                            {filteredEmps.map(emp => (
                                                <button key={emp.id} onClick={() => selectEmployee(emp)} type="button" className="w-full text-left px-4 py-2.5 hover:bg-blue-50 flex items-center justify-between gap-3 border-b last:border-0">
                                                    <div><p className="text-sm font-medium">{emp.name}</p><p className="text-xs text-muted-foreground">{emp.email}</p></div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {selectedEmpId && <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-medium">✅ {newMember.name}
                                        <button onClick={() => { setSelectedEmpId(null); setEmpSearch(""); setNewMember(p => ({ ...p, name: "", email: "", phone: "" })); }} className="ml-auto text-xs text-muted-foreground hover:text-red-600">✕ Clear</button>
                                    </div>}
                                </div>
                            )}
                        </div>
                        {!selectedEmpId && (
                            <div className="grid grid-cols-2 gap-4">
                                {[{ label: "Full Name *", field: "name", placeholder: "Rohan Sharma", type: "text" }, { label: "Email *", field: "email", placeholder: "rohan@rentpe.in", type: "email" }].map(({ label, field, placeholder, type }) => (
                                    <div key={field} className="space-y-1">
                                        <label className="text-sm font-medium">{label}</label>
                                        <Input type={type} value={(newMember as any)[field]} onChange={e => setField(field, e.target.value)} placeholder={placeholder} className={addErrors[field] ? "border-red-400" : ""} />
                                        {addErrors[field] && <p className="text-xs text-red-500">{addErrors[field]}</p>}
                                    </div>
                                ))}
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Phone *</label>
                                    <div className="flex rounded-lg border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                                        <span className="inline-flex items-center px-3 py-2 bg-muted border-r text-sm font-semibold">+91</span>
                                        <input placeholder="9876543210" maxLength={10} className="flex-1 bg-transparent px-3 py-2 text-sm outline-none" value={newMember.phone} onChange={e => setField("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} />
                                    </div>
                                    {addErrors.phone && <p className="text-xs text-red-500">{addErrors.phone}</p>}
                                </div>
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Permissions</label>
                            <PermissionCheckboxes selected={newMember.permissions} onToggle={id => { setNewMember(p => ({ ...p, permissions: p.permissions.includes(id) ? p.permissions.filter(x => x !== id) : [...p.permissions, id] })); }} />
                            {addErrors.permissions && <p className="text-xs text-red-500">{addErrors.permissions}</p>}
                        </div>
                        {addErrors.submit && <p className="text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded">{addErrors.submit}</p>}
                        <div className="flex gap-3">
                            <Button onClick={handleAddMember} disabled={adding} className="bg-green-600 hover:bg-green-700 text-white">{adding ? "Adding..." : "Add Member"}</Button>
                            <Button variant="outline" onClick={() => { setShowAdd(false); setAddErrors({}); }}>Cancel</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="border-none shadow-xl overflow-hidden">
                <CardContent className="p-0">
                    {loading && team.length === 0 ? <div className="p-8 text-center animate-pulse">Loading team members...</div>
                        : team.length === 0 ? <div className="p-8 text-center text-muted-foreground">No team members found.</div>
                            : (
                                <table className="w-full">
                                    <thead className="bg-muted border-b"><tr>
                                        {["Member", "Role & ID", "Permissions", "Status", "Actions"].map(h => <th key={h} className="p-4 text-left font-medium text-sm">{h}</th>)}
                                    </tr></thead>
                                    <tbody>
                                        {team.map((m: any) => {
                                            const perms: string[] = JSON.parse(m.permissions || "[]");
                                            const isBlocked = m.status === "REVOKED";
                                            const isEditing = editingId === m.id;
                                            return (
                                                <tr key={m.id} className={`border-b hover:bg-muted/5 ${isBlocked ? "bg-red-50/40" : ""}`}>
                                                    <td className="p-4">
                                                        <div className={`font-medium ${isBlocked ? "line-through text-red-400" : ""}`}>{m.name}</div>
                                                        <div className="text-xs text-muted-foreground">{m.email}</div>
                                                        <div className="text-[10px] text-muted-foreground mt-0.5">Added: {new Date(m.addedOn).toLocaleDateString('en-IN')}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        {isEditing ? <select value={editRole} onChange={e => setEditRole(e.target.value)} className="w-full border rounded-md p-1.5 text-xs">{ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select>
                                                            : <><span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold block mb-1">{m.role}</span><span className="font-mono text-[10px] text-muted-foreground bg-gray-100 px-1.5 py-0.5 rounded">{m.displayId}</span></>}
                                                    </td>
                                                    <td className="p-4 max-w-xs">
                                                        {isEditing ? <PermissionCheckboxes selected={editPermissions} onToggle={id => setEditPermissions(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])} />
                                                            : <div className="flex flex-wrap gap-1">{perms.map((p: string) => <PermissionBadge key={p} permId={p} />)}</div>}
                                                    </td>
                                                    <td className="p-4">
                                                        {isBlocked ? <span className="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-800">🚫 Blocked</span> : <span className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-800">✅ Active</span>}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex flex-col gap-1.5">
                                                            {isEditing ? (<>
                                                                <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white" disabled={saving} onClick={() => saveEdit(m.id)}><Check className="h-3 w-3 mr-1" />{saving ? "Saving..." : "Save"}</Button>
                                                                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditingId(null)}><X className="h-3 w-3 mr-1" />Cancel</Button>
                                                            </>) : (<>
                                                                <Button size="sm" variant="outline" className="h-8 text-xs border-blue-300 text-blue-700" onClick={() => { setEditingId(m.id); setEditPermissions(JSON.parse(m.permissions || "[]")); setEditRole(m.role); }}><Pencil className="h-3 w-3 mr-1" />Edit</Button>
                                                                <Button size="sm" variant={isBlocked ? "outline" : "destructive"} className={`h-8 text-xs ${isBlocked ? "border-green-300 text-green-700" : ""}`} disabled={processing} onClick={() => setBlockTarget(m)}>
                                                                    {isBlocked ? <><ShieldCheck className="h-3 w-3 mr-1" />Unblock</> : <><ShieldOff className="h-3 w-3 mr-1" />Block</>}
                                                                </Button>
                                                            </>)}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                </CardContent>
            </Card>
        </div>
    );
}

// ─── INTERNAL STAFF TAB ───────────────────────────────────────

function InternalStaffTab() {
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({ name: "", email: "", phone: "", department: "Verification Team", role: "Verifier", permissions: [] as string[] });

    useEffect(() => { loadEmployees(); }, []);

    const loadEmployees = async () => {
        try { const data = await getAdminEmployees(); setEmployees(data); }
        catch { toast.error("Failed to load staff records"); }
        finally { setLoading(false); }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault(); setSubmitting(true);
        try {
            await createAdminEmployee(formData); toast.success("Staff member registered");
            setIsAddOpen(false); loadEmployees();
            setFormData({ name: "", email: "", phone: "", department: "Verification Team", role: "Verifier", permissions: [] });
        } catch (error: any) { toast.error(error.message || "Failed to create staff member"); }
        finally { setSubmitting(false); }
    };

    const handleStatusToggle = async (id: string, currentStatus: string) => {
        try {
            const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
            await updateAdminEmployee(id, { status: newStatus });
            toast.success(`Staff member ${newStatus === "ACTIVE" ? "activated" : "suspended"}`); loadEmployees();
        } catch { toast.error("Failed to update status"); }
    };

    const togglePermission = (permId: string) => setFormData(prev => ({ ...prev, permissions: prev.permissions.includes(permId) ? prev.permissions.filter(p => p !== permId) : [...prev.permissions, permId] }));

    const filtered = employees.filter(emp => emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || emp.email.toLowerCase().includes(searchTerm.toLowerCase()) || emp.displayId.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-indigo-600 p-6 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                <div className="relative z-10">
                    <h2 className="text-xl font-bold text-white">Internal Staff Registry</h2>
                    <p className="text-indigo-100/80 text-sm mt-1">RentPe platform employees with module-level access</p>
                </div>
                <button onClick={() => setIsAddOpen(true)} className="relative z-10 flex items-center gap-2 bg-white text-indigo-600 hover:bg-indigo-50 px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg active:scale-95">
                    <UserPlus size={18} />Register New Staff
                </button>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Search by name, email or Staff ID..." className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xl">
                <table className="w-full text-left">
                    <thead><tr className="bg-slate-50 border-b border-slate-200">
                        {["Employee", "Department & Role", "Status", "Modules", "Actions"].map(h => <th key={h} className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">{h}</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? <tr><td colSpan={5} className="text-center py-16 text-slate-400">Loading staff...</td></tr>
                            : filtered.length === 0 ? <tr><td colSpan={5} className="text-center py-16 text-slate-400">No staff found.</td></tr>
                                : filtered.map(emp => (
                                    <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg">{emp.name[0]}</div>
                                                <div><div className="font-bold text-slate-900">{emp.name}</div><div className="text-[10px] font-black text-slate-400 uppercase">{emp.displayId}</div></div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4"><span className="text-sm font-bold text-slate-700">{emp.department}</span><br /><span className="text-[10px] text-indigo-600 font-black uppercase">{emp.role}</span></td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${emp.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'}`}>
                                                {emp.status === 'ACTIVE' ? <CheckCircle2 size={13} /> : <XCircle size={13} />}{emp.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {(JSON.parse(emp.permissions || "[]") as string[]).slice(0, 3).map((p: string) => (
                                                    <span key={p} className="text-[9px] font-black bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded text-indigo-700 uppercase">{p}</span>
                                                ))}
                                                {(JSON.parse(emp.permissions || "[]") as string[]).length > 3 && <span className="text-[10px] font-bold text-slate-400">+{(JSON.parse(emp.permissions || "[]") as string[]).length - 3}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleStatusToggle(emp.id, emp.status)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-all" title={emp.status === 'ACTIVE' ? 'Suspend' : 'Activate'}>
                                                    {emp.status === 'ACTIVE' ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                    </tbody>
                </table>
            </div>

            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddOpen(false)} />
                    <div className="relative bg-white border w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-7 border-b bg-gradient-to-r from-indigo-50 to-transparent">
                            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3"><Shield className="text-indigo-600" />Onboard Internal Staff</h2>
                            <p className="text-slate-500 text-sm mt-1">Register a new platform-level employee with specific permissions.</p>
                        </div>
                        <form onSubmit={handleCreate} className="p-7 space-y-6 max-h-[65vh] overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {[{ label: "Full Name", key: "name", type: "text" }, { label: "Email Address", key: "email", type: "email" }, { label: "Mobile Number", key: "phone", type: "tel" }].map(f => (
                                    <div key={f.key} className="space-y-1">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">{f.label}</label>
                                        <input required type={f.type} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                            value={(formData as any)[f.key]} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })} />
                                    </div>
                                ))}
                                <div className="space-y-1">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Department</label>
                                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })}>
                                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Shield size={15} />Module Access Permissions</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {MODULES.map(mod => (
                                        <button key={mod.id} type="button" onClick={() => togglePermission(mod.id)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-left text-[11px] font-bold ${formData.permissions.includes(mod.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}>
                                            <div className={`w-3.5 h-3.5 rounded-sm border ${formData.permissions.includes(mod.id) ? 'bg-white border-white' : 'border-slate-300'} flex items-center justify-center`}>
                                                {formData.permissions.includes(mod.id) && <CheckCircle2 size={9} className="text-indigo-600" />}
                                            </div>
                                            {mod.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setIsAddOpen(false)} className="px-7 py-2.5 text-xs font-black bg-indigo-100 text-indigo-800 rounded-full">CANCEL</button>
                                <button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-9 py-2.5 rounded-full font-black shadow-lg flex items-center gap-2">
                                    {submitting ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <UserPlus size={16} />}{submitting ? "Registering..." : "Onboard Employee"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── MAIN PAGE ────────────────────────────────────────────────

export default function InternalTeamPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialTab = searchParams.get("tab") === "staff" ? "staff" : "roles";
    const [activeTab, setActiveTab] = useState(initialTab);

    const switchTab = (tab: string) => {
        setActiveTab(tab);
        router.replace(`/dashboard/admin/internal-team?tab=${tab}`, { scroll: false });
    };

    return (
        <div className="space-y-4 md:space-y-6 pb-20 md:pb-8">
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
                    <Users className="h-7 w-7 text-indigo-600" /> Internal Team Hub
                </h1>
                <p className="text-muted-foreground text-sm mt-1">RBAC Roles & Internal Staff management</p>
            </div>

            <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
                {[
                    { id: "roles", label: "🔐 RBAC Roles" },
                    { id: "staff", label: "👥 Internal Staff" },
                ].map(t => (
                    <button key={t.id} onClick={() => switchTab(t.id)}
                        className={`px-5 py-2 rounded-lg text-xs font-black transition-all uppercase tracking-wider ${activeTab === t.id ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-700"}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === "roles" ? <RBACTab /> : <InternalStaffTab />}
        </div>
    );
}
