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
    Trash2
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

export default function AdminStaffPage() {
    const [employees, setEmployees] = useState<any[]>([]);
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                        Admin Employee Hub
                    </h1>
                    <p className="text-white/60 mt-1">Manage internal RentPe platform staff and access levels</p>
                </div>
                <button 
                    onClick={() => setIsAddDialogOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-95"
                >
                    <UserPlus size={20} />
                    Register New Staff
                </button>
            </div>

            {/* Filters & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                    <input 
                        type="text" 
                        placeholder="Search by name, email or Staff ID..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/60">
                    <Filter size={18} />
                    <span className="text-sm font-medium">All Departments</span>
                </div>
            </div>

            {/* Staff List */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-white/5 border-b border-white/10">
                            <th className="px-6 py-4 text-sm font-semibold text-white/60 uppercase tracking-wider">Employee</th>
                            <th className="px-6 py-4 text-sm font-semibold text-white/60 uppercase tracking-wider">Department & Role</th>
                            <th className="px-6 py-4 text-sm font-semibold text-white/60 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-sm font-semibold text-white/60 uppercase tracking-wider">Modules</th>
                            <th className="px-6 py-4 text-sm font-semibold text-white/60 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            <tr><td colSpan={5} className="text-center py-20 text-white/40">Loading platform staff...</td></tr>
                        ) : filteredEmployees.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-20 text-white/40">No staff members found.</td></tr>
                        ) : filteredEmployees.map((emp) => (
                            <tr key={emp.id} className="hover:bg-white/5 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg">
                                            {emp.name[0]}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-white">{emp.name}</div>
                                            <div className="text-xs text-white/40">{emp.displayId}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-white/80">{emp.department}</span>
                                        <span className="text-xs text-indigo-400 font-medium">{emp.role}</span>
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
                                        {JSON.parse(emp.permissions || "[]").slice(0, 3).map((p: string) => (
                                            <span key={p} className="text-[10px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-white/60 uppercase">
                                                {p}
                                            </span>
                                        ))}
                                        {JSON.parse(emp.permissions || "[]").length > 3 && (
                                            <span className="text-[10px] text-white/40">+{JSON.parse(emp.permissions || "[]").length - 3}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => handleStatusToggle(emp.id, emp.status)}
                                            className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-all transform active:scale-90"
                                            title={emp.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                                        >
                                            {emp.status === 'ACTIVE' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                                        </button>
                                        <button className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-all transform active:scale-90">
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
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsAddDialogOpen(false)} />
                    <div className="relative bg-[#1A1A1A] border border-white/10 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-white/5 bg-gradient-to-r from-indigo-600/10 to-transparent">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                <Shield className="text-indigo-400" />
                                Onboard Internal Staff
                            </h2>
                            <p className="text-white/40 text-sm mt-1">Register a new platform-level employee with specific permissions.</p>
                        </div>

                        <form onSubmit={handleCreateEmployee} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/60">Full Name</label>
                                    <input 
                                        type="text" 
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/60">Email Address</label>
                                    <input 
                                        type="email" 
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        value={formData.email}
                                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/60">Mobile Number</label>
                                    <input 
                                        type="tel" 
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/60">Department</label>
                                    <select 
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none"
                                        value={formData.department}
                                        onChange={(e) => setFormData({...formData, department: e.target.value})}
                                    >
                                        {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                                    <Shield size={16} />
                                    Module Access Permissions
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {MODULES.map(mod => (
                                        <button
                                            key={mod.id}
                                            type="button"
                                            onClick={() => togglePermission(mod.id)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left ${
                                                formData.permissions.includes(mod.id)
                                                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-100'
                                                    : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60 hover:border-white/20'
                                            }`}
                                        >
                                            <div className={`w-4 h-4 rounded-sm border ${
                                                formData.permissions.includes(mod.id) ? 'bg-indigo-500 border-indigo-400' : 'border-white/20'
                                            } flex items-center justify-center`}>
                                                {formData.permissions.includes(mod.id) && <CheckCircle2 size={10} className="text-white" />}
                                            </div>
                                            <span className="text-xs truncate">{mod.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl flex gap-3">
                                <AlertTriangle className="text-indigo-400 shrink-0" />
                                <div className="text-xs text-indigo-100/70 leading-relaxed">
                                    <strong>Default Security:</strong> Newly onboarded staff will receive a temporary password via email. Multi-factor authentication is recommended for all internal accounts.
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsAddDialogOpen(false)}
                                    className="px-6 py-3 rounded-xl text-white/60 hover:text-white font-semibold transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={submitting}
                                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                                >
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
