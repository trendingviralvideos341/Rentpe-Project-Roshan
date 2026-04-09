"use client";

import { useState, useEffect, useCallback } from "react";
import { getServiceCities, addServiceCity, updateServiceCity, toggleCityStatus } from "@/actions/adminPhase2";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { MapPin, Plus, RefreshCcw, Edit3, ToggleLeft, ToggleRight, Building2, X } from "lucide-react";

interface CityForm {
    id?: string;
    name: string;
    slug: string;
    state: string;
    pinCodes: string;
    priority: number;
    metaTitle: string;
    metaDesc: string;
}

const emptyForm: CityForm = { name: "", slug: "", state: "", pinCodes: "", priority: 0, metaTitle: "", metaDesc: "" };

export default function CitiesPage() {
    const [cities, setCities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<CityForm>(emptyForm);
    const [saving, setSaving] = useState(false);

    const fetchCities = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getServiceCities();
            setCities(data);
        } catch { toast.error("Failed to load cities"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchCities(); }, [fetchCities]);

    const handleSubmit = async () => {
        if (!form.name.trim() || !form.state.trim()) { toast.error("Name and State are required"); return; }
        setSaving(true);
        try {
            const pinCodes = form.pinCodes.split(",").map(s => s.trim()).filter(Boolean);
            if (form.id) {
                await updateServiceCity(form.id, {
                    name: form.name, state: form.state, pinCodes,
                    priority: Number(form.priority),
                    metaTitle: form.metaTitle, metaDesc: form.metaDesc
                });
                toast.success(`"${form.name}" updated!`);
            } else {
                await addServiceCity({
                    name: form.name,
                    slug: form.slug || form.name.toLowerCase().replace(/\s+/g, '-'),
                    state: form.state,
                    pinCodes,
                    priority: Number(form.priority),
                    metaTitle: form.metaTitle,
                    metaDesc: form.metaDesc,
                });
                toast.success(`"${form.name}" added to service cities!`);
            }
            setForm(emptyForm);
            setShowForm(false);
            fetchCities();
        } catch (e: any) { toast.error(e.message || "Save failed"); }
        finally { setSaving(false); }
    };

    const handleToggle = async (id: string, isActive: boolean) => {
        try {
            await toggleCityStatus(id, !isActive);
            toast.success(`City ${!isActive ? 'activated' : 'deactivated'}`);
            fetchCities();
        } catch { toast.error("Toggle failed"); }
    };

    return (
        <div className="space-y-4 md:space-y-6 pb-20 md:pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
                        <MapPin className="h-7 w-7 text-teal-600" /> City / Area Management
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Manage cities where RentPe is active</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchCities} disabled={loading}>
                        <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                    </Button>
                    <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => { setForm(emptyForm); setShowForm(true); }}>
                        <Plus className="h-4 w-4 mr-2" /> Add City
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total Cities", value: cities.length, color: "text-teal-600" },
                    { label: "Active", value: cities.filter(c => c.isActive).length, color: "text-green-600" },
                    { label: "Inactive", value: cities.filter(c => !c.isActive).length, color: "text-slate-400" },
                    { label: "Total Properties", value: cities.reduce((s, c) => s + (c.propertyCount || 0), 0), color: "text-indigo-600" },
                ].map(card => (
                    <Card key={card.label}>
                        <CardContent className="p-4">
                            <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
                            <p className="text-xs text-muted-foreground font-semibold mt-1">{card.label}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* City Cards — responsive grid */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-2xl animate-pulse" />)}
                </div>
            ) : cities.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed rounded-xl">
                    <MapPin className="h-10 w-10 text-teal-400 mx-auto mb-3" />
                    <p className="font-bold text-slate-700">No service cities yet. Add your first city!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cities.map(city => (
                        <Card key={city.id} className={`transition-all hover:shadow-md ${!city.isActive ? "opacity-60" : ""}`}>
                            <CardContent className="p-5 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-black text-lg text-slate-900">{city.name}</h3>
                                        <p className="text-sm text-muted-foreground">{city.state}</p>
                                    </div>
                                    <Badge className={`border-0 text-xs ${city.isActive ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-500"}`}>
                                        {city.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                </div>

                                <div className="flex items-center gap-3 text-sm text-slate-600">
                                    <Building2 className="h-4 w-4 text-indigo-400" />
                                    <span><strong>{city.propertyCount || 0}</strong> properties</span>
                                    <span className="ml-auto text-xs font-bold text-teal-600">Priority: {city.priority}</span>
                                </div>

                                {city.pinCodes && city.pinCodes !== '[]' && (
                                    <p className="text-xs text-muted-foreground truncate">
                                        📮 {JSON.parse(city.pinCodes || '[]').slice(0, 3).join(', ')}{JSON.parse(city.pinCodes || '[]').length > 3 ? '...' : ''}
                                    </p>
                                )}

                                <div className="flex gap-2 pt-1 border-t">
                                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => {
                                        setForm({
                                            id: city.id, name: city.name, slug: city.slug, state: city.state,
                                            pinCodes: JSON.parse(city.pinCodes || '[]').join(', '),
                                            priority: city.priority, metaTitle: city.metaTitle || '', metaDesc: city.metaDesc || ''
                                        });
                                        setShowForm(true);
                                    }}>
                                        <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                                    </Button>
                                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => handleToggle(city.id, city.isActive)}>
                                        {city.isActive ? <><ToggleLeft className="h-3.5 w-3.5 mr-1" /> Deactivate</> : <><ToggleRight className="h-3.5 w-3.5 mr-1" /> Activate</>}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add/Edit City Modal — bottom sheet on mobile */}
            {showForm && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-6">
                    <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b">
                            <h3 className="font-black text-lg">{form.id ? "✏️ Edit City" : "➕ Add Service City"}</h3>
                            <button onClick={() => setShowForm(false)} className="p-1.5 rounded-full hover:bg-slate-100">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="text-xs font-bold text-slate-600 block mb-1">City Name *</label>
                                    <input className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                                        placeholder="e.g. Delhi" value={form.name}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: f.slug || e.target.value.toLowerCase().replace(/\s+/g, '-') }))} />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="text-xs font-bold text-slate-600 block mb-1">State *</label>
                                    <input className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                                        placeholder="e.g. Delhi NCR" value={form.state}
                                        onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="text-xs font-bold text-slate-600 block mb-1">URL Slug</label>
                                    <input className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 bg-slate-50"
                                        placeholder="auto-generated" value={form.slug}
                                        onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="text-xs font-bold text-slate-600 block mb-1">Priority (higher = first)</label>
                                    <input type="number" className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                                        min={0} max={100} value={form.priority}
                                        onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))} />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-slate-600 block mb-1">Pin Codes (comma separated)</label>
                                    <input className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                                        placeholder="110001, 110002, 110003" value={form.pinCodes}
                                        onChange={e => setForm(f => ({ ...f, pinCodes: e.target.value }))} />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-slate-600 block mb-1">SEO Title</label>
                                    <input className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                                        placeholder="PGs & Hostels in Delhi | RentPe" value={form.metaTitle}
                                        onChange={e => setForm(f => ({ ...f, metaTitle: e.target.value }))} />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-slate-600 block mb-1">SEO Description</label>
                                    <textarea className="w-full border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-300"
                                        rows={2} placeholder="Find verified PGs and hostels in Delhi..." value={form.metaDesc}
                                        onChange={e => setForm(f => ({ ...f, metaDesc: e.target.value }))} />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                                <Button className="flex-1 bg-teal-600 hover:bg-teal-700" disabled={saving} onClick={handleSubmit}>
                                    {saving ? "Saving..." : form.id ? "Update City" : "Add City"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
