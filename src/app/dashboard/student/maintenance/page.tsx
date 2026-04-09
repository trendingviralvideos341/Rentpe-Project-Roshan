'use client';

import { useEffect, useState, useTransition, useRef } from 'react';
import { getBookings } from '@/actions/bookings';
import { createMaintenanceRequest, getMyMaintenanceRequests } from '@/actions/maintenance';
import { toast } from 'sonner';
import { Wrench, ArrowLeft, Loader2, Plus, X, Camera, Clock, CheckCircle2, AlertTriangle, Activity } from 'lucide-react';
import Link from 'next/link';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type Category = 'ELECTRICAL' | 'PLUMBING' | 'FURNITURE' | 'CLEANLINESS' | 'WIFI' | 'SECURITY' | 'OTHER';

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
    { key: 'ELECTRICAL', label: 'Electrical', icon: '💡' },
    { key: 'PLUMBING', label: 'Plumbing', icon: '🚿' },
    { key: 'FURNITURE', label: 'Furniture', icon: '🛋️' },
    { key: 'CLEANLINESS', label: 'Cleanliness', icon: '🧹' },
    { key: 'WIFI', label: 'WiFi / Internet', icon: '📶' },
    { key: 'SECURITY', label: 'Security', icon: '🔒' },
    { key: 'OTHER', label: 'Other', icon: '📦' },
];

const PRIORITIES: { key: Priority; label: string; color: string; sla: string }[] = [
    { key: 'LOW', label: 'Low', color: 'slate', sla: '7 days SLA' },
    { key: 'MEDIUM', label: 'Medium', color: 'amber', sla: '72 hrs SLA' },
    { key: 'HIGH', label: 'High', color: 'orange', sla: '24 hrs SLA' },
    { key: 'URGENT', label: 'Urgent', color: 'red', sla: '4 hrs SLA' },
];

