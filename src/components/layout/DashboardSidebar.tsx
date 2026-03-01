'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building, Users, Calendar, Utensils, Ticket, Settings, CreditCard, UserPlus, Shield, ClipboardList, FileCheck, Trash2, FileText, Percent, ClipboardCheck, Search, CheckCircle2, Eye, UserCheck } from "lucide-react";
import { cn } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { getPendingBookingsCount } from "@/actions/bookings";
import { getPendingPropertiesCount } from "@/actions/admin";
import { getPendingOwnerActionCount } from "@/actions/properties";
import { LogoutButton } from "@/components/layout/LogoutButton";

interface SidebarProps {
    role: "owner" | "admin" | "student" | "onboarder" | "verifier";
}

export default function DashboardSidebar({ role }: SidebarProps) {
    const pathname = usePathname();
    const [pendingCount, setPendingCount] = useState(0);
    const [pendingPropCount, setPendingPropCount] = useState(0);

    useEffect(() => {
        if (role === "owner") {
            const checkBookings = async () => {
                const count = await getPendingBookingsCount();
                setPendingCount(count);
                const propCount = await getPendingOwnerActionCount();
                setPendingPropCount(propCount);
            };
            checkBookings();
            const interval = setInterval(checkBookings, 5000);
            return () => clearInterval(interval);
        }
        if (role === "admin") {
            const checkProps = async () => {
                const count = await getPendingPropertiesCount();
                setPendingPropCount(count);
            };
            checkProps();
            const interval = setInterval(checkProps, 5000);
            return () => clearInterval(interval);
        }
    }, [role]);

    const ownerLinks = [
        { href: "/dashboard/owner", label: "Overview", icon: LayoutDashboard },
        { href: "/dashboard/owner/properties", label: "My Properties", icon: Building, badge: pendingPropCount },
        { href: "/dashboard/owner/bookings", label: "Customer Bookings", icon: Users, badge: pendingCount },
        { href: "/dashboard/owner/onboarding", label: "Customer Onboarding", icon: ClipboardCheck },
        { href: "/dashboard/owner/tenants", label: "Tenants", icon: Calendar },
        { href: "/dashboard/owner/verifications", label: "Customer Doc Verifications", icon: FileCheck },
        { href: "/dashboard/owner/staff", label: "My Staff", icon: UserPlus },
        { href: "/dashboard/owner/food-menu", label: "Food Menu", icon: Utensils },
        { href: "/dashboard/owner/tickets", label: "Support Tickets", icon: Ticket },
        { href: "/dashboard/owner/payments", label: "Payments", icon: CreditCard },
        { href: "/dashboard/owner/activity-log", label: "Activity Log", icon: ClipboardList },
    ];

    const adminLinks = [
        { href: "/dashboard/admin", label: "Overview", icon: LayoutDashboard },
        { href: "/dashboard/admin/users", label: "User Management", icon: Users },
        { href: "/dashboard/admin/property-approval", label: "Property Approvals", icon: Building, badge: pendingPropCount },
        { href: "/dashboard/admin/bookings", label: "Customer Bookings", icon: Users },
        { href: "/dashboard/admin/onboarding", label: "Customer Onboarding", icon: ClipboardCheck },
        { href: "/dashboard/admin/doc-verification", label: "Customer Doc Verification", icon: FileCheck },
        { href: "/dashboard/admin/team", label: "Team & Roles", icon: Shield },
        { href: "/dashboard/admin/employees", label: "Employees", icon: UserCheck },
        { href: "/dashboard/admin/transactions", label: "All Transactions", icon: CreditCard },
        { href: "/dashboard/admin/audit-log", label: "Audit Log", icon: ClipboardList },
        { href: "/dashboard/admin/tickets", label: "Resolutions", icon: Ticket },
        { href: "/dashboard/admin/platform-fees", label: "Platform Fees", icon: Percent },
        { href: "/dashboard/admin/data-management", label: "Data Management", icon: Trash2 },
        { href: "/dashboard/admin/settings", label: "Settings", icon: Settings },
    ];

    const studentLinks = [
        { href: "/dashboard/student", label: "My Bookings", icon: LayoutDashboard },
        { href: "/dashboard/student/documents", label: "My Documents", icon: FileText },
        { href: "/search", label: "Find PG", icon: Building },
        { href: "/dashboard/student/tickets", label: "Support Tickets", icon: Ticket },
    ];

    const onboarderLinks = [
        { href: "/dashboard/onboarder", label: "Overview", icon: LayoutDashboard },
        { href: "/dashboard/onboarder/queue", label: "Pending Queue", icon: ClipboardList },
        { href: "/dashboard/onboarder/new", label: "New Field Visit", icon: UserPlus },
        { href: "/dashboard/onboarder/submissions", label: "My Submissions", icon: FileCheck },
    ];

    const verifierLinks = [
        { href: "/dashboard/verifier", label: "Overview", icon: LayoutDashboard },
        { href: "/dashboard/verifier/reviews", label: "Review Queue", icon: Search },
    ];

    const panelNames: Record<string, string> = {
        owner: "Owner Panel",
        admin: "Admin Panel",
        student: "Student Dashboard",
        onboarder: "Onboarding Team",
        verifier: "Verification Team",
    };

    const linkMap: Record<string, typeof ownerLinks> = {
        owner: ownerLinks,
        admin: adminLinks,
        student: studentLinks,
        onboarder: onboarderLinks,
        verifier: verifierLinks,
    };

    const links = linkMap[role] || studentLinks;

    return (
        <aside className="w-64 bg-card border-r h-full flex flex-col hidden md:flex sticky top-16">
            <div className="p-6">
                <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                    {panelNames[role] || "Dashboard"}
                </h2>
            </div>
            <nav className="flex-1 px-4 space-y-2">
                {links.map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.href;
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
        </aside>
    );
}
