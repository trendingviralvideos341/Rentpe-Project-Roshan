'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAdminAgreements, getAgreementDownloadUrl } from '@/actions/agreements';
import type { AgreementRecord, AgreementStatus } from '@/actions/agreements';
import { toast } from 'sonner';
import {
  FileText,
  Download,
  Eye,
  Search,
  Filter,
  AlertTriangle,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  Users,
  FileSignature,
  BarChart3,
} from 'lucide-react';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const ALL_STATUSES: AgreementStatus[] = [
  'PENDING_TENANT_VERIFICATION',
  'TENANT_VERIFIED',
  'PENDING_COUNTER_SIGN',
  'SIGNER_VERIFIED',
  'AGREEMENT_READY_FOR_DOWNLOAD',
  'PENDING_SIGNED_UPLOAD',
  'AGREEMENT_COMPLETED',
  'TERMINATED',
];

const STATUS_FILTER_GROUPS: { label: string; value: string; statuses: AgreementStatus[] | 'all' }[] = [
  { label: 'All', value: 'all', statuses: 'all' },
  {
    label: 'Pending',
    value: 'pending',
    statuses: ['PENDING_TENANT_VERIFICATION', 'TENANT_VERIFIED', 'PENDING_COUNTER_SIGN', 'SIGNER_VERIFIED', 'AGREEMENT_READY_FOR_DOWNLOAD', 'PENDING_SIGNED_UPLOAD'],
  },
  { label: 'Completed', value: 'completed', statuses: ['AGREEMENT_COMPLETED'] },
  { label: 'Terminated', value: 'terminated', statuses: ['TERMINATED'] },
];

