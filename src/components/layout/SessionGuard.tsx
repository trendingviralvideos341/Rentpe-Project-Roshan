'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { checkSessionIntegrity } from '@/actions/auth';
import { ShieldAlert, LogIn } from 'lucide-react';

export default function SessionGuard() {
    const [mismatch, setMismatch] = useState<any>(null);
    const [countdown, setCountdown] = useState(5);
    const pathname = usePathname();

    useEffect(() => {
        const check = async () => {
            // Only guard dashboard routes
            if (!pathname.startsWith('/dashboard')) return;

            try {
                const result = await checkSessionIntegrity();
                if (result.status === 'mismatch') {
                    setMismatch(result);
                    setCountdown(5); // reset countdown
                } else {
                    setMismatch(null);
                }
            } catch (e) {
                console.error("Session integrity check failed:", e);
            }
        };

        check();
        // Poll every 8 seconds for session changes
        const interval = setInterval(check, 8000);
        return () => clearInterval(interval);
    }, [pathname]);

    // Auto-refresh countdown when mismatch is detected
    useEffect(() => {
        if (!mismatch) return;

        // Start the auto-refresh countdown
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    window.location.reload();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [mismatch]);

    if (!mismatch) return null;

    const roleLabel = mismatch.currentRole === 'USER' ? 'Student' :
        mismatch.currentRole === 'OWNER' ? 'Owner' :
            mismatch.currentRole === 'ADMIN' ? 'Admin' :
                mismatch.currentRole;

    const roleColor = mismatch.currentRole === 'OWNER' ? 'from-emerald-500 to-teal-600' :
        mismatch.currentRole === 'ADMIN' ? 'from-purple-600 to-indigo-700' :
            'from-blue-500 to-cyan-600';

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Top colored bar */}
                <div className={`bg-gradient-to-r ${roleColor} p-6 text-white text-center`}>
                    <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                        <ShieldAlert className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-xl font-black tracking-tight">Session Switch Detected</h2>
                    <p className="text-white/80 text-sm mt-1">Another tab changed the active account</p>
                </div>

                {/* Body */}
                <div className="p-6 text-center space-y-4">
                    <p className="text-slate-600 text-sm leading-relaxed">
                        A different tab switched to the <span className="font-bold text-slate-900 uppercase">{roleLabel}</span> account.
                        This page will automatically refresh to show the correct data.
                    </p>

                    {/* Auto-refresh countdown ring */}
                    <div className="flex flex-col items-center gap-2 py-2">
                        <div className="relative h-20 w-20">
                            <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                                <circle
                                    cx="18" cy="18" r="15.9" fill="none"
                                    stroke="#3b82f6" strokeWidth="3"
                                    strokeDasharray={`${(countdown / 5) * 100} 100`}
                                    strokeLinecap="round"
                                    className="transition-all duration-1000"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-2xl font-black text-slate-800">{countdown}</span>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">
                            Auto-refreshing in {countdown}s
                        </p>
                    </div>

                    <button
                        onClick={() => window.location.reload()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-colors"
                    >
                        <LogIn className="h-4 w-4" /> Refresh Now → {roleLabel} View
                    </button>

                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">
                        Identity Security Guard • RentPe Platform
                    </p>
                </div>
            </div>
        </div>
    );
}
