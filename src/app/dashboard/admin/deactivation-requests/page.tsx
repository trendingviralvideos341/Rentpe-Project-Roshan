'use client';

import { useEffect, useState, useTransition } from "react";
import { getDeactivationRequests } from "@/actions/admin";
import { approvePropertyDeactivation, rejectPropertyDeactivation } from "@/actions/properties";
import { PowerOff, AlertTriangle, Clock, Building, Users, Calendar, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";

type DeactivationRequest = {
    id: string;
    displayId: string;
    name: string;
    address: string;
    city: string;
    status: string;
    deactivationRequestedAt: string;
    deactivationReason: string;
    owner: { name: string; email: string; phone: string; displayId: string };
    tenants: { id: string; status: string }[];
    bookings: { id: string; status: string }[];
};

export default function DeactivationRequestsPage() {
    const [requests, setRequests] = useState<DeactivationRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [rejectDialogId, setRejectDialogId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isPending, startTransition] = useTransition();

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const data = await getDeactivationRequests();
            setRequests(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRequests(); }, []);

    const handleApprove = (propertyId: string, propertyName: string) => {
        startTransition(async () => {
            try {
                await approvePropertyDeactivation(propertyId);
                setActionMsg({ type: 'success', text: `"${propertyName}" deactivated successfully.` });
                fetchRequests();
            } catch (err: any) {
                setActionMsg({ type: 'error', text: err.message });
            }
            setTimeout(() => setActionMsg(null), 5000);
        });
    };

    const handleReject = (propertyId: string, propertyName: string) => {
        if (!rejectReason.trim()) return;
        startTransition(async () => {
            try {
                await rejectPropertyDeactivation(propertyId, rejectReason);
                setActionMsg({ type: 'success', text: `Deactivation request rejected. "${propertyName}" remains LIVE.` });
                setRejectDialogId(null);
                setRejectReason('');
                fetchRequests();
            } catch (err: any) {
                setActionMsg({ type: 'error', text: err.message });
            }
            setTimeout(() => setActionMsg(null), 5000);
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-xl">
                        <PowerOff className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Deactivation Requests</h1>
                        <p className="text-sm text-muted-foreground">Review and action property exit requests from owners</p>
                    </div>
                </div>
                <button
                    onClick={fetchRequests}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium border rounded-lg hover:bg-muted transition-colors"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    Refresh
                </button>
            </div>

            {/* Action Flash Message */}
            {actionMsg && (
                <div className={`flex items-center gap-3 p-4 rounded-xl text-sm font-medium border ${
                    actionMsg.type === 'success'
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                    {actionMsg.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {actionMsg.text}
                </div>
            )}

            {/* Industry Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-800">
                    <span className="font-bold">📋 Industry Standard (OYO/Zolo/Stanza):</span> Properties are never deleted — only deactivated. The property and all its data are preserved for legal compliance. Before approving, ensure <strong>0 active tenants</strong> and <strong>0 pending bookings</strong>.
                </p>
            </div>

            {/* Requests List */}
            {loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-3" />
                    Loading deactivation requests...
                </div>
            ) : requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="p-4 bg-green-100 rounded-full mb-4">
                        <CheckCircle className="h-10 w-10 text-green-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">No Pending Requests</h3>
                    <p className="text-sm text-muted-foreground mt-1">All properties are active. No deactivation requests at this time.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {requests.map((req) => {
                        const hasBlockers = req.tenants.length > 0 || req.bookings.length > 0;
                        const isExpanded = expanded === req.id;

                        return (
                            <div key={req.id} className={`bg-card border rounded-2xl overflow-hidden shadow-sm transition-all ${hasBlockers ? 'border-amber-200' : 'border-border'}`}>
                                {/* Request Card Header */}
                                <div className="p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4 flex-1">
                                            <div className="p-2 bg-orange-100 rounded-xl flex-shrink-0">
                                                <Building className="h-5 w-5 text-orange-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-bold text-foreground">{req.name}</h3>
                                                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">{req.displayId}</span>
                                                    {hasBlockers && (
                                                        <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                            <AlertTriangle className="h-3 w-3" />
                                                            BLOCKERS
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-0.5">{req.address}, {req.city}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    Owner: <span className="font-medium text-foreground">{req.owner.name}</span> · {req.owner.email} · {req.owner.displayId}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <div className={`text-center px-3 py-1.5 rounded-lg border text-xs font-bold ${req.tenants.length > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                                                <div className="flex items-center gap-1">
                                                    <Users className="h-3 w-3" />
                                                    {req.tenants.length}
                                                </div>
                                                <div>Tenants</div>
                                            </div>
                                            <div className={`text-center px-3 py-1.5 rounded-lg border text-xs font-bold ${req.bookings.length > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {req.bookings.length}
                                                </div>
                                                <div>Bookings</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Request Details */}
                                    <div className="mt-4 grid grid-cols-1 gap-3">
                                        <div className="flex items-start gap-2 text-sm">
                                            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                            <span className="text-muted-foreground">
                                                Requested: <span className="text-foreground font-medium">
                                                    {new Date(req.deactivationRequestedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                                </span>
                                            </span>
                                        </div>
                                        <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3">
                                            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Owner's Reason</p>
                                            <p className="text-sm text-foreground">{req.deactivationReason || 'No reason provided.'}</p>
                                        </div>

                                        {hasBlockers && (
                                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                                <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    Cannot Approve Yet
                                                </p>
                                                <p className="text-sm text-red-700">
                                                    {req.tenants.length > 0 && `${req.tenants.length} active tenant(s) must be moved out. `}
                                                    {req.bookings.length > 0 && `${req.bookings.length} active booking(s) must be cancelled.`}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-3 mt-4 flex-wrap">
                                        <button
                                            onClick={() => handleApprove(req.id, req.name)}
                                            disabled={isPending || hasBlockers}
                                            title={hasBlockers ? 'Resolve blockers first' : 'Approve and deactivate'}
                                            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                                                hasBlockers
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow-red-200 shadow-lg'
                                            }`}
                                        >
                                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PowerOff className="h-4 w-4" />}
                                            Approve Deactivation
                                        </button>

                                        <button
                                            onClick={() => { setRejectDialogId(req.id); setRejectReason(''); }}
                                            disabled={isPending}
                                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-all shadow-sm"
                                        >
                                            <XCircle className="h-4 w-4" />
                                            Reject Request
                                        </button>

                                        <button
                                            onClick={() => setExpanded(isExpanded ? null : req.id)}
                                            className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors ml-auto"
                                        >
                                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            {isExpanded ? 'Less' : 'More'}
                                        </button>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="mt-4 pt-4 border-t text-sm space-y-2 text-muted-foreground">
                                            <p><span className="font-medium text-foreground">Owner Phone:</span> {req.owner.phone || 'N/A'}</p>
                                            <p><span className="font-medium text-foreground">Full Address:</span> {req.address}, {req.city}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Reject Dialog (inline) */}
                                {rejectDialogId === req.id && (
                                    <div className="border-t bg-slate-50 p-5">
                                        <p className="text-sm font-bold text-foreground mb-3">Rejection Reason <span className="text-red-500">*</span></p>
                                        <textarea
                                            value={rejectReason}
                                            onChange={(e) => setRejectReason(e.target.value)}
                                            placeholder="e.g. Property has 2 active tenants whose leases expire in May 2026. Please resolve before requesting exit."
                                            rows={3}
                                            className="w-full border border-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                                        />
                                        <div className="flex gap-3 mt-3">
                                            <button
                                                onClick={() => handleReject(req.id, req.name)}
                                                disabled={!rejectReason.trim() || isPending}
                                                className="px-4 py-2 text-sm font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-all"
                                            >
                                                {isPending ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : null}
                                                Confirm Rejection
                                            </button>
                                            <button
                                                onClick={() => setRejectDialogId(null)}
                                                className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
