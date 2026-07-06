// src/components/admin/RevenueChart.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type RevenueData = { month: string; revenue: number }[];

export function RevenueChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData]       = useState<RevenueData>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Replace with your real API
    fetch("/api/admin/revenue-chart")
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
        type: "bar",
        data: {
          labels:   data.map(d => d.month),
          datasets: [{
            label:           "Revenue (₹)",
            data:            data.map(d => d.revenue),
            backgroundColor: "#7C3AED",
            borderRadius:    6,
            borderSkipped:   false,
          }],
        },
        options: {
          responsive:          true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `₹${ctx.parsed.y !== null && ctx.parsed.y !== undefined ? ctx.parsed.y.toLocaleString("en-IN") : 0}`,
              },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: "#94a3b8", font: { size: 11 } } },
            y: {
              grid:  { color: "#f1f5f9" },
              ticks: {
                color: "#94a3b8",
                font:  { size: 11 },
                callback: (v) => `₹${Number(v).toLocaleString("en-IN")}`,
              },
            },
          },
        },
      });
    });

    return () => chart?.destroy();
  }, [data]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Revenue performance</h2>
          <p className="text-xs text-slate-400 mt-0.5">Platform earnings across billing volume</p>
        </div>
        <select className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-500">
          <option>Last 6 months</option>
          <option>Last 12 months</option>
          <option>This FY</option>
        </select>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
      ) : data.length === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-slate-400">
          <span className="text-2xl mb-2">📊</span>
          <p className="text-sm font-medium">No revenue data yet</p>
          <p className="text-xs mt-1">Earnings will appear once bookings start processing</p>
        </div>
      ) : (
        <div style={{ position: "relative", height: "200px" }}>
          <canvas ref={canvasRef}
            role="img"
            aria-label="Bar chart showing monthly platform revenue" />
        </div>
      )}
    </div>
  );
}
