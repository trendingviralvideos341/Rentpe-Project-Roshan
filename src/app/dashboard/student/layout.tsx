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
            <main className="flex-1 p-4 md:p-8 min-h-screen overflow-y-auto w-full">
                {children}
            </main>
        </div>
    );
}
