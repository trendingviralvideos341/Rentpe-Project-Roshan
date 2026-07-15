'use client';

import { useEffect, useState, useTransition } from 'react';
import { getBookings } from '@/actions/bookings';
import { createRoomChangeRequest, getMyRoomChangeRequests } from '@/actions/roomChange';
import { toast } from 'sonner';
import { RefreshCw, ArrowLeft, CheckCircle2, Clock, XCircle, Loader2, BedDouble } from 'lucide-react';
import Link from 'next/link';

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
    PENDING: { label: 'Pending', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    APPROVED: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    REJECTED: { label: 'Rejected', cls: 'bg-red-100 text-red-700 border-red-200' },
    COMPLETED: { label: 'Completed', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
};

const REASONS = [
    'Room too noisy / poor sleep',
    'Roommate compatibility issues',
    'Need a quieter study environment',
    'Health/medical reasons',
    'Prefer a different floor/view',
    'Room has maintenance issues',
    'Other',
];

export default function RoomChangePage() {
    const [booking, setBooking] = useState<any>(null);
    const [requests, setRequests] = useState<any[]>([]);
    const [availableRooms, setAvailableRooms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ requestedRoomId: '', reason: '', customReason: '', preferredDate: '' });

    useEffect(() => {
        const load = async () => {
            try {
                const bookings = await getBookings();
                const active = bookings.find((b: any) => ['ACTIVE', 'MOVE_IN_SCHEDULED'].includes(b.status));
                setBooking(active || null);
                const reqs = await getMyRoomChangeRequests();
                setRequests(reqs);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const hasPending = requests.some(r => r.status === 'PENDING');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const reason = form.reason === 'Other' ? form.customReason : form.reason;
        if (!reason) { toast.error('Please select a reason.'); return; }
        startTransition(async () => {
            try {
                const result = await createRoomChangeRequest({
                    bookingId: booking.id,
                    currentRoomId: booking.roomId,
                    requestedRoomId: form.requestedRoomId || undefined,
                    reason,
                    preferredDate: form.preferredDate || undefined,
                });
                setRequests(prev => [result, ...prev]);
                setShowForm(false);
                setForm({ requestedRoomId: '', reason: '', customReason: '', preferredDate: '' });
                toast.success('Room change request submitted!');
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
                <div className="w-full mx-auto relative z-10 px-4 md:px-8">
                    <Link href="/dashboard/student" className="text-indigo-200 text-xs font-bold flex items-center gap-1 mb-4 hover:text-white">
                        <ArrowLeft className="w-3 h-3" /> Dashboard
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Room Change Request</h1>
                    <p className="text-indigo-200 text-sm font-medium mt-1">Request to move to a different room in the same property</p>
                </div>
            </div>

            <div className="w-full mx-auto px-4 md:px-8 -mt-12 relative z-10 space-y-6">
                {/* Current Room Card */}
                {booking && (
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Your Current Room</p>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center">
                                <BedDouble className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                                <p className="font-black text-slate-900">{booking.roomAssigned || 'Not Assigned Yet'}</p>
                                <p className="text-sm text-slate-500">{booking.propertyName} · {booking.occupancy}</p>
                            </div>
                        </div>

                        {!hasPending && booking.roomId && (
                            <button
                                onClick={() => setShowForm(true)}
                                className="mt-4 w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200"
                            >
                                + Request Room Change
                            </button>
                        )}
                        {hasPending && (
                            <p className="mt-4 text-center text-sm text-amber-600 font-bold bg-amber-50 py-2 rounded-xl border border-amber-100">
                                You have a pending request. Wait for owner response.
                            </p>
                        )}
                        {!booking.roomId && (
                            <p className="mt-4 text-center text-sm text-slate-400 font-medium">
                                Room change is available once a room is assigned.
                            </p>
                        )}
                    </div>
                )}

                {/* Request Form */}
                {showForm && (
                    <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                        <div className="p-5 border-b border-slate-100">
                            <h2 className="font-black text-slate-900 flex items-center gap-2">
                                <RefreshCw className="w-5 h-5 text-indigo-600" /> New Room Change Request
                            </h2>
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Reason *</label>
                                <select
                                    required
                                    value={form.reason}
                                    onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Select a reason</option>
                                    {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            {form.reason === 'Other' && (
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Describe your reason *</label>
                                    <textarea
                                        required
                                        rows={3}
                                        value={form.customReason}
                                        onChange={e => setForm(f => ({ ...f, customReason: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Preferred Move Date (optional)</label>
                                <input
                                    type="date"
                                    value={form.preferredDate}
                                    min={new Date().toISOString().split('T')[0]}
                                    onChange={e => setForm(f => ({ ...f, preferredDate: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="flex-1 py-3 text-sm font-black bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="flex-2 flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm rounded-2xl disabled:opacity-50 transition-all"
                                >
                                    {isPending ? 'Submitting...' : 'Submit Request →'}
                                </button>
                            </div>
                        </div>
                    </form>
                )}

                {/* Request History */}
                {requests.length > 0 && (
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                        <div className="p-5 border-b border-slate-100">
                            <h2 className="font-black text-slate-900 text-sm">Request History</h2>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {requests.map(req => {
                                const badge = STATUS_BADGES[req.status] || STATUS_BADGES.PENDING;
                                return (
                                    <div key={req.id} className="p-5 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-slate-400">{req.displayId}</span>
                                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wider ${badge.cls}`}>{badge.label}</span>
                                        </div>
                                        <p className="text-sm font-semibold text-slate-800">{req.reason}</p>
                                        {req.currentRoom && (
                                            <p className="text-xs text-slate-500">From: <strong>{req.currentRoom.roomNumber}</strong> ({req.currentRoom.type})</p>
                                        )}
                                        {req.ownerNote && (
                                            <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                                                <p className="text-xs font-black text-indigo-500 uppercase tracking-widest">Owner Note</p>
                                                <p className="text-sm text-indigo-800 mt-1">{req.ownerNote}</p>
                                            </div>
                                        )}
                                        <p className="text-[10px] text-slate-400">{new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {!booking && (
                    <div className="bg-white rounded-3xl shadow-xl p-10 text-center border border-slate-100">
                        <RefreshCw className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="font-black text-slate-500">No active booking found.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
