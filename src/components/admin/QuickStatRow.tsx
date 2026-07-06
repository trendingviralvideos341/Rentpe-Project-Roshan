// src/components/admin/QuickStatRow.tsx
"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

type QuickStats = {
  fraudAlerts:     number;
  previousAlerts:  number;
  pendingProperties: number;
  unlistedCount:   number;
  totalRegistrations: number;
  totalRegistrationsLabel: string;
};

export function QuickStatRow() {
  const [stats, setStats] = useState<QuickStats | null>(null);

  useEffect(() => {
    fetch("/api/admin/quick-stats")
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const tiles = [
    {
      label:   "Fraud & security",
      value:   stats?.fraudAlerts ?? 0,
      sub:     `${stats?.previousAlerts ?? 0} previous alerts`,
      href:    "/dashboard/admin/fraud",
      accent:  "text-red-500",
      cta:     "Audit results",
    },
    {
      label:   "Property verification",
      value:   stats?.pendingProperties ?? 0,
      sub:     `${stats?.unlistedCount ?? 0} unlisted`,
      href:    "/dashboard/admin/properties?status=pending",
      accent:  "text-blue-500",
      cta:     "View registry",
    },
    {
      label:   "User base",
      value:   stats?.totalRegistrations ?? 0,
      sub:     stats?.totalRegistrationsLabel ?? "Total registrations",
      href:    "/dashboard/admin/users",
      accent:  "text-violet-500",
      cta:     "Manage users",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {tiles.map((t) => (
        <div key={t.label}
             className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col gap-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t.label}</span>
          <span className={`text-3xl font-semibold ${t.accent}`}>
            {t.value.toLocaleString("en-IN")}
          </span>
          <span className="text-xs text-slate-400">{t.sub}</span>
          <Link href={t.href}
                className="mt-auto flex items-center gap-1 text-xs text-violet-600 hover:underline font-medium pt-2">
            {t.cta} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ))}
    </div>
  );
}
