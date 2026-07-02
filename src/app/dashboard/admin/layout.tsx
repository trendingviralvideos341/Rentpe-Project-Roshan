import { Suspense } from "react";
import DashboardSidebar from "@/components/layout/DashboardSidebar";
import { getCurrentUser } from "@/actions/auth";
import { PageExplainer } from "@/components/dashboard/PageExplainer";

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await getCurrentUser() as any;

    return (
        <div className="flex bg-[#f8faff] bg-[radial-gradient(at_0%_0%,rgba(199,210,254,0.4)_0,transparent_50%),radial-gradient(at_100%_100%,rgba(221,214,254,0.4)_0,transparent_50%)] min-h-screen">
            <Suspense fallback={<div className="w-64 bg-card border-r min-h-screen hidden md:flex" />}>
                <DashboardSidebar 
                    role="admin" 
                    permissions={user?.permissions || []} 
                    displayId={user?.displayId}
                    userName={user?.name}
                    isSuperAdmin={user?.isSuperAdmin}
                />
            </Suspense>
            <main className="flex-1 p-4 md:p-8 min-h-screen overflow-y-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out">
                <PageExplainer role="admin" />
                {children}
            </main>
        </div>
    );
}
