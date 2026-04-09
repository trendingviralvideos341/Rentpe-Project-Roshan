'use client';

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, Building, Users, Calendar, Utensils, Ticket, Settings, CreditCard, UserPlus, Shield, ClipboardList, FileCheck, Trash2, FileText, Percent, ClipboardCheck, UserCheck, Menu, X, User, PowerOff, ArrowUpCircle, Wrench, Bell, RefreshCw, IndianRupee, Receipt, BarChart3, Download, MessageCircle, CalendarDays, MapPin, AlertTriangle, Send, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { getPendingBookingsCount, getStudentPendingActionsCount, getAdminAlertCounts } from "@/actions/bookings";
import { getPendingPropertiesCount, getDeactivationRequestCount } from "@/actions/admin";
import { getPendingOwnerActionCount } from "@/actions/properties";
import { getPendingDocumentsCount } from "@/actions/documents";
import { getPendingUpgradeCount } from "@/actions/roleUpgrade";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { getStudentFoodStatus } from "@/actions/food";

interface SidebarLink {
    href: string;
    label: string;
    icon: LucideIcon;
    badge?: number;
    reqPerm?: string[];
}

interface SidebarSection {
    title: string;
    links: SidebarLink[];
}

interface SidebarProps {
    role: "owner" | "admin" | "student" | "onboarder" | "verifier" | "staff";
    permissions?: string[];
    isStaff?: boolean;
    displayId?: string;
    userName?: string;
    isSuperAdmin?: boolean;
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
    const [deactivationCount, setDeactivationCount] = useState(0);
    const [roleUpgradeCount, setRoleUpgradeCount] = useState(0);
    const [foodStatus, setFoodStatus] = useState<{ label: string; href?: string; hasActiveBooking: boolean } | null>(null);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        if (role === "owner" || role === "staff") {
            const checkOwner = async () => {
                const count = await getPendingBookingsCount();
                setPendingCount(count);
                const propCount = await getPendingOwnerActionCount();
                setPendingPropCount(propCount);
                const docCount = await getPendingDocumentsCount();
                setPendingDocCount(docCount);
            };
            checkOwner();
            const interval = setInterval(checkOwner, 30000);
            return () => clearInterval(interval);
        }
        if (role === "admin") {
            const checkAdmin = async () => {
                const propCount = await getPendingPropertiesCount();
                setPendingPropCount(propCount);
                const alerts = await getAdminAlertCounts();
                setAdminAlerts(alerts);
                const deactCount = await getDeactivationRequestCount();
                setDeactivationCount(deactCount);
                const upgradeCount = await getPendingUpgradeCount();
                setRoleUpgradeCount(upgradeCount);
            };
            checkAdmin();
            const interval = setInterval(checkAdmin, 30000);
            return () => clearInterval(interval);
        }
        if (role === "student") {
            const checkStudent = async () => {
                const count = await getStudentPendingActionsCount();
                setStudentAlertCount(count);
                const food = await getStudentFoodStatus();
                setFoodStatus(food);
            };
            checkStudent();
            const interval = setInterval(checkStudent, 30000);
            return () => clearInterval(interval);
        }
    }, [role]);

    // Close mobile drawer on route change
    useEffect(() => {
        if (mobileOpen) {
            const timer = setTimeout(() => setMobileOpen(false), 0);
            return () => clearTimeout(timer);
        }
    }, [pathname, mobileOpen]);

    const ownerSections: SidebarSection[] = [
        {
            title: "Core",
            links: [
                { href: "/dashboard/owner", label: "Overview", icon: LayoutDashboard },
                { href: "/dashboard/owner?tab=profile", label: "My Profile", icon: User },
            ]
        },
        {
            title: "Property Mgmt",
            links: [
                { href: "/dashboard/owner/properties", label: "My Properties", icon: Building, badge: pendingPropCount, reqPerm: ["manage_properties", "register_property"] },
                { href: "/dashboard/owner/food-menu", label: "Service (Food Menu)", icon: Utensils, reqPerm: ["food_menu"] },
            ]
        },
        {
            title: "Tenant Operations",
            links: [
                { href: "/dashboard/owner/bookings", label: "Customer Bookings", icon: Users, badge: pendingCount, reqPerm: ["view_bookings", "approve_bookings"] },
                { href: "/dashboard/owner/onboarding", label: "Customer Onboarding", icon: ClipboardCheck, reqPerm: ["manage_tenants"] },
                { href: "/dashboard/owner/verifications", label: "KYC & Doc Verifications", icon: FileCheck, badge: pendingDocCount, reqPerm: ["manage_tenants"] },
                { href: "/dashboard/owner/tenants", label: "Active Tenants", icon: Calendar, reqPerm: ["manage_tenants"] },
                { href: "/dashboard/owner/maintenance", label: "Maintenance Requests", icon: Wrench, reqPerm: ["manage_tenants"] },
                { href: "/dashboard/owner/notices", label: "Vacating Notices", icon: Bell, reqPerm: ["manage_tenants"] },
                { href: "/dashboard/owner/room-changes", label: "Room Change Requests", icon: RefreshCw, reqPerm: ["manage_tenants"] },
            ]
        },
        {
            title: "Finance",
            links: [
                { href: "/dashboard/owner/payments", label: "Rent Payments", icon: CreditCard, reqPerm: ["view_payments", "mark_rent"] },
                { href: "/dashboard/owner/rent-collection", label: "Rent Collection", icon: IndianRupee, reqPerm: ["view_payments", "mark_rent"] },
                { href: "/dashboard/owner/deposits", label: "Security Deposits", icon: Shield, reqPerm: ["view_payments"] },
                { href: "/dashboard/owner/invoices/generate", label: "Generate Invoices", icon: Receipt, reqPerm: ["view_payments", "mark_rent"] },
                { href: "/dashboard/owner/analytics", label: "Analytics", icon: BarChart3, reqPerm: ["view_payments"] },
                { href: "/dashboard/owner/tax-summary", label: "Tax Export", icon: Download, reqPerm: ["view_payments"] },
                { href: "/dashboard/owner/settings/payment", label: "Payment Settings", icon: Settings, reqPerm: ["view_payments"] },
            ]
        },
        {
            title: "Team & Help",
            links: [
                { href: "/dashboard/owner/staff", label: "Management & Staff Team", icon: UserPlus, reqPerm: ["manage_staff"] },
                { href: "/dashboard/owner/tenant-log", label: "Tenant Log", icon: ClipboardList, reqPerm: ["manage_tenants"] },
                { href: "/dashboard/owner/availability", label: "Room Calendar", icon: CalendarDays, reqPerm: ["manage_tenants"] },
                { href: "/dashboard/owner/broadcast", label: "WhatsApp Broadcast", icon: MessageCircle, reqPerm: ["manage_tenants"] },
                { href: "/dashboard/owner/tickets", label: "Support Tickets", icon: Ticket, reqPerm: ["support"] },
                { href: "/dashboard/owner/activity-log", label: "Activity Log", icon: Receipt, reqPerm: ["view_activity"] },
            ]
        }
    ];

    const adminSections: SidebarSection[] = [
        {
            title: "Core",
            links: [
                { href: "/dashboard/admin", label: "Overview", icon: LayoutDashboard },
                { href: "/dashboard/admin?tab=profile", label: "My Profile", icon: Shield },
            ]
        },
        {
            title: "User Hub",
            links: [
                { href: "/dashboard/admin/users", label: "User Management", icon: Users, reqPerm: ["super_admin", "users"] },
                { href: "/dashboard/admin/team", label: "Team Roles (RBAC)", icon: Shield, reqPerm: ["super_admin"] },
                { href: "/dashboard/admin/employees", label: "Owner Staff Hub", icon: UserCheck, reqPerm: ["super_admin", "staff"] },
                { href: "/dashboard/admin/staff", label: "Internal Platform Staff", icon: Shield, reqPerm: ["super_admin", "staff"] },
                { href: "/dashboard/admin/role-upgrades", label: "Role Upgrade Requests", icon: ArrowUpCircle, badge: roleUpgradeCount, reqPerm: ["super_admin", "users"] },
            ]
        },
        {
            title: "Operations",
            links: [
                { href: "/dashboard/admin/kyc", label: "KYC Verification Queue", icon: FileCheck, badge: adminAlerts.verifications, reqPerm: ["super_admin", "properties"] },
                { href: "/dashboard/admin/properties", label: "Property Approval Queue", icon: Building, badge: pendingPropCount, reqPerm: ["super_admin", "properties"] },
                { href: "/dashboard/admin/property-approval", label: "Property Detail Review", icon: Building, reqPerm: ["super_admin", "properties"] },
                { href: "/dashboard/admin/deactivation-requests", label: "Deactivation Requests", icon: PowerOff, badge: deactivationCount, reqPerm: ["super_admin", "properties"] },
                { href: "/dashboard/admin/bookings", label: "Customer Bookings", icon: Calendar, badge: adminAlerts.bookings, reqPerm: ["super_admin", "bookings"] },
                { href: "/dashboard/admin/onboarding", label: "Customer Onboarding", icon: ClipboardCheck, reqPerm: ["super_admin", "operations"] },
                { href: "/dashboard/admin/doc-verification", label: "Doc KYC (Owner)", icon: FileCheck, reqPerm: ["super_admin", "properties"] },
                { href: "/dashboard/admin/tenants", label: "Active Tenants", icon: Users, reqPerm: ["super_admin", "operations"] },
                { href: "/dashboard/admin/cities", label: "City / Area Management", icon: MapPin, reqPerm: ["super_admin", "operations"] },
            ]
        },
        {
            title: "Resolution",
            links: [
                { href: "/dashboard/admin/disputes", label: "Dispute Resolution", icon: AlertTriangle, reqPerm: ["super_admin", "tickets"] },
                { href: "/dashboard/admin/refunds", label: "Refund Management", icon: CreditCard, reqPerm: ["super_admin", "payments"] },
                { href: "/dashboard/admin/tickets", label: "Support Tickets (SLA)", icon: Ticket, reqPerm: ["super_admin", "tickets"] },
                { href: "/dashboard/admin/notifications/send", label: "Bulk Notifications", icon: Send, reqPerm: ["super_admin"] },
            ]
        },
        {
            title: "Finance",
            links: [
                { href: "/dashboard/admin/payouts", label: "Owner Payouts", icon: IndianRupee, reqPerm: ["super_admin", "payments"] },
                { href: "/dashboard/admin/settings/commission", label: "Commission Config", icon: Percent, reqPerm: ["super_admin", "payments"] },
                { href: "/dashboard/admin/transactions", label: "Global Transactions", icon: CreditCard, reqPerm: ["super_admin", "payments"] },
                { href: "/dashboard/admin/platform-fees", label: "Revenue & Fees", icon: Receipt, reqPerm: ["super_admin", "payments"] },
            ]
        },
        {
            title: "Analytics",
            links: [
                { href: "/dashboard/admin/analytics", label: "Platform Analytics", icon: BarChart3, reqPerm: ["super_admin"] },
            ]
        },
        {
            title: "System & Settings",
            links: [
                { href: "/dashboard/admin/fraud", label: "🛡️ Fraud Management", icon: Shield, reqPerm: ["super_admin", "audit"] },
                { href: "/dashboard/admin/audit-log", label: "Security Audit Log", icon: ClipboardList, reqPerm: ["super_admin", "audit"] },
                { href: "/dashboard/admin/data-management", label: "System Maintenance", icon: Trash2, reqPerm: ["super_admin"] },
                { href: "/dashboard/admin/settings", label: "Platform Settings", icon: Settings, reqPerm: ["super_admin"] },
            ]
        }
    ];

    const studentLinks: SidebarLink[] = [
        { href: "/dashboard/student", label: "My Bookings", icon: LayoutDashboard, badge: studentAlertCount },
        { href: "/dashboard/student?tab=profile", label: "My Profile", icon: User },
        { href: "/dashboard/student/documents", label: "My Documents", icon: FileText },
        { href: "/dashboard/student/payments", label: "Payment History", icon: CreditCard },
        { href: "/dashboard/student/maintenance", label: "Maintenance", icon: Wrench },
        { href: "/dashboard/student/notice", label: "Vacating Notice", icon: Bell },
        { href: "/dashboard/student/room-change", label: "Room Change", icon: RefreshCw },
    ];

    if (foodStatus) {
        studentLinks.push({
            href: foodStatus.href || "#",
            label: foodStatus.label,
            icon: Utensils,
        });
    }

    studentLinks.push(
        { href: "/search", label: "Find PG", icon: Building },
        { href: "/dashboard/student/tickets", label: "Support Tickets", icon: Ticket },
    );

    const studentSections: SidebarSection[] = [
        {
            title: "Menu",
            links: studentLinks
        }
    ];

    // Staff sections: only routes that actually make sense for staff (no analytics, tax, deposits, settings)
    const STAFF_ALLOWED_ROUTES = [
        "/dashboard/owner/bookings",
        "/dashboard/owner/onboarding",
        "/dashboard/owner/verifications",
        "/dashboard/owner/tenants",
        "/dashboard/owner/maintenance",
        "/dashboard/owner/notices",
        "/dashboard/owner/room-changes",
        "/dashboard/owner/payments",
        "/dashboard/owner/rent-collection",
        "/dashboard/owner/properties",
        "/dashboard/owner/food-menu",
        "/dashboard/owner/availability",
        "/dashboard/owner/broadcast",
        "/dashboard/owner/tickets",
        "/dashboard/owner/tenant-log",
    ];

    const staffSections: SidebarSection[] = ownerSections
        .map(section => ({
            ...section,
            links: section.links.filter(link =>
                STAFF_ALLOWED_ROUTES.includes(link.href.split('?')[0])
            )
        }))
        .filter(section => section.links.length > 0);

    const perms = props.permissions || [];
    const isSuperAdmin =
        perms.includes("super_admin") ||
        (role === "admin" && props.isSuperAdmin) ||
        (role === "admin" && perms.length === 0 && !props.isStaff) ||
        (role === "owner" && !props.isStaff); // Primary owners have full access

    const panelNames: Record<string, string> = {
        owner: "Owner Dashboard",
        admin: isSuperAdmin ? "Super Admin Dashboard" : "Staff Portal Dashboard",
        student: "Tenant Dashboard",
        staff: "Staff Portal Dashboard",
        onboarder: "Staff Portal Dashboard",
        verifier: "Staff Portal Dashboard",
    };

    const filterSectionLinks = (sections: SidebarSection[]) => {
        return sections.map(section => ({
            ...section,
            links: section.links.filter(link => {
                const path = link.href.split('?')[0];
                if (path === "/dashboard/staff" || path === "/dashboard/owner" || path === "/dashboard/admin" || path === "/dashboard/student") return true; // Always show overview
                if (path.includes("tab=profile")) return true; // Always show profile
                
                if (!link.reqPerm) return true;
                if (isSuperAdmin) return true;
                return link.reqPerm.some(p => perms.includes(p));
            })
        })).filter(section => section.links.length > 0);
    };

    const sectionMap: Record<string, SidebarSection[]> = {
        owner: filterSectionLinks(ownerSections),
        admin: filterSectionLinks(adminSections),
        student: studentSections,
        staff: filterSectionLinks(staffSections),
    };

    const currentSections = sectionMap[role] || studentSections;

    const navContent = (
        <>
            <div className="p-6">
                <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                    {panelNames[role] || "Dashboard"}
                </h2>
                {props.displayId && (
                    <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest mt-1 group-hover:text-primary transition-colors">
                        🆔 {props.displayId}
                    </p>
                )}
            </div>
            <nav className="flex-1 px-4 pb-8 space-y-6 overflow-y-auto no-scrollbar">
                {currentSections.map((section) => (
                    <div key={section.title} className="space-y-1">
                        {role !== "student" && (
                            <h3 className="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2">
                                {section.title}
                            </h3>
                        )}
                        <div className="space-y-1">
                            {section.links.map((link) => {
                                const Icon = link.icon;
                                const linkPath = link.href.split('?')[0];
                                const linkTab = link.href.includes('tab=') ? link.href.split('tab=')[1] : null;
                                const currentTab = searchParams.get('tab') || 'overview';

                                const isActive = pathname === linkPath && (
                                    linkTab ? currentTab === linkTab : currentTab === 'overview'
                                );
                                const badge = link.badge;
                                const isGreyedOut = (link.label === 'Food' || link.label === 'No food option available') && link.href === "#";

                                if (isGreyedOut) {
                                    return (
                                        <div
                                            key={link.label}
                                            className="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground/40 cursor-not-allowed"
                                        >
                                            <Icon className="h-5 w-5" />
                                            <span className="text-sm">{link.label}</span>
                                        </div>
                                    );
                                }

                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={cn(
                                            "flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 relative group/link",
                                            isActive
                                                ? "bg-primary/10 text-primary font-bold shadow-sm ring-1 ring-primary/20"
                                                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground hover:translate-x-1"
                                        )}
                                    >
                                        <Icon className={cn(
                                            "h-5 w-5 transition-transform duration-300",
                                            isActive ? "scale-110" : "group-hover/link:scale-110"
                                        )} />
                                        <span className="text-sm">{link.label}</span>
                                        {badge !== undefined && badge > 0 && (
                                            <span className="absolute right-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-lg shadow-red-200">
                                                {badge}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
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
                suppressHydrationWarning
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
                                suppressHydrationWarning
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

