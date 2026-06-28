import { Suspense } from "react";
import DashboardSidebar from "@/components/layout/DashboardSidebar";
import { getCurrentUser } from "@/actions/auth";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export default async function OwnerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await getCurrentUser().catch(() => null) as any;
    const permissions = (() => {
        if (!user?.staffPermissions) return [];
        try {
            return JSON.parse(user.staffPermissions);
        } catch (e) {
            return [];
        }
    })();
    const isStaff = !!user?.parentOwnerId;

    // GST Turnover Warning Banner Query
    const ownerId = user?.parentOwnerId || user?.id;
    let activeGstAlert: any = null;

    if (ownerId) {
        const properties = await prisma.property.findMany({
            where: { ownerId },
            select: { gstNumber: true }
        });
        const hasAnyGst = properties.some(p => p.gstNumber && p.gstNumber.trim().length > 0);

        if (!hasAnyGst) {
            activeGstAlert = await prisma.notification.findFirst({
                where: {
                    userId: user.id,
                    type: { in: ["GST_LIMIT_18_LAKHS", "GST_LIMIT_19_LAKHS", "GST_LIMIT_19_5_LAKHS", "GST_LIMIT_EXCEEDED"] },
                    isRead: false
                },
                orderBy: { createdAt: 'desc' }
            });
        }
    }

    return (
        <div className="flex min-h-screen">
            <Suspense fallback={<div className="w-64 bg-card border-r min-h-screen hidden md:flex" />}>
                <DashboardSidebar 
                    role="owner" 
                    permissions={permissions} 
                    isStaff={isStaff} 
                    displayId={user?.displayId} 
                />
            </Suspense>
            <main className="flex-1 p-4 md:p-8 bg-[#f8faff] bg-[radial-gradient(at_0%_0%,rgba(199,210,254,0.4)_0,transparent_50%),radial-gradient(at_100%_100%,rgba(221,214,254,0.4)_0,transparent_50%)] selection:bg-purple-100 min-h-screen relative overflow-hidden">
                <div className="relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-700">
                    
                    {/* GST Warning Banner */}
                    {activeGstAlert && (
                        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-4 shadow-sm animate-in slide-in-from-top duration-300">
                            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                                <svg className="w-5 h-5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div className="flex-1 space-y-1">
                                <p className="font-bold text-amber-900 text-sm">Action Required: GST Registration Limit Alert</p>
                                <p className="text-xs text-amber-700 leading-relaxed">{activeGstAlert.message}</p>
                                <div className="flex items-center gap-3 mt-2">
                                    <a
                                        href="/dashboard/owner/properties"
                                        className="inline-flex items-center gap-1 text-xs font-black text-amber-950 hover:underline"
                                    >
                                        Go to Properties Settings to update GSTIN →
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    {children}
                </div>
            </main>
        </div>
    );
}
