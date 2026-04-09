'use client';

import { useEffect, useState } from 'react';
import { getRoomAvailabilityData } from '@/actions/ownerRentCollection';
import { getOccupancyReport } from '@/actions/ownerDashboard';
import { CalendarDays, Loader2, LayoutGrid, List, RefreshCw } from 'lucide-react';

const STATUS_COLORS = {
    AVAILABLE: { bg: 'bg-emerald-500', light: 'bg-emerald-100', text: 'text-emerald-700', label: 'Available', dot: '🟢' },
    OCCUPIED:  { bg: 'bg-blue-500',    light: 'bg-blue-100',    text: 'text-blue-700',    label: 'Occupied',  dot: '🔵' },
    RESERVED:  { bg: 'bg-amber-500',   light: 'bg-amber-100',   text: 'text-amber-700',   label: 'Reserved',  dot: '🟡' },
    TEMP_LOCKED:  { bg: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-700', label: 'Reserved', dot: '🟡' },
    MAINTENANCE: { bg: 'bg-red-500',   light: 'bg-red-100',    text: 'text-red-700',    label: 'Maintenance', dot: '🔴' },
};

function getBedColor(status: string) {
    return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.AVAILABLE;
}

export default function RoomAvailabilityPage() {
    const [properties, setProperties] = useState<any[]>([]);
    const [selectedPropertyId, setSelectedPropertyId] = useState('');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'grid' | 'list'>('list');
    const [hoveredBed, setHoveredBed] = useState<string | null>(null);

    useEffect(() => {
        getOccupancyReport().then((report: any[]) => {
            setProperties(report);
            if (report.length > 0) {
                setSelectedPropertyId(report[0].propertyId);
            }
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        if (selectedPropertyId) {
            setData(null);
            getRoomAvailabilityData(selectedPropertyId).then(setData);
        }
    }, [selectedPropertyId]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
    );

    const summary = data?.summary;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-6 pt-10 pb-20 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="max-w-6xl mx-auto relative z-10">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                                <CalendarDays className="w-8 h-8" /> Room Availability
                            </h1>
                            <p className="text-indigo-200 text-sm font-medium mt-1">Live bed status across your property</p>
                        </div>
                        <select value={selectedPropertyId} onChange={e => setSelectedPropertyId(e.target.value)}
                            className="px-4 py-2.5 bg-white/20 text-white border border-white/30 rounded-xl text-sm font-bold focus:outline-none focus:bg-white/30 backdrop-blur-sm">
                            {properties.map((p: any) => (
                                <option key={p.propertyId} value={p.propertyId} className="text-slate-900">{p.propertyName}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 -mt-12 relative z-10 space-y-6">
                {/* Summary Cards */}
                {summary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'Total Rooms', val: summary.totalRooms, color: 'slate' },
                            { label: 'Total Beds', val: summary.totalBeds, color: 'indigo' },
                            { label: 'Occupied', val: summary.occupiedBeds, color: 'blue' },
                            { label: 'Available', val: summary.availableBeds, color: 'emerald' },
                        ].map(card => (
                            <div key={card.label} className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100 text-center">
                                <p className="text-2xl font-black text-slate-900">{card.val}</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{card.label}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Occupancy Rate */}
                {summary && (
                    <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-black text-slate-700">Overall Occupancy</span>
                            <span className="font-black text-2xl text-indigo-600">{summary.occupancyRate}%</span>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full transition-all duration-700"
                                style={{ width: `${summary.occupancyRate}%` }}
                            />
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-xs font-bold text-slate-500">
                            {Object.entries(STATUS_COLORS).slice(0, 4).map(([key, cfg]) => (
                                <span key={key} className="flex items-center gap-1">{cfg.dot} {cfg.label}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* View Toggle */}
                <div className="flex items-center justify-between">
                    <h2 className="font-black text-slate-800">Room Details</h2>
                    <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-1">
                        <button onClick={() => setView('list')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 transition-all ${view === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                            <List className="w-3 h-3" /> List
                        </button>
                        <button onClick={() => setView('grid')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 transition-all ${view === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                            <LayoutGrid className="w-3 h-3" /> Grid
                        </button>
                    </div>
                </div>

                {!data ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    </div>
                ) : view === 'list' ? (
                    /* LIST VIEW */
                    <div className="space-y-3">
                        {data.rooms.map((room: any) => (
                            <div key={room.id} className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
                                <div className="p-4 flex items-center justify-between border-b border-slate-100">
                                    <div>
                                        <p className="font-black text-slate-900">Room {room.roomNumber}</p>
                                        <p className="text-xs text-slate-400">{room.type} · ₹{room.price.toLocaleString('en-IN')}/mo</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-500">{room.occupied}/{room.totalBeds} occupied</span>
                                        <div className={`px-2.5 py-1 rounded-full text-[10px] font-black ${room.available > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {room.available > 0 ? `${room.available} Available` : 'Full'}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 flex flex-wrap gap-2">
                                    {room.beds.map((bed: any) => {
                                        const cfg = getBedColor(bed.status);
                                        return (
                                            <div key={bed.id}
                                                onMouseEnter={() => setHoveredBed(bed.id)}
                                                onMouseLeave={() => setHoveredBed(null)}
                                                className={`relative px-3 py-2 rounded-xl text-[11px] font-black transition-all cursor-default ${cfg.light} ${cfg.text} border border-current/20`}>
                                                Bed {bed.bedNumber}
                                                {hoveredBed === bed.id && bed.tenantName && (
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-[10px] rounded-xl whitespace-nowrap z-10 shadow-xl">
                                                        {bed.tenantName}
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* GRID VIEW */
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {data.rooms.map((room: any) => (
                            <div key={room.id} className={`bg-white rounded-2xl shadow-lg border overflow-hidden ${room.available > 0 ? 'border-emerald-100' : 'border-blue-100'}`}>
                                <div className={`h-1.5 ${room.available > 0 ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                                <div className="p-4">
                                    <p className="font-black text-slate-900">Room {room.roomNumber}</p>
                                    <p className="text-xs text-slate-400 mb-3">{room.type}</p>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {room.beds.map((bed: any) => {
                                            const cfg = getBedColor(bed.status);
                                            return (
                                                <div key={bed.id} title={bed.tenantName || cfg.label}
                                                    className={`h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${cfg.light} ${cfg.text}`}>
                                                    {bed.bedNumber}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-2 text-center">
                                        {room.occupied}/{room.totalBeds} occupied
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
