"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { Plus, Trash2, Utensils, Save } from "lucide-react";
import { getFoodMenu, updateFoodMenu } from "@/actions/ops";
import { getProperties } from "@/actions/properties";

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
            if (props.length > 0) {
                setSelectedPropertyId(props[0].id);
            } else {
                setLoading(false);
            }
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
            alert(`Menu for ${day} saved!`);
        } catch (error) {
            alert("Failed to save menu.");
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
                        className="bg-background border rounded px-3 py-2 text-sm"
                        value={selectedPropertyId}
                        onChange={(e) => setSelectedPropertyId(e.target.value)}
                    >
                        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid gap-6">
                {menu.map((dayItem) => (
                    <Card key={dayItem.day}>
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
                                        placeholder="e.g. Poha, Tea"
                                        value={dayItem.breakfast || ""}
                                        onChange={(e) => handleUpdate(dayItem.day, 'breakfast', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Lunch</label>
                                    <Input
                                        placeholder="e.g. Thali, Rice"
                                        value={dayItem.lunch || ""}
                                        onChange={(e) => handleUpdate(dayItem.day, 'lunch', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Dinner</label>
                                    <Input
                                        placeholder="e.g. Roti, Sabzi"
                                        value={dayItem.dinner || ""}
                                        onChange={(e) => handleUpdate(dayItem.day, 'dinner', e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
