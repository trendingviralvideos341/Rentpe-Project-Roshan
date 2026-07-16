'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  getOwnerAgreements,
  sendSignerAgreementOTP,
  verifySignerAgreementOTP,
  uploadSignedAgreement,
  getAgreementDownloadUrl,
  terminateAgreement,
} from '@/actions/agreements';
import { getProperties } from '@/actions/properties';
import type { AgreementRecord, AgreementStatus } from '@/actions/agreements';
import { toast } from 'sonner';
import {
  FileText,
  Download,
  Upload,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  X,
  Eye,
  ShieldCheck,
  Send,
  FileSignature,
  Users,
  Building2,
  RefreshCw,
  Paperclip,
} from 'lucide-react';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getStatusBadge(status: AgreementStatus) {
  switch (status) {
    case 'PENDING_TENANT_VERIFICATION':
      return { label: 'Pending Tenant Verify', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
    case 'TENANT_VERIFIED':
    case 'PENDING_COUNTER_SIGN':
      return { label: 'Awaiting Counter-Sign', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };
    case 'SIGNER_VERIFIED':
      return { label: 'Processing PDF', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' };
    case 'AGREEMENT_READY_FOR_DOWNLOAD':
      return { label: 'Ready for Upload', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' };
    case 'PENDING_SIGNED_UPLOAD':
      return { label: 'Signed Copy Needed', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
    case 'AGREEMENT_COMPLETED':
      return { label: '✅ Completed', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
    case 'TERMINATED':
      return { label: 'Terminated', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' };
    default:
      return { label: status, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' };
  }
}

// ─── SKELETON ─────────────────────────────────────────────────────────────────

function OwnerAgreementSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 rounded-2xl bg-white/60 border border-purple-100" />
        ))}
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="h-40 rounded-2xl bg-white/60 border border-purple-100" />
      ))}
    </div>
  );
}

// ─── OTP INPUT ────────────────────────────────────────────────────────────────

interface OtpInputProps {
  value: string[];
  onChange: (otp: string[]) => void;
  disabled?: boolean;
}

