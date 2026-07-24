'use client';

import { useState, useEffect } from 'react';
import {
  Shield, ShieldCheck, ShieldAlert, CheckCircle2, XCircle, AlertTriangle,
  Building2, MapPin, CreditCard, FileText, User, Camera, RefreshCcw,
  Search, Eye, Clock, Check, X, AlertCircle, ChevronDown, ChevronUp,
  Loader2, Filter, Sparkles, MessageSquare, ArrowUpRight
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
  getPendingV2PropertiesForAdmin,
  reviewV2PropertyDomain,
  approveOrRejectV2Property
} from '@/actions/properties-v2';

// ─── Domain Review Categories ──────────────────────────────────────────────────

const DOMAINS: Array<{
  key: 'PROPERTY_DETAILS' | 'KYC' | 'BANK' | 'DOCUMENTS';
  label: string;
  icon: any;
  statusField: string;
}> = [
  { key: 'PROPERTY_DETAILS', label: 'Property & Location', icon: MapPin, statusField: 'propertyVerificationStatus' },
  { key: 'KYC', label: 'Owner Identity KYC', icon: User, statusField: 'kycVerificationStatus' },
  { key: 'BANK', label: 'Bank & Settlement', icon: CreditCard, statusField: 'bankVerificationStatus' },
  { key: 'DOCUMENTS', label: 'Ownership & Legal Docs', icon: FileText, statusField: 'docVerificationStatus' },
];

const RISK_BADGES: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  LOW: { label: 'LOW RISK', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: ShieldCheck },
  MEDIUM: { label: 'MEDIUM RISK', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: AlertTriangle },
  HIGH: { label: 'HIGH RISK', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: ShieldAlert },
};

const VERIFICATION_STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  VERIFIED: { label: 'Verified ✓', bg: 'bg-emerald-100', color: 'text-emerald-800' },
  REJECTED: { label: 'Rejected ✗', bg: 'bg-red-100', color: 'text-red-800' },
  NEEDS_RESUBMISSION: { label: 'Changes Requested', bg: 'bg-amber-100', color: 'text-amber-800' },
  PENDING: { label: 'Under Review', bg: 'bg-blue-100', color: 'text-blue-800' },
  NOT_SUBMITTED: { label: 'Not Submitted', bg: 'bg-slate-100', color: 'text-slate-600' },
};

