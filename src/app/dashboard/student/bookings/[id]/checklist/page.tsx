'use client';

import { useEffect, useState, useTransition } from 'react';
import { getChecklist, updateChecklistItem } from '@/actions/checklist';
import { toast } from 'sonner';
import { CheckCircle2, Circle, Loader2, ArrowLeft, PartyPopper } from 'lucide-react';
import Link from 'next/link';

type ChecklistItem = {
    id: string;
    category: string;
    item: string;
    required: boolean;
    done: boolean;
};

interface Props {
    params: Promise<{ id: string }>;
}

const CATEGORY_ICONS: Record<string, string> = {
    'Documents': '📄',
    'Verify at PG': '🏠',
    'Essentials to Pack': '🎒',
    'Financial': '💰',
};

export default function ChecklistPage({ params }: Props) {
    const [bookingId, setBookingId] = useState('');
    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        params.then(({ id }) => {
            setBookingId(id);
            getChecklist(id).then(cl => {
                setItems(cl.items as ChecklistItem[]);
                setLoading(false);
            }).catch(() => setLoading(false));
        });
    }, [params]);

    const toggle = (itemId: string, done: boolean) => {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, done } : i));
        startTransition(async () => {
            try {
                await updateChecklistItem(bookingId, itemId, done);
                if (done) toast.success('Item checked!');
            } catch {
                setItems(prev => prev.map(i => i.id === itemId ? { ...i, done: !done } : i));
                toast.error('Failed to save. Please try again.');
            }
        });
    };

    const total = items.length;
    const done = items.filter(i => i.done).length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    const allDone = done === total && total > 0;

    const categories = [...new Set(items.map(i => i.category))];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                    <p className="text-slate-500 font-medium">Loading your checklist...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-4 pt-10 pb-20 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="max-w-3xl mx-auto relative z-10">
                    <Link href={`/dashboard/student/bookings/${bookingId}`}
                        className="text-indigo-200 text-xs font-bold flex items-center gap-1 mb-4 hover:text-white transition-colors">
                        <ArrowLeft className="w-3 h-3" /> Back to Booking
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Move-in Checklist</h1>
                    <p className="text-indigo-200 text-sm font-medium mt-1">Complete all items before your move-in day</p>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 -mt-12 relative z-10 space-y-6">
                {/* Progress Card */}
                <div className={`rounded-3xl p-6 shadow-xl border transition-all duration-500 ${allDone
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-400 text-white'
                    : 'bg-white border-slate-100'}`}>
                    {allDone ? (
                        <div className="flex items-center gap-4">
                            <PartyPopper className="w-10 h-10 shrink-0" />
                            <div>
                                <h2 className="text-xl font-black">All Done! 🎉</h2>
                                <p className="text-emerald-100 text-sm mt-1">You&apos;re 100% ready for move-in. Welcome home!</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <span className="text-2xl font-black text-slate-900">{done}/{total}</span>
                                    <span className="text-slate-400 text-sm font-medium ml-2">items completed</span>
                                </div>
                                <span className={`text-2xl font-black ${percent === 100 ? 'text-emerald-600' : percent >= 50 ? 'text-indigo-600' : 'text-slate-500'}`}>
                                    {percent}%
                                </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                <div
                                    className="h-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-700 ease-out"
                                    style={{ width: `${percent}%` }}
                                />
                            </div>
                            <p className="text-xs text-slate-400 font-medium mt-2">
                                {total - done} item{total - done !== 1 ? 's' : ''} remaining
                            </p>
                        </>
                    )}
                </div>

                {/* Checklist by Category */}
                {categories.map(category => {
                    const categoryItems = items.filter(i => i.category === category);
                    const categoryDone = categoryItems.filter(i => i.done).length;
                    return (
                        <div key={category} className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                <h2 className="font-black text-slate-900 flex items-center gap-2 text-sm">
                                    <span className="text-lg">{CATEGORY_ICONS[category] || '📋'}</span>
                                    {category}
                                </h2>
                                <span className="text-xs font-bold text-slate-400">{categoryDone}/{categoryItems.length}</span>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {categoryItems.map(item => (
                                    <label
                                        key={item.id}
                                        className={`flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-indigo-50/30 transition-colors group ${isPending ? 'opacity-70' : ''}`}
                                        onClick={() => !isPending && toggle(item.id, !item.done)}
                                    >
                                        <div className="mt-0.5 shrink-0">
                                            {item.done
                                                ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                : <Circle className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className={`text-sm font-semibold transition-colors ${item.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                                {item.item}
                                            </span>
                                            {item.required && !item.done && (
                                                <span className="ml-2 text-[10px] font-black text-red-500 uppercase tracking-wider">Required</span>
                                            )}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
