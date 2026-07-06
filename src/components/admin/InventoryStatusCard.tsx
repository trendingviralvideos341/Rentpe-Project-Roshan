// src/components/admin/InventoryStatusCard.tsx
"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Clock, XCircle } from "lucide-react";

type Inventory = { occupied: number; available: number; maintenance: number; total: number };

export function InventoryStatusCard() {
  const [data, setData]       = useState<Inventory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/inventory-status")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const occupancyRate = data && data.total > 0
    ? Math.round((data.occupied / data.total) * 100)
    : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Inventory status</h2>
          <p className="text-xs text-slate-400 mt-0.5">Beds across all properties</p>
        </div>
        <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2 py-1 rounded-lg">
          {occupancyRate}% occupied
        </span>
      </div>

      {loading ? (
        <div className="h-32 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
      ) : !data ? (
        <div className="h-32 flex items-center justify-center text-slate-400 text-sm">
          No inventory data
        </div>
      ) : (
        <div className="space-y-3">
          {[
            { label: "Occupied",    val: data.occupied,    icon: CheckCircle, clr: "text-emerald-500" },
            { label: "Available",   val: data.available,   icon: Clock,       clr: "text-blue-500"    },
            { label: "Maintenance", val: data.maintenance, icon: XCircle,     clr: "text-amber-500"   },
          ].map(({ label, val, icon: Icon, clr }) => (
            <div key={label} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
              <Icon className={`h-4 w-4 ${clr}`} />
              <span className="text-sm text-slate-600 flex-1">{label}</span>
              <span className="text-sm font-semibold text-slate-800">{val.toLocaleString("en-IN")}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-400">Total beds</span>
            <span className="text-xs font-bold text-slate-700">{data.total.toLocaleString("en-IN")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
