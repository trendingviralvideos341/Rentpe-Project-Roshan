"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Utensils, Save, Building2, ChefHat } from "lucide-react";
import { getFoodMenu, updateFoodMenu } from "@/actions/ops";
import { getProperties } from "@/actions/properties";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────────────────────

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DAY_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const DAY_ICONS = ["🌟","🔥","💧","🌿","⚡","🎉","😴"];

const MEAL_TYPES = [
    { value:"MorningTea",  label:"Morning tea",  emoji:"☕", order:1, defaultFrom:"07:00", defaultTo:"08:00" },
    { value:"Breakfast",   label:"Breakfast",    emoji:"🌅", order:2, defaultFrom:"08:00", defaultTo:"10:00" },
    { value:"MidMorning",  label:"Mid-morning",  emoji:"🍵", order:3, defaultFrom:"10:30", defaultTo:"11:30" },
    { value:"Lunch",       label:"Lunch",        emoji:"☀️", order:4, defaultFrom:"12:30", defaultTo:"14:30" },
    { value:"Snacks",      label:"Snacks",       emoji:"🍪", order:5, defaultFrom:"16:00", defaultTo:"17:30" },
    { value:"EveningTea",  label:"Evening tea",  emoji:"🫖", order:6, defaultFrom:"17:00", defaultTo:"18:00" },
    { value:"Dinner",      label:"Dinner",       emoji:"🌙", order:7, defaultFrom:"20:00", defaultTo:"22:00" },
    { value:"LateNight",   label:"Late night",   emoji:"🌃", order:8, defaultFrom:"22:00", defaultTo:"23:30" },
    { value:"Custom",      label:"Custom",       emoji:"✏️", order:9, defaultFrom:"12:00", defaultTo:"13:00" },
] as const;

const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i === 0 ? 12 : i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

