// src/components/admin/AdminKPICards.tsx
"use client";

import { IndianRupee, Target, Package, FileWarning, TrendingUp, TrendingDown } from "lucide-react";

const CARDS = [
  {
    label:   "Platform revenue",
    value:   "₹0",
    delta:   null,
    sub:     "All time earnings",
    icon:    IndianRupee,
    iconBg:  "bg-violet-100",
    iconClr: "text-violet-600",
    border:  "border-l-violet-500",
  },
  {
    label:   "Active tenants",
    value:   "0",
    delta:   null,
    sub:     "Currently occupying",
    icon:    Target,
    iconBg:  "bg-emerald-100",
    iconClr: "text-emerald-600",
    border:  "border-l-emerald-500",
  },
  {
    label:   "Conversion rate",
    value:   "50%",
    delta:   "+2%",
    up:      true,
    sub:     "Bookings / enquiries",
    icon:    Package,
    iconBg:  "bg-slate-100",
    iconClr: "text-slate-600",
    border:  "border-l-slate-400",
  },
  {
    label:   "Pending disputes",
    value:   "0",
    delta:   null,
    sub:     "Requires resolution",
    icon:    FileWarning,
    iconBg:  "bg-amber-100",
    iconClr: "text-amber-600",
    border:  "border-l-amber-500",
  },
];

export function AdminKPICards() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {CARDS.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className={`bg-white rounded-2xl border border-slate-100 border-l-4 ${c.border}
                        p-5 flex flex-col gap-3 hover:shadow-sm transition`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {c.label}
              </span>
              <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${c.iconBg}`}>
                <Icon className={`h-4 w-4 ${c.iconClr}`} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-semibold text-slate-900">{c.value}</span>
              {c.delta && (
                <span className={`text-xs font-medium mb-1 flex items-center gap-0.5
                  ${c.up ? "text-emerald-600" : "text-red-500"}`}>
                  {c.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {c.delta}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">{c.sub}</p>
          </div>
        );
      })}
    </div>
  );
}
