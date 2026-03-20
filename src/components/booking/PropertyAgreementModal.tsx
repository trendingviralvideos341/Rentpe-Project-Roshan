"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ScrollText, AlertTriangle, MapPin, BedDouble, Calendar, Shield } from "lucide-react";

interface PropertyAgreementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAccept: () => void;
    property: {
        id: string;
        name: string;
        address: string;
        city: string;
        noticePeriod?: number | null;
        cancellationPolicy?: string | null;
        refundPolicy?: string | null;
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
    };
    moveInDate: string;
    depositAmount: number;
    platformFee: number;
}

export function PropertyAgreementModal({
    isOpen, onClose, onAccept,
    property, room, tenant, moveInDate, depositAmount, platformFee
}: PropertyAgreementModalProps) {
    const [scrolledToBottom, setScrolledToBottom] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setScrolledToBottom(false);
            setAccepted(false);
        }
    }, [isOpen]);

    function handleScroll() {
        const el = scrollRef.current;
        if (!el) return;
        const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 30;
        if (isAtBottom) setScrolledToBottom(true);
    }

    const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const noticePeriod = property.noticePeriod || 30;
    const totalPayable = room.price + depositAmount + platformFee;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0 rounded-3xl overflow-hidden">
                {/* Header */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-100 rounded-xl">
                            <ScrollText className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-extrabold text-slate-900">Property Agreement</DialogTitle>
                            <p className="text-xs text-slate-500">Please read the full agreement before proceeding to payment</p>
                        </div>
                    </div>
                </DialogHeader>

                {/* Property Summary */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 shrink-0">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-xs text-slate-600 font-semibold truncate">{property.name}, {property.city}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <BedDouble className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-xs text-slate-600 font-semibold">Room {room.roomNumber} ({room.type})</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-xs text-slate-600 font-semibold">Move-in: {moveInDate}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-xs text-slate-600 font-semibold">Deposit: {room.depositMonths} Month{room.depositMonths > 1 ? 's' : ''} (Refundable)</span>
                        </div>
                    </div>
                </div>

                {/* Scrollable Agreement Content */}
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-xs text-slate-600 leading-relaxed"
                >
                    {!scrolledToBottom && (
                        <div className="sticky top-0 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-amber-700 font-semibold text-[11px]">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            Please scroll down and read the full agreement to proceed.
                        </div>
                    )}

                    <div className="text-center space-y-1 pb-4 border-b border-slate-100">
                        <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">Accommodation Agreement</h3>
                        <p className="text-[11px] text-slate-400">Date: {today}</p>
                        <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-600 border-indigo-200">RentPe Facilitated Agreement</Badge>
                    </div>

                    <section>
                        <h4 className="font-black text-slate-800 uppercase text-[11px] tracking-widest mb-2">1. Parties</h4>
                        <p><strong>Tenant:</strong> {tenant.name} {tenant.email ? `(${tenant.email})` : ""}</p>
                        <p><strong>Property:</strong> {property.name}, {property.address}</p>
                        <p><strong>Facilitated By:</strong> RentPe (Marketplace Intermediary — NOT the property owner)</p>
                    </section>

                    <section>
                        <h4 className="font-black text-slate-800 uppercase text-[11px] tracking-widest mb-2">2. Financial Terms</h4>
                        <div className="bg-slate-50 rounded-xl p-4 space-y-2 font-mono text-[11px]">
                            <div className="flex justify-between"><span>Monthly Rent</span><span className="font-bold">₹{room.price.toLocaleString('en-IN')}</span></div>
                            <div className="flex justify-between text-emerald-700"><span>Security Deposit ({room.depositMonths} month{room.depositMonths > 1 ? 's' : ''} — Refundable)</span><span className="font-bold">₹{depositAmount.toLocaleString('en-IN')}</span></div>
                            <div className="flex justify-between text-amber-700"><span>Platform Fee (Non-refundable)</span><span className="font-bold">₹{platformFee.toFixed(2)}</span></div>
                            <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-slate-900 text-sm"><span>Total Payable Now</span><span>₹{totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                        </div>
                        <p className="mt-2 text-[10px] text-slate-500">⚠️ Platform fees are non-refundable. Security deposit is refundable within 30 days of vacating (subject to deductions for documented damage only — not normal wear & tear, per MTA 2021).</p>
                    </section>

                    <section>
                        <h4 className="font-black text-slate-800 uppercase text-[11px] tracking-widest mb-2">3. Tenancy Duration & Rent Due</h4>
                        <p>Move-in Date: <strong>{moveInDate}</strong></p>
                        <p>Monthly rent is due on the <strong>1st of every calendar month</strong>. Late payment may attract penalty charges as specified by the property owner.</p>
                        <p>Duration: Month-to-month basis. Minimum stay and notice period rules apply (see Section 5).</p>
                    </section>

                    <section>
                        <h4 className="font-black text-slate-800 uppercase text-[11px] tracking-widest mb-2">4. House Rules & Conduct</h4>
                        <ul className="list-disc ml-4 space-y-1">
                            <li>You must follow all property rules as communicated by the owner, including visitor policies, curfew timings, noise levels, and food-related guidelines.</li>
                            <li>You are responsible for maintaining your room in good, clean condition.</li>
                            <li>Illegal activities, possession of prohibited substances, vandalism, or harassment of other residents is strictly prohibited and will result in immediate eviction.</li>
                            <li>No subletting or sharing your assigned bed/room without written owner consent.</li>
                        </ul>
                    </section>

                    <section>
                        <h4 className="font-black text-slate-800 uppercase text-[11px] tracking-widest mb-2">5. Notice Period & Vacating</h4>
                        <p>You must provide a written notice of <strong>{noticePeriod} days</strong> before vacating the property. Failure to do so may result in forfeiture of all or part of the security deposit.</p>
                        <p>Move-out inspection will be conducted jointly. Any deductions from the deposit will be communicated to you in writing within 7 days of move-out.</p>
                    </section>

                    <section>
                        <h4 className="font-black text-slate-800 uppercase text-[11px] tracking-widest mb-2">6. Security Deposit Refund (MTA 2021 Compliant)</h4>
                        <p>Your security deposit of ₹{depositAmount.toLocaleString('en-IN')} ({room.depositMonths} month{room.depositMonths > 1 ? 's' : ''} rent) is <strong className="text-emerald-600">fully refundable</strong> subject to:</p>
                        <ul className="list-disc ml-4 space-y-1 mt-1">
                            <li><strong>Permitted deductions only:</strong> Documented physical damage (beyond normal wear & tear), unpaid rent/dues, unreturned keys or property assets.</li>
                            <li><strong>Normal wear & tear IS NOT deductible</strong> (fading paint, minor scuffs, worn fixtures from normal use).</li>
                            <li><strong>Refund timeline:</strong> Within <strong>30 days</strong> of handing over possession of the room.</li>
                            <li>All deductions will be supported by written itemized explanation.</li>
                        </ul>
                        <p className="mt-2 text-[10px] text-slate-500">These rules align with Model Tenancy Act 2021 and established Indian PG industry standards.</p>
                    </section>

                    <section>
                        <h4 className="font-black text-slate-800 uppercase text-[11px] tracking-widest mb-2">7. Platform Disclaimer</h4>
                        <p>RentPe is an <strong>intermediary marketplace platform</strong> and is NOT the property owner or landlord. RentPe is not liable for the physical condition of the property, actions of the owner, or service delivery. Disputes arising from the accommodation are between you (the tenant) and the property owner. RentPe may assist in mediation through the Resolution Center but bears no financial liability.</p>
                    </section>

                    <section>
                        <h4 className="font-black text-slate-800 uppercase text-[11px] tracking-widest mb-2">8. Refund & Cancellation</h4>
                        <p>{property.refundPolicy || "Cancellation refunds are subject to the property owner's cancellation policy. Token amounts are non-refundable once the reservation window expires. Platform fees are strictly non-refundable."}</p>
                    </section>

                    <section>
                        <h4 className="font-black text-slate-800 uppercase text-[11px] tracking-widest mb-2">9. Governing Law</h4>
                        <p>This agreement is governed by the laws of India, including the Model Tenancy Act 2021, Consumer Protection Act 2019, and applicable State laws. Jurisdiction: Bangalore, Karnataka.</p>
                    </section>

                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mt-4">
                        <p className="text-[11px] text-emerald-700 font-bold text-center">
                            By clicking "I Agree to Property Terms", you confirm that you have read, understood, and accept this agreement. Your digital acceptance is legally binding under the Information Technology Act, 2000.
                        </p>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0 space-y-3">
                    {scrolledToBottom && (
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                checked={accepted}
                                onChange={e => setAccepted(e.target.checked)}
                            />
                            <span className="text-[11px] font-bold text-slate-700 leading-relaxed uppercase tracking-wide">
                                I have read and agree to the Property Agreement and the <a href="/terms/tenant" target="_blank" className="text-indigo-600 underline">Tenant Terms & Conditions</a>
                            </span>
                        </label>
                    )}
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">
                            Cancel
                        </Button>
                        <Button
                            onClick={onAccept}
                            disabled={!scrolledToBottom || !accepted}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold disabled:opacity-40"
                        >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            I Agree to Property Terms
                        </Button>
                    </div>
                    {!scrolledToBottom && (
                        <p className="text-center text-[10px] text-slate-400">Scroll to the bottom to enable the agreement button</p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
