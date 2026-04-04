'use client';

import { useTransition } from 'react';
import { switchRole } from '@/actions/auth';
import { toast } from 'sonner';

export function RoleSwitcher({ currentRole, roles }: {
    currentRole: string,
    roles: string[]
}) {
    const [isPending, startTransition] = useTransition();

    const handleSwitch = (targetRole: string) => {
        if (targetRole === currentRole || isPending) return;

        startTransition(async () => {
            const toastId = toast.loading(
                `Switching to ${targetRole === 'OWNER' ? '🏠 Owner' : '🎓 Student'} Dashboard...`
            );
            try {
                await switchRole(targetRole as any);
            } catch (err: any) {
                // switchRole() calls Next.js redirect() server-side which throws NEXT_REDIRECT — expected.
                // WHY window.location.href (not router.push + router.refresh):
                // router.push()    = client-side nav, reuses existing session cache ❌
                // router.refresh() = re-fetches server components but has cookie timing race ❌
                // window.location.href = full browser reload, reads fresh JWT cookie from scratch ✅
                toast.success(
                    `Switched to ${targetRole === 'OWNER' ? '🏠 Owner' : '🎓 Student'} Dashboard`,
                    { id: toastId }
                );
                if (targetRole === 'OWNER') {
                    window.location.href = '/dashboard/owner';
                } else {
                    window.location.href = '/dashboard/student';
                }
            }
        });
    };

    // Only render if user holds more than one relevant role
    if (!roles || roles.length <= 1) return null;

    return (
        <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1 border border-slate-200 shadow-sm">
            {roles.includes('USER') && (
                <button
                    onClick={() => handleSwitch('USER')}
                    disabled={isPending}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black transition-all duration-200 ${
                        currentRole === 'USER'
                            ? 'bg-purple-600 text-white shadow-md scale-[1.02]'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    🎓 Student
                </button>
            )}
            {roles.includes('OWNER') && (
                <button
                    onClick={() => handleSwitch('OWNER')}
                    disabled={isPending}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black transition-all duration-200 ${
                        currentRole === 'OWNER'
                            ? 'bg-purple-600 text-white shadow-md scale-[1.02]'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    🏠 Owner
                </button>
            )}
        </div>
    );
}

export default RoleSwitcher;
