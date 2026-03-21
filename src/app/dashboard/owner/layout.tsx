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
            <main className="flex-1 p-8 bg-[#f8faff] bg-[radial-gradient(at_0%_0%,rgba(199,210,254,0.4)_0,transparent_50%),radial-gradient(at_100%_100%,rgba(221,214,254,0.4)_0,transparent_50%)] selection:bg-purple-100 min-h-screen relative overflow-hidden">
                {/* Subtle grid pattern using CSS */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.05)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent)] pointer-events-none"></div>
                
                <div className="relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-700">
                    {children}
                </div>
            </main>
        </div>
    );
}
