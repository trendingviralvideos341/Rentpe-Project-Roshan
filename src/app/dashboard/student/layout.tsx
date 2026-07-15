import { Suspense } from "react";
import DashboardSidebar from "@/components/layout/DashboardSidebar";
import { getCurrentUser } from "@/actions/auth";

export const dynamic = 'force-dynamic';

export default async function StudentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await getCurrentUser() as any;

    return (
        <div className="flex bg-muted/30 min-h-screen">
            <Suspense fallback={<div className="w-64 bg-card border-r min-h-screen hidden md:flex" />}>
                <DashboardSidebar 
                    role="student" 
                    displayId={user?.displayId}
                />
            </Suspense>
            <main className="flex-1  min-h-screen overflow-y-auto w-full">
                <Suspense fallback={<div className="flex h-full items-center justify-center p-8"><div className="animate-pulse flex flex-col items-center"><div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div><p className="mt-4 text-slate-500 font-medium">Loading Dashboard...</p></div></div>}>
                    {children}
                </Suspense>
            </main>
        </div>
    );
}
