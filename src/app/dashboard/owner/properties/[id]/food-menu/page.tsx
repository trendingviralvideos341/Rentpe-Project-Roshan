'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Save, Loader2, X, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MEALS = [
    { key: 'breakfast', label: 'Breakfast', icon: '🌅', time: '7:30 – 9:30 AM' },
    { key: 'lunch',     label: 'Lunch',     icon: '☀️', time: '12:30 – 2:30 PM' },
    { key: 'dinner',    label: 'Dinner',    icon: '🌙', time: '7:30 – 9:30 PM' },
];

type WeeklyMenu = Record<string, Record<string, string>>;

async function getFoodMenuForProperty(propertyId: string) {
    const res = await fetch(`/api/owner/food-menu?propertyId=${propertyId}`);
    if (!res.ok) return null;
    return res.json();
}

async function saveFoodMenuForProperty(propertyId: string, weeklyMenu: WeeklyMenu) {
    const res = await fetch('/api/owner/food-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, weeklyMenu }),
    });
    if (!res.ok) throw new Error('Failed to save');
    return res.json();
}

export default function OwnerFoodMenuEditor() {
    const params = useParams();
    const propertyId = params?.id as string;

    const [menu, setMenu] = useState<WeeklyMenu>(() => {
        const init: WeeklyMenu = {};
        DAYS.forEach(d => { init[d] = { breakfast: '', lunch: '', dinner: '' }; });
        return init;
    });
    const [loading, setLoading] = useState(true);
    const [activeDay, setActiveDay] = useState('monday');
    const [isPending, startTransition] = useTransition();
    const [lastSaved, setLastSaved] = useState<string | null>(null);
    const [menuVersion, setMenuVersion] = useState(0);
    const [propertyName, setPropertyName] = useState('');

    useEffect(() => {
        if (!propertyId) { setLoading(false); return; }
        getFoodMenuForProperty(propertyId).then(data => {
            if (data?.weeklyMenu) {
                try {
                    const parsed = typeof data.weeklyMenu === 'string' ? JSON.parse(data.weeklyMenu) : data.weeklyMenu;
                    const merged: WeeklyMenu = {};
                    DAYS.forEach(d => {
                        merged[d] = { breakfast: '', lunch: '', dinner: '', ...(parsed[d] || {}) };
                    });
                    setMenu(merged);
                } catch {}
            }
            if (data?.propertyName) setPropertyName(data.propertyName);
            if (data?.menuVersion) { setMenuVersion(data.menuVersion); setLastSaved(`v${data.menuVersion}`); }
        }).catch(() => {}).finally(() => setLoading(false));
    }, [propertyId]);

    const updateCell = (day: string, meal: string, value: string) => {
        setMenu(prev => ({
            ...prev,
            [day]: { ...prev[day], [meal]: value }
        }));
    };

    // Copy today's meals to all days
    const copyToAll = () => {
        const source = menu[activeDay];
        const newMenu: WeeklyMenu = {};
        DAYS.forEach(d => { newMenu[d] = { ...source }; });
        setMenu(newMenu);
        toast.success(`${activeDay.charAt(0).toUpperCase() + activeDay.slice(1)}'s menu copied to all days.`);
    };

    const handleSave = () => {
        startTransition(async () => {
            try {
                const data = await saveFoodMenuForProperty(propertyId, menu);
                setMenuVersion(v => v + 1);
                setLastSaved(`v${(data?.menuVersion || menuVersion + 1)}`);
                toast.success('Food menu saved successfully!');
            } catch {
                toast.error('Failed to save menu. Please try again.');
            }
        });
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
    );

    const today = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-6 pt-10 pb-20 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="max-w-5xl mx-auto relative z-10">
                    <Link href={`/dashboard/owner/properties`} className="text-indigo-200 text-xs font-bold flex items-center gap-1 mb-4 hover:text-white">
                        <ChevronLeft className="w-3 h-3" /> Back to Properties
                    </Link>
                    <div className="flex items-end justify-between">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Food Menu Manager</h1>
                            <p className="text-indigo-200 text-sm font-medium mt-1">{propertyName} · Set weekly meal plan</p>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={isPending}
                            className="flex items-center gap-2 px-5 py-3 bg-white text-indigo-700 font-black text-sm rounded-2xl hover:bg-indigo-50 transition-all shadow-xl disabled:opacity-70"
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {isPending ? 'Saving...' : 'Save Menu'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 -mt-12 relative z-10 space-y-4">
                {/* Last Saved */}
                {lastSaved && (
                    <p className="text-center text-xs text-slate-400 font-medium pt-2">
                        Saved: {lastSaved}
                    </p>
                )}

                {/* Day Tabs */}
                <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto border-b border-slate-100">
                        <div className="flex min-w-max">
                            {DAYS.map(day => (
                                <button
                                    key={day}
                                    onClick={() => setActiveDay(day)}
                                    className={`flex-1 px-6 py-4 text-center min-w-[100px] font-black text-sm capitalize transition-all relative ${
                                        activeDay === day
                                            ? 'bg-indigo-600 text-white'
                                            : day === today
                                            ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                            : 'text-slate-500 hover:bg-slate-50'
                                    }`}
                                >
                                    {day.slice(0, 3).toUpperCase()}
                                    {day === today && activeDay !== day && (
                                        <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Current Day Editor */}
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="font-black text-slate-900 capitalize text-lg">{activeDay}</h2>
                            <button
                                onClick={copyToAll}
                                className="text-xs font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-all"
                            >
                                Copy to all days →
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {MEALS.map(meal => (
                                <div key={meal.key} className="space-y-2">
                                    <label className="flex items-center gap-2">
                                        <span className="text-xl">{meal.icon}</span>
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-slate-500">{meal.label}</p>
                                            <p className="text-[10px] text-slate-400">{meal.time}</p>
                                        </div>
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={menu[activeDay]?.[meal.key] || ''}
                                        onChange={e => updateCell(activeDay, meal.key, e.target.value)}
                                        placeholder={`What's for ${meal.label.toLowerCase()}?`}
                                        className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-slate-50 hover:bg-white transition-colors"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Full Week Preview */}
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                        <h2 className="font-black text-slate-900 text-sm">Weekly Overview</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px]">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Day</th>
                                    {MEALS.map(m => (
                                        <th key={m.key} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            {m.icon} {m.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {DAYS.map(day => (
                                    <tr
                                        key={day}
                                        onClick={() => setActiveDay(day)}
                                        className={`hover:bg-indigo-50/30 cursor-pointer transition-colors ${activeDay === day ? 'bg-indigo-50/50' : ''}`}
                                    >
                                        <td className="px-4 py-3">
                                            <span className={`text-sm font-black capitalize ${day === today ? 'text-indigo-600' : 'text-slate-700'}`}>
                                                {day}
                                                {day === today && <span className="ml-1.5 text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">TODAY</span>}
                                            </span>
                                        </td>
                                        {MEALS.map(m => (
                                            <td key={m.key} className="px-4 py-3 text-sm text-slate-600">
                                                {menu[day]?.[m.key] || <span className="text-slate-300 italic text-xs">Not set</span>}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
