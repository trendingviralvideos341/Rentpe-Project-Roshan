import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Utensils, ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
    thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
};
const MEALS = [
    { key: 'breakfast', label: 'Breakfast', icon: '🌅', time: '7:30 – 9:30 AM' },
    { key: 'lunch', label: 'Lunch', icon: '☀️', time: '12:30 – 2:30 PM' },
    { key: 'dinner', label: 'Dinner', icon: '🌙', time: '7:30 – 9:30 PM' },
];

export const metadata = { title: 'Food Menu | RentPe Dashboard' };

export default async function StudentFoodMenuPage() {
    const session = await getSession();
    if (!session) return null;
    const userId = (session as any).userId;

    // Get active booking — include all meaningful statuses
    const booking = await prisma.booking.findFirst({
        where: {
            userId,
            status: { in: ['ACTIVE', 'MOVE_IN_SCHEDULED', 'CHECKED_IN', 'PAID', 'CASH_PAID', 'APPROVED', 'APPROVED_PAYMENT_PENDING', 'AGREEMENT_PENDING', 'KYC_PENDING', 'APPROVED_KYC_PENDING', 'ROOM_RESERVED'] },
            deletedAt: null,
        },
        include: { property: { include: { foodMenu: { take: 1 } } } }
    });

    if (!booking || !booking.property) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50">
                <div className="text-center max-w-md">
                    <Utensils className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h2 className="text-xl font-black text-slate-700">No Active Booking</h2>
                    <p className="text-slate-400 text-sm mt-2">Food menu is available for active tenants only.</p>
                    <Link href="/dashboard/student" className="inline-block mt-6 px-6 py-3 bg-indigo-600 text-white font-black text-sm rounded-2xl hover:bg-indigo-700 transition-all">
                        ← Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const property = booking.property;
    const foodMenu = (property as any).foodMenu?.[0];

    // Check if food is available at this PG
    if (!property.foodType || property.foodType === 'NONE' || property.foodType === 'NOT_AVAILABLE') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
                <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-4 pt-10 pb-20 relative overflow-hidden">
                    <div className="max-w-3xl mx-auto relative z-10">
                        <Link href="/dashboard/student" className="text-indigo-200 text-xs font-bold flex items-center gap-1 mb-4 hover:text-white">
                            <ArrowLeft className="w-3 h-3" /> Dashboard
                        </Link>
                        <h1 className="text-2xl font-black text-white">Food Menu</h1>
                    </div>
                </div>
                <div className="max-w-3xl mx-auto px-4 -mt-12 relative z-10">
                    <div className="bg-white rounded-3xl shadow-xl p-12 text-center border border-slate-100">
                        <span className="text-5xl mb-4 block">🍽️</span>
                        <h2 className="text-xl font-black text-slate-700">Not available at your current PG</h2>
                        <p className="text-slate-400 text-sm mt-2">
                            <span className="font-semibold text-slate-600">{property.name}</span> does not offer a food service.
                        </p>
                        <p className="text-slate-400 text-xs mt-4">
                            If you believe this is incorrect, please raise a <Link href="/dashboard/student/tickets" className="text-indigo-600 font-bold hover:underline">support ticket</Link>.
                        </p>
                        <Link href="/dashboard/student" className="inline-block mt-6 px-6 py-3 bg-indigo-600 text-white font-black text-sm rounded-2xl hover:bg-indigo-700 transition-all">
                            ← Back to Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Parse weekly menu
    let weeklyMenu: Record<string, Record<string, string>> = {};
    if (foodMenu?.weeklyMenu) {
        try { weeklyMenu = JSON.parse(foodMenu.weeklyMenu); } catch {}
    }

    const today = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-4 pt-10 pb-20 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="max-w-3xl mx-auto relative z-10">
                    <Link href="/dashboard/student" className="text-indigo-200 text-xs font-bold flex items-center gap-1 mb-4 hover:text-white">
                        <ArrowLeft className="w-3 h-3" /> Dashboard
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Food Menu</h1>
                    <p className="text-indigo-200 text-sm font-medium mt-1">{property.name} · Weekly Menu</p>
                    <div className="flex items-center gap-2 mt-3">
                        <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-[11px] font-black text-white uppercase tracking-widest">
                            {property.foodType?.replace(/_/g, ' ')}
                        </span>
                        {booking.foodSelected && (
                            <span className="px-3 py-1 bg-emerald-400/30 backdrop-blur-sm rounded-full text-[11px] font-black text-white">
                                ✓ You&apos;re opted in
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 -mt-12 relative z-10">
                {/* Day Scroll */}
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <div className="flex border-b border-slate-100 min-w-max">
                            {DAYS.map(day => (
                                <div key={day}
                                    className={`flex-1 px-6 py-4 text-center min-w-[80px] ${day === today ? 'bg-indigo-600' : 'hover:bg-slate-50'}`}>
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${day === today ? 'text-indigo-200' : 'text-slate-400'}`}>
                                        {DAY_LABELS[day]}
                                    </p>
                                    {day === today && <div className="w-1.5 h-1.5 bg-white rounded-full mx-auto mt-1" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    {DAYS.map(day => {
                        const dayMenu = weeklyMenu[day] || {};
                        const hasMenu = Object.values(dayMenu).some(Boolean);
                        return (
                            <div key={day} className={`${day === today ? 'block' : 'hidden md:block'}`}>
                                {day !== today && <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
                                    <span className="text-sm font-black text-slate-700 capitalize">{day}</span>
                                </div>}
                                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                    {MEALS.map(meal => (
                                        <div key={meal.key} className="p-6">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-lg">{meal.icon}</span>
                                                <div>
                                                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">{meal.label}</p>
                                                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" /> {meal.time}
                                                    </p>
                                                </div>
                                            </div>
                                            {dayMenu[meal.key] ? (
                                                <p className="text-sm font-semibold text-slate-800 leading-relaxed">{dayMenu[meal.key]}</p>
                                            ) : (
                                                <p className="text-sm text-slate-300 italic">Not specified</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <p className="text-center text-xs text-slate-400 font-medium mt-4">
                    {foodMenu?.menuVersion ? `Menu version: v${foodMenu.menuVersion}` : 'Menu is up to date'}
                </p>
                <div className="text-center mt-3">
                    <p className="text-xs text-slate-400">For special dietary requirements, contact your property owner directly.</p>
                </div>
            </div>
        </div>
    );
}
