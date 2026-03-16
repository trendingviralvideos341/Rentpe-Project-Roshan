import DashboardSidebar from "@/components/layout/DashboardSidebar";
import { getCurrentUser } from "@/actions/auth";

export const dynamic = 'force-dynamic';

export default async function OwnerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await getCurrentUser() as any;
    const permissions = (() => {
        if (!user?.staffPermissions) return [];
        try {
            return JSON.parse(user.staffPermissions);
        } catch (e) {
            return [];
        }
    })();
    const isStaff = !!user?.parentOwnerId;

    return (
        <div className="flex min-h-[calc(100vh-4rem)]">
            <DashboardSidebar 
                role="owner" 
                permissions={permissions} 
                isStaff={isStaff} 
                displayId={user?.displayId} 
            />
            <main className="flex-1 p-8 bg-muted/10">
                {children}
            </main>
        </div>
    );
}