export default function AdminPropertyReviewsPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<any>(null);

  // Domain review modal state
  const [reviewDomain, setReviewDomain] = useState<{
    propertyId: string;
    category: 'PROPERTY_DETAILS' | 'KYC' | 'BANK' | 'DOCUMENTS';
    categoryLabel: string;
  } | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Overall decision modal state
  const [decisionModal, setDecisionModal] = useState<{
    propertyId: string;
    propertyName: string;
    displayId: string;
    action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';
  } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  const fetchProperties = async () => {
    setLoading(true);
    const res = await getPendingV2PropertiesForAdmin();
    if (res.success) {
      setProperties(res.properties || []);
    } else {
      toast.error(res.error || 'Failed to load properties');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleDomainReview = async (actionType: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES') => {
    if (!reviewDomain) return;
    setSubmittingReview(true);
    const res = await reviewV2PropertyDomain({
      propertyId: reviewDomain.propertyId,
      category: reviewDomain.category,
      actionType,
      notes: reviewNotes,
    });
    setSubmittingReview(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(`Domain ${reviewDomain.categoryLabel} ${actionType.toLowerCase()}d!`);
      setReviewDomain(null);
      setReviewNotes('');
      await fetchProperties();
    }
  };

  const handleOverallDecision = async () => {
    if (!decisionModal) return;
    
    if (
      (decisionModal.action === 'REJECT' || decisionModal.action === 'REQUEST_CHANGES') &&
      !decisionReason.trim()
    ) {
      toast.error('Please provide a mandatory reason for this decision.');
      return;
    }
    
    setSubmittingDecision(true);

    const res = await approveOrRejectV2Property({
      propertyId: decisionModal.propertyId,
      action: decisionModal.action,
      rejectionReason: decisionReason,
    });

    setSubmittingDecision(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(
        `Property ${decisionModal.displayId} ${
          decisionModal.action === 'APPROVE' ? 'APPROVED! Listed Live' : 'REJECTED'
        }`
      );
      setDecisionModal(null);
      setDecisionReason('');
      await fetchProperties();
    }
  };

  const filteredProperties = properties.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.displayId?.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q) ||
      p.owner?.name?.toLowerCase().includes(q) ||
      p.owner?.phone?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-violet-600" />
            <h1 className="text-2xl font-black text-slate-900">V2 Property Review Queue</h1>
          </div>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Granular 5-Domain Verification & Automated Fraud Risk Scoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchProperties} className="font-bold border-2">
            <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <Card className="border-none shadow-md bg-white rounded-2xl">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by property ID, name, city, owner..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-50 border-slate-200 rounded-xl text-sm font-medium"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <span>Pending Review:</span>
            <span className="bg-violet-100 text-violet-700 px-2.5 py-0.5 rounded-full font-black">
              {properties.length} Properties
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Property Review List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      ) : filteredProperties.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
          <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-black text-slate-700">Queue Clean! No Pending Reviews</h3>
          <p className="text-slate-400 text-sm mt-1">All V2 properties have been verified or resolved.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredProperties.map((prop) => {
            const riskConfig = RISK_BADGES[prop.fraudRiskScore || 'LOW'] || RISK_BADGES.LOW;
            const RiskIcon = riskConfig.icon;

            return (
              <Card
                key={prop.id}
                className="border-none shadow-xl shadow-violet-100/50 rounded-3xl overflow-hidden bg-white hover:shadow-2xl transition-all"
              >
                {/* Property Card Header */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-black text-lg shrink-0">
                      <Building2 className="h-6 w-6 text-violet-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-lg">{prop.name}</span>
                        <span className="text-xs font-mono font-bold bg-violet-500/30 px-2 py-0.5 rounded border border-violet-400/30">
                          {prop.displayId}
                        </span>
                        <span className="text-xs font-bold bg-white/10 px-2 py-0.5 rounded text-slate-300">
                          {prop.propertyType} · {prop.genderType}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-medium mt-1 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-violet-400" />
                        {prop.address}, {prop.city} {prop.pincode ? `(${prop.pincode})` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Owner & Risk Score Badges */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 text-right">
                      <p className="text-[10px] font-black uppercase text-violet-300">Owner</p>
                      <p className="text-xs font-bold text-white mt-0.5">{prop.owner?.name || '—'}</p>
                      <p className="text-[10px] font-mono text-slate-300">{prop.owner?.phone || prop.owner?.email}</p>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border ${riskConfig.bg} ${riskConfig.color} font-black text-xs shadow-sm`}
                    >
                      <RiskIcon className="h-4 w-4" />
                      {riskConfig.label}
                    </div>
                  </div>
                </div>

                <CardContent className="p-6 space-y-6">
                  {/* Completeness Score Bar */}
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex-1">
                      <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                        <span className="text-slate-600 uppercase tracking-wider font-black">Listing Completeness</span>
                        <span className="text-violet-700 font-black">{prop.completenessScore || 0}%</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-violet-500 to-indigo-600 rounded-full"
                          style={{ width: `${prop.completenessScore || 0}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right border-l pl-4 border-slate-200">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Configured Rooms</p>
                      <p className="text-sm font-black text-slate-800">{prop.rooms?.length || 0} Room Types</p>
                    </div>
                  </div>

                  {/* 4-Domain Verification Matrix */}
                  <div>
                    <p className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">
                      Domain Verification Checklist
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {DOMAINS.map((domain) => {
                        const statusVal = prop[domain.statusField] || 'NOT_SUBMITTED';
                        const cfg = VERIFICATION_STATUS_CONFIG[statusVal] || VERIFICATION_STATUS_CONFIG.NOT_SUBMITTED;
                        const DomainIcon = domain.icon;

                        return (
                          <div
                            key={domain.key}
                            className="border-2 border-slate-100 rounded-2xl p-4 space-y-3 bg-white hover:border-violet-200 transition-all flex flex-col justify-between"
                          >
                            <div className="flex items-center justify-between">
                              <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
                                <DomainIcon className="h-4 w-4 text-violet-600" />
                              </div>
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}
                              >
                                {cfg.label}
                              </span>
                            </div>

                            <div>
                              <p className="text-xs font-black text-slate-800">{domain.label}</p>
                              {domain.key === 'KYC' && (
                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                  {prop.kycDocuments?.length || 0} KYC docs uploaded
                                </p>
                              )}
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setReviewDomain({
                                  propertyId: prop.id,
                                  category: domain.key,
                                  categoryLabel: domain.label,
                                })
                              }
                              className="w-full text-xs font-bold border-violet-200 text-violet-700 hover:bg-violet-50 rounded-xl"
                            >
                              Review Domain →
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Audit Trail & History */}
                  {prop.reviews && prop.reviews.length > 0 && (
                    <div className="border-t pt-4">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                        Audit Review History ({prop.reviews.length})
                      </p>
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-2">
                        {prop.reviews.map((rev: any) => (
                          <div
                            key={rev.id}
                            className="bg-slate-50 rounded-xl p-2.5 text-xs flex items-start justify-between gap-2 border border-slate-100"
                          >
                            <div>
                              <span className="font-black text-slate-700">{rev.adminName}</span>
                              <span className="text-slate-400"> reviewed </span>
                              <span className="font-bold text-violet-700">{rev.reviewCategory}</span>
                              <span className="text-slate-500 font-medium"> → {rev.actionType}</span>
                              {rev.notes && <p className="text-slate-600 font-medium mt-0.5">"{rev.notes}"</p>}
                            </div>
                            <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                              {new Date(rev.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="border-t pt-4 flex flex-col sm:flex-row items-center justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setDecisionModal({
                          propertyId: prop.id,
                          propertyName: prop.name,
                          displayId: prop.displayId,
                          action: 'REQUEST_CHANGES',
                        })
                      }
                      className="w-full sm:w-auto border-amber-300 text-amber-700 hover:bg-amber-50 font-bold rounded-2xl h-11"
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" /> Request Revisions
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() =>
                        setDecisionModal({
                          propertyId: prop.id,
                          propertyName: prop.name,
                          displayId: prop.displayId,
                          action: 'REJECT',
                        })
                      }
                      className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50 font-bold rounded-2xl h-11"
                    >
                      <XCircle className="h-4 w-4 mr-2" /> Reject Property
                    </Button>

                    <Button
                      onClick={() =>
                        setDecisionModal({
                          propertyId: prop.id,
                          propertyName: prop.name,
                          displayId: prop.displayId,
                          action: 'APPROVE',
                        })
                      }
                      className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-2xl h-11 shadow-lg shadow-emerald-200 px-6"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Approve & Go Live
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Domain Review Modal ── */}
      {reviewDomain && (
        <Dialog open={!!reviewDomain} onOpenChange={() => setReviewDomain(null)}>
          <DialogContent className="rounded-3xl max-w-md">
            <DialogHeader>
              <DialogTitle className="font-black text-lg text-slate-900">
                Review {reviewDomain.categoryLabel}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-medium">
                Record your decision for this domain. Updates the property's verification status and audit log.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-black text-slate-600 uppercase tracking-wider block mb-1">
                  Verifier Notes / Feedback
                </label>
                <Textarea
                  placeholder="Provide explicit reasons if rejecting or requesting changes..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  className="rounded-xl border-2 border-slate-200 text-sm font-medium focus:border-violet-400"
                />
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => handleDomainReview('REJECT')}
                disabled={submittingReview}
                className="flex-1 border-red-200 text-red-600 hover:bg-red-50 font-bold rounded-xl"
              >
                Reject Domain
              </Button>
              <Button
                onClick={() => handleDomainReview('APPROVE')}
                disabled={submittingReview}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
              >
                {submittingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve Domain'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Overall Approve / Reject Modal ── */}
      {decisionModal && (
        <Dialog open={!!decisionModal} onOpenChange={() => setDecisionModal(null)}>
          <DialogContent className="rounded-3xl max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-black text-xl text-slate-900">
                {decisionModal.action === 'APPROVE'
                  ? 'Approve Property & Go Live'
                  : decisionModal.action === 'REJECT'
                  ? 'Reject Property Submission'
                  : 'Request Revisions'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-medium">
                {decisionModal.propertyName} ({decisionModal.displayId})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {decisionModal.action === 'APPROVE' ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex gap-3 text-sm text-emerald-800">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-black">Ready to Publish</p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Approving will publish this listing LIVE on RentPe platform. The owner will be notified immediately.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-black text-slate-600 uppercase tracking-wider block mb-1">
                    Reason for {decisionModal.action === 'REJECT' ? 'Rejection' : 'Revisions'} *
                  </label>
                  <Textarea
                    placeholder="Describe what needs correction or why the listing was rejected..."
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                    rows={4}
                    className="rounded-xl border-2 border-slate-200 text-sm font-medium focus:border-violet-400"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDecisionModal(null)} className="rounded-xl font-bold">
                Cancel
              </Button>
              <Button
                onClick={handleOverallDecision}
                disabled={submittingDecision}
                className={`font-black rounded-xl text-white ${
                  decisionModal.action === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : decisionModal.action === 'REJECT'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {submittingDecision ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  'Confirm & Send Notification'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
