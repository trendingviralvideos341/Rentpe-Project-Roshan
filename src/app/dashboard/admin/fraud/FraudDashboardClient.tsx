'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { resolveFraudFlag, blockFraudUser, freezeUserPayouts, approveFlaggedBooking } from '@/actions/fraudAdmin';

interface FraudFlag {
    id: string;
    userId: string;
    bookingId?: string | null;
    reason: string;
    riskScore: number;
    status: string;
    createdAt: Date;
    user: { id: string; name: string | null; email: string; displayId: string | null; phone: string | null };
    booking?: { id: string; displayId: string; propertyName: string; amount: number | null } | null;
}

interface LinkedAccount {
    id: string;
    userAId: string;
    userBId: string;
    linkType: string;
    reason: string;
    confidenceScore: number;
    userA: { id: string; name: string | null; email: string; displayId: string | null };
    userB: { id: string; name: string | null; email: string; displayId: string | null };
}

interface Summary {
    openFlags: number;
    highRiskFlags: number;
    linkedAccounts: number;
    blockedBookings: number;
}

const RISK_COLORS: Record<string, string> = {
    HIGH: 'bg-red-500/20 text-red-300 border-red-500/30',
    MEDIUM: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    LOW: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
};

const LINK_COLORS: Record<string, string> = {
    DEVICE: 'bg-purple-500/20 text-purple-300',
    PHONE: 'bg-red-500/20 text-red-300',
    EMAIL: 'bg-orange-500/20 text-orange-300',
    IP: 'bg-blue-500/20 text-blue-300',
    PAYMENT: 'bg-yellow-500/20 text-yellow-300',
};

function getRiskLevel(score: number) {
    if (score >= 71) return 'HIGH';
    if (score >= 31) return 'MEDIUM';
    return 'LOW';
}

