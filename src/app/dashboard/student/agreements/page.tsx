'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  getMyAgreements,
  sendTenantAgreementOTP,
  verifyTenantAgreementOTP,
  getAgreementDownloadUrl,
  verifyUploadedAgreement,
} from '@/actions/agreements';
import type { AgreementRecord, AgreementStatus } from '@/actions/agreements';
import { toast } from 'sonner';
import {
  FileText,
  Download,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
  X,
  Eye,
  ShieldCheck,
  Send,
  FileSignature,
} from 'lucide-react';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const STEPS = [
  'Verify Identity',
  'Owner Signs',
  'Download PDF',
  'Physical Sign',
  'Upload',
  'Complete',
];

function getStepIndex(status: AgreementStatus): number {
  switch (status) {
    case 'PENDING_TENANT_VERIFICATION': return 0;
    case 'TENANT_VERIFIED':             return 1;
    case 'PENDING_COUNTER_SIGN':        return 1;
    case 'SIGNER_VERIFIED':             return 2;
    case 'AGREEMENT_READY_FOR_DOWNLOAD':return 2;
    case 'PENDING_SIGNED_UPLOAD':       return 4;
    case 'AGREEMENT_COMPLETED':         return 5;
    default:                            return -1;
  }
}

interface StatusBadge { label: string; color: string; bgColor: string; borderColor: string }

