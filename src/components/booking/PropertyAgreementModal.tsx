"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, ScrollText, AlertTriangle, MapPin, BedDouble, Calendar, Shield, ChevronDown } from "lucide-react";

interface PropertyAgreementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAccept: (deviceInfo: { userAgent: string; moveInDate?: string }) => Promise<void>;
    property: {
        id: string;
        name: string;
        address: string;
        city: string;
        noticePeriod?: number | null;
        cancellationPolicy?: string | null;
        refundPolicy?: string | null;
        displayId?: string | null;   // PG ID e.g. APP-RP-2026-0001
    };
    room: {
        roomNumber: string;
        type: string;
        price: number;
        depositMonths: number;
    };
    tenant: {
        name: string;
        email?: string;
        userId?: string | null;       // Permanent User ID e.g. REN-USER-XXXX
        tenantId?: string | null;     // Tenant ID e.g. REN-USER-XXXX (set after physical KYC)
    };
    moveInDate: string;
    depositAmount: number;
    platformFee: number;
    bookingDisplayId?: string | null; // Booking ID e.g. REN-BOOK-2026-0001
}

function parseDateToISO(dateStr: string) {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            return d.toISOString().split('T')[0];
        }
    } catch {}
    return new Date().toISOString().split('T')[0];
}

export function PropertyAgreementModal({
    isOpen, onClose, onAccept,
    property, room, tenant, moveInDate, depositAmount, platformFee, bookingDisplayId
}: PropertyAgreementModalProps) {
    const [scrolledToBottom, setScrolledToBottom] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const [signing, setSigning] = useState(false);
    const [selectedDate, setSelectedDate] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
 
    useEffect(() => {
        if (isOpen) {
            setScrolledToBottom(false);
            setAccepted(false);
            setSigning(false);
            setSelectedDate("");
        }
    }, [isOpen]);
 
    function handleScroll() {
        const el = scrollRef.current;
        if (!el) return;
        // Tight threshold: user must be within 10px of bottom
        const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 10;
        if (isAtBottom) setScrolledToBottom(true);
    }
 
    const handleAccept = async () => {
        setSigning(true);
        try {
            // Capture device fingerprint at the exact moment of signing
            const deviceInfo = { 
                userAgent: navigator.userAgent,
                moveInDate: selectedDate
            };
            await onAccept(deviceInfo);
        } finally {
            setSigning(false);
        }
    };
 
    const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const formattedMoveInDate = selectedDate
        ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
        : "[Please select date below]";

    const noticePeriod = property.noticePeriod || 30;
    const rent = Number(room.price) || 0;
    const deposit = Number(depositAmount) || 0;
    const totalPayable = rent + deposit;
 
    const canSign = scrolledToBottom && accepted && selectedDate !== "";

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[93vh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden border-0 shadow-2xl">
                {/* ── Dark Header ── */}
                <DialogHeader className="px-6 pt-5 pb-4 bg-slate-950 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
                            <ScrollText className="w-5 h-5 text-indigo-300" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-extrabold text-white tracking-tight">Rental Agreement</DialogTitle>
                            <p className="text-[11px] text-slate-400 mt-0.5">Read and accept before completing your booking</p>
                        </div>
                        <div className="ml-auto">
                            <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-3 py-1 rounded-full">
                                RentPe · {today}
                            </span>
                        </div>
                    </div>
                </DialogHeader>

                {/* ── Property Info Strip ── */}
                <div className="px-6 py-3 bg-slate-900/80 border-b border-slate-700/60 shrink-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1.5">
                        <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="text-[11px] text-slate-300 font-semibold truncate">{property.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <BedDouble className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="text-[11px] text-slate-300 font-semibold">Room {room.roomNumber} ({room.type})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="text-[11px] text-slate-300 font-semibold">Move-in: {formattedMoveInDate}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Shield className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="text-[11px] text-slate-300 font-semibold">{room.depositMonths}M Deposit</span>
                        </div>
                    </div>
                </div>

                {/* ── Date Selection Card ── */}
                <div className={`px-6 py-3 border-b shrink-0 transition-all duration-300 ${!selectedDate ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <label className="text-xs font-black text-indigo-950 uppercase tracking-wider block">Confirm Your Actual Move-in Date</label>
                            {!selectedDate ? (
                                <span className="text-[10px] text-rose-600 font-bold block mt-0.5 animate-pulse">
                                    ⚠️ Please select a move-in date. Rent will be calculated from this date.
                                </span>
                            ) : (
                                <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                                    ✅ Rent and every other applicable charges will start from this date: {formattedMoveInDate}
                                </span>
                            )}
                        </div>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            min={new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} // Allow up to 3 days in the past
                            className={`px-3 py-1.5 bg-white border-2 rounded-xl text-sm font-bold text-indigo-950 focus:outline-none transition-all cursor-pointer ${
                                !selectedDate ? 'border-rose-300 focus:border-rose-500 hover:border-rose-400' : 'border-emerald-300 focus:border-emerald-500 hover:border-emerald-400'
                            }`}
                        />
                    </div>
                </div>

                {/* ── Scroll Hint (only before scrolled) ── */}
                {!scrolledToBottom && (
                    <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 shrink-0 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-700 font-semibold text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            Scroll to the bottom to enable acceptance
                        </div>
                        <ChevronDown className="w-4 h-4 text-amber-500 animate-bounce" />
                    </div>
                )}

                {/* ── Agreement Content (Scrollable) ── */}
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto bg-white px-6 py-5 space-y-5 text-xs text-slate-600 leading-relaxed"
                >
                    {/* ── Identity Panel (Zolo/Stanza-style: all IDs visible before signing) ── */}
                    {(tenant.userId || tenant.tenantId || bookingDisplayId || property.displayId) && (
                        <div className="bg-indigo-950 border border-indigo-700/50 rounded-xl p-3.5 mb-1">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2.5">📋 Permanent Legal Identifiers — Keep This Safe</p>
                            <div className="grid grid-cols-2 gap-2">
                                {bookingDisplayId && (
                                    <div className="bg-indigo-900/60 rounded-lg p-2.5 border border-indigo-600/30">
                                        <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider mb-0.5">Booking ID</p>
                                        <p className="text-[11px] font-black text-white font-mono">{bookingDisplayId}</p>
                                    </div>
                                )}

                                {tenant.tenantId && (
                                    <div className="bg-emerald-900/60 rounded-lg p-2.5 border border-emerald-600/40">
                                        <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider mb-0.5">Tenant ID ✓ KYC Verified</p>
                                        <p className="text-[11px] font-black text-emerald-300 font-mono">{tenant.tenantId}</p>
                                    </div>
                                )}
                                {property.displayId && (
                                    <div className="bg-indigo-900/60 rounded-lg p-2.5 border border-indigo-600/30">
                                        <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider mb-0.5">PG / Property ID</p>
                                        <p className="text-[11px] font-black text-white font-mono">{property.displayId}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Title */}
                    <div className="text-center space-y-1.5 pb-4 border-b-2 border-dashed border-slate-200">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Accommodation Occupancy Agreement</h3>
                        <p className="text-[10px] text-slate-400">Facilitated by RentPe (Marketplace Intermediary)</p>
                        <p className="text-[10px] text-slate-400">Ref: {property.name} · Executed: {today}</p>
                    </div>

                    {/* Section 1: Parties */}
                    <section>
                        <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-2 pb-1 border-b border-slate-100">1. Parties to This Agreement</h4>
                        <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-[11px]">
                            <p><strong className="text-slate-700">Tenant:</strong> {tenant.name}{tenant.email ? ` (${tenant.email})` : ""}</p>
                            <p><strong className="text-slate-700">Property:</strong> {property.name}, {property.address}, {property.city}</p>
                            <p><strong className="text-slate-700">Facilitated By:</strong> RentPe Platform — an intermediary marketplace. RentPe is NOT the property owner or landlord.</p>
                        </div>
                    </section>

                    {/* Section 2: Financial Terms */}
                    <section>
                        <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-2 pb-1 border-b border-slate-100">2. Financial Terms (Locked at Signing)</h4>
                        <div className="rounded-xl overflow-hidden border border-slate-200 text-[11px]">
                            <div className="bg-slate-900 px-4 py-1.5">
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Payment Breakdown</span>
                            </div>
                            <div className="divide-y divide-slate-100 font-mono">
                                <div className="flex justify-between px-4 py-2.5">
                                    <span className="text-slate-600">Monthly Rent (1st Month)</span>
                                    <span className="font-black text-slate-900">₹{rent.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between px-4 py-2.5 bg-emerald-50/50">
                                    <div>
                                        <span className="text-emerald-700">Security Deposit ({room.depositMonths} month{room.depositMonths > 1 ? 's' : ''})</span>
                                        <span className="ml-2 text-[9px] bg-emerald-100 text-emerald-600 font-bold px-1.5 py-0.5 rounded-full">✓ Refundable</span>
                                    </div>
                                    <span className="font-black text-emerald-700">₹{deposit.toLocaleString('en-IN')}</span>
                                </div>

                                <div className="flex justify-between px-4 py-3 bg-slate-900">
                                    <span className="text-sm font-black text-white">Total Payable Now</span>
                                    <span className="text-sm font-black text-white">₹{totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>
                        <p className="mt-2 text-[10px] text-slate-400 italic">These amounts are fixed as of the agreement date and cannot be altered retroactively.</p>
                    </section>

                    {/* Section 3: Tenancy Duration */}
                    <section>
                        <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-2 pb-1 border-b border-slate-100">3. Tenancy Duration & Rent Schedule</h4>
                        <ul className="space-y-1 list-disc ml-4">
                            <li>Move-in Date: <strong>{formattedMoveInDate}</strong></li>
                            <li>Monthly rent is due on the <strong>1st of every calendar month</strong>. Late payment may attract a penalty as specified by the property owner.</li>
                            <li>Tenancy is on a month-to-month basis. Minimum stay and notice period rules apply (see Section 5).</li>
                        </ul>
                    </section>

                    {/* Section 4: House Rules */}
                    <section>
                        <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-2 pb-1 border-b border-slate-100">4. House Rules & Code of Conduct</h4>
                        <ul className="list-disc ml-4 space-y-1">
                            <li>You must follow all property rules communicated by the owner, including visitor policies, curfew timings, noise guidelines, and food-related rules.</li>
                            <li>You are responsible for maintaining your room and assigned area in a clean, undamaged condition.</li>
                            <li>Illegal activities, possession of prohibited substances, vandalism, or harassment of other residents is strictly prohibited and will result in immediate eviction.</li>
                            <li>No subletting of your assigned bed/room without written owner consent.</li>
                            <li>Guests must be declared and comply with the property's visitor policy.</li>
                        </ul>
                    </section>

                    {/* Section 5: Notice Period */}
                    <section>
                        <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-2 pb-1 border-b border-slate-100">5. Notice Period & Vacating</h4>
                        <p>You must provide written notice of <strong>{noticePeriod} days</strong> before vacating. Failure to provide adequate notice may result in forfeiture of part or all of the security deposit.</p>
                        <p className="mt-1">A joint move-out inspection will be conducted. Deductions, if any, will be communicated in writing within 7 days of vacating.</p>
                    </section>

                    {/* Section 6: Deposit Refund */}
                    <section>
                        <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-2 pb-1 border-b border-slate-100">6. Security Deposit Refund <span className="text-emerald-600 normal-case">(MTA 2021 Compliant)</span></h4>
                        <p>Your security deposit of <strong>₹{deposit.toLocaleString('en-IN')}</strong> ({room.depositMonths} month{room.depositMonths > 1 ? 's' : ''} rent) is <strong className="text-emerald-600">fully refundable</strong> subject to:</p>
                        <ul className="list-disc ml-4 space-y-1 mt-1">
                            <li><strong>Permitted deductions only:</strong> Documented physical damage (beyond normal wear & tear), unpaid dues, unreturned keys or property assets.</li>
                            <li><strong>Normal wear & tear is NOT deductible</strong> (fading paint, minor scuffs, worn fixtures from normal use).</li>
                            <li><strong>Refund timeline:</strong> Within <strong>30 days</strong> of handing over possession of the room.</li>
                            <li>All deductions will be supported by a written, itemised explanation.</li>
                        </ul>
                        <p className="mt-1.5 text-[10px] text-slate-400">In compliance with Model Tenancy Act 2021 and established Indian PG industry standards.</p>
                    </section>

                    {/* Section 7: Disclaimer */}
                    <section>
                        <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-2 pb-1 border-b border-slate-100">7. Platform Disclaimer</h4>
                        <p>RentPe is an <strong>intermediary marketplace platform</strong> and is NOT the property owner or landlord. RentPe is not liable for the physical condition of the property, actions of the owner, or service delivery. Disputes arising from the accommodation are between the Tenant and the Property Owner. RentPe may assist in mediation through its Resolution Centre but bears no direct financial liability.</p>
                    </section>

                    {/* Section 8: Cancellation */}
                    <section>
                        <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-2 pb-1 border-b border-slate-100">8. Refund & Cancellation Policy</h4>
                        <p>{property.refundPolicy || "Cancellation refunds are subject to the property owner's cancellation policy. Token amounts, once the reservation window has expired, are non-refundable. Platform service fees are strictly non-refundable upon booking confirmation."}</p>
                    </section>

                    {/* Section 9: Governing Law */}
                    <section>
                        <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-2 pb-1 border-b border-slate-100">9. Governing Law & Jurisdiction</h4>
                        <p>This agreement is governed by the laws of India, including the Model Tenancy Act 2021, Consumer Protection Act 2019, and applicable State laws. Jurisdiction: Bangalore, Karnataka, India.</p>
                    </section>

                    {/* Acceptance Notice */}
                    <div className="bg-gradient-to-r from-indigo-950 to-slate-900 rounded-xl p-4 mt-2 border border-indigo-500/30">
                        <p className="text-[11px] text-indigo-200 font-semibold text-center leading-relaxed">
                            By clicking <strong className="text-white">"I Accept & Sign Agreement"</strong>, you confirm you have read, understood, and irrevocably accept all terms of this agreement. Your digital acceptance is legally binding under the <strong className="text-white">Information Technology Act, 2000</strong>.
                        </p>
                    </div>
                </div>

                {/* ── Footer Actions ── */}
                <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0 space-y-3">
                    {scrolledToBottom ? (
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                                checked={accepted}
                                onChange={e => setAccepted(e.target.checked)}
                            />
                            <span className="text-[11px] font-bold text-slate-700 leading-relaxed group-hover:text-indigo-700 transition-colors">
                                I have fully read this agreement and agree to all its terms, including the{" "}
                                <a href="/terms/tenant" target="_blank" className="text-indigo-600 underline underline-offset-2">Tenant Terms & Conditions</a>.
                            </span>
                        </label>
                    ) : (
                        <p className="text-center text-[10px] text-slate-400 flex items-center justify-center gap-1.5">
                            <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
                            Scroll to read the full agreement to enable acceptance
                        </p>
                    )}

                    <div className="flex gap-3">
                        <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl h-11 font-bold border-slate-200 hover:border-slate-400">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAccept}
                            disabled={!canSign || signing}
                            className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl h-11 font-black text-sm disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 transition-all active:scale-[0.99]"
                        >
                            {signing ? (
                                <span className="flex items-center gap-2"><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Signing...</span>
                            ) : (
                                <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> I Accept & Sign Agreement</span>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
