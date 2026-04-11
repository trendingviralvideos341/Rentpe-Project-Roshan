'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle, CalendarDays, FileText } from 'lucide-react';

interface Props {
    minimumNoticeDays: number;
    onSubmit: (date: string, reason: string) => void;
    loading?: boolean;
}

export function VacatingNoticeCard({ minimumNoticeDays, onSubmit, loading }: Props) {
    const [plannedDate, setPlannedDate] = useState('');
    const [reason, setReason] = useState('');

    const today = new Date();
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() + minimumNoticeDays);

    const selectedDate = plannedDate ? new Date(plannedDate) : null;
    const isTooEarly = selectedDate && selectedDate < minDate;
    const daysFromToday = selectedDate
        ? Math.ceil((selectedDate.getTime() - today.getTime()) / 86400000)
        : null;

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-slate-900">File Vacating Notice</h3>
            </div>

            <p className="text-xs text-slate-500">
                Minimum notice required: <strong className="text-slate-700">{minimumNoticeDays} days</strong>
            </p>

            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" /> Planned Move-Out Date
                </label>
                <input
                    type="date"
                    value={plannedDate}
                    min={minDate.toISOString().split('T')[0]}
                    onChange={e => setPlannedDate(e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                />
            </div>

            {isTooEarly && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                        You must give at least <strong>{minimumNoticeDays} days</strong> notice.
                        To vacate earlier, <strong>contact your PG / Hostel Management Incharge</strong> directly.
                    </span>
                </div>
            )}

            {!isTooEarly && daysFromToday !== null && (
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-xs flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span><strong>{daysFromToday} days</strong> from today — within the required notice period.</span>
                </div>
            )}

            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Reason for vacating</label>
                <textarea
                    placeholder="e.g. Course completed, relocating to another city..."
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 resize-none"
                    rows={3}
                />
            </div>

            <button
                disabled={!plannedDate || !reason.trim() || !!isTooEarly || loading}
                onClick={() => onSubmit(plannedDate, reason)}
                className="w-full py-2.5 text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-40 transition-all"
            >
                {loading ? 'Submitting...' : 'Submit Vacating Notice'}
            </button>
        </div>
    );
}
