'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldAlert, LogIn, UserX } from 'lucide-react';

const STORAGE_KEY = 'rentpe_active_session';
// Industry standard: 3 seconds (used by Google, Slack, Discord)
const AUTO_REDIRECT_SECONDS = 3;

function getDashboardForRole(role: string): string {
    switch (role?.toUpperCase()) {
        case 'ADMIN': return '/dashboard/admin';
        case 'OWNER': return '/dashboard/owner';
        case 'ONBOARDER': return '/dashboard/onboarder';
        case 'VERIFIER': return '/dashboard/verifier';
        case 'USER': return '/dashboard/student';
        default: return '/login';
    }
}

export default function SessionGuard() {
    const [alert, setAlert] = useState<{
        type: 'user_change' | 'role_change';
        fromRole: string;
        toRole: string;
        toUserId: string | null;
        redirectTo: string;
    } | null>(null);
    const [countdown, setCountdown] = useState(AUTO_REDIRECT_SECONDS);
    const initialUserIdRef = useRef<string | null>(null);
    const initialRoleRef = useRef<string | null>(null);

    // On mount: capture current userId + role as the baseline for this tab
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                initialUserIdRef.current = parsed.userId || null;
                initialRoleRef.current = parsed.role || null;
            }
        } catch { }

        // Native browser 'storage' event fires INSTANTLY in all other tabs
        // when any tab writes to localStorage — zero polling delay
        const handleStorage = (e: StorageEvent) => {
            if (e.key !== STORAGE_KEY) return;

            try {
                const newData = e.newValue ? JSON.parse(e.newValue) : null;
                const prevUserId = initialUserIdRef.current;
                const prevRole = initialRoleRef.current;

                if (!newData) {
                    // Another tab logged OUT
                    if (prevUserId) {
                        setAlert({
                            type: 'user_change',
                            fromRole: prevRole || '',
                            toRole: 'LOGGED_OUT',
                            toUserId: null,
                            redirectTo: '/login',
                        });
                        setCountdown(AUTO_REDIRECT_SECONDS);
                    }
                    return;
                }

                if (prevUserId && newData.userId !== prevUserId) {
                    // DIFFERENT USER logged in on another tab
                    // → Redirect to THEIR correct dashboard
                    const dest = getDashboardForRole(newData.role);
                    setAlert({
                        type: 'user_change',
                        fromRole: prevRole || '',
                        toRole: newData.role,
                        toUserId: newData.userId,
                        redirectTo: dest,
                    });
                    setCountdown(AUTO_REDIRECT_SECONDS);
                } else if (prevUserId && newData.userId === prevUserId && newData.role !== prevRole) {
                    // SAME USER switched ROLE on another tab
                    const dest = getDashboardForRole(newData.role);
                    setAlert({
                        type: 'role_change',
                        fromRole: prevRole || '',
                        toRole: newData.role,
                        toUserId: newData.userId,
                        redirectTo: dest,
                    });
                    setCountdown(AUTO_REDIRECT_SECONDS);
                }
            } catch { }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    // Auto-redirect countdown when an alert is triggered
    useEffect(() => {
        if (!alert) return;
        // setCountdown is already initialized at 3s by state default or during alert trigger.
        // We only need to start the interval here.

        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    // ✅ KEY FIX: navigate to the CORRECT dashboard — not just reload same URL
                    window.location.href = alert.redirectTo;
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [alert]);

    if (!alert) return null;

    const isDifferentUser = alert.type === 'user_change';
    const roleLabel = (r: string) => {
        const map: Record<string, string> = {
            USER: 'Student', OWNER: 'Owner', ADMIN: 'Admin',
            ONBOARDER: 'Onboarder', VERIFIER: 'Verifier', LOGGED_OUT: 'Signed Out'
        };
        return map[r?.toUpperCase()] || r;
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200 mx-4">
                {/* Header bar */}
                <div className={`p-5 text-white text-center ${isDifferentUser
                    ? 'bg-gradient-to-r from-red-500 to-rose-600'
                    : 'bg-gradient-to-r from-violet-600 to-indigo-700'
                    }`}>
                    <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2">
                        {isDifferentUser
                            ? <UserX className="h-6 w-6 text-white" />
                            : <ShieldAlert className="h-6 w-6 text-white" />
                        }
                    </div>
                    <h2 className="text-base font-black tracking-tight">
                        {isDifferentUser ? '🔒 Session Changed' : '🔄 Role Switched'}
                    </h2>
                    <p className="text-white/75 text-xs mt-0.5">Detected from another tab</p>
                </div>

                {/* Body */}
                <div className="p-5 text-center space-y-3">
                    <p className="text-slate-600 text-sm leading-relaxed">
                        {isDifferentUser
                            ? <>Another tab logged in as <span className="font-bold text-slate-900">{roleLabel(alert.toRole)}</span>. Redirecting you to the right dashboard.</>
                            : <>Switched to <span className="font-bold text-slate-900">{roleLabel(alert.toRole)}</span> mode. Taking you there now.</>
                        }
                    </p>

                    {/* Countdown ring — 3 second industry standard */}
                    <div className="flex flex-col items-center gap-1 py-1">
                        <div className="relative h-14 w-14">
                            <svg className="h-14 w-14 -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                                <circle
                                    cx="18" cy="18" r="14"
                                    fill="none"
                                    stroke={isDifferentUser ? '#ef4444' : '#7c3aed'}
                                    strokeWidth="4"
                                    strokeDasharray={`${(countdown / AUTO_REDIRECT_SECONDS) * 87.96} 87.96`}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dasharray 1s linear' }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-lg font-black text-slate-800">{countdown}</span>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            Redirecting in {countdown}s
                        </p>
                    </div>

                    <button
                        onClick={() => { window.location.href = alert.redirectTo; }}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all active:scale-95 ${isDifferentUser
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-violet-600 hover:bg-violet-700'
                            }`}
                    >
                        <LogIn className="h-4 w-4" /> Go to {roleLabel(alert.toRole)} Dashboard
                    </button>

                    <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">
                        Identity Security Guard • RentPe
                    </p>
                </div>
            </div>
        </div>
    );
}
