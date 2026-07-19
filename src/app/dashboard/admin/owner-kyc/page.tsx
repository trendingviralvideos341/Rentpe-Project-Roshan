"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getKYCQueue, verifyDocument as verifyOwnerDoc, rejectDocument } from "@/actions/adminPhase2";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle, XCircle, Eye, FileCheck, User, X, ZoomIn, Search, ShieldCheck } from "lucide-react";

const KYC_FILTER_TABS = [
    { key: "ALL", label: "All Docs" }, { key: "PENDING", label: "⏳ Pending" },
    { key: "VERIFIED", label: "✅ Verified" }, { key: "AADHAAR", label: "Aadhaar" },
    { key: "PAN", label: "PAN Card" }, { key: "PG_LICENCE", label: "PG Licence" },
    { key: "LIVE_PHOTO", label: "Live Photo" },
];

interface DocItem {
    id: string; propertyId: string; propertyName: string; propertyDisplayId?: string;
    city: string; docType: string; docLabel: string; docUrl: string; isVerified: boolean;
    owner: { id: string; name?: string; email?: string; phone?: string; displayId?: string }; submittedAt: string;
}

export default function OwnerKycPage() {
    const [data, setData] = useState<{ queue: DocItem[]; stats: { pending: number; verified: number; total: number } } | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("ALL");
    const [rejectTarget, setRejectTarget] = useState<DocItem | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [viewerDoc, setViewerDoc] = useState<DocItem | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    
    // Date/Property Filters
    const currentYearNum = new Date().getFullYear();
    const currentMonthNum = new Date().getMonth() + 1;
    const currentFYBase = currentMonthNum < 4 ? currentYearNum - 1 : currentYearNum;
    const defaultMonth = currentMonthNum.toString().padStart(2, '0');

    const [selectedProperty, setSelectedProperty] = useState('ALL');
    const [selectedYear, setSelectedYear] = useState(currentFYBase.toString());
    const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try { const result = await getKYCQueue(filter); setData(result); }
        catch { toast.error("Failed to load KYC queue"); }
        finally { setLoading(false); }
    }, [filter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleVerify = async (item: DocItem) => {
        setActionLoading(item.id);
        try { await verifyOwnerDoc(item.propertyId, item.docType); toast.success(`${item.docLabel} verified!`); fetchData(); }
        catch { toast.error("Verification failed"); }
        finally { setActionLoading(null); }
    };

    const handleReject = async () => {
        if (!rejectTarget || !rejectReason.trim()) { toast.error("Please provide a reason"); return; }
        setActionLoading(rejectTarget.id);
        try {
            await rejectDocument(rejectTarget.propertyId, rejectTarget.docType, rejectReason);
            toast.success("Document rejected & owner notified"); setRejectTarget(null); setRejectReason(""); fetchData();
        } catch { toast.error("Rejection failed"); }
        finally { setActionLoading(null); }
    };

    const propertiesList = useMemo(() => {
        return Array.from(new Set(data?.queue.map(a => a.propertyName).filter(Boolean))) as string[];
    }, [data?.queue]);

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

    const filteredQueue = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        return (data?.queue || []).filter(item => {
            // Text Search
            if (q) {
                const haystack = [
                    item.propertyName,
                    item.propertyDisplayId,
                    item.owner?.name,
                    item.owner?.email,
                    item.city
                ].join(' ').toLowerCase();
                if (!haystack.includes(q)) return false;
            }

            // Property Filter
            if (selectedProperty !== 'ALL' && item.propertyName !== selectedProperty) return false;
            
            // Date Filter
            if (item.submittedAt) {
                const date = new Date(item.submittedAt);
                const itemFY = getFYFromDate(date).toString();
                const itemMonth = (date.getMonth() + 1).toString().padStart(2, '0');
                if (itemFY !== selectedYear) return false;
                if (selectedMonth !== 'ALL' && itemMonth !== selectedMonth) return false;
            }
            return true;
        });
    }, [data?.queue, selectedProperty, selectedYear, selectedMonth, searchQuery]);


    return (
        <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 min-h-screen pb-20">
            {/* Header matching AdminAgreementsContainer styling for white pill dropdowns */}
            <div className="bg-gradient-to-r from-[#3b5bdb] to-[#7048e8] px-4 pt-8 md:pt-10 pb-20 relative overflow-hidden">
                <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -left-10 bottom-0 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                <div className="max-w-7xl mx-auto relative z-10 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <ShieldCheck className="w-5 h-5 text-purple-200" />
                            <span className="text-purple-200 text-xs font-black uppercase tracking-widest">Admin · Operations</span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Property Owners KYC</h1>
                        <p className="text-purple-200 text-sm font-medium mt-1">
                            Manage KYC document verifications for property owners
                        </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-end gap-4 shrink-0 mt-4 lg:mt-0 w-full lg:w-auto">
                        {/* Dropdown Filters with White Pill Styling */}
                        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/80 mb-1 ml-3">SELECT PROPERTY</span>
                                <select
                                    value={selectedProperty}
                                    onChange={(e) => setSelectedProperty(e.target.value)}
                                    className="appearance-none bg-white text-indigo-950 rounded-full px-5 py-2.5 pr-10 text-sm font-black focus:outline-none transition-all cursor-pointer relative shadow-lg shadow-indigo-900/20"
                                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%231e1b4b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'3\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                                >
                                    <option value="ALL">All Properties</option>
                                    {propertiesList.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/80 mb-1 ml-3">SELECT YEAR</span>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => {
                                        setSelectedYear(e.target.value);
                                        setSelectedMonth('ALL');
                                    }}
                                    className="appearance-none bg-white text-indigo-950 rounded-full px-5 py-2.5 pr-10 text-sm font-black focus:outline-none transition-all cursor-pointer relative shadow-lg shadow-indigo-900/20"
                                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%231e1b4b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'3\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                                >
                                    {yearOptions.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/80 mb-1 ml-3">SELECT MONTH</span>
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="appearance-none bg-white text-indigo-950 rounded-full px-5 py-2.5 pr-10 text-sm font-black focus:outline-none transition-all cursor-pointer relative shadow-lg shadow-indigo-900/20"
                                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%231e1b4b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'3\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                                >
                                    {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 -mt-12 relative z-10 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: "⏳ Pending", value: data?.stats.pending ?? "—", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
                        { label: "✅ Verified", value: data?.stats.verified ?? "—", color: "text-green-600", bg: "bg-green-50 border-green-200" },
                        { label: "📋 Total", value: data?.stats.total ?? "—", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
                        { label: "🔁 Queue", value: loading ? "..." : "LIVE", color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
                    ].map(card => (
                        <Card key={card.label} className={`border bg-white/70 backdrop-blur-xl ${card.color}`}><CardContent className="p-4">
                            <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
                            <p className="text-xs text-muted-foreground font-semibold mt-1">{card.label}</p>
                        </CardContent></Card>
                    ))}
                </div>

                <div className="bg-white/70 backdrop-blur-xl border border-purple-100 shadow-lg rounded-2xl p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search by property, owner name..."
                                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 bg-white/80"
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar sm:pb-0 items-center">
                            {KYC_FILTER_TABS.map(tab => (
                                <button key={tab.key} onClick={() => setFilter(tab.key)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${filter === tab.key ? "bg-indigo-600 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"}`}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="grid gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-100/50 backdrop-blur-xl rounded-xl animate-pulse" />)}</div>
                ) : filteredQueue.length === 0 ? (
                    <div className="py-20 text-center border-2 border-dashed bg-white/50 backdrop-blur-md border-slate-200 rounded-xl">
                        <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
                        <p className="font-bold text-slate-700">All clear! No documents in this filter.</p>
                    </div>
                ) : (
                    <>
                        <div className="md:hidden space-y-3">
                            {filteredQueue.map(item => (
                                <Card key={item.id} className={`border-l-4 bg-white/80 backdrop-blur-md ${item.isVerified ? "border-l-green-400" : "border-l-amber-400"}`}>
                                    <CardContent className="p-4 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div><p className="font-bold text-sm text-slate-900 truncate max-w-[180px]">{item.propertyName}</p>
                                                <p className="text-xs text-muted-foreground">{item.city} · {item.propertyDisplayId}</p></div>
                                            <Badge className={item.isVerified ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>{item.isVerified ? "Verified" : "Pending"}</Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-600">
                                            <FileCheck className="h-3.5 w-3.5" /><span className="font-semibold">{item.docLabel}</span>
                                            <span>·</span><User className="h-3.5 w-3.5" /><span className="truncate">{item.owner?.name || "Owner"}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setViewerDoc(item)}><Eye className="h-3.5 w-3.5 mr-1" />View</Button>
                                            {!item.isVerified && (<>
                                                <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-xs" disabled={actionLoading === item.id} onClick={() => handleVerify(item)}><CheckCircle className="h-3.5 w-3.5 mr-1" />Verify</Button>
                                                <Button size="sm" variant="destructive" className="flex-1 text-xs" onClick={() => setRejectTarget(item)}><XCircle className="h-3.5 w-3.5 mr-1" />Reject</Button>
                                            </>)}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                        <div className="hidden md:block bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50/80 border-b">
                                    <tr>{["Property", "Owner", "Document", "City", "Status", "Submitted", "Actions"].map(h => (
                                        <th key={h} className="text-left px-4 py-3 text-xs font-black uppercase text-slate-500">{h}</th>
                                    ))}</tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredQueue.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-3"><p className="font-semibold text-slate-900 truncate max-w-[160px]">{item.propertyName}</p><p className="text-xs text-muted-foreground">{item.propertyDisplayId}</p></td>
                                            <td className="px-4 py-3"><p className="font-medium">{item.owner?.name || "—"}</p><p className="text-xs text-muted-foreground">{item.owner?.email}</p></td>
                                            <td className="px-4 py-3"><span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">{item.docLabel}</span></td>
                                            <td className="px-4 py-3 text-slate-600">{item.city}</td>
                                            <td className="px-4 py-3"><Badge className={item.isVerified ? "bg-green-100 text-green-800 border-0" : "bg-amber-100 text-amber-800 border-0"}>{item.isVerified ? "✅ Verified" : "⏳ Pending"}</Badge></td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{new Date(item.submittedAt).toLocaleDateString('en-IN')}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => setViewerDoc(item)}><Eye className="h-3.5 w-3.5" /></Button>
                                                    {!item.isVerified && (<>
                                                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs" disabled={actionLoading === item.id} onClick={() => handleVerify(item)}>✅ Verify</Button>
                                                        <Button size="sm" variant="destructive" className="text-xs" onClick={() => setRejectTarget(item)}>❌ Reject</Button>
                                                    </>)}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {viewerDoc && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-0 md:p-6" onClick={() => setViewerDoc(null)}>
                    <div className="bg-white w-full h-full md:h-auto md:max-w-3xl md:rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b bg-slate-50">
                            <div><h3 className="font-black text-slate-900">{viewerDoc.docLabel}</h3><p className="text-xs text-muted-foreground">{viewerDoc.propertyName}</p></div>
                            <button onClick={() => setViewerDoc(null)} className="p-2 rounded-full hover:bg-slate-200"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100 min-h-[300px]">
                            {viewerDoc.docUrl.match(/\.(jpg|jpeg|png|webp|gif)/i) ? (
                                <img src={viewerDoc.docUrl} alt={viewerDoc.docLabel} className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg" />
                            ) : (
                                <div className="text-center space-y-3"><FileCheck className="h-16 w-16 text-indigo-400 mx-auto" />
                                    <a href={viewerDoc.docUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold underline flex items-center gap-2 justify-center"><ZoomIn className="h-4 w-4" />Open Document</a>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t bg-white flex flex-col sm:flex-row gap-3">
                            {!viewerDoc.isVerified ? (<>
                                <Button className="flex-1 bg-green-600 hover:bg-green-700" disabled={actionLoading === viewerDoc.id} onClick={() => { handleVerify(viewerDoc); setViewerDoc(null); }}><CheckCircle className="h-4 w-4 mr-2" />Approve</Button>
                                <Button variant="destructive" className="flex-1" onClick={() => { setRejectTarget(viewerDoc); setViewerDoc(null); }}><XCircle className="h-4 w-4 mr-2" />Reject</Button>
                            </>) : (<div className="flex-1 flex items-center gap-2 text-green-700 font-bold"><CheckCircle className="h-5 w-5" />Verified</div>)}
                        </div>
                    </div>
                </div>
            )}

            {rejectTarget && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-6">
                    <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 space-y-4">
                        <h3 className="font-black text-lg text-slate-900 flex items-center gap-2"><XCircle className="h-5 w-5 text-red-500" />Reject Document</h3>
                        <p className="text-sm text-muted-foreground">Rejecting <strong>{rejectTarget.docLabel}</strong> for <strong>{rejectTarget.propertyName}</strong>. Owner will be notified.</p>
                        <textarea className="w-full border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300" rows={3} placeholder="Reason for rejection..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>Cancel</Button>
                            <Button variant="destructive" className="flex-1" disabled={!rejectReason.trim() || actionLoading === rejectTarget.id} onClick={handleReject}>Reject & Notify Owner</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
