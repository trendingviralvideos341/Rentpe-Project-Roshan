'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';

/**
 * NavbarWrapper — suppresses the global Navbar on all /dashboard/* routes.
 * Dashboard pages have their own DashboardSidebar, so showing the top Navbar
 * there causes a double-navigation UX issue.
 */
export default function NavbarWrapper({ session }: { session: any }) {
    const pathname = usePathname();
    const isDashboard = pathname?.startsWith('/dashboard');
    const isImpersonating = !!session?.impersonatorId;

    if (isDashboard) {
        if (isImpersonating) return <Navbar session={session} onlyBar={true} />;
        return null;
    }
    return <Navbar session={session} />;
}
