"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { Utensils, Save, Building2, ChefHat } from "lucide-react";
import { getFoodMenu, updateFoodMenu } from "@/actions/ops";
import { getProperties } from "@/actions/properties";
import { toast } from "sonner";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function FoodMenuContainer() {
    const [properties, setProperties] = useState<any[]>([]);
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
    const [selectedProperty, setSelectedProperty] = useState<any>(null);
    const [menu, setMenu] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [activeDay, setActiveDay] = useState("Monday");

    useEffect(() => {
        const fetchInitial = async () => {
            try {
                const props = await getProperties();
                setProperties(props);
                // Never auto-select even if only 1 property — per your requirement
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
        }
    }, [selectedPropertyId]);

    const fetchMenu = async () => {
        setLoading(true);
        try {
            const data = await getFoodMenu(selectedPropertyId);
            const aggregatedMenu = DAYS.map(dayName => {
                const dayMeals = data.filter((m: any) => m.dayOfWeek === dayName);
                return {
                    day: dayName,
                    breakfast: dayMeals.find((m: any) => m.mealType === 'Breakfast')?.items || "",
                    lunch: dayMeals.find((m: any) => m.mealType === 'Lunch')?.items || "",
                    dinner: dayMeals.find((m: any) => m.mealType === 'Dinner')?.items || "",
                };
            });
            setMenu(aggregatedMenu);
        } catch {
            toast.error("Failed to fetch menu");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = (day: string, type: 'breakfast' | 'lunch' | 'dinner', val: string) => {
        setMenu(prev => prev.map(m => m.day === day ? { ...m, [type]: val } : m));
    };

    const handleSave = async (day: string) => {
        const item = menu.find(m => m.day === day);
        if (!item) return;
        setSaving(day);
        try {
            await updateFoodMenu(selectedPropertyId, day, {
                breakfast: item.breakfast,
                lunch: item.lunch,
                dinner: item.dinner,
            });
            toast.success(`${day} menu saved!`);
        } catch {
            toast.error("Failed to save menu.");
        } finally {
            setSaving(null);
        }
    };

    const handleSaveAll = async () => {
        setSaving('ALL');
        try {
            await Promise.all(
                menu.map(item =>
                    updateFoodMenu(selectedPropertyId, item.day, {
                        breakfast: item.breakfast,
                        lunch: item.lunch,
                        dinner: item.dinner,
                    })
                )
            );
            toast.success("All 7 days saved!");
        } catch {
            toast.error("Failed to save all menus.");
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
                    <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-2xl">
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
                        {selectedPropertyId && menu.length > 0 && (
                            <Button
                                size="sm"
                                onClick={handleSaveAll}
                                disabled={saving === 'ALL'}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs shrink-0"
                            >
                                <Save className="h-3.5 w-3.5 mr-1.5" />
                                {saving === 'ALL' ? "Saving..." : "Save all"}
                            </Button>
                        )}
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
                <div className="space-y-4">

                    {/* ── Day selector tabs ── */}
                    <div className="flex gap-2 flex-wrap">
                        {DAYS.map((day, i) => {
                            const dayMenu = menu.find(m => m.day === day);
                            const hasContent = dayMenu && (dayMenu.breakfast || dayMenu.lunch || dayMenu.dinner);
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
                        <Card className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 bg-slate-50 border-b border-slate-100">
                                <CardTitle className="text-base font-black flex items-center gap-2 text-slate-800">
                                    <Utensils className="h-4 w-4 text-indigo-500" />
                                    {activeDay}
                                    <span className="text-xs font-normal text-muted-foreground ml-1">
                                        — {selectedProperty?.name}
                                    </span>
                                </CardTitle>
                                <Button
                                    size="sm"
                                    onClick={() => handleSave(activeDay)}
                                    disabled={saving === activeDay}
                                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                                >
                                    <Save className="h-3.5 w-3.5 mr-1.5" />
                                    {saving === activeDay ? "Saving..." : `Save ${DAY_SHORT[DAYS.indexOf(activeDay)]}`}
                                </Button>
                            </CardHeader>
                            <CardContent className="pt-5">
                                <div className="grid md:grid-cols-3 gap-4">
                                    {(['breakfast', 'lunch', 'dinner'] as const).map((meal) => (
                                        <div key={meal} className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                                <span className="text-base">
                                                    {meal === 'breakfast' ? '🌅' : meal === 'lunch' ? '☀️' : '🌙'}
                                                </span>
                                                {meal}
                                            </label>
                                            <Input
                                                placeholder={
                                                    meal === 'breakfast' ? "e.g. Idli, Sambar, Chutney" :
                                                    meal === 'lunch' ? "e.g. Rice, Dal, Sabzi, Salad" :
                                                    "e.g. Roti, Paneer, Dal, Kheer"
                                                }
                                                value={activeDayMenu[meal] || ""}
                                                onChange={(e) => handleUpdate(activeDay, meal, e.target.value)}
                                                className={`rounded-xl transition-all ${
                                                    activeDayMenu[meal]
                                                        ? "border-indigo-200 bg-indigo-50/50 text-indigo-900 font-medium"
                                                        : ""
                                                }`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* ── All days view ── */}
                    {activeDay === "ALL" && (
                        <div className="space-y-3">
                            {menu.map((dayItem) => (
                                <Card key={dayItem.day} className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:border-indigo-200 transition-all">
                                    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 bg-slate-50 border-b border-slate-100">
                                        <CardTitle className="text-sm font-black flex items-center gap-2 text-slate-800">
                                            <Utensils className="h-3.5 w-3.5 text-indigo-500" />
                                            {dayItem.day}
                                        </CardTitle>
                                        <Button
                                            size="sm"
                                            onClick={() => handleSave(dayItem.day)}
                                            disabled={saving === dayItem.day}
                                            variant="outline"
                                            className="rounded-xl text-xs h-8"
                                        >
                                            <Save className="h-3 w-3 mr-1" />
                                            {saving === dayItem.day ? "Saving..." : "Save"}
                                        </Button>
                                    </CardHeader>
                                    <CardContent className="pt-4">
                                        <div className="grid md:grid-cols-3 gap-3">
                                            {(['breakfast', 'lunch', 'dinner'] as const).map((meal) => (
                                                <div key={meal} className="space-y-1.5">
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                                        {meal === 'breakfast' ? '🌅' : meal === 'lunch' ? '☀️' : '🌙'} {meal}
                                                    </label>
                                                    <Input
                                                        placeholder={
                                                            meal === 'breakfast' ? "Breakfast items..." :
                                                            meal === 'lunch' ? "Lunch items..." :
                                                            "Dinner items..."
                                                        }
                                                        value={dayItem[meal] || ""}
                                                        onChange={(e) => handleUpdate(dayItem.day, meal, e.target.value)}
                                                        className="rounded-xl text-sm"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
