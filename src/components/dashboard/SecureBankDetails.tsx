'use client';

import { useState, useEffect, useRef } from "react";
import { Landmark, Eye, EyeOff, ShieldCheck, FileCheck, ZoomIn, Lock, LockOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { verifyRevealOTP } from "@/actions/security";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface SecureBankDetailsProps {
    propertyId: string;
    bankName: string | null;
    initialBankAccountNo: string | null;
    initialBankIfsc: string | null;
    initialCancelChequeUrl: string | null;
    isChequeVerified?: boolean;
    onChequeViewerOpen: (url: string) => void;
    userRole: "ADMIN" | "OWNER" | "STAFF";
}

export default function SecureBankDetails({
    propertyId,
    bankName,
    initialBankAccountNo,
    initialBankIfsc,
    initialCancelChequeUrl,
    isChequeVerified = false,
    onChequeViewerOpen,
    userRole
}: SecureBankDetailsProps) {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otpInput, setOtpInput] = useState("");
    const [verifying, setVerifying] = useState(false);

    // Unlocked data
    const [realBankName, setRealBankName] = useState<string | null>(null);
    const [realAccountNo, setRealAccountNo] = useState<string | null>(null);
    const [realIfsc, setRealIfsc] = useState<string | null>(null);
    const [realChequeUrl, setRealChequeUrl] = useState<string | null>(null);

    const [expiresAt, setExpiresAt] = useState<number | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!isUnlocked || !expiresAt) return;

        const updateTimer = () => {
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
            setTimeLeft(remaining);

            if (remaining === 0) {
                setIsUnlocked(false);
                setRealBankName(null);
                setRealAccountNo(null);
                setRealIfsc(null);
                setRealChequeUrl(null);
                setExpiresAt(null);
                toast("Session locked automatically for security.", { icon: "🔒" });
            }
        };

        // Run immediately then set interval
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        
        return () => clearInterval(interval);
    }, [isUnlocked, expiresAt]);

    const handleRevealClick = () => {
        if (isUnlocked) {
            // Manual lock
            setIsUnlocked(false);
            setRealBankName(null);
            setRealAccountNo(null);
            setRealIfsc(null);
            setRealChequeUrl(null);
            setExpiresAt(null);
            setTimeLeft(0);
            toast("Bank details locked.", { icon: "🔒" });
        } else {
            setOtpInput("");
            setShowOtpModal(true);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otpInput || otpInput.trim() === "") {
            toast.error("Please enter the OTP.");
            return;
        }

        setVerifying(true);
        try {
            const res = await verifyRevealOTP(propertyId, otpInput.trim());
            if (res.success) {
                setRealBankName(res.bankName);
                setRealAccountNo(res.bankAccountNo);
                setRealIfsc(res.bankIfsc);
                setRealChequeUrl(res.cancelChequeUrl);
                
                setExpiresAt(res.expiresAt);
                // Calculate remaining seconds right now
                const remainingSeconds = Math.floor((res.expiresAt - Date.now()) / 1000);
                setTimeLeft(remainingSeconds > 0 ? remainingSeconds : 120);
                setIsUnlocked(true);
                setShowOtpModal(false);
                toast.success("Bank details unlocked securely.");
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to verify OTP.");
        } finally {
            setVerifying(false);
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Derived Display values
    const displayBankName = isUnlocked && realBankName ? realBankName : bankName;
    const displayAccountNo = isUnlocked && realAccountNo ? realAccountNo : initialBankAccountNo;
    const displayIfsc = isUnlocked && realIfsc ? realIfsc : initialBankIfsc;

    return (
        <div className="bg-white rounded-3xl border-2 border-slate-100 p-6 md:p-8 shadow-sm space-y-6 relative overflow-hidden">
            {/* Background decoration */}
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10 transition-colors duration-500 pointer-events-none ${isUnlocked ? 'bg-emerald-500' : 'bg-purple-500'}`}></div>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-slate-50 pb-6 relative z-10">
                <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl transition-colors duration-500 ${isUnlocked ? 'bg-emerald-50 text-emerald-600' : 'bg-purple-50 text-purple-600'}`}>
                        <Landmark className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black tracking-tight text-slate-900">Bank Details</h3>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                            {isUnlocked ? 'Secured Session Active' : 'Payment Routing Information'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {isUnlocked && (
                        <div className="flex flex-col items-end mr-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Auto-locking in</span>
                            <span className="text-emerald-600 font-mono font-bold text-lg tabular-nums animate-pulse">{formatTime(timeLeft)}</span>
                        </div>
                    )}
                    <Button 
                        onClick={handleRevealClick}
                        variant={isUnlocked ? "outline" : "default"}
                        className={`rounded-xl font-black uppercase tracking-widest text-[10px] h-10 transition-all shadow-sm ${
                            isUnlocked 
                                ? "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                : "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-200"
                        }`}
                    >
                        {isUnlocked ? (
                            <><Lock className="w-3.5 h-3.5 mr-2" /> Lock Now</>
                        ) : (
                            <><Eye className="w-3.5 h-3.5 mr-2" /> Reveal Details</>
                        )}
                    </Button>
                </div>
            </div>
            
            {/* Body */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                <div className="space-y-6">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Beneficiary Name</label>
                        <div className="relative group">
                            <p className={`font-bold text-lg p-4 rounded-xl border font-mono transition-all duration-300 shadow-inner flex items-center justify-between ${
                                isUnlocked 
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                                    : "bg-slate-50 border-slate-200 text-slate-900"
                            }`}>
                                <span>{displayBankName || 'Not provided'}</span>
                                {isUnlocked && <LockOpen className="w-4 h-4 text-emerald-500 opacity-50" />}
                            </p>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Account Number</label>
                        <div className="relative group">
                            <p className={`font-bold text-lg p-4 rounded-xl border font-mono transition-all duration-300 shadow-inner flex items-center justify-between ${
                                isUnlocked 
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                                    : "bg-slate-50 border-slate-200 text-slate-900"
                            }`}>
                                <span>{displayAccountNo || 'Not provided'}</span>
                                {isUnlocked && <LockOpen className="w-4 h-4 text-emerald-500 opacity-50" />}
                            </p>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">IFSC Code</label>
                        <div className="relative group">
                            <p className={`font-bold text-lg p-4 rounded-xl border font-mono transition-all duration-300 shadow-inner flex items-center justify-between ${
                                    isUnlocked 
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                                        : "bg-slate-50 border-slate-100 text-slate-900"
                                }`}>
                                <span>{displayIfsc || 'Not provided'}</span>
                                {isUnlocked && <LockOpen className="w-4 h-4 text-emerald-500 opacity-50" />}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center justify-between">
                        <span>Cancelled Cheque / Passbook</span>
                        {isUnlocked && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[8px]">Unmasked</Badge>}
                    </label>
                    
                    {initialCancelChequeUrl ? (
                        <div className="relative rounded-2xl overflow-hidden border-2 border-slate-100 group w-full text-left bg-slate-100 aspect-video shadow-inner">
                            {isUnlocked ? (
                                <button onClick={() => onChequeViewerOpen(realChequeUrl || initialCancelChequeUrl)} className="w-full h-full block">
                                    <img src={realChequeUrl || initialCancelChequeUrl} className="w-full h-full object-cover" alt="Cancelled Cheque Unlocked" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                        <div className="flex items-center gap-2 px-6 py-3 bg-white text-slate-900 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform">
                                            <ZoomIn className="w-4 h-4" /> View HD
                                        </div>
                                    </div>
                                </button>
                            ) : (
                                <div className="absolute inset-0 bg-slate-200 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                                    <Lock className="w-8 h-8 mb-3 opacity-50 text-slate-500" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Image Protected</span>
                                    <p className="text-xs font-bold opacity-80 max-w-[200px]">Unlock bank details to view the secure cheque image.</p>
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={handleRevealClick}
                                        className="mt-4 bg-white/80 backdrop-blur-sm border-slate-300 text-slate-700 hover:bg-white text-[10px] font-black uppercase tracking-widest rounded-xl"
                                    >
                                        <Eye className="w-3.5 h-3.5 mr-1.5" /> Reveal
                                    </Button>
                                </div>
                            )}
                            
                            {/* Status badge in corner */}
                            {isChequeVerified && (
                                <div className="absolute top-3 right-3 bg-emerald-500 text-white p-1.5 rounded-full shadow-lg z-10">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl aspect-video text-slate-400">
                            <FileCheck className="w-8 h-8 mb-2 opacity-50" />
                            <span className="text-[10px] font-black uppercase tracking-widest">No Image Provided</span>
                        </div>
                    )}
                </div>
            </div>

            {/* OTP Modal */}
            {showOtpModal && (
                <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-indigo-600 p-6 text-white text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                            <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-indigo-200 relative z-10" />
                            <h3 className="text-xl font-black relative z-10">Security Verification</h3>
                            <p className="text-indigo-200 text-sm mt-1 font-medium relative z-10">Verify your identity to access sensitive data.</p>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-3">
                                <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold mb-1">A verification code is required.</p>
                                    <p className="opacity-90">Enter the mock OTP <strong className="font-mono bg-amber-200 px-1 py-0.5 rounded text-amber-900">123456</strong> to proceed. This action will be logged.</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">6-Digit Code</label>
                                <Input
                                    type="text"
                                    maxLength={6}
                                    placeholder="• • • • • •"
                                    className="h-14 text-center text-2xl font-mono tracking-[0.5em] font-bold rounded-xl border-2 border-slate-200 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-all"
                                    value={otpInput}
                                    onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[10px]"
                                    onClick={() => setShowOtpModal(false)}
                                    disabled={verifying}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px]"
                                    onClick={handleVerifyOtp}
                                    disabled={verifying || otpInput.length !== 6}
                                >
                                    {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Unlock"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