function OtpInputBoxes({ value, onChange, disabled }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, char: string) => {
    const digit = char.replace(/\D/g, '').slice(-1);
    const next = [...value];
    next[index] = digit;
    onChange(next);
    if (digit && index < 5) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (value[index]) {
        const next = [...value];
        next[index] = '';
        onChange(next);
      } else if (index > 0) {
        refs.current[index - 1]?.focus();
        const next = [...value];
        next[index - 1] = '';
        onChange(next);
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) refs.current[index + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    const next = Array(6).fill('');
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    onChange(next);
    refs.current[Math.min(text.length, 5)]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center">
      {Array(6).fill(null).map((_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          disabled={disabled}
          className={`
            w-11 text-center text-xl font-black border-2 rounded-xl transition-all outline-none
            ${value[i] ? 'border-indigo-500 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-white text-slate-900'}
            focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          style={{ height: '52px' }}
          aria-label={`OTP digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

// ─── COUNTER-SIGN MODAL ───────────────────────────────────────────────────────

interface CounterSignModalProps {
  agreement: AgreementRecord;
  onClose: () => void;
  onSuccess: () => void;
}

function CounterSignModal({ agreement, onClose, onSuccess }: CounterSignModalProps) {
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const otpString = otp.join('');
  const isComplete = otpString.length === 6;

  const handleSendOtp = async () => {
    setIsSending(true);
    try {
      const result = await sendSignerAgreementOTP(agreement.id);
      setMaskedEmail(result.maskedEmail);
      setOtpSent(true);
      toast.success('OTP sent to your registered email!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to send OTP.');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async () => {
    if (!isComplete) return;
    setIsVerifying(true);
    try {
      await verifySignerAgreementOTP(agreement.id, otpString);
      toast.success('Agreement countersigned! PDF is being generated...');
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || 'Verification failed.');
      setOtp(Array(6).fill(''));
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#3b5bdb] to-[#7048e8] px-6 py-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-white" />
              <h2 className="font-black text-white text-lg">Counter-Sign Agreement</h2>
            </div>
            <p className="text-purple-200 text-xs mt-0.5">Authorize as Property Owner / Manager</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Agreement Ref */}
          <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3">
            <FileText className="w-8 h-8 text-indigo-600 shrink-0" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Agreement</p>
              <p className="font-black text-slate-900 font-mono">{agreement.displayId}</p>
              <p className="text-xs text-slate-500">
                {agreement.tenantName} · {agreement.propertyName}
              </p>
            </div>
          </div>

          {!otpSent ? (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto">
                  <Send className="w-7 h-7 text-indigo-600" />
                </div>
                <h3 className="font-black text-slate-900">Send OTP to Your Email</h3>
                <p className="text-sm text-slate-500">
                  We'll send a one-time password to verify your identity before counter-signing.
                </p>
              </div>
              <button
                onClick={handleSendOtp}
                disabled={isSending}
                className="w-full py-3.5 bg-gradient-to-r from-[#3b5bdb] to-[#7048e8] hover:from-[#3451c7] hover:to-[#5f38d6] text-white font-black rounded-2xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
              >
                {isSending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP...</> : <><Send className="w-4 h-4" /> Send OTP</>}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-slate-600">
                  OTP sent to <span className="font-black text-indigo-700">{maskedEmail}</span>
                </p>
                <p className="text-xs text-slate-400">Valid for 10 minutes</p>
              </div>

              <OtpInputBoxes value={otp} onChange={setOtp} disabled={isVerifying} />

              <button
                onClick={handleVerify}
                disabled={!isComplete || isVerifying}
                className="w-full py-3.5 bg-gradient-to-r from-[#3b5bdb] to-[#7048e8] hover:from-[#3451c7] hover:to-[#5f38d6] text-white font-black rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
              >
                {isVerifying ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : <><ShieldCheck className="w-4 h-4" /> Verify &amp; Counter-Sign</>}
              </button>

              <button
                onClick={() => { setOtpSent(false); setOtp(Array(6).fill('')); }}
                className="w-full text-sm text-slate-500 hover:text-indigo-600 font-medium transition-colors"
              >
                Resend OTP
              </button>
            </div>
          )}

          {/* Legal notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
            <p className="text-[11px] text-amber-800 text-center leading-relaxed">
              🔒 By verifying, you authorize this agreement as Property Owner / Authorized Manager under IT Act 2000.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── UPLOAD MODAL ─────────────────────────────────────────────────────────────

interface UploadModalProps {
  agreement: AgreementRecord;
  onClose: () => void;
  onSuccess: () => void;
}

function UploadSignedModal({ agreement, onClose, onSuccess }: UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileError, setFileError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const MAX_SIZE = 5 * 1024 * 1024; // 5MB

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setFileError('Only PDF files are accepted.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setFileError('File size must be under 5MB.');
      return;
    }
    setSelectedFile(file);
  };

  const simulateProgress = () => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) { clearInterval(interval); return 90; }
        return prev + Math.random() * 15;
      });
    }, 150);
    return interval;
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    const progressInterval = simulateProgress();

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // strip data:...;base64,
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      await uploadSignedAgreement(agreement.id, base64, selectedFile.name);
      setProgress(100);
      clearInterval(progressInterval);

      toast.success('Agreement completed! Tenant onboarding continues.');
      setTimeout(onSuccess, 600);
    } catch (e: any) {
      clearInterval(progressInterval);
      setProgress(0);
      toast.error(e.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Compute expected filename
  const expectedFilename = `RP-AGR-${agreement.displayId.replace(/[^A-Z0-9-]/gi, '')}-SIGNED.pdf`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-white" />
              <h2 className="font-black text-white text-lg">Upload Signed Copy</h2>
            </div>
            <p className="text-emerald-100 text-xs mt-0.5">Physical signature upload required</p>
          </div>
          <button onClick={onClose} disabled={uploading} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all disabled:opacity-50">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Agreement Ref */}
          <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3">
            <FileText className="w-8 h-8 text-emerald-600 shrink-0" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Agreement</p>
              <p className="font-black text-slate-900 font-mono">{agreement.displayId}</p>
              <p className="text-xs text-slate-500">{agreement.tenantName} · {agreement.propertyName}</p>
            </div>
          </div>

          {/* File Input */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
              Signed Agreement PDF
            </label>
            <div
              onClick={() => !uploading && fileRef.current?.click()}
              className={`
                border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all
                ${selectedFile ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50/50'}
                ${uploading ? 'opacity-60 cursor-not-allowed' : ''}
              `}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                disabled={uploading}
              />
              {selectedFile ? (
                <div className="space-y-1">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto">
                    <Paperclip className="w-5 h-5 text-emerald-600" />
                  </div>
                  <p className="font-black text-emerald-800 text-sm truncate px-2">{selectedFile.name}</p>
                  <p className="text-xs text-emerald-600">{(selectedFile.size / 1024).toFixed(1)} KB · PDF</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto">
                    <Upload className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="font-black text-slate-600 text-sm">Click to select PDF</p>
                  <p className="text-xs text-slate-400">PDF only · Max 10MB</p>
                </div>
              )}
            </div>
            {fileError && (
              <p className="text-red-600 text-xs font-medium mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {fileError}
              </p>
            )}
          </div>

          {/* Expected Filename Note */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-[11px] text-blue-800 font-medium">
              📋 File will be saved as:{' '}
              <span className="font-mono font-black text-blue-900">{expectedFilename}</span>
            </p>
          </div>

          {/* Progress Bar */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-black text-slate-600">
                <span>Uploading...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading || !!fileError}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
            ) : (
              <><Upload className="w-4 h-4" /> 📤 Upload Signed Agreement</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AGREEMENT ROW (Mobile Card / Desktop Row) ────────────────────────────────

interface AgreementRowProps {
  agreement: AgreementRecord;
  onActionComplete: () => void;
  onTerminate: (id: string) => void;
}

function AgreementRow({ agreement, onActionComplete, onTerminate }: AgreementRowProps) {
  const [showCounterSign, setShowCounterSign] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const badge = getStatusBadge(agreement.status);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const url = await getAgreementDownloadUrl(agreement.id);
      window.open(url, '_blank');
    } catch (e: any) {
      toast.error(e.message || 'Could not get download URL.');
    } finally {
      setIsDownloading(false);
    }
  };

  const actions = (
    <div className="flex flex-col sm:flex-row gap-2">
      {(agreement.status === 'TENANT_VERIFIED' || agreement.status === 'PENDING_COUNTER_SIGN') && (
        <button
          onClick={() => setShowCounterSign(true)}
          className="flex-1 py-2.5 px-3 bg-gradient-to-r from-[#3b5bdb] to-[#7048e8] text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 hover:from-[#3451c7] hover:to-[#5f38d6] transition-all shadow-md shadow-indigo-200"
        >
          <ShieldCheck className="w-3.5 h-3.5" /> ✍️ Counter Sign
        </button>
      )}

      {agreement.status === 'AGREEMENT_READY_FOR_DOWNLOAD' && (
        <div className="flex flex-col gap-3 w-full mt-2">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 text-left">
            <p className="font-bold flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Mandatory Physical Signing</p>
            <p className="mt-1 leading-relaxed">Kindly download the agreement, print it, and sign it physically with the tenant. Verify all legal documents, sign both parties, and then upload the same agreement below to continue the onboarding process of the customer.</p>
          </div>
          <div className="flex gap-2 w-full">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex-1 py-2.5 px-3 border-2 border-indigo-200 text-indigo-700 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 hover:bg-indigo-50 transition-all disabled:opacity-60"
            >
              {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              📥 Download PDF
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="flex-1 py-2.5 px-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-md shadow-emerald-200"
            >
              <Upload className="w-3.5 h-3.5" /> 📤 Upload Signed Copy
            </button>
          </div>
        </div>
      )}

      {agreement.status === 'PENDING_SIGNED_UPLOAD' && (
        <button
          onClick={() => setShowUpload(true)}
          className="flex-1 py-2.5 px-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-md shadow-emerald-200"
        >
          <Upload className="w-3.5 h-3.5" /> 📤 Upload Signed Copy
        </button>
      )}

      {agreement.status === 'AGREEMENT_COMPLETED' && (
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="flex-1 py-2.5 px-3 border-2 border-slate-200 text-slate-700 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-all disabled:opacity-60"
        >
          {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
          📄 View Agreement
        </button>
      )}

      {!['AGREEMENT_COMPLETED', 'TERMINATED'].includes(agreement.status) && (
        <button
          onClick={() => onTerminate(agreement.id)}
          className="px-3 py-1.5 border border-red-200 text-red-600 text-xs font-black rounded-lg hover:bg-red-50 transition-all"
        >
          Terminate
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Card */}
      <div className="md:hidden bg-white/70 backdrop-blur-xl border border-purple-100 shadow-lg rounded-2xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#3b5bdb] to-[#7048e8]" />
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="font-mono text-xs font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg">
                {agreement.displayId}
              </span>
              <p className="font-black text-slate-900 mt-1">{agreement.tenantName}</p>
              <p className="text-xs text-slate-500">{agreement.tenantDisplayId}</p>
            </div>
            <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${badge.color} ${badge.bg} ${badge.border}`}>
              {badge.label}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-50 rounded-xl p-2">
              <p className="text-slate-400 font-black uppercase text-[10px]">Property</p>
              <p className="font-bold text-slate-700 truncate">{agreement.propertyName}</p>
              <p className="text-slate-500">Room {agreement.roomNumber}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-2">
              <p className="text-slate-400 font-black uppercase text-[10px]">Rent</p>
              <p className="font-black text-slate-900">Rs. {agreement.monthlyRent.toLocaleString('en-IN')}</p>
            </div>
          </div>
          {actions}
        </div>
      </div>

      {/* Desktop Row */}
      <tr className="hidden md:table-row hover:bg-purple-50/40 transition-colors border-b border-purple-100/50 last:border-0">
        <td className="px-4 py-4">
          <span className="font-mono text-xs font-black text-purple-700 bg-purple-50 px-2 py-1 rounded-lg">
            {agreement.displayId}
          </span>
        </td>
        <td className="px-4 py-4">
          <p className="font-black text-slate-900 text-sm">{agreement.tenantName}</p>
          <p className="text-xs text-slate-400 font-mono">{agreement.tenantDisplayId}</p>
        </td>
        <td className="px-4 py-4">
          <p className="font-bold text-slate-800 text-sm">{agreement.propertyName}</p>
          <p className="text-xs text-slate-500">Room {agreement.roomNumber}</p>
        </td>
        <td className="px-4 py-4">
          <p className="font-black text-slate-900 text-sm">Rs. {agreement.monthlyRent.toLocaleString('en-IN')}</p>
        </td>
        <td className="px-4 py-4">
          <span className={`text-xs font-black px-3 py-1.5 rounded-full border ${badge.color} ${badge.bg} ${badge.border}`}>
            {badge.label}
          </span>
        </td>
        <td className="px-4 py-4">
          <div className="flex gap-2">{actions}</div>
        </td>
      </tr>

      {showCounterSign && (
        <CounterSignModal
          agreement={agreement}
          onClose={() => setShowCounterSign(false)}
          onSuccess={() => { setShowCounterSign(false); onActionComplete(); }}
        />
      )}
      {showUpload && (
        <UploadSignedModal
          agreement={agreement}
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); onActionComplete(); }}
        />
      )}
    </>
  );
}

// ─── SUMMARY CARD ─────────────────────────────────────────────────────────────

function SummaryCard({ label, count, inactiveColor, activeColor, isActive, onClick }: { label: string; count: number; inactiveColor: string; activeColor: string; isActive?: boolean; onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full text-left rounded-2xl p-4 border transition-all ${isActive ? activeColor : inactiveColor} ${isActive ? 'shadow-lg shadow-black/10 scale-[1.02] border-transparent' : 'hover:scale-[1.01] hover:shadow-md'}`}
    >
      <p className="text-2xl font-black">{count}</p>
      <p className="text-sm font-bold mt-0.5 opacity-90">{label}</p>
    </button>
  );
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="bg-white/70 backdrop-blur-xl border border-purple-100 shadow-xl rounded-2xl p-12 text-center">
      <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
        <FileText className="w-10 h-10 text-indigo-400" />
      </div>
      <h2 className="font-black text-slate-700 text-xl">No Agreements Found</h2>
      <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">
        Tenancy agreements will appear here when bookings are confirmed and agreements are generated.
      </p>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function OwnerAgreementsPage() {
  const currentYearNum = new Date().getFullYear();
  const defaultMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');

  const [agreements, setAgreements] = useState<AgreementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [terminateTarget, setTerminateTarget] = useState<string | null>(null);
  const [terminateReason, setTerminateReason] = useState('');
  const [isTerminating, setIsTerminating] = useState(false);

  const [activeTab, setActiveTab] = useState('ALL');
  const [ownerProperties, setOwnerProperties] = useState<any[]>([]);
  const [selectedProperty, setSelectedProperty] = useState('ALL');
  const [selectedYear, setSelectedYear] = useState(currentYearNum.toString());
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [currentPage, setCurrentPage] = useState(1);

  const loadAgreements = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await getOwnerAgreements();
      setAgreements(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load agreements.');
      if (!silent) toast.error(e.message || 'Failed to load agreements.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchOwnerProps = useCallback(async () => {
    try {
      const props = await getProperties();
      setOwnerProperties(props);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadAgreements();
    fetchOwnerProps();
  }, [loadAgreements, fetchOwnerProps]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedProperty, selectedYear, selectedMonth, activeTab]);

  const propertiesList = Array.from(new Set([
      ...ownerProperties.map(p => p.name),
      ...agreements.map(a => a.propertyName)
  ].filter(Boolean))) as string[];

  const startYear = 2026;
  const yearOptions = Array.from({ length: Math.max(1, currentYearNum - startYear + 1) }, (_, i) => {
      const y = (currentYearNum - i).toString();
      return { value: y, label: y };
  });

  const allMonths = [
      { value: '01', label: 'January' }, { value: '02', label: 'February' },
      { value: '03', label: 'March' }, { value: '04', label: 'April' },
      { value: '05', label: 'May' }, { value: '06', label: 'June' },
      { value: '07', label: 'July' }, { value: '08', label: 'August' },
      { value: '09', label: 'September' }, { value: '10', label: 'October' },
      { value: '11', label: 'November' }, { value: '12', label: 'December' }
  ];

  const baseMonthOptions = selectedYear === currentYearNum.toString()
      ? allMonths.slice(0, new Date().getMonth() + 1)
      : allMonths;
  const monthOptions = [{ value: 'ALL', label: 'All Months' }, ...baseMonthOptions];

  const filteredAgreements = agreements.filter(a => {
      let matchStatus = true;
      if (activeTab === 'PENDING_TENANT_VERIFY') matchStatus = a.status === 'PENDING_TENANT_VERIFICATION';
      else if (activeTab === 'AWAITING_COUNTER_SIGN') matchStatus = ['TENANT_VERIFIED', 'PENDING_COUNTER_SIGN'].includes(a.status);
      else if (activeTab === 'READY_FOR_UPLOAD') matchStatus = ['AGREEMENT_READY_FOR_DOWNLOAD', 'PENDING_SIGNED_UPLOAD'].includes(a.status);
      else if (activeTab === 'COMPLETED') matchStatus = a.status === 'AGREEMENT_COMPLETED';

      let matchProperty = true;
      if (selectedProperty !== 'ALL') {
          matchProperty = a.propertyName === selectedProperty;
      }

      let matchDate = true;
      if (selectedYear && selectedMonth && a.createdAt) {
          const date = new Date(a.createdAt);
          const itemYear = date.getFullYear().toString();
          const itemMonth = (date.getMonth() + 1).toString().padStart(2, '0');
          if (itemYear !== selectedYear || (selectedMonth !== 'ALL' && itemMonth !== selectedMonth)) {
              matchDate = false;
          }
      }
      return matchStatus && matchProperty && matchDate;
  });

  const ITEMS_PER_PAGE = 25;
  const totalPages = Math.ceil(filteredAgreements.length / ITEMS_PER_PAGE) || 1;
  const paginatedAgreements = filteredAgreements.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Computed stats
  const stats = {
    pendingTenantVerify: agreements.filter(a => a.status === 'PENDING_TENANT_VERIFICATION').length,
    awaitingCounterSign: agreements.filter(a => ['TENANT_VERIFIED', 'PENDING_COUNTER_SIGN'].includes(a.status)).length,
    readyForUpload: agreements.filter(a => ['AGREEMENT_READY_FOR_DOWNLOAD', 'PENDING_SIGNED_UPLOAD'].includes(a.status)).length,
    completed: agreements.filter(a => a.status === 'AGREEMENT_COMPLETED').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-[#3b5bdb] to-[#7048e8] px-4 pt-10 pb-20 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 bottom-0 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="w-full relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-5 h-5 text-purple-200" />
              <span className="text-purple-200 text-xs font-black uppercase tracking-widest">Management</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Agreements</h1>
            <p className="text-purple-200 text-sm font-medium mt-1">
              Manage tenant agreements, counter-sign, and upload signed copies
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-end gap-4 shrink-0 mt-4 lg:mt-0 w-full lg:w-auto">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/80 mb-1 ml-3">SELECT PROPERTY</span>
                    <select
                        value={selectedProperty}
                        onChange={(e) => setSelectedProperty(e.target.value)}
                        className="appearance-none bg-white text-indigo-950 rounded-full px-5 py-2.5 pr-10 text-sm font-black focus:outline-none transition-all cursor-pointer relative shadow-lg shadow-indigo-900/20"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%231e1b4b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                    >
                        <option value="ALL">All Properties</option>
                        {propertiesList.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/80 mb-1 ml-3">SELECT YEAR</span>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="appearance-none bg-white text-indigo-950 rounded-full px-5 py-2.5 pr-10 text-sm font-black focus:outline-none transition-all cursor-pointer relative shadow-lg shadow-indigo-900/20"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%231e1b4b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
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
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%231e1b4b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                    >
                        {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
            </div>
            
            <button
              onClick={() => loadAgreements(true)}
              disabled={refreshing}
              className="shrink-0 flex items-center gap-2 px-4 py-3 bg-white/20 hover:bg-white/30 text-white font-black text-sm rounded-xl transition-all disabled:opacity-60 w-full sm:w-auto justify-center shadow-lg"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="w-full px-4 -mt-12 relative z-10 space-y-5">
        {loading ? (
          <OwnerAgreementSkeleton />
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
            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryCard
                label="📄 Pending Tenant Verify"
                count={stats.pendingTenantVerify}
                inactiveColor="bg-amber-50 border-amber-200 text-amber-800"
                activeColor="bg-amber-500 text-white"
                isActive={activeTab === 'PENDING_TENANT_VERIFY'}
                onClick={() => setActiveTab(activeTab === 'PENDING_TENANT_VERIFY' ? 'ALL' : 'PENDING_TENANT_VERIFY')}
              />
              <SummaryCard
                label="⏳ Awaiting My Counter-Sign"
                count={stats.awaitingCounterSign}
                inactiveColor="bg-blue-50 border-blue-200 text-blue-800"
                activeColor="bg-[#3b5bdb] text-white"
                isActive={activeTab === 'AWAITING_COUNTER_SIGN'}
                onClick={() => setActiveTab(activeTab === 'AWAITING_COUNTER_SIGN' ? 'ALL' : 'AWAITING_COUNTER_SIGN')}
              />
              <SummaryCard
                label="📥 Ready for Upload"
                count={stats.readyForUpload}
                inactiveColor="bg-indigo-50 border-indigo-200 text-indigo-800"
                activeColor="bg-indigo-600 text-white"
                isActive={activeTab === 'READY_FOR_UPLOAD'}
                onClick={() => setActiveTab(activeTab === 'READY_FOR_UPLOAD' ? 'ALL' : 'READY_FOR_UPLOAD')}
              />
              <SummaryCard
                label="✅ Completed"
                count={stats.completed}
                inactiveColor="bg-emerald-50 border-emerald-200 text-emerald-800"
                activeColor="bg-emerald-500 text-white"
                isActive={activeTab === 'COMPLETED'}
                onClick={() => setActiveTab(activeTab === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
              />
            </div>

            {filteredAgreements.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {/* Mobile Cards */}
                <div className="md:hidden space-y-4">
                  {paginatedAgreements.map(agreement => (
                    <AgreementRow
                      key={agreement.id}
                      agreement={agreement}
                      onActionComplete={() => loadAgreements(true)}
                      onTerminate={(id) => setTerminateTarget(id)}
                    />
                  ))}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block bg-white/70 backdrop-blur-xl border border-purple-100 shadow-xl rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-purple-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-600" />
                      <h2 className="font-black text-slate-900">
                        {activeTab === 'ALL' ? 'All Agreements' : 'Filtered Agreements'}
                      </h2>
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 font-black text-xs rounded-full">
                        {filteredAgreements.length}
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-purple-100">
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Agreement ID</th>
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Tenant</th>
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Property / Room</th>
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Monthly Rent</th>
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-50">
                        {paginatedAgreements.map(agreement => (
                          <AgreementRow
                            key={agreement.id}
                            agreement={agreement}
                            onActionComplete={() => loadAgreements(true)}
                            onTerminate={(id) => setTerminateTarget(id)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {totalPages > 1 && (
                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-between bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-100">
                    <div className="text-sm text-slate-500 font-bold mb-4 sm:mb-0">
                      Showing <span className="text-indigo-600">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-indigo-600">{Math.min(currentPage * ITEMS_PER_PAGE, filteredAgreements.length)}</span> of <span className="text-indigo-600">{filteredAgreements.length}</span> entries
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
            )}
          </>
        )}
      </div>

      {terminateTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-5">
              <h2 className="font-black text-white text-lg">Terminate Agreement</h2>
              <p className="text-red-100 text-xs mt-0.5">This action cannot be undone</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2">Reason for termination *</label>
                <textarea
                  value={terminateReason}
                  onChange={e => setTerminateReason(e.target.value)}
                  placeholder="Please provide a reason (minimum 10 characters)"
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">{terminateReason.length}/500 characters</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setTerminateTarget(null); setTerminateReason(''); }}
                  className="flex-1 py-3 border-2 border-slate-200 text-slate-700 font-black rounded-2xl hover:bg-slate-50 transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (terminateReason.trim().length < 10) { toast.error('Please provide a reason (at least 10 characters).'); return; }
                    setIsTerminating(true);
                    try {
                      await terminateAgreement(terminateTarget, terminateReason.trim());
                      toast.success('Agreement terminated.');
                      setTerminateTarget(null);
                      setTerminateReason('');
                      loadAgreements();
                    } catch (e: any) {
                      toast.error(e.message || 'Failed to terminate.');
                    } finally {
                      setIsTerminating(false);
                    }
                  }}
                  disabled={isTerminating || terminateReason.trim().length < 10}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                >
                  {isTerminating ? <><span className="animate-spin">⏳</span> Terminating...</> : 'Confirm Terminate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
