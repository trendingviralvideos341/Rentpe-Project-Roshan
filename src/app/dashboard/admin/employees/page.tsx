"use client";

import { useState, useEffect, useCallback } from "react";
import { validateEmail, validatePhone, validateName, validateAadhaar, validatePAN, normalizePhone } from "@/lib/validators";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PincodeAddress from "@/components/ui/PincodeAddress";
import {
    UserPlus, UserCheck, RefreshCcw, AlertTriangle, Shield, FileText,
    CheckCircle, XCircle, Clock, Search, ChevronDown, ChevronUp,
    Briefcase, Phone, Mail, MapPin, User, Calendar, IndianRupee
} from "lucide-react";
import {
    getEmployees, addEmployee, updateEmployeeStatus,
    activateEmployee, verifyEmployeeDoc, updateBackgroundCheck, updateEmployeePermissions,
    generateEmpCode, editEmpCode, unsuspendEmployee
} from "@/actions/employee";

// ── Constants ──────────────────────────────────────────────────────────────
const DEPARTMENTS = ["Onboarder", "Verifier", "Support", "Finance", "Operations", "Field Executive", "Tech", "HR"];
const DESIGNATIONS: Record<string, string[]> = {
    "Onboarder": ["Junior Onboarder", "Senior Onboarder", "Onboarding Lead"],
    "Verifier": ["Document Verifier", "Senior Verifier", "Verification Lead"],
    "Support": ["Support Agent", "Support Lead", "Customer Success"],
    "Finance": ["Finance Analyst", "Finance Ops", "Accounts Executive"],
    "Operations": ["Operations Executive", "Operations Manager"],
    "Field Executive": ["Field Agent", "Senior Field Agent"],
    "Tech": ["Developer", "QA Engineer", "DevOps"],
    "HR": ["HR Executive", "HR Manager"],
};
const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"];
const operationalPermissions = [
    { id: "onboarder", label: "🏃 Onboarder Role" },
    { id: "verifier", label: "🔍 Verifier Role" },
    { id: "sub_admin", label: "🔑 Sub Admin" },
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

// ── Status helpers ──────────────────────────────────────────────────────────
const STATUS_META: Record<string, { color: string; bg: string; label: string; icon: string }> = {
    PENDING_DOCS: { color: "text-amber-700", bg: "bg-amber-50  border-amber-200", label: "Pending Docs", icon: "📋" },
    DOCS_SUBMITTED: { color: "text-blue-700", bg: "bg-blue-50   border-blue-200", label: "Docs Submitted", icon: "📄" },
    BACKGROUND_CHECK: { color: "text-purple-700", bg: "bg-purple-50 border-purple-200", label: "Background Check", icon: "🔍" },
    ACTIVE: { color: "text-green-700", bg: "bg-green-50  border-green-200", label: "Active", icon: "✅" },
    SUSPENDED: { color: "text-orange-700", bg: "bg-orange-50 border-orange-200", label: "Suspended", icon: "⏸️" },
    TERMINATED: { color: "text-red-700", bg: "bg-red-50    border-red-200", label: "Terminated", icon: "🚫" },
    REJECTED: { color: "text-gray-700", bg: "bg-gray-50   border-gray-200", label: "Rejected", icon: "❌" },
};

const BG_META: Record<string, { color: string; bg: string; label: string }> = {
    PENDING: { color: "text-gray-500", bg: "bg-gray-50  border-gray-200", label: "⏳ Pending" },
    IN_PROGRESS: { color: "text-blue-600", bg: "bg-blue-50  border-blue-200", label: "🔍 In Progress" },
    CLEARED: { color: "text-green-600", bg: "bg-green-50 border-green-200", label: "✅ Cleared" },
    FLAGGED: { color: "text-red-600", bg: "bg-red-50   border-red-200", label: "❌ Rejected" },
};



// ── Inline Doc Viewer Modal ─────────────────────────────────────────────────
function DocViewer({ label, docData, docName, verified, onVerify, onClose }: {
    label: string; docData: string; docName?: string; verified: boolean;
    onVerify: () => void; onClose: () => void;
}) {
    const isPDF = docData.startsWith('data:application/pdf');
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col max-w-3xl w-full max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b">
                    <div>
                        <p className="font-semibold text-sm">{label}</p>
                        {docName && <p className="text-xs text-muted-foreground">{docName}</p>}
                    </div>
                    <div className="flex gap-2 items-center">
                        {!verified && (
                            <button onClick={() => { onVerify(); onClose(); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg font-semibold transition">
                                ✔ Verify Document
                            </button>
                        )}
                        {verified && <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-lg">✅ Verified</span>}
                        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg font-bold px-2">✕</button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                    {isPDF ? (
                        <iframe src={docData} className="w-full" style={{ height: '60vh' }} title={docName} />
                    ) : (
                        <img src={docData} alt={docName} className="max-w-full max-h-[60vh] object-contain rounded-lg shadow" />
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Action modal ────────────────────────────────────────────────────────────
function ActionModal({ title, subtitle, placeholder, confirmLabel, confirmClass, onConfirm, onCancel }:
    { title: string; subtitle: string; placeholder: string; confirmLabel: string; confirmClass: string; onConfirm: (r: string) => void; onCancel: () => void }) {
    const [reason, setReason] = useState("");
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <div>
                        <h3 className="font-bold text-lg">{title}</h3>
                        <p className="text-sm text-muted-foreground">{subtitle}</p>
                    </div>
                </div>
                <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder={placeholder}
                    className="w-full border rounded-lg p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary" />
                <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button disabled={!reason.trim()} onClick={() => onConfirm(reason)} className={confirmClass}>{confirmLabel}</Button>
                </div>
            </div>
        </div>
    );
}

// removed fileToBase64 utility as we now use raw File objects for better performance

// ── Doc Upload field ────────────────────────────────────────────────────────
function DocUpload({ label, docData, docName, verified, onUpload, onVerify }:
    { label: string; docData?: string; docName?: string; verified: boolean; onUpload: (data: string | File, name: string) => void; onVerify: () => void }) {
    const [viewing, setViewing] = useState(false);
    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert("File too large (max 5MB)"); return; }
        onUpload(file, file.name);
    };
    return (
        <>
            {viewing && docData && (
                <DocViewer label={label} docData={docData} docName={docName} verified={verified}
                    onVerify={onVerify} onClose={() => setViewing(false)} />
            )}
            <div className={`border-2 rounded-xl p-4 space-y-2 ${verified ? "border-green-300 bg-green-50/30" : docData ? "border-blue-300 bg-blue-50/30" : "border-dashed border-border"}`}>
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{label}</p>
                    {verified && <span className="text-xs text-green-700 font-bold bg-green-100 px-2 py-0.5 rounded-full">✅ Verified</span>}
                    {!verified && docData && <span className="text-xs text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded-full">📄 Uploaded</span>}
                </div>
                {docData ? (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-500" />
                            <span className="text-xs text-muted-foreground truncate max-w-[120px]">{docName}</span>
                        </div>
                        <div className="flex gap-1.5 items-center">
                            <button onClick={() => setViewing(true)}
                                className="text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md font-medium transition">
                                👁 View
                            </button>
                            {!verified && (
                                <button onClick={onVerify}
                                    className="text-xs text-white bg-green-600 hover:bg-green-700 px-2 py-1 rounded-md font-semibold transition">
                                    ✔ Verify
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <label className="flex flex-col items-center gap-1 cursor-pointer py-2">
                        <FileText className="h-6 w-6 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Click to upload PDF / Image (max 5MB)</span>
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
                    </label>
                )}
            </div>
        </>
    );
}

// ── EMP Code Modal ──────────────────────────────────────────────────────────
function EmpCodeModal({ empId, currentCode, onClose, onSaved }: {
    empId: string; currentCode: string | null; onClose: () => void; onSaved: () => void;
}) {
    // Always start in view/generate mode — never in edit mode by default
    const [editMode, setEditMode] = useState(false);
    const [code, setCode] = useState(currentCode || "");
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    async function handleGenerate() {
        setLoading(true); setErr("");
        try { await generateEmpCode(empId); onSaved(); }
        catch (e: any) { setErr(e.message); setLoading(false); }
    }
    async function handleSave() {
        if (!notes.trim()) { setErr("Notes are mandatory when manually editing code"); return; }
        setLoading(true); setErr("");
        try { await editEmpCode(empId, code, notes); onSaved(); }
        catch (e: any) { setErr(e.message); setLoading(false); }
    }

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-full"><UserCheck className="h-5 w-5 text-indigo-600" /></div>
                    <div>
                        <h3 className="font-bold text-lg">Employee ID</h3>
                        <p className="text-xs text-muted-foreground">System assigns IDs sequentially (e.g. EMP102, EMP103...)</p>
                    </div>
                </div>

                {/* Current code display */}
                {currentCode && !editMode && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">Current Employee Code</p>
                            <p className="text-2xl font-bold text-indigo-700 font-mono">{currentCode}</p>
                        </div>
                        <button onClick={() => setEditMode(true)}
                            className="px-3 py-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition">
                            ✏️ Edit
                        </button>
                    </div>
                )}

                {/* Generate (first time) */}
                {!currentCode && !editMode && (
                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">No employee code assigned yet. Click below to generate the next available code automatically.</p>
                        <button onClick={handleGenerate} disabled={loading}
                            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition disabled:opacity-50">
                            {loading ? "Generating..." : "⚡ Generate Employee Code"}
                        </button>
                    </div>
                )}

                {/* Edit mode */}
                {editMode && (
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Employee Code <span className="text-red-500">*</span></label>
                            <input value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setErr(""); }}
                                placeholder="e.g. EMP102" className="w-full border rounded-lg p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            <p className="text-xs text-muted-foreground">Format: EMP followed by number (EMP101, EMP102…)</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Reason / Notes <span className="text-red-500">* mandatory</span></label>
                            <textarea value={notes} onChange={e => { setNotes(e.target.value); setErr(""); }}
                                placeholder="Reason for manual edit (system skipped a number, correction, etc.)..."
                                className="w-full border rounded-lg p-2.5 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                    </div>
                )}

                {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{err}</p>}

                <div className="flex gap-2 justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted font-medium">Cancel</button>
                    {editMode && (
                        <button onClick={handleSave} disabled={loading}
                            className="px-5 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition disabled:opacity-50">
                            {loading ? "Saving..." : "💾 Save Code"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function AdminEmployeesPage() {
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("ALL");
    const [filterDept, setFilterDept] = useState("ALL");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [actionModal, setActionModal] = useState<{ empId: string; type: string } | null>(null);
    const [bgModal, setBgModal] = useState<{ empId: string } | null>(null);
    const [bgStatus, setBgStatus] = useState<"IN_PROGRESS" | "CLEARED" | "FLAGGED">("IN_PROGRESS");
    const [empCodeModal, setEmpCodeModal] = useState<{ empId: string; currentCode: string | null } | null>(null);
    const [processing, setProcessing] = useState(false);

    // Add form state
    const [form, setForm] = useState({
        name: "", email: "", phone: "+91",
        dateOfBirth: "", gender: "", permanentAddress: "", currentAddress: "",
        emergencyContactName: "", emergencyContactPhone: "+91", emergencyContactRel: "",
        department: "", designation: "", permissions: [] as string[],
        joiningDate: "", salary: "", employmentType: "FULL_TIME",
        aadhaarNumber: "", panNumber: "",
    });
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [adding, setAdding] = useState(false);

    const fetchEmployees = useCallback(async () => {
        setLoading(true);
        try { setEmployees(await getEmployees()); } catch { }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

    // ── Filtering ──
    const filtered = employees.filter(e => {
        const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase()) || e.displayId.toLowerCase().includes(search.toLowerCase());
        const matchStatus = filterStatus === "ALL" || e.status === filterStatus;
        const matchDept = filterDept === "ALL" || e.department === filterDept;
        return matchSearch && matchStatus && matchDept;
    });

    // ── Form helpers — validate live as user types ──
    function setF(k: string, v: string) {
        setForm(p => ({ ...p, [k]: v }));
        // Live validation per field
        let err = "";
        if (k === "name") err = validateName(v);
        else if (k === "emergencyContactName") err = v.length > 0 ? validateName(v) : "";
        else if (k === "email") err = v.length > 3 ? validateEmail(v) : "";
        else if (k === "phone") err = v.length > 3 ? validatePhone(v) : "";
        else if (k === "emergencyContactPhone") err = v.length > 3 ? validatePhone(v) : "";
        else if (k === "aadhaarNumber") err = v.length > 0 ? validateAadhaar(v) : "";
        else if (k === "panNumber") err = v.length > 0 ? validatePAN(v) : "";
        setFormErrors(p => { const n = { ...p }; if (err) n[k] = err; else delete n[k]; return n; });
    }
    function togglePerm(id: string) {
        setForm(p => ({ ...p, permissions: p.permissions.includes(id) ? p.permissions.filter(x => x !== id) : [...p.permissions, id] }));
    }

    function validateAddForm() {
        const errs: Record<string, string> = {};
        const nameErr = validateName(form.name); if (nameErr) errs.name = nameErr;
        const emailErr = validateEmail(form.email); if (emailErr) errs.email = emailErr;
        const phoneErr = validatePhone(form.phone); if (phoneErr) errs.phone = phoneErr;
        if (!form.dateOfBirth) errs.dateOfBirth = "Date of birth required";
        if (!form.gender) errs.gender = "Gender required";
        if (!form.permanentAddress.trim()) errs.permanentAddress = "Permanent address required";
        if (!form.emergencyContactName.trim()) errs.emergencyContactName = "Emergency contact name required";
        const epErr = validatePhone(form.emergencyContactPhone); if (epErr) errs.emergencyContactPhone = epErr;
        if (!form.emergencyContactRel) errs.emergencyContactRel = "Relationship required";
        if (!form.department) errs.department = "Department required";
        if (!form.designation.trim()) errs.designation = "Designation required";
        if (form.aadhaarNumber && validateAadhaar(form.aadhaarNumber)) errs.aadhaarNumber = validateAadhaar(form.aadhaarNumber);
        if (form.panNumber && validatePAN(form.panNumber)) errs.panNumber = validatePAN(form.panNumber);
        return errs;
    }

    async function handleAddEmployee() {
        const errs = validateAddForm();
        if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }
        setAdding(true);
        try {
            await addEmployee({
                name: form.name, email: form.email, phone: form.phone,
                dateOfBirth: form.dateOfBirth, gender: form.gender,
                permanentAddress: form.permanentAddress, currentAddress: form.currentAddress,
                emergencyContactName: form.emergencyContactName, emergencyContactPhone: form.emergencyContactPhone,
                emergencyContactRel: form.emergencyContactRel,
                department: form.department, designation: form.designation, permissions: form.permissions,
                joiningDate: form.joiningDate || undefined,
                salary: form.salary ? parseFloat(form.salary) : undefined,
                employmentType: form.employmentType,
                aadhaarNumber: form.aadhaarNumber || undefined,
                panNumber: form.panNumber || undefined,
            });
            setShowAdd(false);
            setForm({ name: "", email: "", phone: "+91", dateOfBirth: "", gender: "", permanentAddress: "", currentAddress: "", emergencyContactName: "", emergencyContactPhone: "+91", emergencyContactRel: "", department: "", designation: "", permissions: [], joiningDate: "", salary: "", employmentType: "FULL_TIME", aadhaarNumber: "", panNumber: "" });
            fetchEmployees();
        } catch (e: any) { setFormErrors({ submit: e.message }); }
        finally { setAdding(false); }
    }

    async function handleAction(reason: string) {
        if (!actionModal) return;
        setProcessing(true);
        try {
            const { empId, type } = actionModal;
            if (type === "ACTIVATE") await activateEmployee(empId);
            else if (type === "UNSUSPEND") await unsuspendEmployee(empId, reason);
            else await updateEmployeeStatus(empId, type as any, reason);
            fetchEmployees();
        } catch (e: any) { alert(e.message); }
        finally { setProcessing(false); setActionModal(null); }
    }

    async function handleVerifyDoc(empId: string, docType: any) {
        try { await verifyEmployeeDoc(empId, docType); fetchEmployees(); } catch (e: any) { alert(e.message); }
    }

    async function handleBgCheck(notes: string) {
        if (!bgModal) return;
        setProcessing(true);
        try { await updateBackgroundCheck(bgModal.empId, bgStatus, notes); fetchEmployees(); }
        catch (e: any) { alert(e.message); }
        finally { setProcessing(false); setBgModal(null); }
    }

    const statusOptions = ["ALL", "PENDING_DOCS", "BACKGROUND_CHECK", "ACTIVE", "SUSPENDED", "TERMINATED"];

    return (
        <div className="space-y-6">
            {/* Action Modals */}
            {actionModal && (
                <ActionModal
                    title={actionModal.type === "ACTIVATE" ? "Activate Employee" : actionModal.type === "UNSUSPEND" ? "Unsuspend Employee" : actionModal.type === "SUSPENDED" ? "Suspend Employee" : actionModal.type === "TERMINATED" ? "Terminate Employee" : "Reject Employee"}
                    subtitle="This action will be logged in the audit trail"
                    placeholder={actionModal.type === "ACTIVATE" ? "Reason for activation..." : actionModal.type === "UNSUSPEND" ? "Reason for unsuspending (mandatory)..." : actionModal.type === "SUSPENDED" ? "Reason for suspension..." : "Reason for termination..."}
                    confirmLabel={actionModal.type === "ACTIVATE" ? "✅ Activate" : actionModal.type === "UNSUSPEND" ? "🔓 Unsuspend" : actionModal.type === "SUSPENDED" ? "⏸️ Suspend" : "🚫 Terminate"}
                    confirmClass={actionModal.type === "ACTIVATE" || actionModal.type === "UNSUSPEND" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
                    onConfirm={handleAction}
                    onCancel={() => setActionModal(null)}
                />
            )}
            {bgModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-900 border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
                        <h3 className="font-bold text-lg flex items-center gap-2"><Shield className="h-5 w-5 text-indigo-500" />Update Background Check</h3>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Status</label>
                            <div className="flex gap-2">
                                {(["IN_PROGRESS", "CLEARED", "FLAGGED"] as const).map(s => (
                                    <button key={s} onClick={() => setBgStatus(s)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition ${bgStatus === s
                                            ? (s === "CLEARED" ? "border-green-500 bg-green-50 text-green-700"
                                                : s === "FLAGGED" ? "border-red-500 bg-red-50 text-red-700"
                                                    : "border-blue-500 bg-blue-50 text-blue-700")
                                            : "border-muted text-muted-foreground bg-white dark:bg-gray-900"}`}>
                                        {s === "IN_PROGRESS" ? "🔍 In Progress" : s === "CLEARED" ? "✅ Cleared" : "❌ Rejected"}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Notes</label>
                            <textarea id="bgNotes" className="w-full border rounded-lg p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Background check notes, agency name, findings..." />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setBgModal(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted font-medium">Cancel</button>
                            <button onClick={() => handleBgCheck((document.getElementById("bgNotes") as HTMLTextAreaElement).value)}
                                className="px-5 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition shadow-sm">
                                💾 Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {empCodeModal && (
                <EmpCodeModal
                    empId={empCodeModal.empId}
                    currentCode={empCodeModal.currentCode}
                    onClose={() => setEmpCodeModal(null)}
                    onSaved={() => { setEmpCodeModal(null); fetchEmployees(); }}
                />
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Employee Management</h1>
                    <p className="text-muted-foreground">HR onboarding, document verification & background checks</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchEmployees} disabled={loading}><RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
                    <Button onClick={() => setShowAdd(!showAdd)}><UserPlus className="h-4 w-4 mr-2" />Add Employee</Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-5 gap-3">
                {[
                    { label: "Total", count: employees.length, color: "border-gray-200 bg-gray-50" },
                    { label: "Active", count: employees.filter(e => e.status === "ACTIVE").length, color: "border-green-200 bg-green-50" },
                    { label: "Pending Docs", count: employees.filter(e => e.status === "PENDING_DOCS").length, color: "border-amber-200 bg-amber-50" },
                    { label: "BG Check", count: employees.filter(e => e.status === "BACKGROUND_CHECK").length, color: "border-purple-200 bg-purple-50" },
                    { label: "Suspended", count: employees.filter(e => e.status === "SUSPENDED" || e.status === "TERMINATED").length, color: "border-red-200 bg-red-50" },
                ].map(s => (
                    <Card key={s.label} className={`border ${s.color}`}>
                        <CardContent className="p-3 text-center">
                            <p className="text-2xl font-bold">{s.count}</p>
                            <p className="text-xs text-muted-foreground">{s.label}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* ADD EMPLOYEE FORM */}
            {showAdd && (
                <Card className="border-primary/40 border-2">
                    <CardContent className="p-6 space-y-6">
                        <h3 className="font-bold text-xl flex items-center gap-2"><UserPlus className="h-5 w-5" />Add New Employee</h3>

                        {/* Section 1: Personal Info */}
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Personal Information</p>
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { label: "Full Legal Name *", key: "name", placeholder: "e.g. Rohan Sharma" },
                                    { label: "Official Email *", key: "email", placeholder: "rohan@rentpe.in" },
                                ].map(f => (
                                    <div key={f.key} className="space-y-1">
                                        <label className="text-sm font-medium">{f.label}</label>
                                        <Input value={(form as any)[f.key]} onChange={e => setF(f.key, e.target.value)} placeholder={f.placeholder}
                                            className={formErrors[f.key] ? "border-red-400" : ""} />
                                        {formErrors[f.key] && <p className="text-xs text-red-500">{formErrors[f.key]}</p>}
                                    </div>
                                ))}
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Phone * <span className="text-xs text-muted-foreground">(+91 mandatory)</span></label>
                                    <Input value={form.phone} placeholder="+919876543210"
                                        onChange={e => { let v = e.target.value; if (!v.startsWith("+91")) v = "+91" + v.replace(/^\+91/, ""); if (v.length > 13) v = v.slice(0, 13); setF("phone", v); }}
                                        className={formErrors.phone ? "border-red-400" : ""} />
                                    {formErrors.phone ? <p className="text-xs text-red-500">{formErrors.phone}</p> : <p className="text-[10px] text-muted-foreground">Format: +91 followed by 10 digits</p>}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Date of Birth *</label>
                                    <Input type="date" value={form.dateOfBirth} onChange={e => setF("dateOfBirth", e.target.value)}
                                        className={formErrors.dateOfBirth ? "border-red-400" : ""} />
                                    {formErrors.dateOfBirth && <p className="text-xs text-red-500">{formErrors.dateOfBirth}</p>}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Gender *</label>
                                    <select value={form.gender} onChange={e => setF("gender", e.target.value)}
                                        className={`w-full h-10 border rounded-md px-3 py-2 text-sm ${formErrors.gender ? "border-red-400" : "border-input"}`}>
                                        <option value="">Select gender</option>
                                        <option>Male</option><option>Female</option><option>Other</option><option>Prefer not to say</option>
                                    </select>
                                    {formErrors.gender && <p className="text-xs text-red-500">{formErrors.gender}</p>}
                                </div>
                                <PincodeAddress label="Permanent Address" required
                                    value={form.permanentAddress} onChange={v => setF("permanentAddress", v)}
                                    error={formErrors.permanentAddress} />
                                <PincodeAddress label="Current Address" hint="Only if different from permanent"
                                    value={form.currentAddress} onChange={v => setF("currentAddress", v)}
                                    copyFromValue={form.permanentAddress} />
                            </div>
                        </div>

                        {/* Section 2: Emergency Contact */}
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Emergency Contact</p>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Contact Name *</label>
                                    <Input value={form.emergencyContactName} onChange={e => setF("emergencyContactName", e.target.value)} placeholder="e.g. Suresh Sharma"
                                        className={formErrors.emergencyContactName ? "border-red-400" : ""} />
                                    {formErrors.emergencyContactName && <p className="text-xs text-red-500">{formErrors.emergencyContactName}</p>}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Contact Phone * (+91)</label>
                                    <Input value={form.emergencyContactPhone} placeholder="+919876543210"
                                        onChange={e => { let v = e.target.value; if (!v.startsWith("+91")) v = "+91" + v.replace(/^\+91/, ""); if (v.length > 13) v = v.slice(0, 13); setF("emergencyContactPhone", v); }}
                                        className={formErrors.emergencyContactPhone ? "border-red-400" : ""} />
                                    {formErrors.emergencyContactPhone && <p className="text-xs text-red-500">{formErrors.emergencyContactPhone}</p>}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Relationship *</label>
                                    <select value={form.emergencyContactRel} onChange={e => setF("emergencyContactRel", e.target.value)}
                                        className={`w-full h-10 border rounded-md px-3 py-2 text-sm ${formErrors.emergencyContactRel ? "border-red-400" : "border-input"}`}>
                                        <option value="">Select relationship</option>
                                        <option>Father</option><option>Mother</option><option>Spouse</option><option>Sibling</option><option>Friend</option><option>Other</option>
                                    </select>
                                    {formErrors.emergencyContactRel && <p className="text-xs text-red-500">{formErrors.emergencyContactRel}</p>}
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Employment Details */}
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Employment Details</p>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Department *</label>
                                    <select value={form.department} onChange={e => { setF("department", e.target.value); setF("designation", ""); }}
                                        className={`w-full h-10 border rounded-md px-3 py-2 text-sm ${formErrors.department ? "border-red-400" : "border-input"}`}>
                                        <option value="">Select department</option>
                                        {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                                    </select>
                                    {formErrors.department && <p className="text-xs text-red-500">{formErrors.department}</p>}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Designation *</label>
                                    <select value={form.designation} onChange={e => setF("designation", e.target.value)}
                                        className={`w-full h-10 border rounded-md px-3 py-2 text-sm ${formErrors.designation ? "border-red-400" : "border-input"}`}>
                                        <option value="">Select designation</option>
                                        {(DESIGNATIONS[form.department] || []).map(d => <option key={d}>{d}</option>)}
                                    </select>
                                    {formErrors.designation && <p className="text-xs text-red-500">{formErrors.designation}</p>}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Employment Type</label>
                                    <select value={form.employmentType} onChange={e => setF("employmentType", e.target.value)}
                                        className="w-full h-10 border rounded-md px-3 py-2 text-sm border-input">
                                        {EMPLOYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Joining Date</label>
                                    <Input type="date" value={form.joiningDate} onChange={e => setF("joiningDate", e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Monthly Salary (₹ CTC)</label>
                                    <Input type="number" value={form.salary} onChange={e => setF("salary", e.target.value)} placeholder="e.g. 25000" />
                                </div>
                            </div>
                        </div>

                        {/* Section 4: Identity Numbers */}
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Identity Numbers <span className="text-xs normal-case font-normal">(Documents uploadable after saving)</span></p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Aadhaar Number</label>
                                    <Input value={form.aadhaarNumber} onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 12); setF("aadhaarNumber", v); }} placeholder="12-digit Aadhaar"
                                        className={formErrors.aadhaarNumber ? "border-red-400" : ""} />
                                    {formErrors.aadhaarNumber && <p className="text-xs text-red-500">{formErrors.aadhaarNumber}</p>}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">PAN Number</label>
                                    <Input value={form.panNumber} onChange={e => setF("panNumber", e.target.value.toUpperCase().slice(0, 10))} placeholder="AAAAA0000A"
                                        className={formErrors.panNumber ? "border-red-400" : ""} />
                                    {formErrors.panNumber && <p className="text-xs text-red-500">{formErrors.panNumber}</p>}
                                </div>
                            </div>
                        </div>

                        {/* Section 5: Permissions */}
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Access Permissions</p>
                            <div className="grid grid-cols-4 gap-2">
                                {operationalPermissions.map(perm => (
                                    <label key={perm.id} className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-sm ${form.permissions.includes(perm.id) ? "bg-primary/10 border-primary" : "hover:bg-muted border-border"}`}>
                                        <input type="checkbox" checked={form.permissions.includes(perm.id)} onChange={() => togglePerm(perm.id)} className="accent-primary" />
                                        <span className="text-xs">{perm.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {formErrors.submit && <p className="text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded">{formErrors.submit}</p>}
                        <div className="flex gap-2">
                            <Button onClick={handleAddEmployee} disabled={adding} className="bg-green-600 hover:bg-green-700 text-white">
                                {adding ? "Saving..." : "Save Employee"}
                            </Button>
                            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email or ID…" className="pl-9" />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    className="border rounded-md px-3 py-2 text-sm border-input">
                    {statusOptions.map(s => <option key={s} value={s}>{s === "ALL" ? "All Statuses" : STATUS_META[s]?.label || s}</option>)}
                </select>
                <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                    className="border rounded-md px-3 py-2 text-sm border-input">
                    <option value="ALL">All Departments</option>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
            </div>

            {/* Employee List */}
            {loading ? (
                <div className="py-12 text-center animate-pulse text-muted-foreground">Loading employees...</div>
            ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">No employees found. Click &quot;Add Employee&quot; to get started.</div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(emp => {
                        const statusM = STATUS_META[emp.status] || { color: "text-gray-600", bg: "bg-gray-50 border-gray-200", label: emp.status, icon: "•" };
                        const bgM = BG_META[emp.backgroundCheckStatus] || BG_META.PENDING;
                        const isExpanded = expandedId === emp.id;
                        const auditTrail = JSON.parse(emp.auditTrail || "[]");
                        const perms: string[] = JSON.parse(emp.permissions || "[]");

                        return (
                            <Card key={emp.id} className={`border ${isExpanded ? "border-primary/40" : ""}`}>
                                <CardContent className="p-0">
                                    {/* Row */}
                                    <div className="flex items-center justify-between p-4 gap-4">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                                {emp.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold truncate">{emp.name}</p>
                                                <p className="text-xs text-muted-foreground">{emp.email} · {emp.phone}</p>
                                                <p className="text-xs text-muted-foreground">{emp.department} / {emp.designation}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className={`font-mono text-xs px-2 py-0.5 rounded ${emp.empCode ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-muted-foreground'}`}>
                                                {emp.empCode ? emp.empCode : emp.displayId}
                                            </span>
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusM.bg} ${statusM.color}`}>
                                                {statusM.icon} {statusM.label}
                                            </span>
                                            <span className={`text-xs font-medium ${bgM.color}`}>{bgM.label}</span>
                                            {/* Quick actions */}
                                            <div className="flex gap-1.5">
                                                {emp.status === "PENDING_DOCS" && (
                                                    <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => setActionModal({ empId: emp.id, type: "ACTIVATE" })}>Activate</Button>
                                                )}
                                                {emp.status === "BACKGROUND_CHECK" && (
                                                    <Button size="sm" className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white" onClick={() => setBgModal({ empId: emp.id })}>BG Check</Button>
                                                )}
                                                {emp.status === "ACTIVE" && (
                                                    <Button size="sm" variant="outline" className="h-7 text-xs border-orange-300 text-orange-700" onClick={() => setActionModal({ empId: emp.id, type: "SUSPENDED" })}>Suspend</Button>
                                                )}
                                                {emp.status === "SUSPENDED" && (
                                                    <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => setActionModal({ empId: emp.id, type: "UNSUSPEND" })}>🔓 Unsuspend</Button>
                                                )}
                                                {(emp.status === "ACTIVE" || emp.status === "SUSPENDED") && (
                                                    <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setActionModal({ empId: emp.id, type: "TERMINATED" })}>Terminate</Button>
                                                )}
                                            </div>
                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setExpandedId(isExpanded ? null : emp.id)}>
                                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Expanded detail */}
                                    {isExpanded && (
                                        <div className="border-t p-4 space-y-6 bg-muted/10">
                                            {/* Personal + Employment */}
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Personal Info</p>
                                                    <div className="space-y-1 text-sm">
                                                        {[
                                                            { icon: <Calendar className="h-3.5 w-3.5" />, label: "DOB", val: emp.dateOfBirth || "—" },
                                                            { icon: <User className="h-3.5 w-3.5" />, label: "Gender", val: emp.gender || "—" },
                                                            { icon: <MapPin className="h-3.5 w-3.5" />, label: "Permanent", val: emp.permanentAddress || "—" },
                                                            { icon: <Phone className="h-3.5 w-3.5" />, label: "Emergency", val: emp.emergencyContactName ? `${emp.emergencyContactName} (${emp.emergencyContactRel}) — ${emp.emergencyContactPhone}` : "—" },
                                                        ].map(r => (
                                                            <div key={r.label} className="flex gap-2 items-start">
                                                                <span className="text-muted-foreground mt-0.5 shrink-0">{r.icon}</span>
                                                                <span className="text-muted-foreground w-20 shrink-0">{r.label}:</span>
                                                                <span className="font-medium">{r.val}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Employment</p>
                                                    <div className="space-y-1 text-sm">
                                                        {[
                                                            { icon: <Briefcase className="h-3.5 w-3.5" />, label: "Type", val: emp.employmentType },
                                                            { icon: <Calendar className="h-3.5 w-3.5" />, label: "Joined", val: emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString("en-IN") : "—" },
                                                            { icon: <IndianRupee className="h-3.5 w-3.5" />, label: "Salary", val: emp.salary ? `₹${emp.salary.toLocaleString("en-IN")}/month` : "—" },
                                                        ].map(r => (
                                                            <div key={r.label} className="flex gap-2 items-start">
                                                                <span className="text-muted-foreground mt-0.5 shrink-0">{r.icon}</span>
                                                                <span className="text-muted-foreground w-20 shrink-0">{r.label}:</span>
                                                                <span className="font-medium">{r.val}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {perms.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {perms.map(p => {
                                                                const pm = operationalPermissions.find(op => op.id === p);
                                                                return <span key={p} className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded">{pm?.label || p}</span>;
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* EMP Code Section */}
                                            <div className="space-y-2">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Employee ID</p>
                                                <div className="border rounded-xl p-3 flex items-center justify-between gap-3">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-muted-foreground">Request ID:</span>
                                                            <span className="font-mono text-xs text-gray-600">{emp.displayId}</span>
                                                        </div>
                                                        {emp.empCode ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-muted-foreground">Employee Code:</span>
                                                                <span className="font-mono text-sm font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">{emp.empCode}</span>
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-amber-600">⚠️ No employee code assigned yet</p>
                                                        )}
                                                        {emp.empCodeNotes && <p className="text-[10px] text-muted-foreground italic">Edit note: {emp.empCodeNotes}</p>}
                                                    </div>
                                                    {emp.status === "ACTIVE" && (
                                                        <div className="flex gap-2 items-center shrink-0">
                                                            {!emp.empCode && (
                                                                <button onClick={() => setEmpCodeModal({ empId: emp.id, currentCode: null })}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg font-bold transition shadow-sm">
                                                                    ⚡ Generate Code
                                                                </button>
                                                            )}
                                                            <button onClick={() => setEmpCodeModal({ empId: emp.id, currentCode: emp.empCode || null })}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg font-semibold transition">
                                                                ✏️ Edit
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Documents */}
                                            <div className="space-y-3">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documents & Verification</p>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <DocUpload label="Aadhaar Card" docData={emp.aadhaarDoc} docName={emp.aadhaarName} verified={emp.aadhaarVerified}
                                                        onUpload={async (data, name) => { const { uploadEmployeeDoc } = await import("@/actions/employee"); await uploadEmployeeDoc(emp.id, "aadhaar", data, name); fetchEmployees(); }}
                                                        onVerify={() => handleVerifyDoc(emp.id, "aadhaar")} />
                                                    <DocUpload label="PAN Card" docData={emp.panDoc} docName={emp.panName} verified={emp.panVerified}
                                                        onUpload={async (data, name) => { const { uploadEmployeeDoc } = await import("@/actions/employee"); await uploadEmployeeDoc(emp.id, "pan", data, name); fetchEmployees(); }}
                                                        onVerify={() => handleVerifyDoc(emp.id, "pan")} />
                                                    <DocUpload label="Address Proof" docData={emp.addressProof} docName={emp.addressProofName} verified={emp.addressVerified}
                                                        onUpload={async (data, name) => { const { uploadEmployeeDoc } = await import("@/actions/employee"); await uploadEmployeeDoc(emp.id, "address", data, name); fetchEmployees(); }}
                                                        onVerify={() => handleVerifyDoc(emp.id, "address")} />
                                                    <DocUpload label="Education Certificate" docData={emp.educationCert} docName={emp.educationCertName} verified={emp.educationVerified}
                                                        onUpload={async (data, name) => { const { uploadEmployeeDoc } = await import("@/actions/employee"); await uploadEmployeeDoc(emp.id, "education", data, name); fetchEmployees(); }}
                                                        onVerify={() => handleVerifyDoc(emp.id, "education")} />
                                                    <DocUpload label="Experience Letter" docData={emp.experienceLetter} docName={emp.experienceLetterName} verified={false}
                                                        onUpload={async (data, name) => { const { uploadEmployeeDoc } = await import("@/actions/employee"); await uploadEmployeeDoc(emp.id, "experienceLetter", data, name); fetchEmployees(); }}
                                                        onVerify={() => { }} />
                                                    <DocUpload label="Police Clearance Cert." docData={emp.policeVerification} docName={emp.policeVerificationName} verified={emp.policeVerified}
                                                        onUpload={async (data, name) => { const { uploadEmployeeDoc } = await import("@/actions/employee"); await uploadEmployeeDoc(emp.id, "policeVerification", data, name); fetchEmployees(); }}
                                                        onVerify={() => handleVerifyDoc(emp.id, "police")} />
                                                </div>
                                            </div>

                                            {/* Background Check */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Background Check</p>
                                                    <button onClick={() => setBgModal({ empId: emp.id })}
                                                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-sm">
                                                        <Shield className="h-3.5 w-3.5" /> Update
                                                    </button>
                                                </div>
                                                <div className={`p-3 rounded-lg border text-sm ${bgM.bg}`}>
                                                    <p className={`font-semibold ${bgM.color}`}>{bgM.label}</p>
                                                    {emp.backgroundCheckNotes && <p className="text-muted-foreground mt-1 text-xs">{emp.backgroundCheckNotes}</p>}
                                                    {emp.backgroundCheckedAt && <p className="text-[10px] text-muted-foreground mt-1">{new Date(emp.backgroundCheckedAt).toLocaleString('en-IN')}</p>}
                                                </div>
                                            </div>

                                            {/* Audit Trail */}
                                            {auditTrail.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Audit Trail</p>
                                                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                                        {[...auditTrail].reverse().map((entry: any, i: number) => (
                                                            <div key={i} className="flex gap-3 text-xs border-l-2 border-primary/30 pl-3">
                                                                <span suppressHydrationWarning className="text-muted-foreground shrink-0">{new Date(entry.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                                <span className="font-mono font-medium text-primary">{entry.action}</span>
                                                                <span className="text-muted-foreground">{entry.actorName}</span>
                                                                {entry.note && <span className="text-muted-foreground">· {entry.note}</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