const PLACEHOLDERS: Record<string, string> = {
    Breakfast: "e.g. Idli, Sambar, Chutney, Filter Coffee",
    Lunch: "e.g. Rice, Dal, Sabzi, Raita, Buttermilk",
    Dinner: "e.g. Roti, Paneer, Dal, Raita, Kheer",
    Snacks: "e.g. Tea, Samosa, Biscuits, Bhel",
    MorningTea: "e.g. Tea/Coffee, Marie biscuits",
    EveningTea: "e.g. Tea, Banana, Biscuits",
    Default: "Food items for this slot...",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

type MealType = typeof MEAL_TYPES[number]["value"];

interface MealSlot {
    id: string;
    type: MealType;
    from: string;   // "08:00" 24hr
    to: string;     // "10:00" 24hr
    items: string;
}

const getMeal = (v: string) => MEAL_TYPES.find(m => m.value === v) ?? MEAL_TYPES[MEAL_TYPES.length - 1];
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const sortSlots = (s: MealSlot[]) => [...s].sort((a, b) => getMeal(a.type).order - getMeal(b.type).order);

const defaultSlots = (): MealSlot[] => [
    { id: uid(), type: "Breakfast", from: "08:00", to: "10:00", items: "" },
    { id: uid(), type: "Lunch",     from: "12:30", to: "14:30", items: "" },
    { id: uid(), type: "Dinner",    from: "20:00", to: "22:00", items: "" },
];

// Convert 24hr "14:30" to { h12:"02", min:"30", ampm:"PM" }
function to12hr(time24: string) {
    const [hStr, mStr] = (time24 || "12:00").split(":");
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return { h12: String(h).padStart(2, "0"), min: mStr || "00", ampm };
}

// Convert 12hr { h12, min, ampm } back to "14:30"
function to24hr(h12: string, min: string, ampm: string): string {
    let h = parseInt(h12, 10);
    if (ampm === "AM" && h === 12) h = 0;
    if (ampm === "PM" && h !== 12) h += 12;
    return `${String(h).padStart(2, "0")}:${min}`;
}

// Format display: "08:00" → "08:00 AM IST"
function formatIST(time24: string): string {
    const { h12, min, ampm } = to12hr(time24);
    return `${h12}:${min} ${ampm} IST`;
}

// ── Time Picker Component ─────────────────────────────────────────────────────

function TimePicker({
    value,
    onChange,
}: {
    value: string;
    onChange: (v: string) => void;
}) {
    const { h12, min, ampm } = to12hr(value);

    const updateTime = (newH12: string, newMin: string, newAmpm: string) => {
        onChange(to24hr(newH12, newMin, newAmpm));
    };

    return (
        <div className="flex items-center gap-1">
            {/* HH */}
            <div className="flex flex-col items-center">
                <span className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">HH</span>
                <select
                    value={h12}
                    onChange={e => updateTime(e.target.value, min, ampm)}
                    className="w-10 text-center text-xs font-mono font-bold border border-slate-200 rounded-lg py-1.5 bg-white text-slate-800 outline-none cursor-pointer focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                    {HOURS_12.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
            </div>
            <span className="text-slate-400 font-bold text-sm mt-3">:</span>
            {/* MM */}
            <div className="flex flex-col items-center">
                <span className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">MM</span>
                <select
                    value={min}
                    onChange={e => updateTime(h12, e.target.value, ampm)}
                    className="w-10 text-center text-xs font-mono font-bold border border-slate-200 rounded-lg py-1.5 bg-white text-slate-800 outline-none cursor-pointer focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                    {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </div>
            {/* AM/PM */}
            <div className="flex flex-col items-center ml-0.5">
                <span className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">AM/PM</span>
                <select
                    value={ampm}
                    onChange={e => updateTime(h12, min, e.target.value)}
                    className="w-14 text-center text-xs font-bold border border-slate-200 rounded-lg py-1.5 bg-white outline-none cursor-pointer focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-indigo-600"
                >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                </select>
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function FoodMenuContainer() {
    const [properties, setProperties] = useState<any[]>([]);
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
    const [selectedProperty, setSelectedProperty] = useState<any>(null);
    const [menu, setMenu] = useState<Record<string, MealSlot[]>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [activeDay, setActiveDay] = useState("Monday");
    const [viewAll, setViewAll] = useState(false);

    useEffect(() => {
        getProperties()
            .then(p => setProperties(p))
            .catch(() => toast.error("Failed to load properties"))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!selectedPropertyId) {
            setSelectedProperty(null);
            setMenu({});
            setIsDirty(false);
            return;
        }
        const prop = properties.find(p => p.id === selectedPropertyId);
        setSelectedProperty(prop ?? null);
        fetchMenu();
        setIsDirty(false);
    }, [selectedPropertyId]);

    const fetchMenu = async () => {
        setLoading(true);
        try {
            const data = await getFoodMenu(selectedPropertyId);
            const built: Record<string, MealSlot[]> = {};
            for (const day of DAYS) {
                const dayMeals = data.filter((m: any) => m.dayOfWeek === day);
                const dailySlotsRow = dayMeals.find((m: any) => m.mealType === 'DAILY_SLOTS');

                if (dailySlotsRow && dailySlotsRow.weeklyMenu) {
                    try {
                        const parsed = JSON.parse(dailySlotsRow.weeklyMenu);
                        if (parsed[day]) {
                            built[day] = sortSlots(parsed[day].map((s: any, i: number) => ({
                                id: s.id || uid(),
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
                            id: uid(),
                            type: m.mealType || "Custom",
                            from: m.fromTime || (m.mealType === 'Breakfast' ? "08:00" : m.mealType === 'Lunch' ? "12:30" : m.mealType === 'Dinner' ? "20:00" : "12:00"),
                            to: m.toTime || (m.mealType === 'Breakfast' ? "10:00" : m.mealType === 'Lunch' ? "14:30" : m.mealType === 'Dinner' ? "22:00" : "13:00"),
                            items: m.items || "",
                        })));
                    } else {
                        built[day] = defaultSlots();
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

    const updateSlot = (day: string, id: string, field: string, value: string) => {
        setMenu(prev => {
            let updated = prev[day].map(s => {
                if (s.id !== id) return s;
                if (field === "type") {
                    const m = getMeal(value);
                    return { ...s, type: value as MealType, from: m.defaultFrom, to: m.defaultTo };
                }
                return { ...s, [field]: value };
            });
            if (field === "type") updated = sortSlots(updated);
            return { ...prev, [day]: updated };
        });
        setIsDirty(true);
    };

    const addSlot = (day: string) => {
        setMenu(prev => ({
            ...prev,
            [day]: sortSlots([
                ...prev[day],
                { id: uid(), type: "Custom", from: "12:00", to: "13:00", items: "" },
            ]),
        }));
        setIsDirty(true);
    };

    const removeSlot = (day: string, id: string) => {
        setMenu(prev => ({ ...prev, [day]: prev[day].filter(s => s.id !== id) }));
        setIsDirty(true);
    };

    const handleSaveAll = async () => {
        if (!isDirty) return;
        setSaving(true);
        try {
            await Promise.all(
                DAYS.map(day => updateFoodMenu(selectedPropertyId, day, menu[day] ?? []))
            );
            toast.success("All 7 days saved!");
            setIsDirty(false);
        } catch {
            toast.error("Failed to save menu.");
        } finally {
            setSaving(false);
        }
    };

    // ── Loading / Empty states ────────────────────────────────────────────────

    if (loading && properties.length === 0) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400 tracking-widest uppercase">Loading properties...</p>
        </div>
    );

    if (!loading && properties.length === 0) return (
        <div className="p-12 text-center border-2 border-dashed rounded-2xl bg-slate-50">
            <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-600">No properties found</p>
            <p className="text-sm text-slate-400 mt-1">Add a property to manage food menus.</p>
        </div>
    );

    const days = viewAll ? DAYS : [activeDay];

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-5">

            {/* ── Top header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
                        <ChefHat className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900">Food menu</h1>
                        <p className="text-xs text-slate-400">Weekly meal plan for residents</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 font-medium">Property</span>
                    <select
                        className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none min-w-[260px] cursor-pointer transition-all"
                        value={selectedPropertyId}
                        onChange={e => { setSelectedPropertyId(e.target.value); setActiveDay("Monday"); setViewAll(false); }}
                    >
                        <option value="">— Select a property —</option>
                        {properties.map(p => (
                            <option key={p.id} value={p.id}>[{p.displayId}] {p.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── Property banner — center, vivid ── */}
            {selectedProperty && (
                <div className="flex flex-col items-center gap-1 py-2">
                    <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 shadow-md shadow-indigo-200">
                        <Building2 className="h-4 w-4 text-white/80 shrink-0" />
                        <span className="text-sm font-black text-white tracking-tight">
                            {selectedProperty.name}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-white/40" />
                        <span className="text-xs text-white/70 font-medium">
                            {selectedProperty.city}
                        </span>
                        <span className="text-[10px] font-mono text-white/50 ml-1">
                            [{selectedProperty.displayId}]
                        </span>
                    </div>
                    <p className="text-[11px] text-slate-400">Editing weekly food menu · All times in IST</p>
                </div>
            )}

            {/* ── Empty state ── */}
            {!selectedPropertyId ? (
                <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 gap-4">
                    <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-sm">
                        <Utensils className="h-8 w-8 text-slate-300" />
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-slate-600 text-base">Select a property to view or edit its menu</p>
                        <p className="text-sm text-slate-400 mt-1 max-w-xs">
                            Choose a property from the dropdown above to manage its weekly food plan.
                        </p>
                    </div>
                </div>

            ) : loading ? (
                <div className="py-16 text-center text-sm text-slate-400 animate-pulse">Loading menu...</div>

            ) : (
                <div className="space-y-3">

                    {/* ── Day selector tabs ── */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {DAYS.map((day, i) => {
                            const hasContent = (menu[day] ?? []).some(s => s.items.trim());
                            const isActive = !viewAll && activeDay === day;
                            return (
                                <button
                                    key={day}
                                    onClick={() => { setActiveDay(day); setViewAll(false); }}
                                    className={cn(
                                        "relative px-4 py-2 rounded-full text-xs font-bold border transition-all",
                                        isActive
                                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200"
                                            : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
                                    )}
                                >
                                    {DAY_SHORT[i]}
                                    {hasContent && (
                                        <span className={cn(
                                            "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2",
                                            isActive ? "bg-green-300 border-indigo-600" : "bg-green-400 border-white"
                                        )} />
                                    )}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setViewAll(v => !v)}
                            className={cn(
                                "ml-auto px-4 py-2 rounded-full text-xs font-bold border transition-all",
                                viewAll
                                    ? "bg-slate-800 text-white border-slate-800"
                                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-400"
                            )}
                        >
                            {viewAll ? "Single day" : "View all"}
                        </button>
                    </div>

                    {/* ── Day cards ── */}
                    {days.map(day => (
                        <DayCard
                            key={day}
                            day={day}
                            dayIndex={DAYS.indexOf(day)}
                            slots={menu[day] ?? []}
                            onUpdate={updateSlot}
                            onAdd={addSlot}
                            onRemove={removeSlot}
                        />
                    ))}

                    {/* ── Save all — bottom ── */}
                    <div className="pt-2 pb-4">
                        <button
                            onClick={handleSaveAll}
                            disabled={!isDirty || saving}
                            className={cn(
                                "w-full h-12 rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all",
                                isDirty && !saving
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-100"
                                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            )}
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

// ── Day Card ──────────────────────────────────────────────────────────────────

function DayCard({
    day,
    dayIndex,
    slots,
    onUpdate,
    onAdd,
    onRemove,
}: {
    day: string;
    dayIndex: number;
    slots: MealSlot[];
    onUpdate: (day: string, id: string, field: string, value: string) => void;
    onAdd: (day: string) => void;
    onRemove: (day: string, id: string) => void;
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">

            {/* Day header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                <div className="w-9 h-9 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-lg shrink-0">
                    {DAY_ICONS[dayIndex]}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-800">{day}</p>
                    <p className="text-[10px] text-slate-400">
                        {slots.length} slot{slots.length !== 1 ? "s" : ""}
                        {slots.some(s => s.items.trim()) ? " · menu set ✓" : " · no items yet"}
                    </p>
                </div>
                <div className="flex items-center gap-1.5">
                    {slots.map(s => {
                        const m = getMeal(s.type);
                        return (
                            <span
                                key={s.id}
                                title={m.label}
                                className="w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-sm"
                            >
                                {m.emoji}
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Slots table */}
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-44">
                                Meal type
                            </th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-52">
                                From (IST)
                            </th>
                            <th className="px-2 py-2.5 text-center text-[10px] font-bold text-slate-300 w-6">→</th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-52">
                                To (IST)
                            </th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Items / menu description
                            </th>
                            <th className="w-10" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {slots.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                                    No meal slots — add one below
                                </td>
                            </tr>
                        ) : slots.map(slot => {
                            const m = getMeal(slot.type);
                            const fromIST = formatIST(slot.from);
                            const toIST = formatIST(slot.to);
                            return (
                                <tr key={slot.id} className="hover:bg-slate-50 transition-colors group">

                                    {/* Meal type */}
                                    <td className="px-4 py-3 align-top">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg w-6 text-center">{m.emoji}</span>
                                            <select
                                                value={slot.type}
                                                onChange={e => onUpdate(day, slot.id, "type", e.target.value)}
                                                className="text-xs font-medium border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 outline-none cursor-pointer focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 flex-1 min-w-0 transition-all"
                                            >
                                                {MEAL_TYPES.map(mt => (
                                                    <option key={mt.value} value={mt.value}>
                                                        {mt.emoji} {mt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </td>

                                    {/* From */}
                                    <td className="px-4 py-3 align-top">
                                        <div className="space-y-1">
                                            <TimePicker
                                                value={slot.from}
                                                onChange={v => onUpdate(day, slot.id, "from", v)}
                                            />
                                            <p className="text-[10px] font-mono text-indigo-500 font-bold pl-0.5">
                                                {fromIST}
                                            </p>
                                        </div>
                                    </td>

                                    {/* Arrow */}
                                    <td className="px-2 py-3 align-middle text-center">
                                        <span className="text-slate-300 text-lg">→</span>
                                    </td>

                                    {/* To */}
                                    <td className="px-4 py-3 align-top">
                                        <div className="space-y-1">
                                            <TimePicker
                                                value={slot.to}
                                                onChange={v => onUpdate(day, slot.id, "to", v)}
                                            />
                                            <p className="text-[10px] font-mono text-indigo-500 font-bold pl-0.5">
                                                {toIST}
                                            </p>
                                        </div>
                                    </td>

                                    {/* Items */}
                                    <td className="px-4 py-3 align-top">
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                                                {m.emoji} {m.label} items
                                            </p>
                                            <input
                                                type="text"
                                                placeholder={PLACEHOLDERS[slot.type] ?? PLACEHOLDERS.Default}
                                                value={slot.items}
                                                onChange={e => onUpdate(day, slot.id, "items", e.target.value)}
                                                className={cn(
                                                    "w-full text-sm px-3 py-2 border rounded-xl outline-none transition-all font-medium",
                                                    slot.items
                                                        ? "border-indigo-200 bg-indigo-50 text-indigo-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                        : "border-slate-200 bg-white text-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                )}
                                            />
                                        </div>
                                    </td>

                                    {/* Delete */}
                                    <td className="pr-3 py-3 align-middle">
                                        <button
                                            onClick={() => onRemove(day, slot.id)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-transparent text-slate-300 hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                            aria-label="Remove slot"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Add slot */}
            <div className="px-4 py-3 border-t border-dashed border-indigo-200 bg-indigo-50/30">
                <button
                    onClick={() => onAdd(day)}
                    className="flex items-center gap-1.5 text-xs font-bold text-indigo-500 hover:text-indigo-700 transition-colors"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add meal slot for {day}
                </button>
            </div>
        </div>
    );
}
