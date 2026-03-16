"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { Plus, Trash2, Utensils, Save } from "lucide-react";
import { getFoodMenu, updateFoodMenu } from "@/actions/ops";
import { getProperties } from "@/actions/properties";
import { toast } from "sonner";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function FoodMenuPage() {
    const [properties, setProperties] = useState<any[]>([]);
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
    const [menu, setMenu] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchInitial = async () => {
            const props = await getProperties();
            setProperties(props);
            setLoading(false);
        };
        fetchInitial();
    }, []);

    useEffect(() => {
        if (selectedPropertyId) {
            fetchMenu();
        }
    }, [selectedPropertyId]);

    const fetchMenu = async () => {
        setLoading(true);
        try {
            const data = await getFoodMenu(selectedPropertyId);
            // Ensure all days are present and aggregate meals
            const aggregatedMenu = DAYS.map(dayName => {
                const dayMeals = data.filter(m => m.dayOfWeek === dayName);
                return {
                    day: dayName,
                    breakfast: dayMeals.find(m => m.mealType === 'Breakfast')?.items || "",
                    lunch: dayMeals.find(m => m.mealType === 'Lunch')?.items || "",
                    dinner: dayMeals.find(m => m.mealType === 'Dinner')?.items || ""
                };
            });
            setMenu(aggregatedMenu);
        } catch (error) {
            console.error(error);
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

        setSaving(true);
        try {
            await updateFoodMenu(selectedPropertyId, day, {
                breakfast: item.breakfast,
                lunch: item.lunch,
                dinner: item.dinner
            });
            toast.success(`Menu for ${day} saved!`);
        } catch (error) {
            toast.error("Failed to save menu.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading menu...</div>;

    if (properties.length === 0) {
        return (
            <div className="p-12 text-center">
                <h2 className="text-xl font-bold">No Properties Found</h2>
                <p className="text-muted-foreground mt-2">Add a property first to manage its food menu.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Food Menu</h1>
                    <p className="text-muted-foreground">Weekly meal plan for residents.</p>
                </div>
                <div className="flex items-center gap-4">
                    <select
                        className="bg-background border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none min-w-[300px]"
                        value={selectedPropertyId}
                        onChange={(e) => setSelectedPropertyId(e.target.value)}
                    >
                        <option value="">Select a property / building...</option>
                        {properties.map(p => (
                            <option key={p.id} value={p.id}>
                                [{p.displayId}] - {p.name} ({p.address?.slice(0, 30)}...)
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {!selectedPropertyId ? (
                <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-slate-200 rounded-[32px] bg-slate-50/50 space-y-4">
                    <div className="p-4 bg-white rounded-full shadow-sm">
                        <Utensils className="h-12 w-12 text-slate-300" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-xl font-bold text-slate-700">No Building Selected</h3>
                        <p className="text-slate-500 max-w-xs mx-auto mt-1">Please select a building from the dropdown above to manage its weekly food menu.</p>
                    </div>
                </div>
            ) : (
                <div className="grid gap-6">
                    {menu.map((dayItem) => (
                        <Card key={dayItem.day} className="rounded-[24px] border-2 border-slate-100 shadow-sm overflow-hidden group hover:border-primary/20 transition-all">
                        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Utensils className="h-4 w-4 text-primary" />
                                {dayItem.day}
                            </CardTitle>
                            <Button size="sm" onClick={() => handleSave(dayItem.day)} disabled={saving}>
                                <Save className="h-4 w-4 mr-2" /> Save Day
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Breakfast</label>
                                    <Input
                                        placeholder="Breakfast details..."
                                        value={dayItem.breakfast || ""}
                                        onChange={(e) => handleUpdate(dayItem.day, 'breakfast', e.target.value)}
                                        className={dayItem.breakfast ? "text-primary font-bold border-primary/20 bg-primary/5" : "text-slate-700"}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Lunch</label>
                                    <Input
                                        placeholder="Lunch details..."
                                        value={dayItem.lunch || ""}
                                        onChange={(e) => handleUpdate(dayItem.day, 'lunch', e.target.value)}
                                        className={dayItem.lunch ? "text-primary font-bold border-primary/20 bg-primary/5" : "text-slate-700"}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Dinner</label>
                                    <Input
                                        placeholder="Dinner details..."
                                        value={dayItem.dinner || ""}
                                        onChange={(e) => handleUpdate(dayItem.day, 'dinner', e.target.value)}
                                        className={dayItem.dinner ? "text-primary font-bold border-primary/20 bg-primary/5" : "text-slate-700"}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
