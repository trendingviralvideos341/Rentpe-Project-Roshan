// src/components/admin/OnboardedProperties.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { Building2, Filter, ChevronDown, BadgeCheck, MapPin } from "lucide-react";
import { getOnboardedProperties } from "@/actions/superAdmin";

const PROPERTY_TYPE_OPTIONS = [
    { value: 'ALL', label: 'All Types' },
    { value: 'PG', label: 'PG' },
    { value: 'HOSTEL', label: 'Hostel' },
    { value: 'FLAT', label: 'Flat' },
    { value: 'APARTMENT', label: 'Apartment' },
];

export function OnboardedProperties() {
    const [onboardedProperties, setOnboardedProperties] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getOnboardedProperties().then(data => {
            setOnboardedProperties(data || []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const [typeFilter, setTypeFilter] = useState<string>('ALL');
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>('ALL');

    const filteredProperties = useMemo(() => {
        if (typeFilter === 'ALL') return onboardedProperties;
        return onboardedProperties.filter(p => (p.propertyType || 'PG').toUpperCase() === typeFilter);
    }, [onboardedProperties, typeFilter]);

    const selectedProperty = useMemo(() => {
        if (selectedPropertyId === 'ALL') return null;
        return onboardedProperties.find(p => p.id === selectedPropertyId) || null;
    }, [onboardedProperties, selectedPropertyId]);

    const handleTypeFilter = (t: string) => {
        setTypeFilter(t);
        setSelectedPropertyId('ALL');
    };

    if (loading) return <div className="p-10 text-center text-slate-500">Loading properties...</div>;

    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="h-9 w-9 rounded-xl bg-violet-100 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-violet-600" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">Onboarded Properties</h2>
                    </div>
                    <p className="text-slate-500 text-xs font-medium ml-12 uppercase tracking-wide">
                        All fully registered &amp; live PG, Hostel, Flat listings on RentPe
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="px-4 py-2 bg-slate-50 rounded-xl text-slate-700 text-sm font-semibold border border-slate-200">
                        {onboardedProperties.length} Properties Live
                    </span>
                </div>
            </div>

            <div className="space-y-6">
                {/* Controls Row: Type Filter + Property Dropdown */}
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Type Filter Chips */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">
                            <Filter className="h-3.5 w-3.5" /> Filter
                        </div>
                        {PROPERTY_TYPE_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => handleTypeFilter(opt.value)}
                                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                                    typeFilter === opt.value
                                        ? 'bg-violet-600 text-white border-violet-600'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-600'
                                }`}
                            >
                                {opt.label}
                                {opt.value !== 'ALL' && (
                                    <span className="ml-1.5 opacity-70">
                                        ({onboardedProperties.filter(p => (p.propertyType || 'PG').toUpperCase() === opt.value).length})
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Property Dropdown Selector */}
                    <div className="md:ml-auto relative">
                        <div className="relative">
                            <select
                                id="property-select"
                                value={selectedPropertyId}
                                onChange={e => setSelectedPropertyId(e.target.value)}
                                className="appearance-none w-full md:w-72 pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all cursor-pointer"
                            >
                                <option value="ALL">— View All Properties —</option>
                                {filteredProperties.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} ({p.city}) · {p.propertyType || 'PG'}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* ── DETAIL VIEW: Single Property ── */}
                {selectedProperty && (
                    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 mt-4">
                         <div className="flex flex-col md:flex-row gap-6">
                              <div className="flex-1 space-y-3">
                                  <div className="flex items-start gap-3 flex-wrap">
                                      <div className="h-12 w-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                                          <Building2 className="h-6 w-6 text-violet-600" />
                                      </div>
                                      <div className="flex-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                              <h3 className="text-xl font-bold text-slate-900">{selectedProperty.name}</h3>
                                              {selectedProperty.isVerified && (
                                                  <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200">
                                                      <BadgeCheck className="h-3 w-3" /> Verified
                                                  </span>
                                              )}
                                          </div>
                                          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500 mt-1">
                                              <MapPin className="h-3.5 w-3.5" /> {selectedProperty.address}, {selectedProperty.city}
                                          </div>
                                      </div>
                                  </div>
                              </div>
                              <div className="shrink-0 flex items-center justify-center md:justify-end gap-6">
                                   <div className="text-center">
                                       <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Base Rent</div>
                                       <div className="text-2xl font-bold text-slate-800">
                                           ₹{selectedProperty.baseRent?.toLocaleString() || 'N/A'}
                                       </div>
                                   </div>
                              </div>
                         </div>
                    </div>
                )}
            </div>
        </div>
    );
}
