'use client';

import { useEffect, useState, useTransition } from 'react';
import { getOwnerVacatingNotices, acknowledgeVacatingNotice, getTenantForSettlement, getSettlementForNotice } from '@/actions/tenancy';
import { getProperties } from '@/actions/properties';
import { toast } from 'sonner';
import { FileText, Clock, CheckCircle2, Loader2, X, Calendar as CalendarIcon, List, ChevronLeft, ChevronRight, Home, AlertTriangle, FileDown, Eye, Printer } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { SettlementModal } from '@/components/dashboard/SettlementModal';
import { VacatingTimeline } from '@/components/ui/VacatingTimeline';

const STATUS_CONFIG: Record<string, { label: string; cls: string; color: string }> = {
    SUBMITTED:    { label: 'Submitted',    cls: 'bg-amber-100 text-amber-700 border-amber-200', color: 'bg-amber-500' },
    ACKNOWLEDGED: { label: 'Acknowledged', cls: 'bg-blue-100 text-blue-700 border-blue-200', color: 'bg-blue-500' },
    APPROVED:     { label: 'Approved',     cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', color: 'bg-emerald-500' },
    DISPUTED:     { label: 'Disputed',     cls: 'bg-red-100 text-red-700 border-red-200', color: 'bg-red-500' },
    WITHDRAWN:    { label: 'Withdrawn',    cls: 'bg-slate-100 text-slate-500 border-slate-200', color: 'bg-slate-400' },
    VACATED:      { label: 'Vacated ✓',   cls: 'bg-teal-100 text-teal-700 border-teal-200', color: 'bg-teal-500' },
};

export default function OwnerNoticesPage() {
    const [notices, setNotices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<any>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [view, setView] = useState<'list' | 'calendar'>('list');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [revisedMoveOutDate, setRevisedMoveOutDate] = useState('');
    const [isPending, startTransition] = useTransition();

    const [confirmNotice, setConfirmNotice] = useState<any>(null);
    const [settlementTenant, setSettlementTenant] = useState<any>(null);
    const [fetchingTenant, setFetchingTenant] = useState(false);
    const [noticeFilter, setNoticeFilter] = useState<'ALL' | 'PENDING' | 'THIS_MONTH' | 'VACATED'>('ALL');
    const [receiptLoading, setReceiptLoading] = useState<string | null>(null); // noticeId being loaded
    const [viewingReceipt, setViewingReceipt] = useState<any>(null); // Data for the receipt modal

    const [selectedYear, setSelectedYear] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [selectedProperty, setSelectedProperty] = useState<string>('ALL');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [ownerProperties, setOwnerProperties] = useState<any[]>([]);

    const handleYearChange = (year: string) => {
        setSelectedYear(year);
        if (year !== 'ALL') {
            const newDate = new Date(currentDate);
            newDate.setFullYear(Number(year));
            setCurrentDate(newDate);
        }
    };

    const handleMonthChange = (month: string) => {
        setSelectedMonth(month);
        if (month !== 'ALL') {
            const newDate = new Date(currentDate);
            newDate.setMonth(Number(month));
            setCurrentDate(newDate);
        }
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedProperty, selectedYear, selectedMonth, noticeFilter]);

    const handleCalendarNavigate = (newDate: Date) => {
        setCurrentDate(newDate);
    };

    const startYear = 2026;
    const currentYear = new Date().getFullYear();
    const uniqueYears = Array.from({ length: Math.max(1, currentYear - startYear + 1) }, (_, i) => {
        return (currentYear - i).toString();
    });

    const ALL_MONTHS = [
        { value: '0', label: 'January' },
        { value: '1', label: 'February' },
        { value: '2', label: 'March' },
        { value: '3', label: 'April' },
        { value: '4', label: 'May' },
        { value: '5', label: 'June' },
        { value: '6', label: 'July' },
        { value: '7', label: 'August' },
        { value: '8', label: 'September' },
        { value: '9', label: 'October' },
        { value: '10', label: 'November' },
        { value: '11', label: 'December' }
    ];
    
    const baseMonthOptions = selectedYear === currentYear.toString()
        ? ALL_MONTHS.slice(0, new Date().getMonth() + 1)
        : ALL_MONTHS;
    const MONTHS = [{ value: 'ALL', label: 'All Months' }, ...baseMonthOptions];

    // Generates the complete, legally-valid official HTML for the settlement receipt
    const getReceiptHtml = (d: any) => {
        const fmt = (date: string | null) => date
            ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
            : '—';
        const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
        const net = d.netRefund ?? (d.securityDeposit - d.totalRentDue - d.totalDeductions);

        const unpaidRows = (d.unpaidRecords || []).map((r: any) =>
            `<tr><td style="color:#ef4444;padding-left:20px">${r.note ? `${r.month} (${r.note})` : r.month}</td><td style="text-align:right;color:#ef4444">- ${inr(r.amount)}</td></tr>`
        ).join('');

        const deductionRows = (d.deductionItems || []).map((item: any) =>
            `<tr><td style="color:#d97706;padding-left:20px">${item.description}</td><td style="text-align:right;color:#d97706">- ${inr(item.amount)}</td></tr>`
        ).join('');

        return `<!DOCTYPE html><html><head><meta charset='utf-8'><title>Official Settlement Receipt - ${d.name}</title>
<style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 48px; color: #0f172a; max-width: 740px; margin: 0 auto; line-height: 1.6; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #4f46e5; padding-bottom: 20px; margin-bottom: 32px; }
    .brand { font-size: 28px; font-weight: 900; color: #4f46e5; letter-spacing: -1px; }
    .brand-sub { font-size: 11px; color: #94a3b8; letter-spacing: 2px; text-transform: uppercase; }
    .doc-meta { text-align: right; font-size: 12px; color: #64748b; }
    .doc-title { font-size: 16px; font-weight: 900; color: #0f172a; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #4f46e5; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }
    table.info { width: 100%; border-collapse: collapse; }
    table.info td { padding: 6px 4px; font-size: 13px; border-bottom: 1px solid #f8fafc; }
    table.info .lbl { color: #64748b; font-weight: 600; width: 45%; }
    table.info .val { font-weight: 700; color: #0f172a; text-align: right; }
    table.info .val.id { color: #4f46e5; font-family: monospace; }
    table.fin { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    table.fin thead tr { background: #f8fafc; }
    table.fin th { padding: 10px 14px; font-size: 11px; font-weight: 900; color: #64748b; text-align: left; border-bottom: 1px solid #e2e8f0; }
    table.fin td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    table.fin .credit { color: #059669; font-weight: 700; text-align: right; }
    table.fin .debit { color: #dc2626; text-align: right; }
    table.fin .sub { color: #d97706; text-align: right; }
    .total-row td { background: #0f172a; color: white; font-weight: 900; font-size: 15px; padding: 14px; border: none; }
    .refund { color: #34d399 !important; } .due { color: #f87171 !important; }
    .proto-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin: 4px 0 12px; font-size: 13px; }
    .stamp-wrap { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
    .stamp { display: inline-block; border: 3px solid #dc2626; color: #dc2626; padding: 6px 20px; border-radius: 4px; font-weight: 900; font-size: 13px; transform: rotate(-4deg); letter-spacing: 2px; }
    .legal { font-size: 9px; color: #94a3b8; margin-top: 16px; line-height: 1.8; }
    @media print { body { padding: 24px; } }
</style></head><body>
<div class="header">
    <div><div class="brand">RentPe</div><div class="brand-sub">Property Management Platform</div></div>
    <div class="doc-meta">
        <div class="doc-title">FINAL SETTLEMENT RECEIPT</div>
        <div>Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <div>Ref: ${d.tenantId}</div>
    </div>
</div>

<div class="section">
    <div class="section-title">Tenant &amp; Property Information</div>
    <table class="info">
        <tr><td class="lbl">Tenant Name</td><td class="val">${d.name}</td></tr>
        <tr><td class="lbl">Tenant ID</td><td class="val id">${d.tenantDisplayId}</td></tr>
        <tr><td class="lbl">Notice Reference</td><td class="val id">${d.noticeDisplayId || 'N/A'}</td></tr>
        <tr><td class="lbl">Booking Reference</td><td class="val id">${d.bookingDisplayId || 'N/A'}</td></tr>
        <tr><td class="lbl">Phone</td><td class="val">${d.phone || '—'}</td></tr>
        <tr><td class="lbl">Property</td><td class="val">${d.propertyName || '—'}</td></tr>
        <tr><td class="lbl">Room No.</td><td class="val">${d.roomNumber || '—'}</td></tr>
        <tr><td class="lbl">Bed No.</td><td class="val">${d.bedNo || '—'}</td></tr>
        <tr><td class="lbl">Room Type</td><td class="val">${d.roomType || '—'}</td></tr>
        <tr><td class="lbl">Move-In Date</td><td class="val">${fmt(d.moveInDate)}</td></tr>
        <tr><td class="lbl">Move-Out Date</td><td class="val">${fmt(d.moveOutDate)}</td></tr>
    </table>
</div>

<div class="section">
    <div class="section-title">Pro-Rata Rent Calculation</div>
    <div class="proto-box">
        <strong>Monthly Rent:</strong> ${inr(d.monthlyRent)}<br>
        <strong>Days in Move-Out Month:</strong> ${d.daysInMonth} days<br>
        <strong>Daily Rate:</strong> ${inr(d.monthlyRent)} ÷ ${d.daysInMonth} = <strong>${inr(d.dailyRate)}/day</strong><br>
        <strong>Days Stayed:</strong> ${d.moveOutDay} days<br>
        <strong>Pro-Rata Rent Amount:</strong> ${inr(d.dailyRate)} × ${d.moveOutDay} = <strong>${inr(d.proRataAmt)}</strong>
    </div>
</div>

<div class="section">
    <div class="section-title">Financial Settlement Breakdown</div>
    <table class="fin" cellspacing="0">
        <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>
            <tr><td><strong>Security Deposit (Credit)</strong></td><td class="credit">+ ${inr(d.securityDeposit)}</td></tr>
            ${d.prepaidRentCredit > 0 ? `<tr><td><strong style="color:#059669">Rent Overpayment Refund (Credit)</strong></td><td class="credit">+ ${inr(d.prepaidRentCredit)}</td></tr>` : ''}
            ${d.totalRentDue > 0 ? `<tr><td><strong style="color:#dc2626">Rent Dues (Outstanding)</strong></td><td class="debit">- ${inr(d.totalRentDue)}</td></tr>${unpaidRows}` : ''}
            ${d.totalDeductions > 0 ? `<tr><td><strong style="color:#d97706">Damage &amp; Maintenance Deductions</strong></td><td class="sub">- ${inr(d.totalDeductions)}</td></tr>${deductionRows}` : ''}
            <tr class="total-row">
                <td>${net >= 0 ? '🏦 Net Refund Payable to Tenant' : '💰 Net Balance Due from Tenant'}</td>
                <td class="${net >= 0 ? 'refund' : 'due'}" style="text-align:right">${inr(Math.abs(net))}</td>
            </tr>
        </tbody>
    </table>
    ${d.settlementNotes ? `<div style="margin-top:12px;font-size:12px;color:#64748b;padding:10px;background:#f8fafc;border-radius:6px"><strong>Settlement Note:</strong> ${d.settlementNotes}</div>` : ''}
</div>

<div class="stamp-wrap">
    <div class="stamp">VERIFIED &amp; SETTLED</div>
    <div class="legal">
        This document is electronically generated and is legally valid under the <strong>Information Technology Act, 2000</strong> and the 
        <strong>Model Tenancy Act, 2021</strong>. It constitutes the official record of the final settlement between the property owner and the tenant.
        No physical signature is required for this document to be legally binding.<br>
        Generated by RentPe on ${new Date().toLocaleString('en-IN')} | System Reference: ${d.tenantId}
    </div>
</div>
</body></html>`;
    };

    const openReceipt = async (notice: any, action: 'view' | 'download' = 'view') => {
        setReceiptLoading(notice.id);
        try {
            const d = await getSettlementForNotice(notice.bookingId);
            if (action === 'view') {
                setViewingReceipt(d);
            } else {
                const html = getReceiptHtml(d);
                const win = window.open('', '_blank');
                if (win) { win.document.write(html); win.document.close(); win.print(); }
            }
        } catch (e: any) {
            toast.error(e.message || 'Could not load receipt.');
        } finally {
            setReceiptLoading(null);
        }
    };

    const handleMoveOutNow = (notice: any) => setConfirmNotice(notice);

    const handleConfirmMoveOut = async () => {
        if (!confirmNotice) return;
        setFetchingTenant(true);
        try {
            const tenant = await getTenantForSettlement(confirmNotice.bookingId);
            setSettlementTenant(tenant);
            setConfirmNotice(null);
        } catch (e: any) {
            toast.error(e.message || 'Could not load tenant data.');
        } finally {
            setFetchingTenant(false);
        }
    };

    useEffect(() => {
        const fetchProps = async () => {
            try {
                const props = await getProperties();
                setOwnerProperties(props);
            } catch (e) { console.error(e); }
        };
        fetchProps();

        getOwnerVacatingNotices().then(data => {
            setNotices(data);
            setLoading(false);
            const now = new Date();
            setSelectedYear(now.getFullYear().toString());
            setSelectedMonth(now.getMonth().toString());
            setCurrentDate(now);
        });
    }, []);

    const handleAcknowledge = (noticeId: string) => {
        startTransition(async () => {
            try {
                const updated = await acknowledgeVacatingNotice(noticeId, note, revisedMoveOutDate || undefined);
                setNotices(prev => prev.map(n => n.id === noticeId ? { ...n, ...updated } : n));
                setExpandedId(null);
                setNote('');
                setRevisedMoveOutDate('');
                toast.success('Notice acknowledged with approved date.');
            } catch (e: any) {
                toast.error(e.message || 'Action failed.');
            }
        });
    };

    // Group upcoming move-outs by month
    const upcoming = notices
        .filter(n => n.status !== 'WITHDRAWN' && new Date(n.plannedMoveOut) >= new Date())
        .sort((a, b) => new Date(a.plannedMoveOut).getTime() - new Date(b.plannedMoveOut).getTime());

    // Calendar logic
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const getNoticesForDay = (day: Date) => {
        return notices.filter(n => n.status !== 'WITHDRAWN' && isSameDay(new Date(n.plannedMoveOut), day));
    };

    const uniqueProperties = Array.from(new Set([
        ...ownerProperties.map(p => p.name),
        ...notices.map(n => n.booking?.propertyName)
    ].filter(Boolean))).sort() as string[];

    const filteredNotices = notices.filter(n => {
        const date = new Date(n.plannedMoveOut);

        let statusMatch = true;
        if (noticeFilter === 'VACATED') statusMatch = n.status === 'VACATED';
        else if (noticeFilter === 'PENDING') statusMatch = n.status === 'SUBMITTED';
        else if (noticeFilter === 'THIS_MONTH') {
            const now = new Date();
            statusMatch = n.status !== 'WITHDRAWN' && n.status !== 'VACATED' && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        } else {
            statusMatch = n.status !== 'VACATED'; // ALL behavior
        }

        if (!statusMatch) return false;
        if (selectedProperty !== 'ALL' && n.booking?.propertyName !== selectedProperty) return false;

        const yearMatch = selectedYear === 'ALL' || date.getFullYear() === Number(selectedYear);
        const monthMatch = selectedMonth === 'ALL' || date.getMonth() === Number(selectedMonth);
        return yearMatch && monthMatch;
    });

    const ITEMS_PER_PAGE = 25;
    const totalPages = Math.ceil(filteredNotices.length / ITEMS_PER_PAGE) || 1;
    const paginatedNotices = filteredNotices.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-6 pt-10 pb-20 rounded-3xl relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="w-full relative z-10">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Vacating Notices</h1>
                            <p className="text-indigo-200 text-sm font-medium mt-1">Manage tenant move-out notifications</p>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex gap-4">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/80 mb-1 ml-3">SELECT PROPERTY</span>
                                    <select
                                        value={selectedProperty}
                                        onChange={(e) => setSelectedProperty(e.target.value)}
                                        className="appearance-none bg-white text-indigo-950 rounded-full px-5 py-2.5 pr-10 text-sm font-black focus:outline-none transition-all cursor-pointer relative shadow-lg shadow-indigo-900/20"
                                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%231e1b4b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                                    >
                                        <option value="ALL">All Properties</option>
                                        {uniqueProperties.map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/80 mb-1 ml-3">SELECT YEAR</span>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => handleYearChange(e.target.value)}
                                        className="appearance-none bg-white text-indigo-950 rounded-full px-5 py-2.5 pr-10 text-sm font-black focus:outline-none transition-all cursor-pointer relative shadow-lg shadow-indigo-900/20"
                                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%231e1b4b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                                    >
                                        {uniqueYears.map(y => (
                                            <option key={y} value={y.toString()}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/80 mb-1 ml-3">SELECT MONTH</span>
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => handleMonthChange(e.target.value)}
                                        className="appearance-none bg-white text-indigo-950 rounded-full px-5 py-2.5 pr-10 text-sm font-black focus:outline-none transition-all cursor-pointer relative shadow-lg shadow-indigo-900/20"
                                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%231e1b4b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                                    >
                                        {MONTHS.map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex bg-white/20 backdrop-blur-md rounded-xl p-1 gap-1 border border-white/30 self-end mb-0.5">
                                <button onClick={() => setView('list')}
                                    className={`px-4 py-2 rounded-lg text-xs font-black flex items-center gap-2 transition-all ${view === 'list' ? 'bg-white text-indigo-700 shadow-lg' : 'text-white hover:bg-white/10'}`}>
                                    <List className="w-4 h-4" /> List
                                </button>
                                <button onClick={() => setView('calendar')}
                                    className={`px-4 py-2 rounded-lg text-xs font-black flex items-center gap-2 transition-all ${view === 'calendar' ? 'bg-white text-indigo-700 shadow-lg' : 'text-white hover:bg-white/10'}`}>
                                    <CalendarIcon className="w-4 h-4" /> Calendar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full px-4 mt-6 relative z-10 space-y-6">
                {/* Summary Cards — 4 tabs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Total',            val: notices.filter(n => n.status !== 'VACATED').length, filter: 'ALL'    as const, highlight: noticeFilter === 'ALL' },
                        { label: 'Pending Action',   val: notices.filter(n => n.status === 'SUBMITTED').length,  filter: 'PENDING'    as const, highlight: noticeFilter === 'PENDING' },
                        { label: 'This Month',       val: upcoming.filter(n => { const d = new Date(n.plannedMoveOut); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length, filter: 'THIS_MONTH' as const, highlight: noticeFilter === 'THIS_MONTH' },
                        { label: 'Vacate Completed', val: notices.filter(n => n.status === 'VACATED').length,   filter: 'VACATED' as const, highlight: noticeFilter === 'VACATED', teal: true },
                    ].map(stat => (
                        <button
                            key={stat.label}
                            onClick={() => setNoticeFilter(stat.filter)}
                            className={`rounded-2xl p-4 shadow-lg border text-center transition-all ${
                                (stat as any).teal && noticeFilter === 'VACATED'
                                    ? 'bg-teal-600 border-teal-500 ring-2 ring-teal-400'
                                    : stat.highlight && !('teal' in stat)
                                    ? 'bg-indigo-600 border-indigo-500 ring-2 ring-indigo-400'
                                    : 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50'
                            }`}>
                            <p className={`text-2xl font-black ${
                                ((stat as any).teal && noticeFilter === 'VACATED') || stat.highlight ? 'text-white' : 'text-slate-900'
                            }`}>{stat.val}</p>
                            <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${
                                ((stat as any).teal && noticeFilter === 'VACATED') || stat.highlight ? 'text-white/80' : 'text-slate-400'
                            }`}>{stat.label}</p>
                        </button>
                    ))}
                </div>

                {view === 'list' ? (
                    <>
                        {/* Upcoming Move-outs List */}
                        {upcoming.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5">
                                <h2 className="font-black text-amber-900 flex items-center gap-2 mb-4">
                                    <CalendarIcon className="w-5 h-5" /> Upcoming Move-outs
                                </h2>
                                <div className="space-y-3">
                                    {upcoming.slice(0, 5).map(n => {
                                        const daysLeft = Math.ceil((new Date(n.plannedMoveOut).getTime() - Date.now()) / 86400000);
                                        return (
                                            <div key={n.id} className="flex items-center justify-between bg-white/70 rounded-2xl p-4 border border-amber-100">
                                                <div>
                                                    <p className="font-black text-slate-900 text-sm">{n.booking?.guestName}</p>
                                                    <p className="text-xs text-slate-500">{n.booking?.propertyName} · {n.displayId}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-slate-900 text-sm">
                                                        {format(new Date(n.plannedMoveOut), 'd MMM')}
                                                    </p>
                                                    <p className={`text-[10px] font-black ${daysLeft <= 7 ? 'text-red-600' : 'text-slate-400'}`}>
                                                        {daysLeft} days
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Full Notice List */}
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                            <div className="p-5 border-b border-slate-100">
                                <h2 className="font-black text-slate-900 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-indigo-600" /> All Notices
                                </h2>
                            </div>

                            {filteredNotices.length === 0 ? (
                                <div className="py-16 text-center">
                                    <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                    <p className="font-black text-slate-400">No vacating notices found for this period</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {paginatedNotices.map(notice => {
                                        const sc = STATUS_CONFIG[notice.status] || STATUS_CONFIG.SUBMITTED;
                                        const daysLeft = Math.ceil((new Date(notice.plannedMoveOut).getTime() - Date.now()) / 86400000);
                                        return (
                                            <div key={notice.id} className="p-5 hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0">
                                                {/* Top row: details + action buttons */}
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h3 className="font-black text-slate-900">{notice.booking?.guestName}</h3>
                                                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase ${sc.cls}`}>{sc.label}</span>
                                                        </div>
                                                        <p className="text-sm text-slate-500">{notice.booking?.propertyName}</p>
                                                        <p className="text-sm font-medium text-slate-700">Reason: {notice.reason}</p>
                                                        <div className="flex items-center gap-4 flex-wrap">
                                                            <span className="text-xs text-slate-400">Filed: {format(new Date(notice.submittedAt), 'd MMM yyyy')}</span>
                                                            <span className={`text-xs font-bold ${daysLeft < 0 ? 'text-red-600' : daysLeft <= 7 ? 'text-amber-600' : 'text-slate-600'}`}>
                                                                Move-out: {format(new Date(notice.plannedMoveOut), 'd MMM yyyy')}
                                                                {daysLeft >= 0 ? ` (${daysLeft} days)` : ' (past)'}
                                                            </span>
                                                        </div>
                                                        {notice.tenantComment && (
                                                             <div className="mt-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2">
                                                                 <span className="text-[10px] font-black text-violet-500">⚠️ Early-Leave Request: </span>
                                                                 <span className="text-xs text-violet-800 font-medium">{notice.tenantComment}</span>
                                                             </div>
                                                         )}
                                                        {notice.ownerNote && (
                                                            <p className="text-xs text-indigo-600 font-medium">Your note: {notice.ownerNote}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col gap-2 shrink-0">
                                                        <button
                                                            onClick={() => {
                                                                const isOpen = expandedId === notice.id;
                                                                setExpandedId(isOpen ? null : notice.id);
                                                                if (!isOpen) {
                                                                    setNote('');
                                                                    setRevisedMoveOutDate(format(new Date(notice.plannedMoveOut), 'yyyy-MM-dd'));
                                                                }
                                                            }}
                                                            className={`px-4 py-2 font-black text-xs rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 shadow-md ${
                                                                expandedId === notice.id
                                                                    ? 'bg-slate-200 text-slate-700 shadow-slate-100'
                                                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                                                            }`}
                                                        >
                                                            <FileText className="w-3.5 h-3.5" />
                                                            {expandedId === notice.id ? 'Hide Details' : 'View Details'}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* ── Inline Expanded Details ── */}
                                                {expandedId === notice.id && (
                                                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                                                        {notice.status === 'SUBMITTED' ? (
                                                            <>
                                                                <div className="grid grid-cols-1 gap-4">
                                                                    <div>
                                                                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Approved Move-out Date</label>
                                                                        <input
                                                                            type="date"
                                                                            value={revisedMoveOutDate}
                                                                            onChange={e => setRevisedMoveOutDate(e.target.value)}
                                                                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                                        />
                                                                        <p className="text-[10px] text-slate-400 mt-1 italic">Default is tenant&apos;s request: {format(new Date(notice.plannedMoveOut), 'd MMM yyyy')}</p>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Your Response (optional)</label>
                                                                        <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
                                                                            placeholder="Add a note for the tenant..."
                                                                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                                                                    </div>
                                                                </div>
                                                                <button onClick={() => handleAcknowledge(notice.id)} disabled={isPending}
                                                                    className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm rounded-2xl disabled:opacity-50 transition-all shadow-lg shadow-indigo-200">
                                                                    {isPending ? 'Acknowledging...' : 'Acknowledge Notice ✓'}
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                {notice.ownerNote && (
                                                                    <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                                                        <p className="text-[10px] font-black uppercase text-indigo-400 mb-1">Your Note</p>
                                                                        <p className="text-xs text-indigo-700">{notice.ownerNote}</p>
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">Vacating Progress</p>
                                                                    <VacatingTimeline notice={notice} />
                                                                </div>
                                                                {notice.status === 'VACATED' && (
                                                                    <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 space-y-3">
                                                                        <p className="text-xs font-black text-teal-700 uppercase flex items-center gap-1.5">
                                                                            <CheckCircle2 className="w-4 h-4" /> Vacating Complete
                                                                        </p>
                                                                        <p className="text-sm text-teal-800">Settlement finalized. View the full receipt below.</p>
                                                                        <div className="flex gap-2">
                                                                            <button
                                                                                onClick={() => openReceipt(notice, 'view')}
                                                                                disabled={receiptLoading === notice.id}
                                                                                className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-xs rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-200 disabled:opacity-60"
                                                                            >
                                                                                {receiptLoading === notice.id ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...</> : <><Eye className="w-3.5 h-3.5" /> View Receipt</>}
                                                                            </button>
                                                                            <button
                                                                                onClick={() => openReceipt(notice, 'download')}
                                                                                disabled={receiptLoading === notice.id}
                                                                                className="flex-1 py-2.5 bg-slate-800 text-white font-black text-xs rounded-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                                                                            >
                                                                                <FileDown className="w-3.5 h-3.5" /> Download PDF
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {notice.status === 'ACKNOWLEDGED' && (
                                                                    <button
                                                                        onClick={() => { setExpandedId(null); handleMoveOutNow(notice); }}
                                                                        className="w-full py-3 bg-gradient-to-r from-rose-600 to-orange-600 text-white font-black text-sm rounded-2xl hover:from-rose-700 hover:to-orange-700 transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2"
                                                                    >
                                                                        <Home className="w-4 h-4" /> Move Out &amp; Settlement Now
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        {totalPages > 1 && (
                            <div className="border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between bg-white px-6 py-4 rounded-b-2xl shadow-sm">
                                <div className="text-sm text-slate-500 font-bold mb-4 sm:mb-0">
                                    Showing <span className="text-indigo-600">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-indigo-600">{Math.min(currentPage * ITEMS_PER_PAGE, filteredNotices.length)}</span> of <span className="text-indigo-600">{filteredNotices.length}</span> entries
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="px-4 py-2 rounded-xl text-sm font-black transition-all bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                    >
                                        Previous
                                    </button>
                                    <div className="px-4 py-2 rounded-xl text-sm font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                                        Page {currentPage} of {totalPages}
                                    </div>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="px-4 py-2 rounded-xl text-sm font-black transition-all bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    /* CALENDAR VIEW */
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="font-black text-slate-900 flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5 text-indigo-600" /> Move-out Calendar
                            </h2>
                            <div className="flex items-center gap-4">
                                <button onClick={() => handleCalendarNavigate(subMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                                </button>
                                <span className="text-sm font-black text-slate-900 min-w-[120px] text-center">
                                    {format(currentDate, 'MMMM yyyy')}
                                </span>
                                <button onClick={() => handleCalendarNavigate(addMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                                    <ChevronRight className="w-5 h-5 text-slate-600" />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {day}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7">
                            {calendarDays.map((day, idx) => {
                                const dayNotices = getNoticesForDay(day);
                                const isCurrentMonth = isSameMonth(day, currentDate);
                                return (
                                    <div key={idx} className={`min-h-[120px] border-b border-r border-slate-50 p-2 transition-all hover:bg-slate-50/50 ${!isCurrentMonth ? 'bg-slate-50/30 opacity-40' : ''}`}>
                                        <div className="flex justify-between items-start">
                                            <span className={`text-xs font-black ${isSameDay(day, new Date()) ? 'bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : 'text-slate-400'}`}>
                                                {format(day, 'd')}
                                            </span>
                                        </div>
                                        <div className="mt-2 space-y-1">
                                            {dayNotices.map(n => {
                                                const sc = STATUS_CONFIG[n.status] || STATUS_CONFIG.SUBMITTED;
                                                return (
                                                    <div 
                                                        key={n.id} 
                                                        onClick={() => {
                                                            setSelected(n);
                                                            if (n.status === 'SUBMITTED') {
                                                                setRevisedMoveOutDate(format(new Date(n.plannedMoveOut), 'yyyy-MM-dd'));
                                                            }
                                                        }}
                                                        className={`text-[9px] font-black p-1.5 rounded-lg border flex flex-col cursor-pointer transition-all hover:scale-[1.02] shadow-sm ${sc.cls}`}
                                                    >
                                                        <span className="truncate">{n.booking?.guestName}</span>
                                                        <span className="flex items-center gap-1 mt-0.5">
                                                           <div className={`w-1 h-1 rounded-full ${sc.color}`} />
                                                           <span className="text-[8px] opacity-70 uppercase">{n.status}</span>
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Acknowledge Modal */}
            {selected && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="font-black text-slate-900">
                                {selected.status === 'ACKNOWLEDGED' ? 'Notice Details' : 'Acknowledge Notice'}
                            </h2>
                            <button onClick={() => setSelected(null)} className="p-2 hover:bg-slate-100 rounded-xl">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                                <p className="text-sm font-black text-slate-900">{selected.booking?.guestName}</p>
                                <p className="text-xs text-slate-500">Planned Move-out: <strong>{format(new Date(selected.plannedMoveOut), 'd MMM yyyy')}</strong></p>
                                <p className="text-xs text-slate-500">Reason: {selected.reason}</p>
                                <p className="text-xs font-black text-indigo-600">Status: {selected.status}</p>
                            </div>
                             {selected.tenantComment && (
                                 <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4">
                                     <p className="text-[10px] font-black uppercase tracking-widest text-violet-500 mb-1">⚠️ Tenant Early-Leave Request</p>
                                     <p className="text-sm text-violet-800 font-medium">{selected.tenantComment}</p>
                                 </div>
                             )}
                            {selected.status === 'SUBMITTED' ? (
                                <>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Approved Move-out Date</label>
                                            <input 
                                                type="date" 
                                                value={revisedMoveOutDate} 
                                                onChange={e => setRevisedMoveOutDate(e.target.value)}
                                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                            />
                                            <p className="text-[10px] text-slate-400 mt-1 italic">Default is tenant's request: {format(new Date(selected.plannedMoveOut), 'd MMM yyyy')}</p>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Your Response (optional)</label>
                                            <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
                                                placeholder="Add a note for the tenant..."
                                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                                        </div>
                                    </div>
                                    <button onClick={() => handleAcknowledge(selected.id)} disabled={isPending}
                                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm rounded-2xl disabled:opacity-50 transition-all shadow-lg shadow-indigo-200">
                                        {isPending ? 'Acknowledging...' : 'Acknowledge Notice ✓'}
                                    </button>
                                </>
                            ) : (
                                <div className="space-y-4">
                                   {selected.ownerNote && (
                                       <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                           <p className="text-[10px] font-black uppercase text-indigo-400 mb-1">Your Note</p>
                                           <p className="text-xs text-indigo-700">{selected.ownerNote}</p>
                                       </div>
                                   )}
                                   {/* ── Vacating Progress Timeline ── */}
                                   <div className="pt-2">
                                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">Vacating Progress</p>
                                       <VacatingTimeline notice={selected} />
                                   </div>
                                   {/* ── VACATED: show completed state ── */}
                                   {selected.status === 'VACATED' && (
                                       <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 space-y-3">
                                           <p className="text-xs font-black text-teal-700 uppercase flex items-center gap-1.5 mb-1">
                                               <CheckCircle2 className="w-4 h-4" /> Vacating Complete
                                           </p>
                                           <p className="text-sm text-teal-800">Settlement finalized. View or download the full receipt.</p>
                                           <div className="flex gap-2">
                                               <button
                                                   onClick={() => openReceipt(selected, 'view')}
                                                   disabled={receiptLoading === selected.id}
                                                   className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-xs rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-60"
                                               >
                                                   {receiptLoading === selected.id ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...</> : <><Eye className="w-3.5 h-3.5" /> View Receipt</>}
                                               </button>
                                               <button
                                                   onClick={() => openReceipt(selected, 'download')}
                                                   disabled={receiptLoading === selected.id}
                                                   className="flex-1 py-2.5 bg-slate-800 text-white font-black text-xs rounded-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                                               >
                                                   <FileDown className="w-3.5 h-3.5" /> Download PDF
                                               </button>
                                           </div>
                                       </div>
                                   )}
                                   {/* ── Move Out & Settlement button (only if ACKNOWLEDGED, not yet VACATED) ── */}
                                   {selected.status === 'ACKNOWLEDGED' && (
                                       <button
                                           onClick={() => { setSelected(null); handleMoveOutNow(selected); }}
                                           className="w-full py-3 bg-gradient-to-r from-rose-600 to-orange-600 text-white font-black text-sm rounded-2xl hover:from-rose-700 hover:to-orange-700 transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2"
                                       >
                                           <Home className="w-4 h-4" /> Move Out &amp; Settlement Now
                                       </button>
                                   )}
                                   <button onClick={() => setSelected(null)} className="w-full py-3 bg-slate-100 text-slate-600 font-black text-xs rounded-xl hover:bg-slate-200 transition-all">
                                        Close
                                   </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Early Move-Out Confirmation Dialog ── */}
            {confirmNotice && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="bg-amber-50 p-6 border-b border-amber-100">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                                </div>
                                <h2 className="font-black text-slate-900 text-lg">Confirm Early Move-Out</h2>
                            </div>
                            <p className="text-sm text-slate-600">
                                Move-out was scheduled for{' '}
                                <strong className="text-slate-900">{format(new Date(confirmNotice.plannedMoveOut), 'd MMM yyyy')}</strong>,
                                but you are selecting{' '}
                                <strong className="text-rose-700">{format(new Date(), 'd MMM yyyy')} (Today)</strong>.
                            </p>
                            <div className="mt-3 bg-white border border-amber-200 rounded-2xl p-3">
                                <p className="text-xs font-black text-amber-700 uppercase tracking-widest mb-1">What happens next</p>
                                <p className="text-xs text-slate-600">
                                    Today&apos;s date will be used for all settlement calculations — pro-rata rent, security deposit, and deductions.
                                </p>
                            </div>
                        </div>
                        <div className="p-5 flex gap-3">
                            <button
                                onClick={handleConfirmMoveOut}
                                disabled={fetchingTenant}
                                className="flex-1 py-3 bg-gradient-to-r from-rose-600 to-orange-600 text-white font-black text-sm rounded-2xl hover:from-rose-700 hover:to-orange-700 disabled:opacity-50 transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2"
                            >
                                {fetchingTenant
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
                                    : <><Home className="w-4 h-4" /> Confirm Move-Out</>
                                }
                            </button>
                            <button
                                onClick={() => setConfirmNotice(null)}
                                disabled={fetchingTenant}
                                className="flex-1 py-3 bg-indigo-600 text-white font-black text-sm rounded-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Settlement Modal ── */}
            {settlementTenant && (
                <SettlementModal
                    tenant={settlementTenant}
                    onClose={() => setSettlementTenant(null)}
                    onSuccess={() => {
                        setSettlementTenant(null);
                        getOwnerVacatingNotices().then(setNotices);
                    }}
                />
            )}
            {viewingReceipt && (() => {
                const vr = viewingReceipt;
                const net = vr.netRefund ?? (vr.securityDeposit - vr.totalRentDue - vr.totalDeductions);
                const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
                return (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                            <div>
                                <h2 className="font-black text-slate-900 text-lg">Settlement Receipt</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Ref: {vr.tenantDisplayId}</p>
                            </div>
                            <button onClick={() => setViewingReceipt(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X className="w-5 h-5 text-slate-500" /></button>
                        </div>

                        <div className="overflow-y-auto flex-1 p-5 space-y-4">
                            {/* Brand */}
                            <div className="text-center border-b border-slate-100 pb-4">
                                <p className="text-xl font-black text-indigo-600 tracking-tighter">RentPe</p>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Final Settlement Document</p>
                            </div>

                            {/* Tenant + Property Info */}
                            <div>
                                <p className="text-[9px] font-black uppercase text-indigo-500 tracking-widest mb-2">Tenant & Property</p>
                                <div className="bg-slate-50 rounded-2xl p-4 space-y-1.5">
                                    {[
                                        ['Tenant ID', vr.tenantDisplayId, true],
                                        ['Notice Ref.', vr.noticeDisplayId || '—', true],
                                        ['Booking Ref.', vr.bookingDisplayId || '—', true],
                                        ['Name', vr.name, false],
                                        ['Phone', vr.phone || '—', false],
                                        ['Property', vr.propertyName || '—', false],
                                        ['Room No.', vr.roomNumber || '—', false],
                                        ['Bed No.', vr.bedNo || '—', false],
                                        ['Room Type', vr.roomType || '—', false],
                                        ['Move-In', fmtDate(vr.moveInDate), false],
                                        ['Move-Out', fmtDate(vr.moveOutDate), false],
                                    ].map(([l, v, isId]) => (
                                        <div key={String(l)} className="flex justify-between text-xs">
                                            <span className="text-slate-400">{l}</span>
                                            <span className={`font-bold ${isId ? 'text-indigo-600 font-mono' : 'text-slate-900'}`}>{String(v)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Pro-Rata Breakdown */}
                            <div>
                                <p className="text-[9px] font-black uppercase text-indigo-500 tracking-widest mb-2">Pro-Rata Rent Calculation</p>
                                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-1.5 text-xs">
                                    <div className="flex justify-between"><span className="text-slate-500">Monthly Rent</span><span className="font-bold">{inr(vr.monthlyRent)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Days in Month</span><span className="font-bold">{vr.daysInMonth} days</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Daily Rate</span><span className="font-bold">{inr(vr.dailyRate)}/day</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Days Stayed</span><span className="font-bold">{vr.moveOutDay} days</span></div>
                                    <div className="flex justify-between pt-1 border-t border-emerald-200">
                                        <span className="font-black text-emerald-800">Pro-Rata Amount</span>
                                        <span className="font-black text-emerald-700">{inr(vr.dailyRate)} × {vr.moveOutDay} = {inr(vr.proRataAmt)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Financial Breakdown */}
                            <div>
                                <p className="text-[9px] font-black uppercase text-indigo-500 tracking-widest mb-2">Settlement Breakdown</p>
                                <div className="bg-slate-50 rounded-2xl p-4 space-y-1.5 text-xs">
                                    <div className="flex justify-between"><span className="text-slate-500">Security Deposit (Credit)</span><span className="font-bold text-emerald-700">+ {inr(vr.securityDeposit)}</span></div>
                                    {vr.totalRentDue > 0 && (<>
                                        <div className="flex justify-between font-bold text-red-600"><span>Rent Dues (Total)</span><span>- {inr(vr.totalRentDue)}</span></div>
                                        {(vr.unpaidRecords || []).map((r: any) => (
                                            <div key={r.month} className="flex justify-between pl-3 text-red-500">
                                                <span>{r.note ? `${r.month} (${r.note})` : r.month}</span>
                                                <span>- {inr(r.amount)}</span>
                                            </div>
                                        ))}
                                    </>)}
                                    {vr.totalDeductions > 0 && (<>
                                        <div className="flex justify-between font-bold text-amber-700"><span>Damage Deductions (Total)</span><span>- {inr(vr.totalDeductions)}</span></div>
                                        {(vr.deductionItems || []).map((item: any, i: number) => (
                                            <div key={i} className="flex justify-between pl-3 text-amber-600">
                                                <span>{item.description}</span>
                                                <span>- {inr(item.amount)}</span>
                                            </div>
                                        ))}
                                    </>)}
                                    <div className="flex justify-between pt-2 border-t border-slate-200">
                                        <span className={`font-black ${net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{net >= 0 ? 'Net Refund' : 'Net Due'}</span>
                                        <span className={`font-black text-base ${net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{inr(Math.abs(net))}</span>
                                    </div>
                                </div>
                            </div>

                            {vr.settlementNotes && (
                                <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
                                    <span className="font-black uppercase text-slate-400 block mb-1">Note</span>
                                    {vr.settlementNotes}
                                </div>
                            )}

                            <p className="text-[8px] text-center text-slate-300 leading-relaxed">
                                Electronically generated. Valid under IT Act 2000 & Model Tenancy Act 2021. No signature required.
                            </p>
                        </div>

                        <div className="p-4 border-t border-slate-100 flex gap-3 shrink-0">
                            <button onClick={() => {
                                const html = getReceiptHtml(viewingReceipt);
                                const win = window.open('', '_blank');
                                if (win) { win.document.write(html); win.document.close(); win.print(); }
                            }} className="flex-1 py-3 bg-indigo-600 text-white font-black text-sm rounded-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                                <Printer className="w-4 h-4" /> Print / Download
                            </button>
                            <button onClick={() => setViewingReceipt(null)} className="flex-1 py-3 bg-slate-100 text-slate-700 font-black text-sm rounded-2xl hover:bg-slate-200 transition-all">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}
        </div>
    );
}
