'use client';
import { useState } from "react";
import { PaymentsContainer } from "@/components/dashboard/PaymentsContainer";
import { RentCollectionContainer } from "@/components/dashboard/RentCollectionContainer";

export default function OwnerPaymentsPage() {
    const [tab, setTab] = useState<'mark' | 'collection'>('mark');
    return (
        <div className="p-4 md:p-8">
            <div className="flex gap-2 mb-6">
                <button onClick={() => setTab('mark')}
                    className={`px-5 py-2 rounded-xl text-sm font-black transition-all ${tab === 'mark' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    💰 Mark Rent Paid
                </button>
                <button onClick={() => setTab('collection')}
                    className={`px-5 py-2 rounded-xl text-sm font-black transition-all ${tab === 'collection' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    📋 Collection & Reminders
                </button>
            </div>
            {tab === 'mark' ? <PaymentsContainer /> : <RentCollectionContainer />}
        </div>
    );
}
