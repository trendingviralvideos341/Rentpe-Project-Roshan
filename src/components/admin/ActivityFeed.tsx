// src/components/admin/ActivityFeed.tsx
"use client";

import { useEffect, useState } from "react";

type FeedEvent = {
  id:        string;
  actor:     string;
  actorRole: string;
  action:    string;
  target:    string;
  time:      string;
  type:      "approved" | "payment" | "kyc" | "login" | "logout" | "flagged";
};

const TYPE_STYLES: Record<FeedEvent["type"], { bg: string; text: string; label: string }> = {
  approved: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Approved"  },
  payment:  { bg: "bg-blue-50",    text: "text-blue-700",    label: "Payment"   },
  kyc:      { bg: "bg-violet-50",  text: "text-violet-700",  label: "KYC"       },
  login:    { bg: "bg-slate-100",  text: "text-slate-600",   label: "Login"     },
  logout:   { bg: "bg-slate-100",  text: "text-slate-600",   label: "Logout"    },
  flagged:  { bg: "bg-red-50",     text: "text-red-700",     label: "Flagged"   },
};

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export function ActivityFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);

  useEffect(() => {
    // Replace this fetch with your real API endpoint
    fetch("/api/admin/activity-feed?limit=8")
      .then(r => r.json())
      .then(d => setEvents(d.events ?? []))
      .catch(() => setEvents([]));
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Platform activity feed</h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time actions across the platform</p>
        </div>
        <a href="/dashboard/admin/audit-log"
           className="text-xs text-violet-600 hover:underline font-medium">
          View all
        </a>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <span className="text-3xl mb-2">📋</span>
          <p className="text-sm">No activity yet</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
          {events.map((e) => {
            const style = TYPE_STYLES[e.type];
            return (
              <div key={e.id} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 transition">
                <div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center
                                text-violet-700 text-xs font-semibold flex-shrink-0 mt-0.5">
                  {initials(e.actor)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 leading-snug">
                    <span className="font-medium">{e.actor}</span>
                    {" "}{e.action}{" "}
                    <span className="font-medium text-slate-900">{e.target}</span>
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                    <span className="text-[10px] text-slate-400">{e.time}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
