import DashboardSidebar from "@/components/layout/DashboardSidebar";
import { getCurrentUser } from "@/actions/auth";

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await getCurrentUser() as any;

    return (
        <div className="flex bg-[#f8faff] bg-[radial-gradient(at_0%_0%,rgba(199,210,254,0.4)_0,transparent_50%),radial-gradient(at_100%_100%,rgba(221,214,254,0.4)_0,transparent_50%)] min-h-screen">
            <DashboardSidebar 
                role="admin" 
                permissions={user?.permissions || []} 
                displayId={user?.displayId}
                userName={user?.name}
                isSuperAdmin={user?.isSuperAdmin}
            />
            <main className="flex-1 p-4 md:p-8 h-[calc(100vh-4rem)] overflow-y-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out">
                {children}
            </main>
        </div>
    );
}
