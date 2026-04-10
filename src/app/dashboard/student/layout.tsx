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
        <div className="flex bg-muted/30">
            <DashboardSidebar 
                role="student" 
                displayId={user?.displayId}
            />
            <main className="flex-1 p-4 md:p-8 h-[calc(100vh-4rem)] overflow-y-auto w-full">
                {children}
            </main>
        </div>
    );
}