function getStatusBadge(status: AgreementStatus) {
  switch (status) {
    case 'PENDING_TENANT_VERIFICATION':
      return { label: 'Pending Tenant', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
    case 'TENANT_VERIFIED':
    case 'PENDING_COUNTER_SIGN':
      return { label: 'Awaiting Owner Sign', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };
    case 'SIGNER_VERIFIED':
      return { label: 'Processing PDF', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' };
    case 'AGREEMENT_READY_FOR_DOWNLOAD':
      return { label: 'Ready / Download', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' };
    case 'PENDING_SIGNED_UPLOAD':
      return { label: 'Signed Copy Needed', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
    case 'AGREEMENT_COMPLETED':
      return { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
    case 'TERMINATED':
      return { label: 'Terminated', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' };
    default:
      return { label: status, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' };
  }
}

function getStatusIcon(status: AgreementStatus) {
  if (status === 'AGREEMENT_COMPLETED') return <CheckCircle2 className="w-3.5 h-3.5" />;
  if (status === 'TERMINATED') return <XCircle className="w-3.5 h-3.5" />;
  return <Clock className="w-3.5 h-3.5" />;
}

// ─── SKELETON ─────────────────────────────────────────────────────────────────

function AdminSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-white/60 border border-purple-100 rounded-2xl" />
        ))}
      </div>
      {/* Filters */}
      <div className="h-14 bg-white/60 border border-purple-100 rounded-2xl" />
      {/* Table */}
      <div className="bg-white/60 border border-purple-100 rounded-2xl overflow-hidden">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-16 border-b border-purple-50 last:border-0 px-6 flex items-center gap-4">
            <div className="w-28 h-6 bg-slate-200 rounded-lg" />
            <div className="w-40 h-5 bg-slate-100 rounded-lg" />
            <div className="w-32 h-5 bg-slate-100 rounded-lg ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  count,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className={`bg-white/70 backdrop-blur-xl border rounded-2xl p-4 ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="p-2 bg-white/60 rounded-xl">{icon}</div>
        <span className="text-3xl font-black">{count}</span>
      </div>
      <p className="text-sm font-bold opacity-80">{label}</p>
    </div>
  );
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="bg-white/70 backdrop-blur-xl border border-purple-100 shadow-xl rounded-2xl p-16 text-center">
      <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
        <FileText className="w-10 h-10 text-purple-400" />
      </div>
      <h2 className="font-black text-slate-700 text-xl">
        {filtered ? 'No Agreements Match' : 'No Agreements Yet'}
      </h2>
      <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">
        {filtered
          ? 'Try adjusting your filters or search query.'
          : 'Platform agreements will appear here once tenancies begin.'}
      </p>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function AdminAgreementsPage() {
  const [agreements, setAgreements] = useState<AgreementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadAgreements = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await getAdminAgreements();
      setAgreements(data);
    } catch (e: any) {
      const msg = e.message || 'Failed to load agreements.';
      setError(msg);
      if (!silent) toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAgreements();
  }, []);

  // Computed stats
  const stats = useMemo(() => ({
    total: agreements.length,
    pending: agreements.filter(a => !['AGREEMENT_COMPLETED', 'TERMINATED'].includes(a.status)).length,
    completed: agreements.filter(a => a.status === 'AGREEMENT_COMPLETED').length,
    terminated: agreements.filter(a => a.status === 'TERMINATED').length,
  }), [agreements]);

  // Filtered agreements
  const filtered = useMemo(() => {
    const filterGroup = STATUS_FILTER_GROUPS.find(g => g.value === statusFilter);
    const q = searchQuery.toLowerCase().trim();

    return agreements.filter(a => {
      // Status filter
      if (filterGroup && filterGroup.statuses !== 'all') {
        if (!filterGroup.statuses.includes(a.status)) return false;
      }
      // Search
      if (q) {
        const haystack = [
          a.displayId,
          a.tenantName,
          a.tenantDisplayId,
          a.ownerName,
          a.ownerDisplayId,
          a.propertyName,
          a.bookingDisplayId,
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [agreements, statusFilter, searchQuery]);

  const handleOpenPdf = async (agreementId: string, mode: 'view' | 'download') => {
    setDownloadingId(agreementId);
    try {
      const url = await getAgreementDownloadUrl(agreementId);
      window.open(url, '_blank');
    } catch (e: any) {
      toast.error(e.message || 'Could not retrieve agreement PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleExport = () => {
    const rows = filtered.map((a: any) => ({
      'Agreement ID': a.displayId,
      'Booking ID': a.bookingDisplayId || a.booking?.displayId || '',
      'Tenant Name': a.tenantName || a.tenant?.name || '',
      'Tenant Email': a.tenant?.email || '',
      'Tenant Phone': a.tenant?.phone || '',
      'Owner Name': a.ownerName || a.owner?.name || '',
      'Property': a.propertyName || a.property?.name || '',
      'City': a.property?.city || '',
      'Monthly Rent (Rs.)': a.monthlyRent,
      'Security Deposit (Rs.)': a.securityDeposit,
      'Status': a.status,
      'Created Date': new Date(a.createdAt).toLocaleDateString('en-IN'),
      'Tenant Verified': a.tenantVerified ? 'Yes' : 'No',
      'Signer Verified': a.signerVerified ? 'Yes' : 'No',
      'Signer Type': a.signerType || '',
      'PDF Generated': a.agreementPdfUrl ? 'Yes' : 'No',
      'Signed PDF Uploaded': a.signedPdfUrl ? 'Yes' : 'No',
      'Completed': a.status === 'AGREEMENT_COMPLETED' ? 'Yes' : 'No',
    }));
    if (rows.length === 0) { toast.error('No agreements to export.'); return; }
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String((r as any)[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RentPe-Agreements-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} agreements to CSV.`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-[#3b5bdb] to-[#7048e8] px-4 pt-10 pb-20 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 bottom-0 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-5 h-5 text-purple-200" />
              <span className="text-purple-200 text-xs font-black uppercase tracking-widest">Admin · Platform</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">All Agreements</h1>
            <p className="text-purple-200 text-sm font-medium mt-1">
              Monitor and manage all tenancy agreements across the platform
            </p>
          </div>
          <button
            onClick={() => loadAgreements(true)}
            disabled={refreshing}
            className="shrink-0 flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white font-black text-sm rounded-xl transition-all disabled:opacity-60 mt-6"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-4 -mt-12 relative z-10 space-y-5">
        {loading ? (
          <AdminSkeleton />
        ) : error ? (
          <div className="bg-white/70 backdrop-blur-xl border border-red-100 shadow-xl rounded-2xl p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="font-black text-red-700">{error}</p>
            <button
              onClick={() => loadAgreements()}
              className="mt-4 px-6 py-2 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 transition-all text-sm"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* ── Stats Row ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={<FileSignature className="w-4 h-4 text-purple-600" />}
                label="Total Agreements"
                count={stats.total}
                color="border-purple-200 text-purple-800"
              />
              <StatCard
                icon={<Clock className="w-4 h-4 text-amber-600" />}
                label="Pending"
                count={stats.pending}
                color="border-amber-200 text-amber-800"
              />
              <StatCard
                icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                label="Completed"
                count={stats.completed}
                color="border-emerald-200 text-emerald-800"
              />
              <StatCard
                icon={<XCircle className="w-4 h-4 text-red-500" />}
                label="Terminated"
                count={stats.terminated}
                color="border-red-200 text-red-700"
              />
            </div>

            {/* ── Filters Bar ── */}
            <div className="bg-white/70 backdrop-blur-xl border border-purple-100 shadow-lg rounded-2xl p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by Agreement ID, tenant name, owner..."
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 bg-white/80"
                  />
                </div>

                {/* Status Filter */}
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="pl-9 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 bg-white/80 appearance-none cursor-pointer"
                  >
                    {STATUS_FILTER_GROUPS.map(g => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </div>

                {/* Export Button */}
                <button
                  onClick={handleExport}
                  className="px-4 py-2.5 bg-gradient-to-r from-[#3b5bdb] to-[#7048e8] text-white font-black rounded-xl text-sm hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-purple-200"
                >
                  📊 Export CSV
                </button>
              </div>

              {/* Result count */}
              <p className="text-[11px] text-slate-400 font-medium mt-2 ml-1">
                Showing <span className="font-black text-slate-600">{filtered.length}</span> of{' '}
                <span className="font-black text-slate-600">{agreements.length}</span> agreements
              </p>
            </div>

            {filtered.length === 0 ? (
              <EmptyState filtered={searchQuery !== '' || statusFilter !== 'all'} />
            ) : (
              <>
                {/* ── Mobile Cards ── */}
                <div className="md:hidden space-y-4">
                  {filtered.map(agreement => {
                    const badge = getStatusBadge(agreement.status);
                    const isThisDownloading = downloadingId === agreement.id;
                    return (
                      <div
                        key={agreement.id}
                        className="bg-white/70 backdrop-blur-xl border border-purple-100 shadow-lg rounded-2xl overflow-hidden"
                      >
                        <div className="h-1 bg-gradient-to-r from-[#3b5bdb] to-[#7048e8]" />
                        <div className="p-4 space-y-3">
                          {/* Top */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-mono text-xs font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg">
                                {agreement.displayId}
                              </span>
                              <p className="text-[10px] text-slate-400 mt-1">
                                {new Date(agreement.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                            <span className={`inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full border ${badge.color} ${badge.bg} ${badge.border}`}>
                              {getStatusIcon(agreement.status)} {badge.label}
                            </span>
                          </div>

                          {/* People */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-50 rounded-xl p-2.5">
                              <p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                                <Users className="w-3 h-3" /> Tenant
                              </p>
                              <p className="font-black text-slate-900 text-sm truncate">{agreement.tenantName}</p>
                              <p className="text-xs text-slate-500 font-mono truncate">{agreement.tenantDisplayId}</p>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-2.5">
                              <p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                                <Building2 className="w-3 h-3" /> Owner
                              </p>
                              <p className="font-black text-slate-900 text-sm truncate">{agreement.ownerName}</p>
                              <p className="text-xs text-slate-500 font-mono truncate">{agreement.ownerDisplayId}</p>
                            </div>
                          </div>

                          {/* Property + Rent */}
                          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                            <div>
                              <p className="font-bold text-slate-800 text-sm">{agreement.propertyName}</p>
                              <p className="text-xs text-slate-500">Room {agreement.roomNumber}</p>
                            </div>
                            <p className="font-black text-slate-900">Rs. {agreement.monthlyRent.toLocaleString('en-IN')}</p>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleOpenPdf(agreement.id, 'view')}
                              disabled={isThisDownloading}
                              className="flex-1 py-2.5 border-2 border-indigo-200 text-indigo-700 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 hover:bg-indigo-50 transition-all disabled:opacity-60"
                            >
                              {isThisDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                              View PDF
                            </button>
                            <button
                              onClick={() => handleOpenPdf(agreement.id, 'download')}
                              disabled={isThisDownloading}
                              className="flex-1 py-2.5 border-2 border-slate-200 text-slate-700 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-all disabled:opacity-60"
                            >
                              {isThisDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                              Download
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Desktop Table ── */}
                <div className="hidden md:block bg-white/70 backdrop-blur-xl border border-purple-100 shadow-xl rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-purple-100 flex items-center gap-3">
                    <FileText className="w-5 h-5 text-purple-600" />
                    <h2 className="font-black text-slate-900">Agreement Registry</h2>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 font-black text-xs rounded-full">
                      {filtered.length}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-purple-100">
                          {['Agreement ID', 'Tenant', 'Owner', 'Property', 'Status', 'Created', 'Actions'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(agreement => {
                          const badge = getStatusBadge(agreement.status);
                          const isThisDownloading = downloadingId === agreement.id;
                          return (
                            <tr
                              key={agreement.id}
                              className="hover:bg-purple-50/30 transition-colors border-b border-purple-100/50 last:border-0"
                            >
                              {/* Agreement ID */}
                              <td className="px-4 py-3">
                                <span className="font-mono text-xs font-black text-purple-700 bg-purple-50 px-2 py-1 rounded-lg">
                                  {agreement.displayId}
                                </span>
                              </td>

                              {/* Tenant */}
                              <td className="px-4 py-3">
                                <p className="font-black text-slate-900 text-sm">{agreement.tenantName}</p>
                                <p className="text-xs text-slate-400 font-mono">{agreement.tenantDisplayId}</p>
                              </td>

                              {/* Owner */}
                              <td className="px-4 py-3">
                                <p className="font-black text-slate-900 text-sm">{agreement.ownerName}</p>
                                <p className="text-xs text-slate-400 font-mono">{agreement.ownerDisplayId}</p>
                              </td>

                              {/* Property */}
                              <td className="px-4 py-3">
                                <p className="font-bold text-slate-800 text-sm">{agreement.propertyName}</p>
                                <p className="text-xs text-slate-500">Room {agreement.roomNumber}</p>
                                <p className="text-xs text-slate-400">
                                  Rs. {agreement.monthlyRent.toLocaleString('en-IN')}/mo
                                </p>
                              </td>

                              {/* Status */}
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-full border ${badge.color} ${badge.bg} ${badge.border}`}>
                                  {getStatusIcon(agreement.status)} {badge.label}
                                </span>
                              </td>

                              {/* Created Date */}
                              <td className="px-4 py-3">
                                <p className="text-sm text-slate-700 font-bold whitespace-nowrap">
                                  {new Date(agreement.createdAt).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {new Date(agreement.createdAt).toLocaleTimeString('en-IN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </td>

                              {/* Actions */}
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleOpenPdf(agreement.id, 'view')}
                                    disabled={isThisDownloading}
                                    title="View PDF"
                                    className="p-2 border border-indigo-200 text-indigo-700 rounded-xl hover:bg-indigo-50 transition-all disabled:opacity-60 flex items-center gap-1 text-xs font-black"
                                  >
                                    {isThisDownloading
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : <Eye className="w-3.5 h-3.5" />
                                    }
                                    View PDF
                                  </button>
                                  <button
                                    onClick={() => handleOpenPdf(agreement.id, 'download')}
                                    disabled={isThisDownloading}
                                    title="Download PDF"
                                    className="p-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-60 flex items-center gap-1 text-xs font-black"
                                  >
                                    {isThisDownloading
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : <Download className="w-3.5 h-3.5" />
                                    }
                                    Download
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer */}
                  <div className="px-6 py-3 border-t border-purple-100 bg-slate-50/50">
                    <p className="text-xs text-slate-400 font-medium">
                      Total <span className="font-black text-slate-600">{filtered.length}</span> agreements
                      {statusFilter !== 'all' || searchQuery ? ' (filtered)' : ' on platform'}
                      {' '}· Last refreshed {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
