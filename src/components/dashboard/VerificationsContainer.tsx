"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    CheckCircle, XCircle, Building2, RefreshCcw, Info, Shield, ShieldCheck, Search
} from "lucide-react";
import { getPhysicalKycBookings, markPhysicalKycVerified } from "@/actions/bookings";
import { getProperties } from "@/actions/properties";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

function formatDateTime(date: string | Date | null | undefined) {
    if (!date) return '—';
    return new Date(date).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
    });
}

// ─── Physical KYC Log Card ────────────────────────────────────────────────────
function PhysicalKycCard({ booking, onMarkVerified }: { booking: any; onMarkVerified: (id: string) => void }) {
    const isVerified = !!booking.kycVerified;
    const tenantId = booking.tenant?.displayId || null;
    const verifierName = booking.kycVerifier?.name || '—';
    const verifierRole = booking.kycVerifier?.role || '';
    const verifiedAt = booking.kycVerifiedAt;

    return (
        <div className={`rounded-2xl border-2 p-4 transition-all duration-300 ${isVerified
            ? 'bg-green-50/50 border-green-200 shadow-sm shadow-green-100/50'
            : 'bg-red-50/50 border-red-200 shadow-sm shadow-red-100/50'
            }`}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                {/* Left: Student Info */}
                <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-lg shrink-0 ${isVerified ? 'bg-green-600' : 'bg-red-500'}`}>
                        {booking.guestName?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-900 text-sm">{booking.guestName}</span>
                            {tenantId && (
                                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                                    {tenantId}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[11px] text-slate-600 font-medium flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {booking.property?.name || booking.propertyName}
                            </span>
                            {booking.room?.roomNumber && (
                                <span className="text-[11px] text-slate-600 font-medium">
                                    · Room {booking.room.roomNumber}
                                </span>
                            )}
                            {booking.roomAssigned && !booking.room?.roomNumber && (
                                <span className="text-[11px] text-slate-600 font-medium">
                                    · Room {booking.roomAssigned}
                                </span>
                            )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                            Booking ID: {booking.displayId}
                        </div>
                    </div>
                </div>

                {/* Right: Badge + Action */}
                <div className="flex flex-col items-end gap-2">
                    {isVerified ? (
                        <span className="flex items-center gap-1.5 bg-green-600 text-white text-[11px] font-black px-3 py-1.5 rounded-full shadow-md shadow-green-200">
                            <CheckCircle className="w-3.5 h-3.5" /> ✅ VERIFIED
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 bg-red-500 text-white text-[11px] font-black px-3 py-1.5 rounded-full shadow-md shadow-red-200 animate-pulse">
                            <XCircle className="w-3.5 h-3.5" /> ❌ NOT VERIFIED
                        </span>
                    )}
                    {!isVerified && (
                        <Button
                            size="sm"
                            className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl px-3 shadow-sm"
                            onClick={() => onMarkVerified(booking.id)}
                        >
                            <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Mark as Verified
                        </Button>
                    )}
                </div>
            </div>

            {/* Verified By Footer */}
            <div className={`mt-3 pt-3 border-t flex items-center gap-2 flex-wrap ${isVerified ? 'border-green-200' : 'border-red-200'}`}>
                {isVerified ? (
                    <>
                        <Shield className={`w-3.5 h-3.5 ${isVerified ? 'text-green-600' : 'text-red-500'}`} />
                        <span className={`text-[11px] font-bold ${isVerified ? 'text-green-700' : 'text-red-600'}`}>
                            Verified by: <span className="font-black">{verifierName}</span>
                            {verifierRole ? ` (${verifierRole === 'OWNER' ? 'Owner' : verifierRole === 'STAFF' ? 'Staff' : 'Admin'})` : ''}
                            {' '}on {formatDateTime(verifiedAt)}
                        </span>
                    </>
                ) : (
                    <>
                        <Shield className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-[11px] font-bold text-red-600">
                            Awaiting physical document verification at check-in
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Main Container ───────────────────────────────────────────────────────────
export function VerificationsContainer() {
    const currentYearNum = new Date().getFullYear();
    const currentMonthNum = new Date().getMonth() + 1;
    const currentFYBase = currentMonthNum < 4 ? currentYearNum - 1 : currentYearNum;
    const defaultMonth = currentMonthNum.toString().padStart(2, '0');

    // Physical KYC Log state
    const [kycBookings, setKycBookings] = useState<any[]>([]);
    const [kycLoading, setKycLoading] = useState(true);
    const [kycSearch, setKycSearch] = useState("");
    const [selectedYear, setSelectedYear] = useState(currentFYBase.toString());
    const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
    const [selectedProperty, setSelectedProperty] = useState("ALL");
    const [ownerProperties, setOwnerProperties] = useState<any[]>([]);

    const properties = Array.from(new Set([
        ...ownerProperties.map(p => p.name),
        ...kycBookings.map(b => b.property?.name || b.propertyName)
    ].filter(Boolean))) as string[];

    const startFY = 2024;
    const yearOptions = Array.from({ length: Math.max(1, currentFYBase - startFY + 1) }, (_, i) => {
        const baseYear = currentFYBase - i;
        const nextYear = (baseYear + 1).toString().slice(-2);
        return { value: baseYear.toString(), label: `${baseYear}-${nextYear}` };
    });

    const fyMonths = [
        { value: '04', label: 'April' }, { value: '05', label: 'May' },
        { value: '06', label: 'June' }, { value: '07', label: 'July' },
        { value: '08', label: 'August' }, { value: '09', label: 'September' },
        { value: '10', label: 'October' }, { value: '11', label: 'November' },
        { value: '12', label: 'December' }, { value: '01', label: 'January' },
        { value: '02', label: 'February' }, { value: '03', label: 'March' }
    ];

    const baseMonthOptions = selectedYear === currentFYBase.toString()
        ? fyMonths.filter(m => {
            const mNum = parseInt(m.value);
            if (currentMonthNum >= 4) return mNum >= 4 && mNum <= currentMonthNum;
            return mNum >= 4 || mNum <= currentMonthNum;
        })
        : fyMonths;

    const monthOptions = [{ value: 'ALL', label: 'All Months' }, ...baseMonthOptions];

    const getFYFromDate = (date: Date) => {
        const y = date.getFullYear();
        const m = date.getMonth() + 1;
        return m < 4 ? y - 1 : y;
    };


    const fetchKycBookings = async () => {
        setKycLoading(true);
        try {
            const data = await getPhysicalKycBookings();
            setKycBookings(data);
        } catch (e) {
            console.error(e);
        } finally {
            setKycLoading(false);
        }
    };

    const fetchOwnerProps = async () => {
        try {
            const props = await getProperties();
            setOwnerProperties(props);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchKycBookings();
        fetchOwnerProps();
    }, []);

    const handleMarkVerified = async (bookingId: string) => {
        try {
            await markPhysicalKycVerified(bookingId);
            toast.success("✅ Physical KYC Verified", {
                description: "Student marked as physically verified. Audit log saved.",
            });
            fetchKycBookings();
        } catch (e) {
            toast.error("Verification failed. Try again.");
        }
    };

    const filteredKycBookings = kycBookings.filter(b => {
        let matchDate = true;
        if (selectedYear && selectedMonth) {
            const dateStr = b.kycVerifiedAt || b.createdAt || b.updatedAt;
            if (dateStr) {
                const date = new Date(dateStr);
                const itemFY = getFYFromDate(date).toString();
                const itemMonth = (date.getMonth() + 1).toString().padStart(2, '0');
                if (itemFY !== selectedYear || (selectedMonth !== 'ALL' && itemMonth !== selectedMonth)) {
                    matchDate = false;
                }
            }
        }

        let matchProperty = true;
        if (selectedProperty !== "ALL") {
            const propName = b.property?.name || b.propertyName;
            if (propName !== selectedProperty) {
                matchProperty = false;
            }
        }

        const q = kycSearch.toLowerCase();
        const matchSearch = (
            b.guestName?.toLowerCase().includes(q) ||
            b.displayId?.toLowerCase().includes(q) ||
            b.propertyName?.toLowerCase().includes(q) ||
            b.tenant?.displayId?.toLowerCase().includes(q) ||
            b.property?.name?.toLowerCase().includes(q)
        );

        return matchDate && matchSearch && matchProperty;
    });

    const verifiedKyc = filteredKycBookings.filter(b => b.kycVerified);
    const unverifiedKyc = filteredKycBookings.filter(b => !b.kycVerified);

    return (
        <div className="w-full space-y-6 pb-10">
            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 bg-white p-6 rounded-2xl border shadow-sm">
                <div>
                    <h1 className="text-2xl font-black tracking-tighter text-slate-900 flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-xl text-white">
                            <Shield className="w-6 h-6" />
                        </div>
                        Physical KYC Center
                    </h1>
                    <div className="mt-1.5">
                        <p className="text-slate-500 font-bold text-xs uppercase tracking-tight mb-0.5">Physical document verification & logs</p>
                        <p className="text-slate-500 text-xs max-w-4xl leading-relaxed">
                            Make sure to keep a copy of all verified documents as per government rules and police verification regulations. Once verified, records will show here who verified it and from whom.
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button
                        variant="outline" size="sm"
                        onClick={fetchKycBookings}
                        className="rounded-xl border-slate-200 font-bold uppercase text-[10px] tracking-widest h-9"
                    >
                        <RefreshCcw className="w-3 h-3 mr-2" /> Refresh
                    </Button>
                </div>
            </div>

            <div className="space-y-6">
                {/* Search bar and Filters */}
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between w-full">
                    <div className="relative flex-1 w-full max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                            placeholder="Search by student name, booking ID..."
                            className="pl-11 h-12 bg-white border border-slate-200 shadow-sm rounded-full text-sm w-full font-medium"
                            value={kycSearch}
                            onChange={(e) => setKycSearch(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 ml-3">PROPERTY</span>
                            <select
                                value={selectedProperty}
                                onChange={(e) => setSelectedProperty(e.target.value)}
                                className="appearance-none bg-white text-indigo-950 rounded-full px-5 py-2.5 pr-10 text-sm font-black focus:outline-none transition-all cursor-pointer relative shadow-sm border border-slate-200 hover:shadow-md"
                                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%231e1b4b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                            >
                                <option value="ALL">All Properties</option>
                                {properties.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 ml-3">SELECT YEAR</span>
                            <select
                                value={selectedYear}
                                onChange={(e) => {
                                    setSelectedYear(e.target.value);
                                    setSelectedMonth('ALL');
                                }}
                                className="appearance-none bg-white text-indigo-950 rounded-full px-5 py-2.5 pr-10 text-sm font-black focus:outline-none transition-all cursor-pointer relative shadow-sm border border-slate-200 hover:shadow-md"
                                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%231e1b4b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                            >
                                {yearOptions.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 ml-3">SELECT MONTH</span>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="appearance-none bg-white text-indigo-950 rounded-full px-5 py-2.5 pr-10 text-sm font-black focus:outline-none transition-all cursor-pointer relative shadow-sm border border-slate-200 hover:shadow-md"
                                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%231e1b4b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                            >
                                {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 -mt-2">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-[11px] font-bold text-slate-600">{verifiedKyc.length} Verified</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                        <span className="text-[11px] font-bold text-slate-600">{unverifiedKyc.length} Pending Verification</span>
                    </div>
                </div>

                {kycLoading ? (
                    <div className="space-y-8 animate-pulse">
                        <div>
                            <div className="flex items-center gap-3 mb-4 px-1">
                                <div className="p-2 rounded-lg bg-slate-200 w-8 h-8"></div>
                                <div className="h-4 bg-slate-200 rounded w-48"></div>
                            </div>
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-4">
                                        <div className="flex gap-3">
                                            <div className="w-11 h-11 rounded-xl bg-slate-200 shrink-0"></div>
                                            <div className="space-y-2 flex-1 mt-1">
                                                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                                                <div className="h-3 bg-slate-200 rounded w-1/4"></div>
                                            </div>
                                            <div className="w-24 h-8 bg-slate-200 rounded-full shrink-0"></div>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-slate-200">
                                            <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : kycBookings.length === 0 ? (
                    <Card className="border-dashed border-2 bg-slate-50/50">
                        <CardContent className="p-16 text-center">
                            <div className="w-16 h-16 bg-white shadow-inner rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                <ShieldCheck className="w-8 h-8 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">No Records Found</h3>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-tighter mt-1">No active bookings pending or completed physical KYC.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-8">
                        {/* ── Pending Verification (red) — always at bottom, shown first for priority ── */}
                        {unverifiedKyc.length > 0 && (
                            <div>
                                <div className="flex items-center gap-3 mb-4 px-1">
                                    <div className="p-2 rounded-lg bg-red-500 text-white shadow-sm">
                                        <XCircle className="w-4 h-4" />
                                    </div>
                                    <h2 className="text-sm font-black tracking-[0.2em] uppercase text-red-600">
                                        ❌ NOT VERIFIED — Pending Physical Check ({unverifiedKyc.length})
                                    </h2>
                                </div>
                                <div className="space-y-3">
                                    {unverifiedKyc.map(b => (
                                        <PhysicalKycCard key={b.id} booking={b} onMarkVerified={handleMarkVerified} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Verified (green) — sorted by kycVerifiedAt desc ── */}
                        {verifiedKyc.length > 0 && (
                            <div>
                                <div className="flex items-center gap-3 mb-4 px-1">
                                    <div className="p-2 rounded-lg bg-green-600 text-white shadow-sm">
                                        <CheckCircle className="w-4 h-4" />
                                    </div>
                                    <h2 className="text-sm font-black tracking-[0.2em] uppercase text-green-700">
                                        ✅ PHYSICALLY VERIFIED ({verifiedKyc.length})
                                    </h2>
                                </div>
                                <div className="space-y-3">
                                    {verifiedKyc.map(b => (
                                        <PhysicalKycCard key={b.id} booking={b} onMarkVerified={handleMarkVerified} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