const STATUS_CONFIG: Record<string, { label: string; icon: any; cls: string }> = {
    OPEN: { label: 'Open', icon: Clock, cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    ACKNOWLEDGED: { label: 'Acknowledged', icon: CheckCircle2, cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    IN_PROGRESS: { label: 'In Progress', icon: Activity, cls: 'bg-purple-100 text-purple-700 border-purple-200' },
    RESOLVED: { label: 'Resolved', icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    CLOSED: { label: 'Closed', icon: X, cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const PRIORITY_BADGE: Record<Priority, string> = {
    LOW: 'bg-slate-100 text-slate-600',
    MEDIUM: 'bg-amber-100 text-amber-700',
    HIGH: 'bg-orange-100 text-orange-700',
    URGENT: 'bg-red-100 text-red-700',
};

export default function MaintenancePage() {
    const [booking, setBooking] = useState<any>(null);
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [photos, setPhotos] = useState<File[]>([]);
    const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);
    const [form, setForm] = useState<{
        category: Category; title: string; description: string; priority: Priority;
    }>({ category: 'ELECTRICAL', title: '', description: '', priority: 'MEDIUM' });

    useEffect(() => {
        const load = async () => {
            try {
                const bookings = await getBookings();
                const active = bookings.find((b: any) => ['ACTIVE', 'MOVE_IN_SCHEDULED', 'APPROVED'].includes(b.status));
                setBooking(active || null);
                const reqs = await getMyMaintenanceRequests();
                setRequests(reqs);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const addPhoto = (file: File) => {
        if (photos.length >= 3) { toast.error('Maximum 3 photos allowed.'); return; }
        setPhotos(prev => [...prev, file]);
        setPhotoPreviews(prev => [...prev, URL.createObjectURL(file)]);
    };

    const removePhoto = (i: number) => {
        setPhotos(prev => prev.filter((_, idx) => idx !== i));
        setPhotoPreviews(prev => prev.filter((_, idx) => idx !== i));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!booking) { toast.error('No active booking found.'); return; }
        startTransition(async () => {
            try {
                const result = await createMaintenanceRequest({
                    bookingId: booking.id,
                    propertyId: booking.propertyId,
                    category: form.category,
                    title: form.title,
                    description: form.description,
                    priority: form.priority,
                    photoFiles: photos,
                });
                setRequests(prev => [{ ...result, photos: [] }, ...prev]);
                setShowForm(false);
                setForm({ category: 'ELECTRICAL', title: '', description: '', priority: 'MEDIUM' });
                setPhotos([]); setPhotoPreviews([]);
                toast.success('Maintenance request submitted!');
            } catch (e: any) {
                toast.error(e.message || 'Failed to submit request.');
            }
        });
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-4 pt-10 pb-20 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="max-w-3xl mx-auto relative z-10 flex items-end justify-between">
                    <div>
                        <Link href="/dashboard/student" className="text-indigo-200 text-xs font-bold flex items-center gap-1 mb-4 hover:text-white">
                            <ArrowLeft className="w-3 h-3" /> Dashboard
                        </Link>
                        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Maintenance</h1>
                        <p className="text-indigo-200 text-sm font-medium mt-1">Report and track property issues</p>
                    </div>
                    {booking && (
                        <button
                            onClick={() => setShowForm(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white text-indigo-700 font-black text-sm rounded-2xl hover:bg-indigo-50 transition-all shadow-lg"
                        >
                            <Plus className="w-4 h-4" /> New Request
                        </button>
                    )}
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 -mt-12 relative z-10 space-y-6">
                {/* Form Modal */}
                {showForm && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
                        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-3xl">
                                <h2 className="font-black text-slate-900 flex items-center gap-2">
                                    <Wrench className="w-5 h-5 text-indigo-600" /> New Complaint
                                </h2>
                                <button type="button" onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-5 space-y-5">
                                {/* Category */}
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Category *</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {CATEGORIES.map(cat => (
                                            <button
                                                type="button"
                                                key={cat.key}
                                                onClick={() => setForm(f => ({ ...f, category: cat.key }))}
                                                className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 text-center transition-all ${form.category === cat.key ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-200'}`}
                                            >
                                                <span className="text-xl">{cat.icon}</span>
                                                <span className="text-[10px] font-black text-slate-600">{cat.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {/* Priority */}
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Priority *</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {PRIORITIES.map(p => (
                                            <button
                                                type="button"
                                                key={p.key}
                                                onClick={() => setForm(f => ({ ...f, priority: p.key }))}
                                                className={`p-2 rounded-xl border-2 text-center transition-all ${form.priority === p.key ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}
                                            >
                                                <span className="block text-xs font-black text-slate-700">{p.label}</span>
                                                <span className="block text-[9px] text-slate-400 mt-0.5">{p.sla}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {/* Title */}
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Title *</label>
                                    <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                        placeholder="e.g. Bathroom tap leaking"
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                {/* Description */}
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Description *</label>
                                    <textarea required rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                        placeholder="Describe the problem in detail..."
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                                </div>
                                {/* Photos */}
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Photos (max 3, optional)</label>
                                    <div className="flex gap-3 flex-wrap">
                                        {photoPreviews.map((src, i) => (
                                            <div key={i} className="relative w-20 h-20">
                                                <img src={src} className="w-20 h-20 object-cover rounded-xl border" alt="preview" />
                                                <button type="button" onClick={() => removePhoto(i)}
                                                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                        {photos.length < 3 && (
                                            <button type="button" onClick={() => fileRef.current?.click()}
                                                className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
                                                <Camera className="w-5 h-5" />
                                                <span className="text-[9px] font-bold mt-1">Add Photo</span>
                                            </button>
                                        )}
                                    </div>
                                    <input ref={fileRef} type="file" accept="image/*" className="hidden"
                                        onChange={e => { if (e.target.files?.[0]) addPhoto(e.target.files[0]); e.target.value = ''; }} />
                                </div>
                                {form.priority === 'URGENT' && (
                                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
                                        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                                        <p className="text-sm text-red-800 font-medium">URGENT requests alert the owner immediately and require action within 4 hours.</p>
                                    </div>
                                )}
                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setShowForm(false)} disabled={isPending}
                                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm rounded-2xl transition-all">Cancel</button>
                                    <button type="submit" disabled={isPending}
                                        className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm rounded-2xl disabled:opacity-50 transition-all shadow-lg shadow-indigo-200">
                                        {isPending ? 'Submitting...' : 'Submit →'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                )}

                {/* Request List */}
                {requests.length === 0 ? (
                    <div className="bg-white rounded-3xl shadow-xl p-12 text-center border border-slate-100">
                        <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h2 className="font-black text-slate-600 text-lg">No Complaints Yet</h2>
                        <p className="text-slate-400 text-sm mt-2">Report any issues with your room or property here.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {requests.map(req => {
                            const sc = STATUS_CONFIG[req.status] || STATUS_CONFIG.OPEN;
                            const StatusIcon = sc.icon;
                            return (
                                <div key={req.id} className={`bg-white rounded-3xl shadow-lg border overflow-hidden ${req.priority === 'URGENT' ? 'border-red-200 shadow-red-100' : 'border-slate-100'}`}>
                                    <div className="p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                    <span className="text-sm">{CATEGORIES.find(c => c.key === req.category)?.icon}</span>
                                                    <h3 className="font-black text-slate-900 text-sm">{req.title}</h3>
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${PRIORITY_BADGE[req.priority as Priority]}`}>{req.priority}</span>
                                                </div>
                                                <p className="text-sm text-slate-500 font-medium">{req.description}</p>
                                            </div>
                                            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase shrink-0 ${sc.cls}`}>
                                                <StatusIcon className="w-3 h-3" />{sc.label}
                                            </span>
                                        </div>
                                        {req.photos?.length > 0 && (
                                            <div className="flex gap-2 mt-3">
                                                {req.photos.map((url: string, i: number) => (
                                                    <img key={i} src={url} className="w-16 h-16 object-cover rounded-xl border" alt="evidence" />
                                                ))}
                                            </div>
                                        )}
                                        {req.ownerNote && (
                                            <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-2xl p-3">
                                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Owner Note</p>
                                                <p className="text-sm text-indigo-800 mt-1">{req.ownerNote}</p>
                                            </div>
                                        )}
                                        {req.slaDeadline && req.status !== 'RESOLVED' && req.status !== 'CLOSED' && (
                                            <p className="text-[10px] text-slate-400 mt-3">
                                                SLA Deadline: {new Date(req.slaDeadline).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        )}
                                        <div className="flex items-center justify-between mt-3">
                                            <span className="text-[10px] font-bold text-slate-400">{req.displayId}</span>
                                            <span className="text-[10px] text-slate-400">{new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
