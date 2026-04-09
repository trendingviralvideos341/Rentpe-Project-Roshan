'use client';

import { useEffect, useState, useTransition } from 'react';
import { getTenantMovementLog } from '@/actions/ownerRentCollection';
import { Loader2, UserCheck, UserX, ArrowUp, ArrowDown, Minus } from 'lucide-react';

const EVENT_CONFIG = {
    MOVE_IN: { icon: '🟢', label: 'Move-In', cls: 'border-l-4 border-emerald-400 bg-emerald-50/60' },
    MOVE_OUT: { icon: '🔴', label: 'Move-Out', cls: 'border-l-4 border-red-400 bg-red-50/60' },
};

function getMonthOptions() {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
            value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            label: d.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
        });
    }
    return months;
}

export default function TenantLogPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedProperty, setSelectedProperty] = useState('');
    const [eventFilter, setEventFilter] = useState<'ALL' | 'MOVE_IN' | 'MOVE_OUT'>('ALL');

    const months = getMonthOptions();

    const reload = (property?: string, month?: string) => {
        setLoading(true);
        getTenantMovementLog(property || undefined, month || undefined).then(result => {
            setData(result);
            setLoading(false);
        });
    };

    useEffect(() => {
        reload(selectedProperty, selectedMonth);
    }, [selectedProperty, selectedMonth]);

    const filteredEvents = (data?.events || []).filter((e: any) =>
        eventFilter === 'ALL' || e.type === eventFilter
    );

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
    );

    const { summary, properties } = data;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-6 pt-10 pb-20 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="max-w-5xl mx-auto relative z-10">
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Tenant Movement Log</h1>
                    <p className="text-indigo-200 text-sm font-medium mt-1">Timeline of all arrivals and departures</p>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 -mt-12 relative z-10 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Move-Ins', val: summary.moveIns, icon: ArrowUp, color: 'emerald' },
                        { label: 'Move-Outs', val: summary.moveOuts, icon: ArrowDown, color: 'red' },
                        {
                            label: 'Net Change',
                            val: summary.netChange > 0 ? `+${summary.netChange}` : summary.netChange,
                            icon: summary.netChange >= 0 ? ArrowUp : ArrowDown,
                            color: summary.netChange >= 0 ? 'emerald' : 'red'
                        },
                    ].map(card => (
                        <div key={card.label} className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100 text-center">
                            <card.icon className={`w-5 h-5 text-${card.color}-500 mx-auto mb-1`} />
                            <p className="text-2xl font-black text-slate-900">{card.val}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{card.label}</p>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <select value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)}
                        className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">All Properties</option>
                        {properties.map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                        className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">All Time</option>
                        {months.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                    <div className="flex gap-2 bg-white border border-slate-200 p-1.5 rounded-2xl">
                        {(['ALL', 'MOVE_IN', 'MOVE_OUT'] as const).map(f => (
                            <button key={f} onClick={() => setEventFilter(f)}
                                className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${eventFilter === f ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                                {f.replace('_', '-')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Timeline */}
                <div className="space-y-3">
                    {filteredEvents.length === 0 ? (
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 py-16 text-center">
                            <UserCheck className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                            <p className="font-black text-slate-400">No tenant movement events found</p>
                            <p className="text-sm text-slate-300 mt-1">Try adjusting your filters</p>
                        </div>
                    ) : (
                        <div className="relative">
                            {/* Timeline line */}
                            <div className="absolute left-[22px] top-0 bottom-0 w-0.5 bg-slate-200" />
                            <div className="space-y-3">
                                {filteredEvents.map((event: any) => {
                                    const cfg = EVENT_CONFIG[event.type as keyof typeof EVENT_CONFIG];
                                    return (
                                        <div key={event.id} className="flex items-start gap-4">
                                            {/* Timeline dot */}
                                            <div className={`relative z-10 w-11 h-11 rounded-full flex items-center justify-center text-lg flex-shrink-0 shadow-sm ${event.type === 'MOVE_IN' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                                                {cfg.icon}
                                            </div>
                                            {/* Card */}
                                            <div className={`flex-1 bg-white rounded-2xl shadow-sm border overflow-hidden ${event.type === 'MOVE_IN' ? 'border-emerald-100' : 'border-red-100'}`}>
                                                <div className={`h-1 ${event.type === 'MOVE_IN' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                <div className="p-4 flex items-center justify-between gap-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${event.type === 'MOVE_IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                                {cfg.label}
                                                            </span>
                                                        </div>
                                                        <p className="font-black text-slate-900 mt-1">{event.tenantName}</p>
                                                        <p className="text-xs text-slate-500">
                                                            Room {event.roomNumber} · {event.propertyName}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-black text-slate-800 text-sm">
                                                            {new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </p>
                                                        <p className="text-xs text-slate-400 mt-0.5">
                                                            {new Date(event.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
