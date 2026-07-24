'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck, Upload, CheckCircle2, Clock, AlertCircle, X, Eye,
  FileText, CreditCard, Home, Loader2, RefreshCcw, Info, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getMyKycDocuments, uploadOwnerKycDocument } from '@/actions/kyc';

// ─── Types ────────────────────────────────────────────────────────────────────

type DocType = 'PAN' | 'AADHAAR' | 'ADDRESS_PROOF' | 'CANCELLED_CHEQUE' | 'GST_CERT' | 'PG_LICENSE' | 'OTHER';

interface KycDocument {
  id: string;
  displayId: string;
  docType: string;
  status: string;
  version: number;
  uploadedAt: string;
  rejectedReason?: string | null;
  fileName?: string | null;
}

const DOC_DEFINITIONS: Array<{
  type: DocType;
  label: string;
  description: string;
  icon: any;
  required: boolean;
  hint: string;
}> = [
  {
    type: 'PAN', label: 'PAN Card', required: true,
    description: 'Upload a clear photo of your PAN Card (both sides)',
    icon: CreditCard,
    hint: 'PAN is mandatory for tax compliance under Income Tax Act.',
  },
  {
    type: 'AADHAAR', label: 'Aadhaar Card', required: true,
    description: 'Upload front and back of your Aadhaar (mask first 8 digits)',
    icon: ShieldCheck,
    hint: 'Store only the last 4 digits visible per UIDAI guidelines. We handle masking automatically.',
  },
  {
    type: 'ADDRESS_PROOF', label: 'Address Proof', required: true,
    description: 'Any of: Electricity Bill, Water Bill, Property Tax, Rent Agreement, Sale Deed',
    icon: Home,
    hint: 'Document must be in your name and show your property address.',
  },
  {
    type: 'CANCELLED_CHEQUE', label: 'Cancelled Cheque', required: true,
    description: 'Upload a cancelled cheque from your bank account for payout setup',
    icon: FileText,
    hint: 'IFSC and account number must be clearly visible.',
  },
  {
    type: 'GST_CERT', label: 'GST Certificate', required: false,
    description: 'Upload your GST Registration Certificate if applicable',
    icon: FileText,
    hint: 'Required only if your annual rental income exceeds ₹20 lakhs.',
  },
  {
    type: 'PG_LICENSE', label: 'PG / Hostel Licence', required: false,
    description: 'Municipal corporation / local authority PG licence',
    icon: ShieldCheck,
    hint: 'Required for PG and Hostel properties as per local regulations.',
  },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  PENDING:              { label: 'Under Review',       color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',   icon: Clock },
  VERIFIED:             { label: 'Verified ✓',          color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  REJECTED:             { label: 'Rejected',            color: 'text-red-700',     bg: 'bg-red-50 border-red-200',       icon: AlertCircle },
  NEEDS_RESUBMISSION:   { label: 'Re-upload Required', color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200', icon: RefreshCcw },
  NOT_UPLOADED:         { label: 'Not Uploaded',        color: 'text-slate-500',   bg: 'bg-slate-50 border-slate-200',   icon: Upload },
};

// ─── Main KYC Page ────────────────────────────────────────────────────────────

export default function OwnerKycPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const fetchDocs = async () => {
    setLoading(true);
    const res = await getMyKycDocuments();
    if (res.success) setDocuments((res.documents as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, []);

  const getDocForType = (type: string) =>
    documents.find(d => d.docType === type);

  const handleUpload = async (type: DocType, file: File) => {
    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum 5MB allowed.');
      return;
    }

    // Read file as base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    setUploading(prev => ({ ...prev, [type]: true }));
    const toastId = toast.loading(`Uploading ${type}...`);

    const res = await uploadOwnerKycDocument({
      docType: type,
      fileBase64: base64,
      fileName: file.name,
      mimeType: file.type,
    });

    if (res.error) {
      toast.error(res.error, { id: toastId });
    } else {
      toast.success(`${type} uploaded successfully! Our team will review it shortly.`, { id: toastId });
      await fetchDocs();
    }
    setUploading(prev => ({ ...prev, [type]: false }));
  };

  // Calculate overall KYC completeness
  const requiredDocs = DOC_DEFINITIONS.filter(d => d.required);
  const verifiedRequired = requiredDocs.filter(d => getDocForType(d.type)?.status === 'VERIFIED').length;
  const uploadedRequired = requiredDocs.filter(d => !!getDocForType(d.type)).length;
  const kycPercent = Math.round((uploadedRequired / requiredDocs.length) * 100);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-violet-600" />
            KYC Documents
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            Upload your identity documents for verification. All files are encrypted and stored securely.
          </p>
        </div>
        <Button variant="outline" onClick={fetchDocs} size="sm" className="border-2 border-slate-200 font-bold">
          <RefreshCcw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* ── Overall Progress ── */}
      <Card className="border-none shadow-xl shadow-violet-100/40 overflow-hidden rounded-3xl">
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-violet-200">KYC Progress</p>
              <p className="text-2xl font-black mt-1">{kycPercent}% Complete</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-violet-200 font-bold">{verifiedRequired}/{requiredDocs.length} Verified</p>
              <p className="text-xs text-violet-300 font-medium mt-0.5">{uploadedRequired} uploaded</p>
            </div>
          </div>
          <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-700"
              style={{ width: `${kycPercent}%` }} />
          </div>
        </div>

        <CardContent className="p-4 bg-gradient-to-br from-violet-50/50 to-white">
          <div className="flex items-start gap-2 text-sm text-slate-600 font-medium">
            <Info className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
            <span>
              KYC is required before your property can go LIVE. Documents are reviewed within 24 hours.
              All data is protected under the <strong>DPDP Act 2023</strong>.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Document Cards ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DOC_DEFINITIONS.map((def) => {
            const existing = getDocForType(def.type);
            const status = existing?.status || 'NOT_UPLOADED';
            const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.NOT_UPLOADED;
            const Icon = def.icon;
            const StatusIcon = statusCfg.icon;
            const isUploading = uploading[def.type];

            return (
              <div key={def.type}
                className={`rounded-2xl border-2 p-4 space-y-3 transition-all ${statusCfg.bg} ${status === 'VERIFIED' ? 'shadow-sm' : 'hover:shadow-md'}`}>
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                      ${status === 'VERIFIED' ? 'bg-emerald-100' : status === 'REJECTED' ? 'bg-red-100' : 'bg-white shadow-sm'}`}>
                      <Icon className={`h-5 w-5 ${status === 'VERIFIED' ? 'text-emerald-600' : status === 'REJECTED' ? 'text-red-600' : 'text-violet-600'}`} />
                    </div>
                    <div>
                      <p className="font-black text-sm text-slate-800">{def.label}</p>
                      {def.required ? (
                        <span className="text-[10px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded uppercase">Required</span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">Optional</span>
                      )}
                    </div>
                  </div>

                  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-black ${statusCfg.color} ${statusCfg.bg}`}>
                    <StatusIcon className="h-3 w-3" />
                    {statusCfg.label}
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 font-medium leading-relaxed">{def.description}</p>

                {/* Hint */}
                <div className="bg-white/60 rounded-lg p-2 text-[10px] text-slate-500 font-medium leading-relaxed border border-white">
                  💡 {def.hint}
                </div>

                {/* Existing doc info */}
                {existing && (
                  <div className="bg-white rounded-xl p-2.5 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {existing.displayId} · v{existing.version}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(existing.uploadedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                    {existing.fileName && (
                      <p className="text-[11px] text-slate-600 font-medium truncate">{existing.fileName}</p>
                    )}
                    {existing.rejectedReason && (
                      <div className="mt-1 p-2 bg-red-50 border border-red-100 rounded-lg">
                        <p className="text-[10px] font-black text-red-600">Rejection reason:</p>
                        <p className="text-[11px] text-red-700 font-medium mt-0.5">{existing.rejectedReason}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Upload Button */}
                {status !== 'VERIFIED' && (
                  <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-all font-black text-sm
                    ${isUploading
                      ? 'border-violet-300 bg-violet-50 text-violet-500 cursor-not-allowed'
                      : 'border-violet-400 hover:bg-violet-50 text-violet-700 hover:border-violet-600'}`}>
                    {isUploading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
                    ) : (
                      <><Upload className="h-4 w-4" /> {existing ? 'Re-upload' : 'Upload'} {def.label}</>
                    )}
                    {!isUploading && (
                      <input type="file" accept=".pdf,image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(def.type, f); e.target.value = ''; }}
                      />
                    )}
                  </label>
                )}

                {status === 'VERIFIED' && (
                  <div className="flex items-center gap-2 text-emerald-600 font-black text-sm justify-center py-2">
                    <CheckCircle2 className="h-4 w-4" /> Verified by RentPe Team
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Privacy Notice ── */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-3">
        <ShieldCheck className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-black text-slate-700">Your documents are protected</p>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            All documents are encrypted at rest (AES-256) and in transit (TLS 1.3).
            Under the DPDP Act 2023, you have the right to request deletion of your KYC documents at any time.
            Financial records (invoices, payments) are retained for 7 years as required by the Income Tax Act.
          </p>
        </div>
      </div>
    </div>
  );
}
