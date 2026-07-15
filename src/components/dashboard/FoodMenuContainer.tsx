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

const MEAL_TYPES = [
    { label: "🌅 Breakfast",   value: "Breakfast",   defaultFrom: "07:00", defaultTo: "09:00" },
    { label: "☕ Morning Tea",  value: "MorningTea",  defaultFrom: "09:30", defaultTo: "10:30" },
    { label: "☀️ Lunch",       value: "Lunch",       defaultFrom: "12:30", defaultTo: "14:30" },
    { label: "🍪 Snacks",      value: "Snacks",      defaultFrom: "17:00", defaultTo: "18:00" },
    { label: "🌙 Dinner",      value: "Dinner",      defaultFrom: "20:00", defaultTo: "22:00" },
    { label: "🌃 Late Night",  value: "LateNight",   defaultFrom: "22:00", defaultTo: "23:30" },
    { label: "✏️ Custom",      value: "Custom",      defaultFrom: "12:00", defaultTo: "13:00" },
];

export function FoodMenuContainer() {
    const [properties, setProperties] = useState<any[]>([]);
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
    const [selectedProperty, setSelectedProperty] = useState<any>(null);
    const [menu, setMenu] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [activeDay, setActiveDay] = useState("Monday");
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        const fetchInitial = async () => {
            try {
                const props = await getProperties();
                setProperties(props);
            } catch {
                toast.error("Failed to load properties");
            } finally {
                setLoading(false);
            }
        };
        fetchInitial();
    }, []);

    useEffect(() => {
        if (selectedPropertyId) {
            const prop = properties.find(p => p.id === selectedPropertyId);
            setSelectedProperty(prop || null);
            fetchMenu();
        } else {
            setSelectedProperty(null);
            setMenu([]);
            setIsDirty(false);
        }
    }, [selectedPropertyId]);

    const fetchMenu = async () => {
        setLoading(true);
        try {
            const data = await getFoodMenu(selectedPropertyId);
            const aggregatedMenu = DAYS.map(dayName => {
                const dayRows = data.filter((m: any) => m.dayOfWeek === dayName);
                const dailySlotsRow = dayRows.find((m: any) => m.mealType === 'DAILY_SLOTS');
                
                let slots: any[] = [];
                if (dailySlotsRow && dailySlotsRow.weeklyMenu) {
                    try {
                        const parsed = JSON.parse(dailySlotsRow.weeklyMenu);
                        if (parsed[dayName]) slots = parsed[dayName];
                    } catch (e) {
                        console.error("Failed to parse weekly menu json for", dayName);
                    }
                } else if (dayRows.length > 0) {
                    // migrate from old rows
                    const breakfast = dayRows.find((m: any) => m.mealType === 'Breakfast');
                    const lunch = dayRows.find((m: any) => m.mealType === 'Lunch');
                    const dinner = dayRows.find((m: any) => m.mealType === 'Dinner');
                    if (breakfast?.items) slots.push({ type: "Breakfast", from: "07:00", to: "09:00", items: breakfast.items });
                    if (lunch?.items) slots.push({ type: "Lunch", from: "12:30", to: "14:30", items: lunch.items });
                    if (dinner?.items) slots.push({ type: "Dinner", from: "20:00", to: "22:00", items: dinner.items });
                }

                // If slots is still empty, populate defaults
                if (slots.length === 0) {
                    slots = [
                        { type: "Breakfast", from: "07:00", to: "09:00", items: "" },
                        { type: "Lunch", from: "12:30", to: "14:30", items: "" },
                        { type: "Dinner", from: "20:00", to: "22:00", items: "" },
                    ];
                }

                return {
                    day: dayName,
                    slots: slots
                };
            });
            setMenu(aggregatedMenu);
            setIsDirty(false);
        } catch {
            toast.error("Failed to fetch menu");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateSlot = (day: string, index: number, field: string, val: string) => {
        setMenu(prev => prev.map(m => {
            if (m.day !== day) return m;
            const newSlots = [...m.slots];
            newSlots[index] = { ...newSlots[index], [field]: val };
            // auto-fill default timings when meal type changes
            if (field === 'type') {
                const mealTypeInfo = MEAL_TYPES.find(t => t.value === val);
                if (mealTypeInfo) {
                    newSlots[index].from = mealTypeInfo.defaultFrom;
                    newSlots[index].to = mealTypeInfo.defaultTo;
                }
            }
            return { ...m, slots: newSlots };
        }));
        setIsDirty(true);
    };

    const handleAddSlot = (day: string) => {
        setMenu(prev => prev.map(m => {
            if (m.day !== day) return m;
            return {
                ...m,
                slots: [...m.slots, { type: "Custom", from: "12:00", to: "13:00", items: "" }]
            };
        }));
        setIsDirty(true);
    };

    const handleRemoveSlot = (day: string, index: number) => {
        setMenu(prev => prev.map(m => {
            if (m.day !== day) return m;
            const newSlots = [...m.slots];
            newSlots.splice(index, 1);
            return { ...m, slots: newSlots };
        }));
        setIsDirty(true);
    };

    const handleSaveAll = async () => {
        setSaving('ALL');
        try {
            await Promise.all(
                menu.map(item =>
                    updateFoodMenu(selectedPropertyId, item.day, {
                        slots: item.slots
                    })
                )
            );
            toast.success("All changes saved successfully!");
            setIsDirty(false);
        } catch {
            toast.error("Failed to save menus.");
        } finally {
            setSaving(null);
        }
    };

    // Loading state
    if (loading && properties.length === 0) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground text-xs tracking-widest uppercase">Loading properties...</p>
        </div>
    );

    // No properties at all
    if (!loading && properties.length === 0) return (
        <div className="p-12 text-center border-2 border-dashed rounded-2xl bg-slate-50/50">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-7 w-7 text-slate-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-700">No properties found</h2>
            <p className="text-sm text-muted-foreground mt-1">
                You must be assigned to at least one property to manage food menus.
            </p>
        </div>
    );

    const activeDayMenu = menu.find(m => m.day === activeDay);

    const renderSlot = (slot: any, day: string, index: number) => (
        <div key={index} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center relative">
            <div className="flex flex-col gap-2 min-w-[200px]">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Meal Type</label>
                <select 
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    value={slot.type}
                    onChange={(e) => handleUpdateSlot(day, index, 'type', e.target.value)}
                >
                    {MEAL_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>
            </div>
            
            <div className="flex flex-col gap-2 min-w-[120px]">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">From</label>
                <input 
                    type="time" 
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    value={slot.from}
                    onChange={(e) => handleUpdateSlot(day, index, 'from', e.target.value)}
                />
            </div>

            <div className="flex flex-col gap-2 min-w-[120px]">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">To</label>
                <input 
                    type="time" 
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    value={slot.to}
                    onChange={(e) => handleUpdateSlot(day, index, 'to', e.target.value)}
                />
            </div>

            <div className="flex flex-col gap-2 flex-1 w-full">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Items</label>
                <Input
                    placeholder="e.g. Idli, Sambar, Chutney..."
                    value={slot.items}
                    onChange={(e) => handleUpdateSlot(day, index, 'items', e.target.value)}
                    className="rounded-lg bg-slate-50"
                />
            </div>

            <button 
                onClick={() => handleRemoveSlot(day, index)}
                className="mt-6 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                title="Remove slot"
            >
                <Trash2 className="h-5 w-5" />
            </button>
        </div>
    );

    return (
        <div className="space-y-6">

            {/* ── Header ── */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black flex items-center gap-2">
                            <ChefHat className="h-6 w-6 text-primary" />
                            Food menu
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Weekly meal plan for residents
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">Property</span>
                        <select
                            className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all outline-none min-w-[260px] cursor-pointer"
                            value={selectedPropertyId}
                            onChange={(e) => setSelectedPropertyId(e.target.value)}
                        >
                            <option value="">— Select a property —</option>
                            {properties.map(p => (
                                <option key={p.id} value={p.id}>
                                    [{p.displayId}] {p.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Active property banner — shows when selected */}
                {selectedProperty && (
                    <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-2xl flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                                <Building2 className="h-4 w-4 text-indigo-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-indigo-900 truncate">
                                    {selectedProperty.name}
                                </p>
                                <p className="text-xs text-indigo-500">
                                    {selectedProperty.city} · editing weekly menu
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Empty state — no property selected ── */}
            {!selectedPropertyId ? (
                <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 space-y-4">
                    <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-sm">
                        <Utensils className="h-8 w-8 text-slate-300" />
                    </div>
                    <div className="text-center space-y-1">
                        <h3 className="text-base font-bold text-slate-700">
                            Select a property to view or edit its menu
                        </h3>
                        <p className="text-sm text-slate-400 max-w-xs">
                            Choose a property from the dropdown above to manage its weekly food plan for residents.
                        </p>
                    </div>
                </div>

            ) : loading ? (
                <div className="py-16 text-center text-sm text-muted-foreground animate-pulse">
                    Loading menu...
                </div>

            ) : (
                <div className="space-y-6">

                    {/* ── Day selector tabs ── */}
                    <div className="flex gap-2 flex-wrap">
                        {DAYS.map((day, i) => {
                            const dayMenu = menu.find(m => m.day === day);
                            const hasContent = dayMenu && dayMenu.slots.some((s: any) => s.items.trim() !== "");
                            return (
                                <button
                                    key={day}
                                    onClick={() => setActiveDay(day)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                                        activeDay === day
                                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                            : "bg-white border-slate-200 text-slate-500 hover:border-indigo-200 hover:text-indigo-600"
                                    }`}
                                >
                                    {DAY_SHORT[i]}
                                    {hasContent && (
                                        <span className={`w-1.5 h-1.5 rounded-full ${activeDay === day ? "bg-indigo-200" : "bg-green-400"}`} />
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

                    {/* ── Single day view ── */}
                    {activeDay !== "ALL" && activeDayMenu && (
                        <Card className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-slate-50/30">
                            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 border-b border-slate-100 bg-white">
                                <CardTitle className="text-base font-black flex items-center gap-2 text-slate-800">
                                    <Utensils className="h-4 w-4 text-indigo-500" />
                                    {activeDay}
                                    <span className="text-xs font-normal text-muted-foreground ml-1">
                                        — {selectedProperty?.name}
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-5 space-y-4">
                                {activeDayMenu.slots.map((slot: any, index: number) => renderSlot(slot, activeDay, index))}
                                
                                <Button 
                                    onClick={() => handleAddSlot(activeDay)} 
                                    variant="outline" 
                                    className="w-full border-dashed border-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 h-12 rounded-xl"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add meal slot
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* ── All days view ── */}
                    {activeDay === "ALL" && (
                        <div className="space-y-6">
                            {menu.map((dayItem) => (
                                <Card key={dayItem.day} className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-slate-50/30">
                                    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 border-b border-slate-100 bg-white">
                                        <CardTitle className="text-sm font-black flex items-center gap-2 text-slate-800">
                                            <Utensils className="h-3.5 w-3.5 text-indigo-500" />
                                            {dayItem.day}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-5 space-y-4">
                                        {dayItem.slots.map((slot: any, index: number) => renderSlot(slot, dayItem.day, index))}
                                        
                                        <Button 
                                            onClick={() => handleAddSlot(dayItem.day)} 
                                            variant="outline" 
                                            className="w-full border-dashed border-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 h-12 rounded-xl"
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add meal slot for {dayItem.day}
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* ── Save All Button (Fixed at bottom) ── */}
                    <div className="pt-4 pb-12 sticky bottom-0 z-10 bg-gradient-to-t from-white via-white to-transparent">
                        <Button 
                            onClick={handleSaveAll}
                            disabled={!isDirty || saving === 'ALL'}
                            className={`w-full rounded-2xl h-14 text-base font-black transition-all shadow-md ${
                                isDirty 
                                    ? 'bg-green-600 hover:bg-green-700 text-white hover:shadow-lg hover:-translate-y-0.5' 
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                            }`}
                        >
                            <Save className="h-5 w-5 mr-2" />
                            {saving === 'ALL' ? "Saving all days..." : isDirty ? "Save all changes" : "No changes to save"}
                        </Button>
                    </div>

                </div>
            )}
        </div>
    );
}
