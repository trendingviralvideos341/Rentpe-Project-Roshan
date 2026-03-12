"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, ShieldOff, ShieldCheck, RefreshCcw, Pencil, X, Check, AlertTriangle } from "lucide-react";
import { getTeamMembers, addTeamMember, updateTeamMemberStatus, updateTeamMemberPermissions } from "@/actions/team";
import { getActiveEmployees } from "@/actions/employee";
import { validateEmail, validatePhone, validateName, normalizePhone } from "@/lib/validators";

const rolePermissions = [
    { id: "onboarder", label: "🏃 Onboarder", desc: "Can onboard property owners" },
    { id: "verifier", label: "🔍 Verifier", desc: "Can verify owner documents" },
    { id: "sub_admin", label: "🔑 Sub Admin", desc: "Limited admin access" },
];
const operationalPermissions = [
    { id: "login_issues", label: "Login & Auth Issues" },
    { id: "payment_failed", label: "Payment Failed / Refunds" },
    { id: "booking_disputes", label: "Booking Disputes" },
    { id: "user_verification", label: "User Verification (KYC)" },
    { id: "ban_users", label: "Block / Unblock Users" },
    { id: "property_moderation", label: "Property Moderation" },
    { id: "support_tickets", label: "Support Tickets" },
    { id: "transaction_view", label: "View Transactions" },
    { id: "reports", label: "Reports & Analytics" },
];
const allPermissions = [...rolePermissions, ...operationalPermissions];
const ALL_ROLES = ["Support Agent", "Finance Ops", "Customer Care", "Operations", "Field Executive", "Team Lead"];


