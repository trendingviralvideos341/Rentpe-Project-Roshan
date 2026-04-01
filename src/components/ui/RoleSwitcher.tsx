'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { switchRole } from '@/actions/auth';
import { GraduationCap, Home, Loader2, ChevronRight } from 'lucide-react';

interface RoleSwitcherProps {
    roles: string[];
    currentRole: string;
}

export function RoleSwitcher({ roles, currentRole }: RoleSwitcherProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Only show if user holds more than one relevant role
    const hasStudent = roles.includes('USER') || roles.includes('STUDENT');
    const hasOwner = roles.includes('OWNER');

    if (!hasStudent || !hasOwner) return null;

    const isOwner = currentRole === 'OWNER';

    const handleSwitch = () => {
        const targetRole = isOwner ? 'USER' : 'OWNER';
        startTransition(async () => {
            try {
                await switchRole(targetRole as any);
                toast.success(
                    targetRole === 'OWNER'
                        ? '🏠 Switched to Owner Dashboard'
                        : '🎓 Switched to Student Dashboard'
                );
                // switchRole does a redirect server-side — router.refresh handles client sync
                router.refresh();
            } catch (err: any) {
                toast.error(err.message || 'Failed to switch role. Try again.');
            }
        });
    };

    return (
        <button
            onClick={handleSwitch}
            disabled={isPending}
            title={isOwner ? 'Switch to Student Dashboard' : 'Switch to Owner Dashboard'}
            className="group flex items-center gap-1 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 rounded-xl p-1 transition-all disabled:opacity-60 disabled:cursor-not-allowed select-none"
        >
            {/* Student pill */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                !isOwner
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'text-slate-500 group-hover:text-slate-700'
            }`}>
                <GraduationCap className="h-3.5 w-3.5" />
                <span>Student</span>
            </div>

            {/* Arrow */}
            <div className="flex items-center px-1">
                {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin" />
                ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                )}
            </div>

            {/* Owner pill */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                isOwner
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'text-slate-500 group-hover:text-slate-700'
            }`}>
                <Home className="h-3.5 w-3.5" />
                <span>Owner</span>
            </div>
        </button>
    );
}

export default RoleSwitcher;
