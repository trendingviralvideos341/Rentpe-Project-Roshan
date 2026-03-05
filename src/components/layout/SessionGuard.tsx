'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ShieldAlert, LogIn, UserX } from 'lucide-react';

const STORAGE_KEY = 'rentpe_active_session';

export default function SessionGuard() {
    const [alert, setAlert] = useState<{ type: 'user_change' | 'role_change', from: string, to: string } | null>(null);
    const [countdown, setCountdown] = useState(5);
    const pathname = usePathname();
    const initialUserIdRef = useRef<string | null>(null);
    const initialRoleRef = useRef<string | null>(null);

    // On mount: record the current user/role so we can detect changes
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                initialUserIdRef.current = parsed.userId || null;
                initialRoleRef.current = parsed.role || null;
            }
        } catch { }

        // Listen for cross-tab storage changes — INSTANT, no polling needed
        const handleStorage = (e: StorageEvent) => {
            if (e.key !== STORAGE_KEY) return;

            try {
                const newData = e.newValue ? JSON.parse(e.newValue) : null;
                const prevUserId = initialUserIdRef.current;
                const prevRole = initialRoleRef.current;

                if (!newData) {
                    // Another tab logged OUT
                    if (prevUserId) {
                        setAlert({ type: 'user_change', from: prevRole || 'User', to: 'Logged Out' });
                        setCountdown(5);
                    }
                    return;
                }

                if (prevUserId && newData.userId !== prevUserId) {
                    // A DIFFERENT USER logged in on another tab
                    setAlert({ type: 'user_change', from: prevRole || 'User', to: newData.role });
                    setCountdown(5);
                } else if (prevUserId && newData.userId === prevUserId && newData.role !== prevRole) {
                    // SAME user switched ROLE on another tab
                    setAlert({ type: 'role_change', from: prevRole || '', to: newData.role });
                    setCountdown(5);
                }
            } catch { }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    // Auto-refresh countdown when alert is detected
    useEffect(() => {
        if (!alert) return;
        setCountdown(5);
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
    }, [alert]);

    if (!alert) return null;

    const isDifferentUser = alert.type === 'user_change';
    const roleLabel = (r: string) => r === 'USER' ? 'Student' : r === 'OWNER' ? 'Owner' : r === 'ADMIN' ? 'Admin' : r === 'LOGGED_OUT' ? 'No Account' : r;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200 mx-4">
                {/* Header */}
                <div className={`p-6 text-white text-center ${isDifferentUser ? 'bg-gradient-to-r from-red-500 to-orange-600' : 'bg-gradient-to-r from-purple-600 to-indigo-700'}`}>
                    <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                        {isDifferentUser ? <UserX className="h-7 w-7 text-white" /> : <ShieldAlert className="h-7 w-7 text-white" />}
                    </div>
                    <h2 className="text-lg font-black tracking-tight">
                        {isDifferentUser ? '🔒 Different Account Detected' : '🔄 Role Switch Detected'}
                    </h2>
                    <p className="text-white/80 text-xs mt-1">Another tab changed the active session</p>
                </div>

                {/* Body */}
                <div className="p-5 text-center space-y-4">
                    <p className="text-slate-600 text-sm leading-relaxed">
                        {isDifferentUser
                            ? <>Another tab logged in as a <span className="font-bold text-slate-900">{roleLabel(alert.to)}</span> account. This page will refresh for security.</>
                            : <>Another tab switched to <span className="font-bold text-slate-900">{roleLabel(alert.to)}</span> mode. Refreshing to match.</>
                        }
                    </p>

                    {/* Countdown ring */}
                    <div className="flex flex-col items-center gap-1">
                        <div className="relative h-16 w-16">
                            <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
                                <circle
                                    cx="18" cy="18" r="15.9" fill="none"
                                    stroke={isDifferentUser ? '#ef4444' : '#7c3aed'}
                                    strokeWidth="3.5"
                                    strokeDasharray={`${(countdown / 5) * 100} 100`}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dasharray 1s linear' }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xl font-black text-slate-800">{countdown}</span>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Auto-refreshing in {countdown}s</p>
                    </div>

                    <button
                        onClick={() => window.location.reload()}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-sm transition-colors ${isDifferentUser ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                    >
                        <LogIn className="h-4 w-4" /> Refresh Now
                    </button>

                    <p className="text-[9px] text-slate-300 uppercase font-bold tracking-widest">
                        Session Security Guard • RentPe
                    </p>
                </div>
            </div>
        </div>
    );
}
