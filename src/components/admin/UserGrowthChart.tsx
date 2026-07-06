// src/components/admin/UserGrowthChart.tsx
"use client";

import { useEffect, useRef, useState } from "react";

export function UserGrowthChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData]       = useState<{ month: string; students: number; owners: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/user-growth")
      .then(r => r.json())
      .then(d => { setData(d.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;
    let chart: any;
    import("chart.js").then(({ Chart, registerables }) => {
      Chart.register(...registerables);
      chart = new Chart(canvasRef.current!, {
        type: "line",
        data: {
          labels:   data.map(d => d.month),
          datasets: [
            {
              label:       "Students",
              data:        data.map(d => d.students),
              borderColor: "#7C3AED",
              borderWidth: 2,
              pointRadius: 3,
              tension:     0.4,
              fill:        false,
            },
            {
              label:       "Owners",
              data:        data.map(d => d.owners),
              borderColor: "#10b981",
              borderWidth: 2,
              pointRadius: 3,
              tension:     0.4,
              fill:        false,
              borderDash:  [4, 4],
            },
          ],
        },
        options: {
          responsive:          true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: "#94a3b8", font: { size: 11 } } },
            y: { grid: { color: "#f1f5f9" }, ticks: { color: "#94a3b8", font: { size: 11 } } },
          },
        },
      });
    });
    return () => chart?.destroy();
  }, [data]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">User growth</h2>
          <p className="text-xs text-slate-400 mt-0.5">Students and owners joining over time</p>
        </div>
        <div className="flex gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-violet-500 inline-block" />Students
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />Owners
          </span>
        </div>
      </div>
      {loading ? (
        <div className="h-44 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
      ) : data.length === 0 ? (
        <div className="h-44 flex flex-col items-center justify-center text-slate-400">
          <p className="text-sm">No growth data yet</p>
        </div>
      ) : (
        <div style={{ position: "relative", height: "176px" }}>
          <canvas ref={canvasRef} role="img" aria-label="Line chart of user growth over time" />
        </div>
      )}
    </div>
  );
}
