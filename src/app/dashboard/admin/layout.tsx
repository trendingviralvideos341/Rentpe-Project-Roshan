import DashboardSidebar from "@/components/layout/DashboardSidebar";
import { getSession } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();

    return (
        <div className="flex bg-muted/30">
            <DashboardSidebar role="admin" permissions={(session as any)?.permissions || []} />
            <main className="flex-1 p-8 h-[calc(100vh-4rem)] overflow-y-auto w-full">
                {children}
            </main>
        </div>
    );
}
