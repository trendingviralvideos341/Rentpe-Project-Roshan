"use client";

import React, { useState, useEffect } from "react";
import { 
    Users, 
    UserPlus, 
    Shield, 
    Search, 
    Filter, 
    MoreVertical, 
    Mail, 
    Phone, 
    Building2,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Edit3,
    Trash2,
    RefreshCcw
} from "lucide-react";
import { toast } from "sonner";
import { 
    getAdminEmployees, 
    createAdminEmployee, 
    updateAdminEmployee 
} from "@/actions/adminEmployees";

const DEPARTMENTS = [
    "Verification Team",
    "Customer Support",
    "Operations",
    "Finance",
    "Technology"
];

const MODULES = [
    { id: "owners", label: "Owner Management" },
    { id: "users", label: "User Management" },
    { id: "properties", label: "Property Approval" },
    { id: "bookings", label: "Booking Operations" },
    { id: "payments", label: "Financial Tracking" },
    { id: "tickets", label: "Support Tickets" },
    { id: "audit", label: "Audit Logs" },
    { id: "staff", label: "Staff Management" }
];

interface AdminEmployee {
    id: string;
    displayId: string;
    userId: string | null;
    name: string;
    email: string;
    phone: string;
    department: string;
    role: string;
    permissions: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    user?: {
        lastLoginAt: Date | null;
        status: string;
    } | null;
}

export default function AdminStaffPage() {
    const [employees, setEmployees] = useState<AdminEmployee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form Stats
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        department: "Verification Team",
        role: "Verifier",
        permissions: [] as string[]
    });

    useEffect(() => {
        loadEmployees();
    }, []);

    const loadEmployees = async () => {
        try {
            const data = await getAdminEmployees();
            setEmployees(data);
        } catch (error) {
            toast.error("Failed to load staff records");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await createAdminEmployee(formData);
            toast.success("Staff member registered successfully");
            setIsAddDialogOpen(false);
            loadEmployees();
            setFormData({
                name: "",
                email: "",
                phone: "",
                department: "Verification Team",
                role: "Verifier",
                permissions: []
            });
        } catch (error: any) {
            toast.error(error.message || "Failed to create staff member");
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusToggle = async (id: string, currentStatus: string) => {
        try {
            const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
            await updateAdminEmployee(id, { status: newStatus });
            toast.success(`Staff member ${newStatus === "ACTIVE" ? "activated" : "suspended"}`);
            loadEmployees();
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    const togglePermission = (permId: string) => {
        setFormData(prev => ({
            ...prev,
            permissions: prev.permissions.includes(permId)
                ? prev.permissions.filter(p => p !== permId)
                : [...prev.permissions, permId]
        }));
    };

    const filteredEmployees = employees.filter(emp => 
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.displayId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-indigo-600 p-8 rounded-2xl border border-indigo-700 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold text-white">
                        Admin Employee Hub
                    </h1>
                    <p className="text-indigo-100/80 mt-1 font-medium">Manage Internal RentPe platform staff and access levels</p>
                </div>
                <button 
                    onClick={() => setIsAddDialogOpen(true)}
                    className="relative z-10 flex items-center gap-2 bg-white text-indigo-600 hover:bg-indigo-50 px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95"
                >
                    <UserPlus size={20} />
                    Register New Staff
                </button>
            </div>

            {/* Filters & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="Search by name, email or Staff ID..."
                        className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-600 shadow-sm">
                    <Filter size={18} />
                    <span className="text-sm font-semibold">All Departments</span>
                </div>
            </div>

            {/* Staff List */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xl">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest">Employee</th>
                            <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest">Department & Role</th>
                            <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest">Status</th>
                            <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest">Modules</th>
                            <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={5} className="text-center py-24 text-slate-400 font-medium">Loading platform staff...</td></tr>
                        ) : filteredEmployees.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-24 text-slate-400 font-medium whitespace-pre-wrap">No staff members found matching your search.</td></tr>
                        ) : filteredEmployees.map((emp) => (
                            <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg">
                                            {emp.name[0]}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900">{emp.name}</div>
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{emp.displayId}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-700">{emp.department}</span>
                                        <span className="text-[10px] text-indigo-600 font-black uppercase tracking-wider">{emp.role}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                        emp.status === 'ACTIVE' 
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    }`}>
                                        {emp.status === 'ACTIVE' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                        {emp.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1">
                                        {(JSON.parse(emp.permissions || "[]") as string[]).slice(0, 3).map((p: string) => (
                                            <span key={p} className="text-[9px] font-black bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded text-indigo-700 uppercase">
                                                {p}
                                            </span>
                                        ))}
                                        {(JSON.parse(emp.permissions || "[]") as string[]).length > 3 && (
                                            <span className="text-[10px] font-bold text-slate-400">+{(JSON.parse(emp.permissions || "[]") as string[]).length - 3}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => handleStatusToggle(emp.id, emp.status)}
                                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-all transform active:scale-90"
                                            title={emp.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                                        >
                                            {emp.status === 'ACTIVE' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                                        </button>
                                        <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-all transform active:scale-90">
                                            <Edit3 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Registration Dialog */}
            {isAddDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddDialogOpen(false)} />
                    <div className="relative bg-white border border-slate-200 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-transparent">
                            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                <Shield className="text-indigo-600" />
                                Onboard Internal Staff
                            </h2>
                            <p className="text-slate-500 text-sm mt-1 font-medium">Register a new platform-level employee with specific permissions.</p>
                        </div>

                        <form onSubmit={handleCreateEmployee} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar bg-white">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Full Name</label>
                                    <input 
                                        type="text" 
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Email Address</label>
                                    <input 
                                        type="email" 
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        value={formData.email}
                                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Mobile Number</label>
                                    <input 
                                        type="tel" 
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Department</label>
                                    <select 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none font-medium"
                                        value={formData.department}
                                        onChange={(e) => setFormData({...formData, department: e.target.value})}
                                    >
                                        {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <Shield size={16} />
                                    Module Access Permissions
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {MODULES.map(mod => (
                                        <button
                                            key={mod.id}
                                            type="button"
                                            onClick={() => togglePermission(mod.id)}
                                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-left ${
                                                formData.permissions.includes(mod.id)
                                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                                                    : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'
                                            }`}
                                        >
                                            <div className={`w-4 h-4 rounded-sm border ${
                                                formData.permissions.includes(mod.id) ? 'bg-white border-white' : 'border-slate-300'
                                            } flex items-center justify-center`}>
                                                {formData.permissions.includes(mod.id) && <CheckCircle2 size={10} className="text-indigo-600" />}
                                            </div>
                                            <span className="text-[11px] font-bold truncate">{mod.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex gap-3">
                                <AlertTriangle className="text-amber-600 shrink-0" />
                                <div className="text-xs text-amber-900 font-medium leading-relaxed">
                                    <strong>Default Security:</strong> Newly onboarded staff will receive a temporary password via email. Multi-factor authentication is recommended for all internal accounts.
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-6">
                                <button 
                                    type="button"
                                    onClick={() => setIsAddDialogOpen(false)}
                                    className="px-8 py-3 text-xs font-black bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-full transition-all active:scale-95 shadow-sm uppercase tracking-widest"
                                >
                                    CANCEL
                                </button>
                                <button 
                                    type="submit"
                                    disabled={submitting}
                                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-10 py-3 rounded-full font-black shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2"
                                >
                                    {submitting ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <UserPlus size={18} />}
                                    {submitting ? "Registering..." : "Onboard Employee"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