// ── Block Confirmation Modal ─────────────────────────────
function BlockModal({
    member, onConfirm, onCancel
}: { member: any; onConfirm: (reason: string) => void; onCancel: () => void }) {
    const [reason, setReason] = useState("");
    const isBlocked = member.status === "REVOKED";
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${isBlocked ? "bg-green-100" : "bg-red-100"}`}>
                        <AlertTriangle className={`h-5 w-5 ${isBlocked ? "text-green-600" : "text-red-600"}`} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">{isBlocked ? "Unblock" : "Block"} Access</h3>
                        <p className="text-sm text-muted-foreground">{member.name} · {member.email}</p>
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium">Reason *</label>
                    <textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder={isBlocked ? "Why are you restoring access?" : "Why are you blocking this member?"}
                        className="w-full border rounded-lg p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
                <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button
                        disabled={!reason.trim()}
                        onClick={() => onConfirm(reason)}
                        className={isBlocked ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}>
                        {isBlocked ? "✅ Restore Access" : "🚫 Block Access"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ── Permission Checkboxes ────────────────────────────────
function PermissionCheckboxes({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
    return (
        <div className="grid grid-cols-3 gap-2">
            {allPermissions.map(perm => {
                const isRole = rolePermissions.find(rp => rp.id === perm.id);
                const isChecked = selected.includes(perm.id);
                const checkedColor = perm.id === "onboarder" ? "border-blue-400 bg-blue-50"
                    : perm.id === "verifier" ? "border-indigo-400 bg-indigo-50"
                        : perm.id === "sub_admin" ? "border-purple-400 bg-purple-50"
                            : "bg-primary/10 border-primary";
                return (
                    <label key={perm.id} className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer text-sm transition ${isChecked ? checkedColor : "hover:bg-muted border-border"}`}>
                        <input type="checkbox" checked={isChecked} onChange={() => onToggle(perm.id)} className="accent-primary w-4 h-4 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-xs font-medium leading-tight">{perm.label}</p>
                            {isRole && (perm as any).desc && <p className="text-[10px] text-muted-foreground">{(perm as any).desc}</p>}
                        </div>
                    </label>
                );
            })}
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────
export default function AdminTeamPage() {
    const [team, setTeam] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [adding, setAdding] = useState(false);
    const [addErrors, setAddErrors] = useState<Record<string, string>>({});
    const [newMember, setNewMember] = useState({ name: "", email: "", phone: "", role: "", permissions: [] as string[] }); // Changed phone to empty string
    const [activeEmployees, setActiveEmployees] = useState<any[]>([]);
    const [empSearch, setEmpSearch] = useState("");
    const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editPermissions, setEditPermissions] = useState<string[]>([]);
    const [editRole, setEditRole] = useState("");
    const [saving, setSaving] = useState(false);

    // Block modal state
    const [blockTarget, setBlockTarget] = useState<any | null>(null);
    const [processing, setProcessing] = useState(false);

    const fetchTeam = useCallback(async () => {
        setLoading(true);
        try { setTeam(await getTeamMembers() as any); } catch { }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchTeam(); }, [fetchTeam]);
    useEffect(() => {
        getActiveEmployees().then(setActiveEmployees).catch(() => { });
    }, []);

    const filteredEmps = activeEmployees.filter(e =>
        e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
        e.email.toLowerCase().includes(empSearch.toLowerCase()) ||
        e.displayId.toLowerCase().includes(empSearch.toLowerCase())
    );

    function selectEmployee(emp: any) {
        setSelectedEmpId(emp.id);
        // Extract 10 digits from phone if it starts with +91, otherwise use as is
        const empPhoneDigits = emp.phone ? emp.phone.replace(/^\+91/, '') : '';
        setNewMember(p => ({ ...p, name: emp.name, email: emp.email, phone: empPhoneDigits }));
        setEmpSearch(emp.name);
        setAddErrors(p => { const n = { ...p }; delete n.name; delete n.email; delete n.phone; return n; });
    }

    // ── Form field helpers ──
    function setField(field: string, value: string) {
        setNewMember(p => ({ ...p, [field]: value }));
        // Clear error on change
        setAddErrors(p => { const n = { ...p }; delete n[field]; return n; });
    }

    function validateForm() {
        const errors: Record<string, string> = {};
        const nameErr = validateName(newMember.name); if (nameErr) errors.name = nameErr;
        const emailErr = validateEmail(newMember.email); if (emailErr) errors.email = emailErr;
        // Validate phone as 10 digits
        if (!newMember.phone || newMember.phone.length !== 10 || !/^\d{10}$/.test(newMember.phone)) {
            errors.phone = "Phone number must be 10 digits.";
        }
        if (!newMember.role) errors.role = "Select a role";
        if (newMember.permissions.length === 0) errors.permissions = "Select at least one permission";
        return errors;
    }

    const toggleNewPermission = (id: string) => {
        setNewMember(p => ({ ...p, permissions: p.permissions.includes(id) ? p.permissions.filter(x => x !== id) : [...p.permissions, id] }));
        setAddErrors(p => { const n = { ...p }; delete n.permissions; return n; });
    };

    async function handleAddMember() {
        const errors = validateForm();
        if (Object.keys(errors).length > 0) { setAddErrors(errors); return; }
        setAdding(true);
        try {
            // Prepend +91 to the 10-digit phone number before sending
            const phoneWithPrefix = `+91${newMember.phone}`;
            await addTeamMember({ name: newMember.name, email: newMember.email, phone: phoneWithPrefix, role: newMember.role, permissions: newMember.permissions });
            setShowAdd(false);
            setNewMember({ name: "", email: "", phone: "", role: "", permissions: [] }); // Reset phone to empty
            setAddErrors({});
            fetchTeam();
        } catch (e: any) { setAddErrors({ submit: e.message || "Failed to add member." }); }
        finally { setAdding(false); }
    }

    // ── Block/Unblock ──
    async function handleBlockConfirm(reason: string) {
        if (!blockTarget) return;
        setProcessing(true);
        try {
            const newStatus = blockTarget.status === "REVOKED" ? "ACTIVE" : "REVOKED";
            await updateTeamMemberStatus(blockTarget.id, newStatus, reason);
            fetchTeam();
        } catch (e: any) { alert(e.message); }
        finally { setProcessing(false); setBlockTarget(null); }
    }

    // ── Edit ──
    function startEdit(member: any) { setEditingId(member.id); setEditPermissions(JSON.parse(member.permissions || "[]")); setEditRole(member.role); }
    function cancelEdit() { setEditingId(null); }
    async function saveEdit(memberId: string) {
        setSaving(true);
        try { await updateTeamMemberPermissions(memberId, editPermissions, editRole); cancelEdit(); fetchTeam(); }
        catch (e: any) { alert("Failed to save: " + e.message); }
        finally { setSaving(false); }
    }

    function PermissionBadge({ permId }: { permId: string }) {
        const isRole = rolePermissions.find(rp => rp.id === permId);
        const perm = allPermissions.find(ap => ap.id === permId);
        if (!perm) return <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px]">{permId}</span>;
        if (isRole) {
            const color = permId === "onboarder" ? "bg-blue-100 text-blue-700 border-blue-200"
                : permId === "verifier" ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                    : "bg-purple-100 text-purple-700 border-purple-200";
            return <span className={`${color} border px-2 py-0.5 rounded-full text-[10px] font-bold`}>{perm.label}</span>;
        }
        return <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px]">{perm.label}</span>;
    }

    return (
        <div className="space-y-6">
            {blockTarget && <BlockModal member={blockTarget} onConfirm={handleBlockConfirm} onCancel={() => setBlockTarget(null)} />}

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Team Access</h1>
                    <p className="text-muted-foreground">Manage team members, roles and permissions.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchTeam} disabled={loading}><RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
                    <Button onClick={() => { setShowAdd(!showAdd); setAddErrors({}); setNewMember({ name: "", email: "", phone: "", role: "", permissions: [] }); }}><UserPlus className="h-4 w-4 mr-2" />Add Member</Button>
                </div>
            </div>

            {/* ── ADD FORM ── */}
            {showAdd && (
                <Card className="border-primary/30 border-2">
                    <CardContent className="p-6 space-y-5">
                        <h3 className="font-bold text-lg">Add New Team Member</h3>

                        {/* Role chips */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Select Role *</label>
                            <div className="flex flex-wrap gap-2">
                                {ALL_ROLES.map(role => {
                                    const isSelected = newMember.role === role;
                                    return (
                                        <button key={role} type="button"
                                            onClick={() => { setField("role", role); }}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition border-2 ${isSelected
                                                ? "border-violet-500 bg-gradient-to-r from-violet-50 to-purple-50 text-violet-700 shadow-sm"
                                                : "border-border text-muted-foreground hover:bg-muted"}`}>
                                            {role}
                                        </button>
                                    );
                                })}
                            </div>
                            {addErrors.role && <p className="text-xs text-red-500">{addErrors.role}</p>}
                        </div>

                        {/* Employee Picker */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium flex items-center gap-2">
                                👤 Select Active Employee <span className="text-xs text-muted-foreground font-normal">(from HR system)</span>
                            </label>
                            {activeEmployees.length === 0 ? (
                                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    ⚠️ No active employees found. Go to <strong>Employees</strong> tab to onboard and activate staff first.
                                </p>
                            ) : (
                                <div className="relative">
                                    <Input value={empSearch} onChange={e => { setEmpSearch(e.target.value); setSelectedEmpId(null); }}
                                        placeholder="Search by name, email or EMP-ID…" className="pr-8" />
                                    {empSearch && !selectedEmpId && filteredEmps.length > 0 && (
                                        <div className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-gray-900 border rounded-xl shadow-xl max-h-56 overflow-y-auto">
                                            {filteredEmps.map(emp => (
                                                <button key={emp.id} onClick={() => selectEmployee(emp)} type="button"
                                                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 flex items-center justify-between gap-3 border-b last:border-0">
                                                    <div>
                                                        <p className="text-sm font-medium">{emp.name}</p>
                                                        <p className="text-xs text-muted-foreground">{emp.email} · {emp.department}/{emp.designation}</p>
                                                    </div>
                                                    <span className={`text-xs font-mono ${emp.empCode ? 'text-indigo-600 font-bold' : 'text-muted-foreground'}`}>
                                                        {emp.empCode || emp.displayId}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {selectedEmpId && (
                                        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-medium">
                                            ✅ {newMember.name} · {newMember.email}
                                            <button onClick={() => { setSelectedEmpId(null); setEmpSearch(""); setNewMember(p => ({ ...p, name: "", email: "", phone: "" })); }}
                                                className="ml-auto text-xs text-muted-foreground hover:text-red-600">✕ Clear</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Fields shown when no employee selected (manual) or always for phone override */}
                        {!selectedEmpId && (
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: "Full Name *", field: "name", placeholder: "Rohan Sharma", type: "text" },
                                    { label: "Email *", field: "email", placeholder: "rohan@rentpe.in", type: "email" },
                                ].map(({ label, field, placeholder, type }) => (
                                    <div key={field} className="space-y-1">
                                        <label className="text-sm font-medium">{label}</label>
                                        <Input
                                            type={type}
                                            value={(newMember as any)[field]}
                                            onChange={e => setField(field, e.target.value)}
                                            placeholder={placeholder}
                                            className={addErrors[field] ? "border-red-400 focus-visible:ring-red-400" : ""}
                                        />
                                        {addErrors[field] && <p className="text-xs text-red-500">{addErrors[field]}</p>}
                                    </div>
                                ))}
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium">Phone Number *</label>
                                        <div className="flex rounded-lg border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-muted border-r border-input text-sm font-semibold text-foreground select-none whitespace-nowrap shrink-0">
                                            <span className="text-muted-foreground">+91</span>
                                            </span>
                                            <input
                                                placeholder="9876543210"
                                                maxLength={10}
                                                className={`flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground ${addErrors.phone ? "border-red-400" : ""}`}
                                                value={newMember.phone}
                                                onChange={e => setField("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                                            />
                                        </div>
                                        {addErrors.phone && <p className="text-xs text-red-500">{addErrors.phone}</p>}
                                    </div>
                            </div>
                        )}

                        {/* Permissions */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Permissions</label>
                            <PermissionCheckboxes selected={newMember.permissions} onToggle={toggleNewPermission} />
                            {addErrors.permissions && <p className="text-xs text-red-500">{addErrors.permissions}</p>}
                        </div>

                        {addErrors.submit && <p className="text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded">{addErrors.submit}</p>}

                        <div className="flex gap-2">
                            <Button onClick={handleAddMember} disabled={adding} className="bg-green-600 hover:bg-green-700 text-white">
                                {adding ? "Adding..." : "Add Member"}
                            </Button>
                            <Button variant="outline" onClick={() => { setShowAdd(false); setAddErrors({}); setNewMember({ name: "", email: "", phone: "+91", role: "", permissions: [] }); }}>Cancel</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── TEAM TABLE ── */}
            <Card>
                <CardContent className="p-0">
                    {loading && team.length === 0 ? (
                        <div className="p-8 text-center animate-pulse">Loading team members...</div>
                    ) : team.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">No team members found. Click &quot;Add Member&quot; to get started.</div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-muted border-b">
                                <tr>
                                    <th className="p-4 text-left font-medium">Member</th>
                                    <th className="p-4 text-left font-medium">Role & ID</th>
                                    <th className="p-4 text-left font-medium">Permissions</th>
                                    <th className="p-4 text-left font-medium">Status & History</th>
                                    <th className="p-4 text-left font-medium">Actions</th>
                                </tr>
                            </thead>
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
                                                {m.phone && <div className="text-xs text-muted-foreground">{m.phone}</div>}
                                                <div className="text-[10px] text-muted-foreground mt-0.5">Added: {new Date(m.addedOn).toLocaleDateString('en-IN')}</div>
                                            </td>
                                            <td className="p-4">
                                                {isEditing ? (
                                                    <select value={editRole} onChange={e => setEditRole(e.target.value)}
                                                        className="w-full border rounded-md p-1.5 text-xs">
                                                        {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                                    </select>
                                                ) : (
                                                    <>
                                                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold block mb-1">{m.role}</span>
                                                        <span className="font-mono text-[10px] text-muted-foreground bg-gray-100 px-1.5 py-0.5 rounded">{m.displayId}</span>
                                                    </>
                                                )}
                                            </td>
                                            <td className="p-4 max-w-xs">
                                                {isEditing ? (
                                                    <PermissionCheckboxes selected={editPermissions} onToggle={id => setEditPermissions(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])} />
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        {perms.map((p: string) => <PermissionBadge key={p} permId={p} />)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 min-w-[200px]">
                                                {isBlocked
                                                    ? <span className="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-800">🚫 Blocked</span>
                                                    : <span className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-800">✅ Active</span>
                                                }
                                                {m.actionNotes && m.actionNotes.length > 0 && (
                                                    <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                                                        {m.actionNotes.map((note: any, i: number) => (
                                                            <div key={i} className={`text-[10px] p-1.5 rounded border ${note.action === "REVOKED" ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"}`}>
                                                                <div className="font-bold">{note.action === "REVOKED" ? "🚫 Blocked" : "✅ Unblocked"}</div>
                                                                <div>📝 {note.reason}</div>
                                                                <div className="font-mono">{new Date(note.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1.5">
                                                    {isEditing ? (
                                                        <>
                                                            <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white" disabled={saving} onClick={() => saveEdit(m.id)}>
                                                                <Check className="h-3 w-3 mr-1" />{saving ? "Saving..." : "Save"}
                                                            </Button>
                                                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={cancelEdit}>
                                                                <X className="h-3 w-3 mr-1" />Cancel
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button size="sm" variant="outline" className="h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => startEdit(m)}>
                                                                <Pencil className="h-3 w-3 mr-1" />Edit
                                                            </Button>
                                                            <Button size="sm" variant={isBlocked ? "outline" : "destructive"}
                                                                className={`h-8 text-xs ${isBlocked ? "border-green-300 text-green-700 hover:bg-green-50" : ""}`}
                                                                disabled={processing}
                                                                onClick={() => setBlockTarget(m)}>
                                                                {isBlocked ? <><ShieldCheck className="h-3 w-3 mr-1" />Unblock</> : <><ShieldOff className="h-3 w-3 mr-1" />Block</>}
                                                            </Button>
                                                        </>
                                                    )}
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
