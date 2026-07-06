// src/components/admin/BookingFunnelChart.tsx
"use client";

const STAGES = [
  { label: "Requested",  key: "requested",  color: "bg-violet-200" },
  { label: "Accepted",   key: "accepted",   color: "bg-violet-400" },
  { label: "Confirmed",  key: "confirmed",  color: "bg-violet-600" },
];

type FunnelData = { requested: number; accepted: number; confirmed: number };

import { useEffect, useState } from "react";

export function BookingFunnelChart() {
  const [data, setData]       = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/booking-funnel")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const max = data ? Math.max(data.requested, 1) : 1;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-800">Booking funnel</h2>
        <p className="text-xs text-slate-400 mt-0.5">Requested → accepted → confirmed</p>
      </div>

      {loading ? (
        <div className="h-44 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
      ) : !data ? (
        <div className="h-44 flex items-center justify-center text-slate-400 text-sm">
          No funnel data yet
        </div>
      ) : (
        <div className="space-y-4 mt-2">
          {STAGES.map(({ label, key, color }) => {
            const val = data[key as keyof FunnelData];
            const pct = Math.round((val / max) * 100);
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-600 font-medium">{label}</span>
                  <span className="text-slate-800 font-semibold">{val.toLocaleString("en-IN")}</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color} transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