function getStatusBadge(status: AgreementStatus): StatusBadge {
  switch (status) {
    case 'PENDING_TENANT_VERIFICATION':
      return { label: 'Action Required', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' };
    case 'TENANT_VERIFIED':
    case 'PENDING_COUNTER_SIGN':
      return { label: 'Awaiting Owner', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' };
    case 'SIGNER_VERIFIED':
      return { label: 'Processing', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' };
    case 'AGREEMENT_READY_FOR_DOWNLOAD':
      return { label: 'Ready to Download', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' };
    case 'PENDING_SIGNED_UPLOAD':
      return { label: 'Sign & Return', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' };
    case 'AGREEMENT_COMPLETED':
      return { label: '✅ Complete', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' };
    case 'TERMINATED':
      return { label: 'Terminated', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' };
    default:
      return { label: status, color: 'text-slate-700', bgColor: 'bg-slate-50', borderColor: 'border-slate-200' };
  }
}

function getStatusInfo(status: AgreementStatus): string {
  switch (status) {
    case 'TENANT_VERIFIED':
    case 'PENDING_COUNTER_SIGN':
      return 'Your identity has been verified. Waiting for the owner or manager to counter-sign the agreement.';
    case 'SIGNER_VERIFIED':
      return 'Both parties have signed digitally. The agreement PDF is being generated — this usually takes a few minutes.';
    case 'TERMINATED':
      return 'This agreement has been terminated. Please contact support if you have questions.';
    default:
      return '';
  }
}

// ─── SKELETON ─────────────────────────────────────────────────────────────────

function AgreementSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-32 bg-white/60 rounded-2xl border border-purple-100" />
      <div className="h-48 bg-white/60 rounded-2xl border border-purple-100" />
      <div className="h-12 bg-purple-100/60 rounded-2xl" />
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
            w-11 h-13 text-center text-xl font-black border-2 rounded-xl transition-all outline-none
            ${value[i] ? 'border-purple-500 bg-purple-50 text-purple-900' : 'border-slate-200 bg-white text-slate-900'}
            focus:border-purple-500 focus:ring-2 focus:ring-purple-200
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          style={{ height: '52px' }}
          aria-label={`OTP digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

// ─── STEPPER ──────────────────────────────────────────────────────────────────

function AgreementStepper({ status }: { status: AgreementStatus }) {
  const currentStep = getStepIndex(status);
  const isTerminated = status === 'TERMINATED';

  if (isTerminated) return null;

  return (
    <div className="overflow-x-auto pb-2 -mx-1">
      <div className="flex items-center min-w-max px-1">
        {STEPS.map((step, index) => {
          const isDone = currentStep > index;
          const isCurrent = currentStep === index;
          return (
            <div key={step} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all
                    ${isDone ? 'bg-gradient-to-br from-[#3b5bdb] to-[#7048e8] text-white shadow-md shadow-purple-200' : ''}
                    ${isCurrent ? 'bg-white border-2 border-[#3b5bdb] text-[#3b5bdb] shadow-sm' : ''}
                    ${!isDone && !isCurrent ? 'bg-slate-100 text-slate-400' : ''}
                  `}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
                </div>
                <span
                  className={`text-[10px] font-bold whitespace-nowrap ${
                    isCurrent ? 'text-[#3b5bdb]' : isDone ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  {step}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 mx-1 mb-5 transition-all ${
                    currentStep > index ? 'bg-gradient-to-r from-[#3b5bdb] to-[#7048e8]' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── OTP MODAL ────────────────────────────────────────────────────────────────

interface OtpModalProps {
  agreement: AgreementRecord;
  onClose: () => void;
  onSuccess: () => void;
}

function OtpModal({ agreement, onClose, onSuccess }: OtpModalProps) {
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [maskedEmail, setMaskedEmail] = useState<string>('');
  const [otpSent, setOtpSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const otpString = otp.join('');
  const isComplete = otpString.length === 6;

  const handleSendOtp = async () => {
    setIsSending(true);
    try {
      const result = await sendTenantAgreementOTP(agreement.id);
      setMaskedEmail(result.maskedEmail);
      setOtpSent(true);
      setCountdown(30);
      toast.success('OTP sent to your registered email!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async () => {
    if (!isComplete) return;
    setIsVerifying(true);
    try {
      await verifyTenantAgreementOTP(agreement.id, otpString);
      toast.success('Identity verified! Agreement has been digitally signed.');
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || 'Verification failed. Please try again.');
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
              <h2 className="font-black text-white text-lg">Verify Identity</h2>
            </div>
            <p className="text-purple-200 text-xs mt-0.5">Digital signature via OTP</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Agreement Reference */}
          <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3">
            <FileText className="w-8 h-8 text-purple-600 shrink-0" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Agreement</p>
              <p className="font-black text-slate-900 font-mono">{agreement.displayId}</p>
              <p className="text-xs text-slate-500">{agreement.propertyName} — Room {agreement.roomNumber}</p>
            </div>
          </div>

          {!otpSent ? (
            /* Step 1 — Send OTP */
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto">
                  <Send className="w-7 h-7 text-purple-600" />
                </div>
                <h3 className="font-black text-slate-900">Send OTP to Email</h3>
                <p className="text-sm text-slate-500">
                  We'll send a one-time password to your registered email address to verify your identity.
                </p>
              </div>
              <button
                onClick={handleSendOtp}
                disabled={isSending}
                className="w-full py-3.5 bg-gradient-to-r from-[#3b5bdb] to-[#7048e8] hover:from-[#3451c7] hover:to-[#5f38d6] text-white font-black rounded-2xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-purple-200"
              >
                {isSending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP...</>
                ) : (
                  <><Send className="w-4 h-4" /> Send OTP</>
                )}
              </button>
            </div>
          ) : (
            /* Step 2 — Enter OTP */
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-slate-600">
                  OTP sent to <span className="font-black text-purple-700">{maskedEmail}</span>
                </p>
                <p className="text-xs text-slate-400">Valid for 10 minutes</p>
              </div>

              <OtpInputBoxes value={otp} onChange={setOtp} disabled={isVerifying} />

              <button
                onClick={handleVerify}
                disabled={!isComplete || isVerifying}
                className="w-full py-3.5 bg-gradient-to-r from-[#3b5bdb] to-[#7048e8] hover:from-[#3451c7] hover:to-[#5f38d6] text-white font-black rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-200"
              >
                {isVerifying ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                ) : (
                  <><ShieldCheck className="w-4 h-4" /> Verify &amp; Continue</>
                )}
              </button>

              <button
                onClick={() => { setOtpSent(false); setOtp(Array(6).fill('')); }}
                disabled={countdown > 0}
                className="w-full text-sm text-slate-500 hover:text-purple-600 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {countdown > 0 ? `Resend OTP in ${countdown}s` : "Didn't receive OTP? Resend"}
              </button>
            </div>
          )}

          {/* Legal notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
            <p className="text-[11px] text-amber-800 text-center leading-relaxed">
              🔒 By verifying, you digitally sign this agreement under IT Act 2000 and agree to all terms and conditions of the tenancy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AGREEMENT CARD ───────────────────────────────────────────────────────────

interface AgreementCardProps {
  agreement: AgreementRecord;
  onActionComplete: () => void;
}

function AgreementCard({ agreement, onActionComplete }: AgreementCardProps) {
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [verifyChecked, setVerifyChecked] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [, startTransition] = useTransition();

  const badge = getStatusBadge(agreement.status);
  const stepIndex = getStepIndex(agreement.status);
  const statusInfo = getStatusInfo(agreement.status);
  const isTerminated = agreement.status === 'TERMINATED';

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

  return (
    <>
      <div className="bg-white/70 backdrop-blur-xl border border-purple-100 shadow-xl rounded-2xl overflow-hidden">
        {/* Card Header Strip */}
        <div className={`h-1.5 ${isTerminated ? 'bg-red-400' : 'bg-gradient-to-r from-[#3b5bdb] to-[#7048e8]'}`} />

        <div className="p-5 space-y-5">
          {/* Top Row: ID + Status */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 text-xs font-black rounded-lg font-mono">
                <FileSignature className="w-3 h-3" />
                {agreement.displayId}
              </span>
              <p className="font-black text-slate-900 text-lg mt-2">{agreement.propertyName}</p>
              <p className="text-slate-500 text-sm">Room {agreement.roomNumber}</p>
            </div>
            <span
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-black border ${badge.color} ${badge.bgColor} ${badge.borderColor}`}
            >
              {badge.label}
            </span>
          </div>

          {/* Meta Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Monthly Rent</p>
              <p className="font-black text-slate-900 mt-0.5">Rs. {agreement.monthlyRent.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Booking ID</p>
              <p className="font-black text-slate-900 font-mono text-sm mt-0.5 truncate">{agreement.bookingDisplayId}</p>
            </div>
          </div>

          {/* Stepper */}
          {!isTerminated && (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Agreement Progress</p>
              <AgreementStepper status={agreement.status} />
            </div>
          )}

          {/* Status Info Message */}
          {statusInfo && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2">
              <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800 font-medium">{statusInfo}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2.5">
            {agreement.status === 'PENDING_TENANT_VERIFICATION' && (
              <button
                onClick={() => setShowOtpModal(true)}
                className="w-full py-3.5 bg-gradient-to-r from-[#3b5bdb] to-[#7048e8] hover:from-[#3451c7] hover:to-[#5f38d6] text-white font-black rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-200"
              >
                <ShieldCheck className="w-4 h-4" />
                ✍️ Verify My Identity &amp; Sign
              </button>
            )}

            {agreement.status === 'AGREEMENT_READY_FOR_DOWNLOAD' && (
              <div className="space-y-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
                  <p className="font-bold flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Physical Signing Required</p>
                  <p className="mt-1">Please download the agreement and sign it physically, or ask the property management to print and sign it with you. Once both parties have signed, the property management must upload the final copy.</p>
                </div>
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black rounded-2xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
                >
                  {isDownloading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Opening...</>
                  ) : (
                    <><Download className="w-4 h-4" /> 📥 Download Agreement PDF</>
                  )}
                </button>
              </div>
            )}

            {agreement.status === 'AGREEMENT_COMPLETED' && !agreement.tenantFinalAccepted && (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h4 className="font-black text-amber-800 flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5" /> Action Required: Verify Uploaded Agreement
                  </h4>
                  <p className="text-sm text-amber-700 mb-4">
                    The property management has uploaded the physically signed agreement. Please download and verify that it is correct.
                  </p>
                  
                  <div className="flex gap-2.5 mb-4">
                    <button onClick={handleDownload} disabled={isDownloading} className="flex-1 py-2.5 border-2 border-purple-200 text-purple-700 font-black rounded-xl hover:bg-purple-50 transition-all text-sm flex justify-center items-center gap-2">
                      <Eye className="w-4 h-4" /> View Document
                    </button>
                  </div>

                  <label className="flex items-start gap-3 p-3 bg-white rounded-lg border border-amber-100 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="mt-1 w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500" 
                      checked={verifyChecked}
                      onChange={(e) => setVerifyChecked(e.target.checked)}
                    />
                    <span className="text-sm font-medium text-slate-700 leading-snug">
                      I have read and verified the uploaded documents and confirm they are correct.
                    </span>
                  </label>
                  
                  <button
                    onClick={async () => {
                      if (!verifyChecked) return toast.error("Please check the verification box to continue");
                      setIsVerifying(true);
                      try {
                        const res = await verifyUploadedAgreement(agreement.id);
                        if (res.success) {
                          toast.success("Agreement verified successfully!");
                          onActionComplete();
                        }
                      } catch (e: any) {
                        toast.error(e.message || "Failed to verify");
                      } finally {
                        setIsVerifying(false);
                      }
                    }}
                    disabled={!verifyChecked || isVerifying}
                    className="w-full mt-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirm &amp; Continue Onboarding
                  </button>
                </div>
              </div>
            )}

            {agreement.status === 'AGREEMENT_COMPLETED' && agreement.tenantFinalAccepted && (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="font-black text-emerald-800">Agreement Fully Executed</h4>
                    <p className="text-sm text-emerald-600 mt-0.5">You have verified the physical agreement. You can now proceed to complete your onboarding.</p>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <button onClick={handleDownload} disabled={isDownloading} className="flex-1 py-3 border-2 border-purple-200 text-purple-700 font-black rounded-2xl hover:bg-purple-50 transition-all flex items-center justify-center gap-2 text-sm">
                    <Eye className="w-4 h-4" /> View Signed Agreement
                  </button>
                </div>
              </div>
            )}

            {agreement.status === 'TERMINATED' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-2">
                <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                <div>
                  <p className="font-black text-red-800 text-sm">Agreement Terminated</p>
                  <p className="text-xs text-red-600 mt-0.5">Please contact your property owner or RentPe support for more information.</p>
                </div>
              </div>
            )}
          </div>

          {/* Timestamp */}
          <p className="text-[10px] text-slate-400 text-right">
            Created {new Date(agreement.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      {showOtpModal && (
        <OtpModal
          agreement={agreement}
          onClose={() => setShowOtpModal(false)}
          onSuccess={() => { setShowOtpModal(false); onActionComplete(); }}
        />
      )}
    </>
  );
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="bg-white/70 backdrop-blur-xl border border-purple-100 shadow-xl rounded-2xl p-12 text-center">
      <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
        <FileText className="w-10 h-10 text-purple-400" />
      </div>
      <h2 className="font-black text-slate-700 text-xl">No Agreements Yet</h2>
      <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">
        Your tenancy agreements will appear here once a booking is confirmed and an agreement is generated.
      </p>
      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Booking confirmed
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <CheckCircle2 className="w-4 h-4 text-slate-200" /> Agreement generated
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <CheckCircle2 className="w-4 h-4 text-slate-200" /> Both parties sign
        </div>
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function StudentAgreementsPage() {
  const [agreements, setAgreements] = useState<AgreementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAgreements = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyAgreements();
      setAgreements(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load agreements.');
      toast.error(e.message || 'Failed to load agreements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgreements();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-[#3b5bdb] to-[#7048e8] px-4 pt-10 pb-20 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 bottom-0 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <FileSignature className="w-5 h-5 text-purple-200" />
            <span className="text-purple-200 text-xs font-black uppercase tracking-widest">Tenancy</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">My Agreement</h1>
          <p className="text-purple-200 text-sm font-medium mt-1">
            Review, sign, and manage your tenancy agreement
          </p>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-2xl mx-auto px-4 -mt-12 relative z-10 space-y-5">
        {loading ? (
          <AgreementSkeleton />
        ) : error ? (
          <div className="bg-white/70 backdrop-blur-xl border border-red-100 shadow-xl rounded-2xl p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="font-black text-red-700">{error}</p>
            <button
              onClick={loadAgreements}
              className="mt-4 px-6 py-2 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 transition-all text-sm"
            >
              Retry
            </button>
          </div>
        ) : agreements.length === 0 ? (
          <EmptyState />
        ) : (
          agreements.map(agreement => (
            <AgreementCard
              key={agreement.id}
              agreement={agreement}
              onActionComplete={loadAgreements}
            />
          ))
        )}
      </div>
    </div>
  );
}
