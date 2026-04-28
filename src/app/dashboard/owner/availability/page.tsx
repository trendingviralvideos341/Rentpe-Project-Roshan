'use client';

import { useEffect, useState, useCallback } from 'react';
import { getRoomAvailabilityData } from '@/actions/ownerRentCollection';
import { getOccupancyReport } from '@/actions/ownerDashboard';
import { CalendarDays, Loader2, LayoutGrid, List, Wifi } from 'lucide-react';

const STATUS_COLORS = {
    AVAILABLE:    { bg: 'bg-emerald-500', light: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-400',  label: 'Available',    dot: '🟢' },
    OCCUPIED:     { bg: 'bg-orange-500',  light: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-400',   label: 'Occupied',     dot: '🟠' },
    RESERVED:     { bg: 'bg-amber-500',   light: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-400',    label: 'Occupied',     dot: '🟡' },
    TEMP_LOCKED:  { bg: 'bg-amber-500',   light: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-400',    label: 'Occupied',     dot: '🟡' },
    LOCKED:       { bg: 'bg-amber-500',   light: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-400',    label: 'Occupied',     dot: '🟡' },
    MAINTENANCE:  { bg: 'bg-red-500',     light: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-400',      label: 'Maintenance',  dot: '🔴' },
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
    const [pulse, setPulse] = useState(false);
    const [lastSynced, setLastSynced] = useState<Date>(new Date());

    // Initial load — property list
    useEffect(() => {
        getOccupancyReport().then((report: any[]) => {
            setProperties(report);
            if (report.length > 0) setSelectedPropertyId(report[0].propertyId);
            setLoading(false);
        });
    }, []);

    // Fetch room data for selected property
    const fetchData = useCallback(async (propId: string) => {
        if (!propId) return;
        try {
            const fresh = await getRoomAvailabilityData(propId);
            setData(fresh);
            setLastSynced(new Date());
            setPulse(true);
            setTimeout(() => setPulse(false), 400);
        } catch { /* silent */ }
    }, []);

    // When property changes — instant fetch + start polling
    useEffect(() => {
        if (!selectedPropertyId) return;
        setData(null);
        fetchData(selectedPropertyId);
        let interval: ReturnType<typeof setInterval> | null = null;

        const start = () => { if (!interval) interval = setInterval(() => fetchData(selectedPropertyId), 30000); };
        const stop  = () => { if (interval) { clearInterval(interval); interval = null; } };
        const onVisibility = () => {
            if (document.visibilityState === 'visible') { fetchData(selectedPropertyId); start(); }
            else stop();
        };

        // Instant fetch + start polling if tab already visible
        if (document.visibilityState === 'visible') { fetchData(selectedPropertyId); start(); }
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            stop();
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [selectedPropertyId, fetchData]);

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
                                <CalendarDays className="w-8 h-8" /> Room Calendar
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-indigo-200 text-sm font-medium">Live bed status across your property</p>
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-white/15 rounded-full border border-white/20">
                                    <span className={`h-1.5 w-1.5 rounded-full ${pulse ? 'bg-green-300 scale-125' : 'bg-green-400'} transition-all animate-pulse`} />
                                    <span className="text-[9px] font-black text-green-300 uppercase tracking-widest flex items-center gap-0.5">
                                        <Wifi className="h-2.5 w-2.5" /> Live · {lastSynced.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                                    </span>
                                </span>
                            </div>
                        </div>
                        <select
                            value={selectedPropertyId}
                            onChange={e => setSelectedPropertyId(e.target.value)}
                            className="px-4 py-2.5 bg-white/20 text-white border border-white/30 rounded-xl text-sm font-bold focus:outline-none focus:bg-white/30 backdrop-blur-sm"
                        >
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
                            { label: 'Total Rooms', val: summary.totalRooms,    color: 'slate'  },
                            { label: 'Total Beds',  val: summary.totalBeds,     color: 'indigo' },
                            { label: 'Occupied',    val: summary.occupiedBeds,  color: 'orange' },
                            { label: 'Available',   val: summary.availableBeds, color: 'emerald'},
                        ].map(card => (
                            <div key={card.label} className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100 text-center">
                                <p className={`text-2xl font-black ${
                                    card.color === 'emerald' ? 'text-emerald-600' :
                                    card.color === 'orange'  ? 'text-orange-600'  :
                                    card.color === 'indigo'  ? 'text-indigo-600'  : 'text-slate-900'
                                }`}>{card.val}</p>
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
                            <span className="flex items-center gap-1">🟢 Available</span>
                            <span className="flex items-center gap-1">🟡 Reserved / Occupied</span>
                            <span className="flex items-center gap-1">🟠 Active Tenant</span>
                            <span className="flex items-center gap-1">🔴 Maintenance</span>
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
                                        <div className={`px-2.5 py-1 rounded-full text-[10px] font-black ${room.available > 0 ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-orange-100 text-orange-700 border border-orange-300'}`}>
                                            {room.available > 0 ? `${room.available} Available` : 'Full'}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 flex flex-wrap gap-2">
                                    {room.beds.map((bed: any) => {
                                        const cfg = getBedColor(bed.status);
                                        const isAvailable = bed.status === 'AVAILABLE';
                                        return (
                                            <div
                                                key={bed.id}
                                                onMouseEnter={() => setHoveredBed(bed.id)}
                                                onMouseLeave={() => setHoveredBed(null)}
                                                className={`relative px-3 py-2 rounded-xl text-[11px] font-black transition-all cursor-default ${cfg.light} ${cfg.text} border-2 ${cfg.border}`}>
                                                Bed {bed.bedNumber}
                                                <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full font-black ${isAvailable ? 'bg-emerald-200 text-emerald-800' : 'bg-orange-200 text-orange-800'}`}>
                                                    {isAvailable ? 'Free' : 'Occupied'}
                                                </span>
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
                            <div key={room.id} className={`bg-white rounded-2xl shadow-lg border overflow-hidden ${room.available > 0 ? 'border-emerald-200' : 'border-orange-200'}`}>
                                <div className={`h-1.5 ${room.available > 0 ? 'bg-emerald-500' : 'bg-orange-500'}`} />
                                <div className="p-4">
                                    <p className="font-black text-slate-900">Room {room.roomNumber}</p>
                                    <p className="text-xs text-slate-400 mb-3">{room.type}</p>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {room.beds.map((bed: any) => {
                                            const cfg = getBedColor(bed.status);
                                            const isAvailable = bed.status === 'AVAILABLE';
                                            return (
                                                <div
                                                    key={bed.id}
                                                    title={`${bed.bedNumber} — ${isAvailable ? 'Available' : (bed.tenantName || 'Occupied')}`}
                                                    className={`h-12 rounded-xl flex flex-col items-center justify-center text-[9px] font-black border-2 ${cfg.light} ${cfg.text} ${cfg.border} transition-all`}>
                                                    <span>{bed.bedNumber}</span>
                                                    <span className={`mt-0.5 px-1 rounded text-[8px] ${isAvailable ? 'bg-emerald-200 text-emerald-800' : 'bg-orange-200 text-orange-800'}`}>
                                                        {isAvailable ? 'Free' : 'Occupied'}
                                                    </span>
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
