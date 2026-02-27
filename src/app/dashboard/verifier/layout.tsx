import DashboardSidebar from "@/components/layout/DashboardSidebar";
export const dynamic = 'force-dynamic';
export default function VerifierLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex bg-muted/30">
            <DashboardSidebar role="verifier" />
            <main className="flex-1 p-8 h-[calc(100vh-4rem)] overflow-y-auto w-full">{children}</main>
        </div>
    );
}
