'use client';

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, Building, Users, Calendar, Utensils, Ticket, Settings, CreditCard, UserPlus, Shield, ClipboardList, FileCheck, Trash2, FileText, Percent, ClipboardCheck, Search, CheckCircle2, Eye, UserCheck, Menu, X, User, TrendingUp } from "lucide-react";
import { cn } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { getPendingBookingsCount, getStudentPendingActionsCount, getAdminAlertCounts } from "@/actions/bookings";
import { getPendingPropertiesCount } from "@/actions/admin";
import { getPendingOwnerActionCount } from "@/actions/properties";
import { getPendingDocumentsCount } from "@/actions/documents";
import { LogoutButton } from "@/components/layout/LogoutButton";

interface SidebarProps {
    role: "owner" | "admin" | "student" | "onboarder" | "verifier";
    permissions?: string[];
}

export default function DashboardSidebar(props: SidebarProps) {
    const { role } = props;
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [pendingCount, setPendingCount] = useState(0);
    const [pendingPropCount, setPendingPropCount] = useState(0);
    const [pendingDocCount, setPendingDocCount] = useState(0);
    const [studentAlertCount, setStudentAlertCount] = useState(0);
    const [adminAlerts, setAdminAlerts] = useState({ bookings: 0, verifications: 0 });
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        if (role === "owner") {
            const checkOwner = async () => {
                const count = await getPendingBookingsCount();
                setPendingCount(count);
                const propCount = await getPendingOwnerActionCount();
                setPendingPropCount(propCount);
                const docCount = await getPendingDocumentsCount();
                setPendingDocCount(docCount);
            };
            checkOwner();
            const interval = setInterval(checkOwner, 5000);
            return () => clearInterval(interval);
        }
        if (role === "admin") {
            const checkAdmin = async () => {
                const propCount = await getPendingPropertiesCount();
                setPendingPropCount(propCount);
                const alerts = await getAdminAlertCounts();
                setAdminAlerts(alerts);
            };
            checkAdmin();
            const interval = setInterval(checkAdmin, 5000);
            return () => clearInterval(interval);
        }
        if (role === "student") {
            const checkStudent = async () => {
                const count = await getStudentPendingActionsCount();
                setStudentAlertCount(count);
            };
            checkStudent();
            const interval = setInterval(checkStudent, 5000);
            return () => clearInterval(interval);
        }
    }, [role]);

    // Close mobile drawer on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    const ownerLinks = [
        { href: "/dashboard/owner", label: "Overview", icon: LayoutDashboard },
        { href: "/dashboard/owner?tab=profile", label: "My Profile", icon: User },
        { href: "/dashboard/owner/properties", label: "My Properties", icon: Building, badge: pendingPropCount },
        { href: "/dashboard/owner/bookings", label: "Customer Bookings", icon: Users, badge: pendingCount },
        { href: "/dashboard/owner/onboarding", label: "Customer Onboarding", icon: ClipboardCheck },
        { href: "/dashboard/owner/verifications", label: "KYC & Doc Verifications", icon: FileCheck, badge: pendingDocCount },
        { href: "/dashboard/owner/tenants", label: "Active Tenants", icon: Calendar },
        { href: "/dashboard/owner/payments", label: "Rent Payments", icon: CreditCard },
        { href: "/dashboard/owner/food-menu", label: "Service (Food Menu)", icon: Utensils },
        { href: "/dashboard/owner/staff", label: "Management Team", icon: UserPlus },
        { href: "/dashboard/owner/tickets", label: "Support Tickets", icon: Ticket },
        { href: "/dashboard/owner/activity-log", label: "Activity Log", icon: ClipboardList },
        { href: "/dashboard/owner/settings/payment", label: "Payment Settings", icon: Settings },
    ];

    const adminLinks = [
        { href: "/dashboard/admin", label: "Overview", icon: LayoutDashboard },
        { href: "/dashboard/admin?tab=profile", label: "My Profile", icon: Shield },
        { href: "/dashboard/admin/users", label: "User Management", icon: Users, reqPerm: ["super_admin", "sub_admin"] },
        { href: "/dashboard/admin/property-approval", label: "Property Approvals", icon: Building, badge: pendingPropCount, reqPerm: ["super_admin", "sub_admin", "property_manager"] },
        { href: "/dashboard/admin/bookings", label: "Platform Bookings", icon: Calendar, badge: adminAlerts.bookings, reqPerm: ["super_admin", "sub_admin", "booking_manager"] },
        { href: "/dashboard/admin/onboarding", label: "Customer Onboarding", icon: ClipboardCheck, reqPerm: ["super_admin", "sub_admin", "onboarder"] },
        { href: "/dashboard/admin/doc-verification", label: "KYC Verifications", icon: FileCheck, badge: adminAlerts.verifications, reqPerm: ["super_admin", "sub_admin", "verifier"] },
        { href: "/dashboard/admin/tenants", label: "Active Tenants", icon: Users, reqPerm: ["super_admin", "sub_admin", "property_manager"] },
        { href: "/dashboard/admin/transactions", label: "Global Transactions", icon: CreditCard, reqPerm: ["super_admin", "finance_admin"] },
        { href: "/dashboard/admin/team", label: "Team Roles (RBAC)", icon: Shield, reqPerm: ["super_admin"] },
        { href: "/dashboard/admin/employees", label: "Employee Hub", icon: UserCheck, reqPerm: ["super_admin", "hr_admin"] },
        { href: "/dashboard/admin/tickets", label: "Resolution Center", icon: Ticket, reqPerm: ["super_admin", "sub_admin", "support"] },
        { href: "/dashboard/admin/platform-fees", label: "Revenue & Fees", icon: Percent, reqPerm: ["super_admin", "finance_admin"] },
        { href: "/dashboard/admin/audit-log", label: "Security Audit Log", icon: ClipboardList, reqPerm: ["super_admin", "security_audit"] },
        { href: "/dashboard/admin/data-management", label: "System Maintenance", icon: Trash2, reqPerm: ["super_admin"] },
        { href: "/dashboard/admin/settings", label: "Platform Settings", icon: Settings, reqPerm: ["super_admin"] },
    ];

    const studentLinks = [
        { href: "/dashboard/student", label: "My Bookings", icon: LayoutDashboard, badge: studentAlertCount },
        { href: "/dashboard/student?tab=profile", label: "My Profile", icon: User },
        { href: "/dashboard/student/documents", label: "My Documents", icon: FileText },
        { href: "/search", label: "Find PG", icon: Building },
        { href: "/dashboard/student/tickets", label: "Support Tickets", icon: Ticket },
    ];

    const panelNames: Record<string, string> = {
        owner: "Owner Panel",
        admin: "Admin Panel",
        student: "Student Dashboard",
    };

    // Filter Admin Links based on RBAC Permissions
    let filteredAdminLinks = adminLinks;
    const perms = props.permissions || [];
    // If the user is the founding ADMIN (no specific granular permissions assigned yet) or explicitly has super_admin
    const isSuperAdmin =
        perms.includes("super_admin") ||
        perms.includes("sub_admin") ||
        (role === "admin" && perms.length === 0);

    if (!isSuperAdmin) {
        filteredAdminLinks = adminLinks.filter(link => {
            if (!link.reqPerm) return true; // Overview and Profile have no reqPerm, always show
            // If the link has required permissions, check if the user has any of them
            return link.reqPerm.some(p => perms.includes(p));
        });
    }

    const linkMap: Record<string, any[]> = {
        owner: ownerLinks,
        admin: filteredAdminLinks,
        student: studentLinks,
    };

    const links = linkMap[role] || studentLinks;

    const navContent = (
        <>
            <div className="p-6">
                <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                    {panelNames[role] || "Dashboard"}
                </h2>
            </div>
            <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
                {links.map((link) => {
                    const Icon = link.icon;
                    // Improved active state logic to handle query params
                    const linkPath = link.href.split('?')[0];
                    const linkTab = link.href.includes('tab=') ? link.href.split('tab=')[1] : null;
                    const currentTab = searchParams.get('tab') || 'overview';

                    const isActive = pathname === linkPath && (
                        linkTab ? currentTab === linkTab : currentTab === 'overview'
                    );

                    const badge = (link as any).badge;
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors relative",
                                isActive
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <Icon className="h-5 w-5" />
                            <span>{link.label}</span>
                            {badge > 0 && (
                                <span className="absolute right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                                    {badge}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4 border-t">
                <LogoutButton />
            </div>
        </>
    );

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="w-64 bg-card border-r h-full flex-col hidden md:flex sticky top-16">
                {navContent}
            </aside>

            {/* Mobile Hamburger Button */}
            <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary text-white rounded-full shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                aria-label="Open menu"
            >
                <Menu className="w-6 h-6" />
            </button>

            {/* Mobile Drawer Overlay */}
            {mobileOpen && (
                <div className="md:hidden fixed inset-0 z-50 flex">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setMobileOpen(false)}
                    />

                    {/* Drawer */}
                    <aside className="relative w-72 max-w-[85vw] bg-card h-full flex flex-col shadow-2xl animate-in slide-in-from-left duration-300">
                        <div className="absolute top-4 right-4">
                            <button
                                onClick={() => setMobileOpen(false)}
                                className="p-2 rounded-full hover:bg-muted transition-colors"
                                aria-label="Close menu"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {navContent}
                    </aside>
                </div>
            )}
        </>
    );
}

