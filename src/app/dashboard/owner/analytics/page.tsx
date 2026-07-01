'use client';

import { useEffect, useState } from 'react';
import { getOwnerAnalytics } from '@/actions/ownerRentCollection';
import { getPropertyPerformanceAnalytics } from '@/actions/ownerDashboard';
import { BarChart3, Loader2, TrendingUp, TrendingDown, Building, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts';

type DateRange = '7d' | '30d' | '90d' | 'fy' | 'custom';

function getDateRange(range: DateRange): { from: string; to: string } {
    const to = new Date();
    const from = new Date();
    if (range === '7d') from.setDate(from.getDate() - 7);
    else if (range === '30d') from.setDate(from.getDate() - 30);
    else if (range === '90d') from.setDate(from.getDate() - 90);
    else if (range === 'fy') {
        const year = to.getMonth() >= 3 ? to.getFullYear() : to.getFullYear() - 1;
        from.setFullYear(year, 3, 1); // April 1
    }
    return {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
    };
}

export default function AnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [perfData, setPerfData] = useState<any[]>([]);
    const [range, setRange] = useState<DateRange>('30d');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    const reload = async (r: DateRange) => {
        setLoading(true);
        const dates = r === 'custom' && customFrom && customTo
            ? { from: customFrom, to: customTo }
            : getDateRange(r);
        const [analytics, perf] = await Promise.all([
            getOwnerAnalytics(dates.from, dates.to),
            getPropertyPerformanceAnalytics(),
        ]);
        setData(analytics);
        setPerfData(perf);
        setLoading(false);
    };

    useEffect(() => { reload(range); }, [range]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
    );

    const bestProperty = perfData.reduce((best: any, p: any) => (!best || p.occupancyRate > best.occupancyRate) ? p : best, null);
    const worstProperty = perfData.reduce((worst: any, p: any) => (!worst || p.occupancyRate < worst.occupancyRate) ? p : worst, null);
    const avgOccupancy = perfData.length > 0
        ? Math.round(perfData.reduce((s: number, p: any) => s + p.occupancyRate, 0) / perfData.length)
        : 0;

    const totalCollected = data?.perProperty?.reduce((s: number, p: any) => s + p.totalCollected, 0) || 0;
    const totalExpected = data?.perProperty?.reduce((s: number, p: any) => s + p.totalExpected, 0) || 0;

    const RANGES: { key: DateRange; label: string }[] = [
        { key: '7d', label: 'Last 7 days' },
        { key: '30d', label: 'Last 30 days' },
        { key: '90d', label: 'Last 3 months' },
        { key: 'fy', label: 'This FY' },
        { key: 'custom', label: 'Custom' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-6 pt-10 pb-20 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="max-w-6xl mx-auto relative z-10">
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <BarChart3 className="w-8 h-8" /> Property Analytics
                    </h1>
                    <p className="text-indigo-200 text-sm font-medium mt-1">Performance insights across all your properties</p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 -mt-12 relative z-10 space-y-6">
                {/* Date Range Selector */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-lg p-3 flex flex-wrap gap-2 items-center">
                    {RANGES.map(r => (
                        <button key={r.key} onClick={() => setRange(r.key)}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${range === r.key ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                            {r.label}
                        </button>
                    ))}
                    {range === 'custom' && (
                        <div className="flex items-center gap-2 ml-auto">
                            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                                className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            <span className="text-slate-400 text-xs font-bold">to</span>
                            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                                className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            <button onClick={() => reload('custom')}
                                className="px-4 py-2 bg-indigo-600 text-white text-xs font-black rounded-xl">Apply</button>
                        </div>
                    )}
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Avg Occupancy', val: `${avgOccupancy}%`, icon: Building, color: 'indigo' },
                        { label: 'Total Collected', val: `₹${totalCollected.toLocaleString('en-IN')}`, icon: TrendingUp, color: 'emerald' },
                        { label: 'Collection Rate', val: totalExpected > 0 ? `${Math.round((totalCollected / totalExpected) * 100)}%` : '—', icon: BarChart3, color: 'purple' },
                        { label: 'Properties', val: perfData.length, icon: Building, color: 'blue' },
                    ].map(card => (
                        <div key={card.label} className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{card.label}</p>
                                <card.icon className={`w-4 h-4 text-${card.color}-500`} />
                            </div>
                            <p className="text-xl font-black text-slate-900">{card.val}</p>
                        </div>
                    ))}
                </div>

                {/* Best / Worst Property */}
                {perfData.length > 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {bestProperty && (
                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                                    <span className="text-xs font-black uppercase tracking-widest text-emerald-600">Best Performer</span>
                                </div>
                                <p className="font-black text-slate-900 text-lg">{bestProperty.propertyName}</p>
                                <p className="text-3xl font-black text-emerald-700 mt-1">{bestProperty.occupancyRate}% <span className="text-base text-emerald-600">occupancy</span></p>
                                <p className="text-xs text-slate-500 mt-1">₹{bestProperty.totalRevenue.toLocaleString('en-IN')} total revenue</p>
                            </div>
                        )}
                        {worstProperty && worstProperty.propertyId !== bestProperty?.propertyId && (
                            <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-2xl p-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle className="w-5 h-5 text-red-600" />
                                    <span className="text-xs font-black uppercase tracking-widest text-red-600">Needs Attention</span>
                                </div>
                                <p className="font-black text-slate-900 text-lg">{worstProperty.propertyName}</p>
                                <p className="text-3xl font-black text-red-700 mt-1">{worstProperty.occupancyRate}% <span className="text-base text-red-600">occupancy</span></p>
                                <p className="text-xs text-slate-500 mt-1">{worstProperty.availableBeds} beds still vacant</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Charts Grid */}
                {data?.monthly?.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Monthly Revenue Chart */}
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 lg:col-span-2">
                            <h3 className="font-black text-slate-900 mb-4">Monthly Revenue Collection</h3>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={data.monthly}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} />
                                    <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }}
                                        tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN')}`} />
                                    <Bar dataKey="collected" fill="#4f46e5" name="Collected" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="expected" fill="#e0e7ff" name="Expected" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Cash vs Online Split Pie Chart */}
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 flex flex-col justify-between">
                            <div>
                                <h3 className="font-black text-slate-900">Payment Mode Split</h3>
                                <p className="text-xs text-slate-400 font-bold mt-0.5">Distribution of collected rent</p>
                            </div>
                            <div className="relative h-[160px] w-full flex items-center justify-center">
                                {((data?.paymentMethodSplit?.online || 0) === 0 && (data?.paymentMethodSplit?.cash || 0) === 0) ? (
                                    <p className="text-xs text-slate-400 font-bold">No collections recorded in this period</p>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: 'Online Payments', value: data?.paymentMethodSplit?.online || 0 },
                                                    { name: 'Cash Payments', value: data?.paymentMethodSplit?.cash || 0 },
                                                ]}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={45}
                                                outerRadius={65}
                                                paddingAngle={3}
                                                dataKey="value"
                                                startAngle={90}
                                                endAngle={-270}
                                            >
                                                <Cell key="cell-online" fill="#4f46e5" strokeWidth={0} />
                                                <Cell key="cell-cash" fill="#f59e0b" strokeWidth={0} />
                                            </Pie>
                                            <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN')}`} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                                {((data?.paymentMethodSplit?.online || 0) > 0 || (data?.paymentMethodSplit?.cash || 0) > 0) && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingBottom: 10 }}>
                                        <span className="text-sm font-black text-indigo-600">
                                            {Math.round(((data?.paymentMethodSplit?.online || 0) / ((data?.paymentMethodSplit?.online || 0) + (data?.paymentMethodSplit?.cash || 0))) * 100)}%
                                        </span>
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Online</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-around gap-2 text-xs font-bold text-slate-600">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0" />
                                    <span>Online: ₹{(data?.paymentMethodSplit?.online || 0).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                                    <span>Cash: ₹{(data?.paymentMethodSplit?.cash || 0).toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Per-Property Table */}
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                        <h3 className="font-black text-slate-900">Per-Property Breakdown</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                    {['Property', 'Total Beds', 'Occupied', 'Occupancy %', 'Revenue', 'Collection Rate'].map(h => (
                                        <th key={h} className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {perfData.map((p: any) => {
                                    const collectionData = data?.perProperty?.find((d: any) => d.propertyId === p.propertyId);
                                    return (
                                        <tr key={p.propertyId} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-5 py-4 font-black text-slate-900">{p.propertyName}</td>
                                            <td className="px-5 py-4 text-slate-600">{p.totalBeds}</td>
                                            <td className="px-5 py-4 text-slate-600">{p.occupiedBeds}</td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full ${p.occupancyRate >= 80 ? 'bg-emerald-500' : p.occupancyRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                            style={{ width: `${p.occupancyRate}%` }} />
                                                    </div>
                                                    <span className="font-black text-slate-800">{p.occupancyRate}%</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 font-black text-slate-800">₹{p.totalRevenue.toLocaleString('en-IN')}</td>
                                            <td className="px-5 py-4">
                                                <span className={`font-black ${(collectionData?.collectionRate || 0) >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                    {collectionData?.collectionRate || 0}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
