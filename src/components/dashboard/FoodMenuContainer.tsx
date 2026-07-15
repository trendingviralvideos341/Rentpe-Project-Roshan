"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { Utensils, Save, Building2, ChefHat, Plus, Trash2 } from "lucide-react";
import { getFoodMenu, updateFoodMenu } from "@/actions/ops";
import { getProperties } from "@/actions/properties";
import { toast } from "sonner";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Meal types in logical daily order — used for auto-sorting
const MEAL_TYPES = [
    { value: "EarlyMorning", label: "Early Morning", emoji: "🌄", order: 1,  defaultFrom: "05:00", defaultTo: "06:30" },
    { value: "MorningTea",   label: "Morning Tea",   emoji: "☕", order: 2,  defaultFrom: "07:00", defaultTo: "08:00" },
    { value: "Breakfast",    label: "Breakfast",     emoji: "🌅", order: 3,  defaultFrom: "08:00", defaultTo: "10:00" },
    { value: "BrunchTea",    label: "Mid-Morning",   emoji: "🍵", order: 4,  defaultFrom: "10:30", defaultTo: "11:30" },
    { value: "Lunch",        label: "Lunch",         emoji: "☀️", order: 5,  defaultFrom: "12:30", defaultTo: "14:30" },
    { value: "Snacks",       label: "Snacks",        emoji: "🍪", order: 6,  defaultFrom: "16:00", defaultTo: "17:30" },
    { value: "EveningTea",   label: "Evening Tea",   emoji: "🫖", order: 7,  defaultFrom: "17:00", defaultTo: "18:00" },
    { value: "Dinner",       label: "Dinner",        emoji: "🌙", order: 8,  defaultFrom: "20:00", defaultTo: "22:00" },
    { value: "LateNight",    label: "Late Night",    emoji: "🌃", order: 9,  defaultFrom: "22:00", defaultTo: "23:30" },
    { value: "Custom",       label: "Custom",        emoji: "✏️", order: 10, defaultFrom: "12:00", defaultTo: "13:00" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ["00", "15", "30", "45"];

const getMealMeta = (val: string) => MEAL_TYPES.find(m => m.value === val) || MEAL_TYPES[MEAL_TYPES.length - 1];

const sortSlots = (slots: any[]) =>
    [...slots].sort((a, b) => {
        const orderA = getMealMeta(a.type).order;
        const orderB = getMealMeta(b.type).order;
        if (orderA !== orderB) return orderA - orderB;
        return a.from.localeCompare(b.from);
    });

const defaultSlots = () => [
    { id: Date.now() + 1, type: "Breakfast", from: "08:00", to: "10:00", items: "" },
    { id: Date.now() + 2, type: "Lunch",     from: "12:30", to: "14:30", items: "" },
    { id: Date.now() + 3, type: "Dinner",    from: "20:00", to: "22:00", items: "" },
];

export function FoodMenuContainer() {
    const [properties, setProperties] = useState<any[]>([]);
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
    const [selectedProperty, setSelectedProperty] = useState<any>(null);
    const [menu, setMenu] = useState<Record<string, any[]>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [activeDay, setActiveDay] = useState("Monday");

    useEffect(() => {
        getProperties()
            .then(setProperties)
            .catch(() => toast.error("Failed to load properties"))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!selectedPropertyId) {
            setSelectedProperty(null);
            setMenu({});
            return;
        }
        const prop = properties.find(p => p.id === selectedPropertyId);
        setSelectedProperty(prop || null);
        fetchMenu();
        setIsDirty(false);
    }, [selectedPropertyId]);

    const fetchMenu = async () => {
        setLoading(true);
        try {
            const data = await getFoodMenu(selectedPropertyId);
            // Build menu from DB data or use defaults
            const built: Record<string, any[]> = {};
            for (const day of DAYS) {
                const dayMeals = data.filter((m: any) => m.dayOfWeek === day);
                const dailySlotsRow = dayMeals.find((m: any) => m.mealType === 'DAILY_SLOTS');

                if (dailySlotsRow && dailySlotsRow.weeklyMenu) {
                    try {
                        const parsed = JSON.parse(dailySlotsRow.weeklyMenu);
                        if (parsed[day]) {
                            built[day] = sortSlots(parsed[day].map((s: any, i: number) => ({
                                id: s.id || Date.now() + i + Math.random(),
                                type: s.type || "Custom",
                                from: s.from || "12:00",
                                to: s.to || "13:00",
                                items: s.items || "",
                            })));
                        }
                    } catch (e) {
                        console.error("Failed to parse weekly menu json for", day);
                    }
                }

                if (!built[day]) {
                    // Fallback to legacy structure or defaults
                    const legacyMeals = dayMeals.filter((m: any) => m.mealType !== 'DAILY_SLOTS');
                    if (legacyMeals.length > 0) {
                        built[day] = sortSlots(legacyMeals.map((m: any, i: number) => ({
                            id: Date.now() + i + Math.random(),
                            type: m.mealType || "Custom",
                            from: m.fromTime || (m.mealType === 'Breakfast' ? "08:00" : m.mealType === 'Lunch' ? "12:30" : m.mealType === 'Dinner' ? "20:00" : "12:00"),
                            to: m.toTime || (m.mealType === 'Breakfast' ? "10:00" : m.mealType === 'Lunch' ? "14:30" : m.mealType === 'Dinner' ? "22:00" : "13:00"),
                            items: m.items || "",
                        })));
                    } else {
                        built[day] = defaultSlots().map(s => ({ ...s, id: Date.now() + Math.random() }));
                    }
                }
            }
            setMenu(built);
        } catch {
            toast.error("Failed to fetch menu");
        } finally {
            setLoading(false);
        }
    };

    const updateSlot = (day: string, id: number, field: string, value: string) => {
        setMenu(prev => {
            let updated = prev[day].map(s => s.id === id ? { ...s, [field]: value } : s);
            if (field === 'type') {
                const meta = getMealMeta(value);
                updated = updated.map(s => s.id === id ? { ...s, from: meta.defaultFrom, to: meta.defaultTo } : s);
            }
            return { ...prev, [day]: sortSlots(updated) };
        });
        setIsDirty(true);
    };

    const addSlot = (day: string) => {
        const newSlot = { id: Date.now(), type: "Custom", from: "12:00", to: "13:00", items: "" };
        setMenu(prev => ({ ...prev, [day]: sortSlots([...prev[day], newSlot]) }));
        setIsDirty(true);
    };

    const removeSlot = (day: string, id: number) => {
        setMenu(prev => ({ ...prev, [day]: prev[day].filter(s => s.id !== id) }));
        setIsDirty(true);
    };

    const handleSaveAll = async () => {
        setSaving(true);
        try {
            await Promise.all(
                DAYS.map(day =>
                    updateFoodMenu(selectedPropertyId, day, menu[day] || [])
                )
            );
            toast.success("All 7 days saved!");
            setIsDirty(false);
        } catch {
            toast.error("Failed to save menu.");
        } finally {
            setSaving(false);
        }
    };

    if (loading && properties.length === 0) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground tracking-widest uppercase">Loading properties...</p>
        </div>
    );

    if (!loading && properties.length === 0) return (
        <div className="p-12 text-center border-2 border-dashed rounded-2xl bg-slate-50">
            <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-600">No properties found</p>
            <p className="text-sm text-muted-foreground mt-1">Add a property to manage food menus.</p>
        </div>
    );

    return (
        <div className="space-y-5">

            {/* ── Top header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                    <ChefHat className="h-5 w-5 text-indigo-500" />
                    <div>
                        <h1 className="text-xl font-black text-slate-900">Food menu</h1>
                        <p className="text-xs text-muted-foreground">Weekly meal plan for residents</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">Property</span>
                    <select
                        className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 bg-white focus:border-indigo-400 outline-none min-w-[240px] cursor-pointer"
                        value={selectedPropertyId}
                        onChange={e => { setSelectedPropertyId(e.target.value); setActiveDay("Monday"); }}
                    >
                        <option value="">— Select a property —</option>
                        {properties.map(p => (
                            <option key={p.id} value={p.id}>[{p.displayId}] {p.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── Selected property — center badge ── */}
            {selectedProperty && (
                <div className="flex flex-col items-center justify-center py-3 gap-1">
                    <div className="flex items-center gap-2 px-5 py-2 bg-indigo-50 border border-indigo-200 rounded-full">
                        <Building2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span className="text-sm font-black text-indigo-800">{selectedProperty.name}</span>
                        <span className="text-xs text-indigo-400">·</span>
                        <span className="text-xs text-indigo-500">{selectedProperty.city}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Editing weekly food menu</p>
                </div>
            )}

            {/* ── Empty state ── */}
            {!selectedPropertyId ? (
                <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 gap-4">
                    <div className="w-14 h-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center">
                        <Utensils className="h-7 w-7 text-slate-300" />
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-slate-600">Select a property to view or edit its menu</p>
                        <p className="text-sm text-slate-400 mt-1 max-w-xs">
                            Choose a property from the dropdown above to manage its weekly food plan.
                        </p>
                    </div>
                </div>

            ) : loading ? (
                <div className="py-16 text-center text-sm text-muted-foreground animate-pulse">Loading menu...</div>

            ) : (
                <div className="space-y-4">

                    {/* ── Day tabs ── */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {DAYS.map((day, i) => {
                            const slots = menu[day] || [];
                            const hasContent = slots.some(s => s.items?.trim());
                            const isActive = activeDay === day;
                            return (
                                <button
                                    key={day}
                                    onClick={() => setActiveDay(day)}
                                    className={`relative px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                                        isActive
                                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                            : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
                                    }`}
                                >
                                    {DAY_SHORT[i]}
                                    {hasContent && (
                                        <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border-2 ${
                                            isActive ? "bg-green-300 border-indigo-600" : "bg-green-400 border-white"
                                        }`} />
                                    )}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setActiveDay("ALL")}
                            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ml-auto ${
                                activeDay === "ALL"
                                    ? "bg-slate-800 text-white border-slate-800"
                                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-400"
                            }`}
                        >
                            View all
                        </button>
                    </div>

                    {/* ── Day cards ── */}
                    {(activeDay === "ALL" ? DAYS : [activeDay]).map(day => (
                        <DayCard
                            key={day}
                            day={day}
                            slots={menu[day] || []}
                            onUpdate={updateSlot}
                            onAdd={addSlot}
                            onRemove={removeSlot}
                            compact={activeDay === "ALL"}
                        />
                    ))}

                    {/* ── Save all — bottom, green, dirty only ── */}
                    <div className="pt-2 pb-4">
                        <button
                            onClick={handleSaveAll}
                            disabled={!isDirty || saving}
                            className={`w-full h-12 rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all ${
                                isDirty && !saving
                                    ? "bg-green-600 hover:bg-green-700 text-white shadow-sm"
                                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            }`}
                        >
                            <Save className="h-4 w-4" />
                            {saving ? "Saving all days..." : isDirty ? "Save all changes" : "No unsaved changes"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Day card sub-component ──
function DayCard({ day, slots, onUpdate, onAdd, onRemove, compact }: {
    day: string;
    slots: any[];
    onUpdate: (day: string, id: number, field: string, value: string) => void;
    onAdd: (day: string) => void;
    onRemove: (day: string, id: number) => void;
    compact?: boolean;
}) {
    const dayIndex = DAYS.indexOf(day);
    const dayEmojis = ["🌟", "🔥", "💧", "🌿", "⚡", "🎉", "😴"];

    return (
        <Card className="rounded-2xl border border-slate-200 overflow-hidden">
            {/* Day header */}
            <div className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                <div className="w-9 h-9 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-base shrink-0">
                    {dayEmojis[dayIndex]}
                </div>
                <div>
                    <p className="text-sm font-black text-slate-800">{day}</p>
                    <p className="text-[10px] text-muted-foreground">
                        {slots.length} meal slot{slots.length !== 1 ? "s" : ""}
                        {slots.some(s => s.items?.trim()) ? " · menu set" : " · no items yet"}
                    </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {slots.map(s => {
                        const meta = getMealMeta(s.type);
                        return (
                            <span key={s.id} title={meta.label}
                                className="w-6 h-6 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-xs">
                                {meta.emoji}
                            </span>
                        );
                    })}
                </div>
            </div>

            <CardContent className="p-4 space-y-3">
                {slots.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">
                        No meal slots yet — add one below
                    </p>
                ) : (
                    slots.map((slot, idx) => {
                        const meta = getMealMeta(slot.type);
                        return (
                            <div key={slot.id}
                                className="grid gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl"
                                style={{ gridTemplateColumns: "160px 1fr 1fr auto" }}
                            >
                                {/* Meal type */}
                                <div className="space-y-1">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Meal type</p>
                                    <div className="relative">
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none">
                                            {meta.emoji}
                                        </span>
                                        <select
                                            value={slot.type}
                                            onChange={e => onUpdate(day, slot.id, 'type', e.target.value)}
                                            className="w-full pl-8 pr-2 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:border-indigo-400 outline-none cursor-pointer appearance-none"
                                        >
                                            {MEAL_TYPES.map(m => (
                                                <option key={m.value} value={m.value}>{m.emoji} {m.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* From time */}
                                <div className="space-y-1">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">From</p>
                                    <TimePicker
                                        value={slot.from}
                                        onChange={v => onUpdate(day, slot.id, 'from', v)}
                                    />
                                </div>

                                {/* To time */}
                                <div className="space-y-1">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">To</p>
                                    <TimePicker
                                        value={slot.to}
                                        onChange={v => onUpdate(day, slot.id, 'to', v)}
                                    />
                                </div>

                                {/* Items + delete */}
                                <button
                                    onClick={() => onRemove(day, slot.id)}
                                    className="self-end p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    title="Remove slot"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>

                                {/* Items — full width */}
                                <div className="col-span-4 space-y-1">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                                        {meta.emoji} {meta.label} items
                                    </p>
                                    <Input
                                        placeholder={`e.g. ${
                                            slot.type === 'Breakfast' ? "Idli, Sambar, Chutney, Filter Coffee" :
                                            slot.type === 'Lunch' ? "Rice, Dal Tadka, Sabzi, Salad, Buttermilk" :
                                            slot.type === 'Dinner' ? "Roti, Paneer Curry, Dal, Raita, Kheer" :
                                            slot.type === 'Snacks' ? "Tea, Samosa, Biscuits, Bhel" :
                                            slot.type === 'MorningTea' ? "Tea/Coffee, Marie biscuits" :
                                            "Food items for this slot..."
                                        }`}
                                        value={slot.items}
                                        onChange={e => onUpdate(day, slot.id, 'items', e.target.value)}
                                        className="rounded-xl text-sm"
                                    />
                                </div>
                            </div>
                        );
                    })
                )}

                {/* Add slot */}
                <button
                    onClick={() => onAdd(day)}
                    className="w-full py-2.5 border border-dashed border-indigo-300 rounded-xl text-xs font-bold text-indigo-500 hover:bg-indigo-50 transition-all flex items-center justify-center gap-1.5"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add meal slot for {day}
                </button>
            </CardContent>
        </Card>
    );
}

// ── Time picker — HH and MM separately ──
function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const parts = (value || "12:00").split(":");
    const hh = parts[0] || "12";
    const mm = parts[1] || "00";

    return (
        <div className="flex items-center gap-1.5">
            <select
                value={hh}
                onChange={e => onChange(`${e.target.value}:${mm}`)}
                className="text-xs font-mono font-bold border border-slate-200 rounded-lg px-2 py-2 bg-white focus:border-indigo-400 outline-none cursor-pointer w-14 text-center"
            >
                {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <span className="text-slate-500 font-black text-sm">:</span>
            <select
                value={mm}
                onChange={e => onChange(`${hh}:${e.target.value}`)}
                className="text-xs font-mono font-bold border border-slate-200 rounded-lg px-2 py-2 bg-white focus:border-indigo-400 outline-none cursor-pointer w-14 text-center"
            >
                {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
        </div>
    );
}
