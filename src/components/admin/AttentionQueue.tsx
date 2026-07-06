// src/components/admin/AttentionQueue.tsx
"use client";

import { AlertTriangle, MessageSquare, Home, Ticket, ChevronRight } from "lucide-react";
import Link from "next/link";

const ITEMS = [
  {
    label:  "Open disputes",
    count:  0,
    icon:   AlertTriangle,
    color:  "text-red-500",
    bg:     "bg-red-50",
    href:   "/dashboard/admin/disputes",
  },
  {
    label:  "Fraud alerts",
    count:  0,
    icon:   AlertTriangle,
    color:  "text-orange-500",
    bg:     "bg-orange-50",
    href:   "/dashboard/admin/fraud",
  },
  {
    label:  "Properties pending",
    count:  0,
    icon:   Home,
    color:  "text-blue-500",
    bg:     "bg-blue-50",
    href:   "/dashboard/admin/properties?status=pending",
  },
  {
    label:  "Support tickets",
    count:  0,
    icon:   Ticket,
    color:  "text-violet-500",
    bg:     "bg-violet-50",
    href:   "/dashboard/admin/tickets",
  },
];

export function AttentionQueue() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Requires your attention</h2>
          <p className="text-xs text-slate-400 mt-0.5">Action items across the platform</p>
        </div>
        <span className="text-xs bg-red-50 text-red-500 font-medium px-2 py-1 rounded-lg">
          {ITEMS.reduce((a, i) => a + i.count, 0)} open
        </span>
      </div>
      <div className="divide-y divide-slate-50">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition group"
            >
              <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${item.bg}`}>
                <Icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <span className="flex-1 text-sm text-slate-700 font-medium">{item.label}</span>
              <span className={`text-sm font-semibold ${item.count > 0 ? item.color : "text-slate-300"}`}>
                {item.count}
              </span>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
