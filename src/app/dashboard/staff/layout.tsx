import { Suspense } from "react";
import { getCurrentUser } from "@/actions/auth";
import DashboardSidebar from "@/components/layout/DashboardSidebar";
import { redirect } from "next/navigation";

export default async function StaffLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await getCurrentUser();

    if (!user || user.role !== 'STAFF') {
        redirect("/login");
    }

    const userData = user as any;
    const permissions = JSON.parse(userData.staffPermissions || "[]");

    return (
        <div className="flex h-screen bg-slate-50">
            <Suspense fallback={<div className="w-64 bg-card border-r h-full hidden md:flex" />}>
                <DashboardSidebar 
                    role="staff" 
                    permissions={permissions}
                    userName={userData.name}
                    displayId={userData.displayId}
                    isStaff={true}
                />
            </Suspense>
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
                    {children}
                </main>
            </div>
        </div>
    );
}
