import DashboardSidebar from "@/components/layout/DashboardSidebar";

export const dynamic = 'force-dynamic';

export default function OwnerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-[calc(100vh-4rem)]">
            <DashboardSidebar role="owner" />
            <main className="flex-1 p-8 bg-muted/10">
                {children}
            </main>
        </div>
    );
}