export default function FraudDashboardClient({
    summary, flags, linkedAccounts
}: { summary: Summary; flags: FraudFlag[]; linkedAccounts: LinkedAccount[] }) {
    const [activeTab, setActiveTab] = useState<'flags' | 'linked'>('flags');
    const [loading, setLoading] = useState<string | null>(null);

    async function handleResolve(flagId: string) {
        setLoading(flagId);
        try {
            await resolveFraudFlag(flagId, 'Resolved by admin after review');
            toast.success('Flag resolved');
            window.location.reload();
        } catch (e: any) {
            toast.error(e.message || 'Failed');
        } finally { setLoading(null); }
    }

    async function handleBlock(userId: string) {
        if (!confirm('Are you sure you want to BLOCK this user? This will ban their account.')) return;
        setLoading(userId);
        try {
            await blockFraudUser(userId, 'Blocked by admin due to fraud detection');
            toast.success('User blocked successfully');
            window.location.reload();
        } catch (e: any) {
            toast.error(e.message || 'Failed');
        } finally { setLoading(null); }
    }

    async function handleFreezePayouts(userId: string) {
        setLoading(`freeze-${userId}`);
        try {
            await freezeUserPayouts(userId, 'Payouts frozen by admin due to fraud risk');
            toast.success('Payouts frozen');
        } catch (e: any) {
            toast.error(e.message || 'Failed');
        } finally { setLoading(null); }
    }

    async function handleApproveBooking(bookingId: string) {
        setLoading(`approve-${bookingId}`);
        try {
            await approveFlaggedBooking(bookingId, 'Admin override — reviewed and approved');
            toast.success('Booking approved');
            window.location.reload();
        } catch (e: any) {
            toast.error(e.message || 'Failed');
        } finally { setLoading(null); }
    }

    return (
        <div className="p-6 space-y-8 min-h-screen bg-[#0a0a0f] text-white">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    🛡️ Fraud Management
                </h1>
                <p className="text-sm text-slate-400 mt-1">Real-time fraud detection, linked account analysis, and risk management</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Open Flags', value: summary.openFlags, color: 'text-amber-400', icon: '🚩' },
                    { label: 'High Risk', value: summary.highRiskFlags, color: 'text-red-400', icon: '🔴' },
                    { label: 'Linked Accounts', value: summary.linkedAccounts, color: 'text-purple-400', icon: '🔗' },
                    { label: 'Blocked Bookings', value: summary.blockedBookings, color: 'text-orange-400', icon: '🚫' },
                ].map(card => (
                    <div key={card.label} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-slate-400 text-xs">{card.label}</span>
                            <span className="text-xl">{card.icon}</span>
                        </div>
                        <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-700/50">
                {(['flags', 'linked'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-medium rounded-t transition-all ${
                            activeTab === tab
                                ? 'text-indigo-400 border-b-2 border-indigo-400'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        {tab === 'flags' ? `🚩 Fraud Flags (${flags.length})` : `🔗 Linked Accounts (${linkedAccounts.length})`}
                    </button>
                ))}
            </div>

            {/* Fraud Flags Tab */}
            {activeTab === 'flags' && (
                <div className="space-y-3">
                    {flags.length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                            <div className="text-4xl mb-3">✅</div>
                            <p>No fraud flags. System is clean.</p>
                        </div>
                    )}
                    {flags.map(flag => {
                        const level = getRiskLevel(flag.riskScore);
                        return (
                            <div key={flag.id} className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${RISK_COLORS[level]}`}>
                                                {level} RISK — Score: {flag.riskScore}/100
                                            </span>
                                            <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">{flag.reason.replace(/_/g, ' ')}</span>
                                            {flag.status !== 'OPEN' && (
                                                <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">{flag.status}</span>
                                            )}
                                        </div>
                                        <div className="text-sm">
                                            <span className="text-slate-300 font-medium">{flag.user.name || 'Unknown'}</span>
                                            <span className="text-slate-500 mx-1">·</span>
                                            <span className="text-slate-400">{flag.user.email}</span>
                                            <span className="text-slate-500 mx-1">·</span>
                                            <span className="text-slate-500">{flag.user.displayId}</span>
                                        </div>
                                        {flag.booking && (
                                            <div className="text-xs text-slate-400">
                                                Booking: <span className="text-slate-300">{flag.booking.displayId}</span> — {flag.booking.propertyName}
                                                {flag.booking.amount && ` (₹${flag.booking.amount.toLocaleString()})`}
                                            </div>
                                        )}
                                        <div className="text-xs text-slate-500">
                                            {new Date(flag.createdAt).toLocaleString('en-IN')}
                                        </div>
                                    </div>
                                    {flag.status === 'OPEN' && (
                                        <div className="flex flex-col gap-2 shrink-0">
                                            <button
                                                onClick={() => handleResolve(flag.id)}
                                                disabled={loading === flag.id}
                                                className="px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-all disabled:opacity-50 border border-white/10 shadow-sm"
                                            >
                                                {loading === flag.id ? '...' : 'Resolve'}
                                            </button>
                                            {flag.booking && (
                                                <button
                                                    onClick={() => handleApproveBooking(flag.booking!.id)}
                                                    disabled={!!loading}
                                                    className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-all disabled:opacity-50 border border-white/10 shadow-sm"
                                                >
                                                    Allow Booking
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleBlock(flag.userId)}
                                                disabled={!!loading}
                                                className="px-4 py-2 text-xs bg-red-700 hover:bg-red-600 text-white rounded-lg font-bold transition-all disabled:opacity-50 border border-white/10 shadow-sm"
                                            >
                                                Block User
                                            </button>
                                            <button
                                                onClick={() => handleFreezePayouts(flag.userId)}
                                                disabled={!!loading}
                                                className="px-4 py-2 text-xs bg-amber-700 hover:bg-amber-600 text-white rounded-lg font-bold transition-all disabled:opacity-50 border border-white/10 shadow-sm"
                                            >
                                                Freeze Payouts
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Linked Accounts Tab */}
            {activeTab === 'linked' && (
                <div className="space-y-3">
                    {linkedAccounts.length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                            <div className="text-4xl mb-3">🔗</div>
                            <p>No linked accounts detected yet.</p>
                        </div>
                    )}
                    {linkedAccounts.map(link => (
                        <div key={link.id} className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-4">
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${LINK_COLORS[link.linkType] || 'bg-slate-700 text-slate-300'}`}>
                                    {link.linkType}
                                </span>
                                <div className="text-sm text-slate-300 flex items-center gap-2">
                                    <span className="font-medium">{link.userA.name || link.userA.email}</span>
                                    <span className="text-slate-500">({link.userA.displayId})</span>
                                    <span className="text-slate-500">↔</span>
                                    <span className="font-medium">{link.userB.name || link.userB.email}</span>
                                    <span className="text-slate-500">({link.userB.displayId})</span>
                                </div>
                                <span className={`ml-auto px-2 py-0.5 rounded text-xs font-bold border ${RISK_COLORS[getRiskLevel(link.confidenceScore)]}`}>
                                    {link.confidenceScore}% confidence
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">{link.reason}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
