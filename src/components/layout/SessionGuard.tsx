'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { checkSessionIntegrity } from '@/actions/auth';
import { AlertTriangle, RefreshCcw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SessionGuard() {
    const [mismatch, setMismatch] = useState<any>(null);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        const check = async () => {
            // Only check on dashboard routes
            if (!pathname.startsWith('/dashboard')) return;

            try {
                const result = await checkSessionIntegrity();
                if (result.status === 'mismatch') {
                    setMismatch(result);
                } else {
                    setMismatch(null);
                }
            } catch (e) {
                console.error("Session integrity check failed:", e);
            }
        };

        check();
        // Check every 10 seconds or on route change
        const interval = setInterval(check, 10000);
        return () => clearInterval(interval);
    }, [pathname]);

    if (!mismatch) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border-t-8 border-amber-500 animate-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="h-20 w-20 rounded-full bg-amber-100 flex items-center justify-center animate-bounce">
                        <ShieldAlert className="h-10 w-10 text-amber-600" />
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Session Update Detected</h2>

                    <p className="text-slate-600 leading-relaxed">
                        We noticed you switched to your <span className="font-bold text-blue-600 uppercase tracking-wide">{mismatch.currentRole}</span> account in another tab.
                        To keep your data safe, please refresh this page to switch views.
                    </p>

                    <div className="w-full pt-4 space-y-3">
                        <Button
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95"
                            onClick={() => window.location.reload()}
                        >
                            <RefreshCcw className="mr-2 h-4 w-4" /> Switch to {mismatch.currentRole} View
                        </Button>

                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                            Identity Security Guard • RentPe Platform
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
