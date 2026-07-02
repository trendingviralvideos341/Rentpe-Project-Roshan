"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, ChevronDown, ChevronUp, BookOpen, Layers, ShieldAlert, Sparkles } from "lucide-react";

interface GuideItem {
    title: string;
    description: string;
    whatItDoes: string;
    howItWorks: string;
    whoUsesIt: string;
}

const adminGuides: Record<string, GuideItem> = {
    "/dashboard/admin": {
        title: "Platform Overview",
        description: "Global monitoring command center for RentPe platform administrators.",
        whatItDoes: "Displays high-level analytics, occupancy metrics, support ticket status, and live server checks.",
        howItWorks: "Queries real-time counts from Database tables (Tenants, Bookings, Properties, Tickets) to build aggregated KPI cards.",
        whoUsesIt: "Super Admins and platform managers for operational visibility."
    },
    "/dashboard/admin/users": {
        title: "User Management Registry",
        description: "Comprehensive administration control for all platform users.",
        whatItDoes: "Enables searching profiles, updating details, issuing warning points, and banning or unbanning accounts.",
        howItWorks: "Directly reads and mutates the core User database records, writing logs to ActionNote and AuditLog.",
        whoUsesIt: "Operations Team and Security Officers to manage resident and owner accounts."
    },
    "/dashboard/admin/internal-team": {
        title: "Internal Team Hub",
        description: "Manages platform employee records, roles, and action tracking.",
        whatItDoes: "Maintains roles (Auditor, Onboarder, Verifier), tracks task history, and displays employee stats.",
        howItWorks: "Queries the AdminEmployee and TeamMember registries, linking actions to internal accounts.",
        whoUsesIt: "Super Admins to manage internal human resource access levels."
    },
    "/dashboard/admin/role-upgrades": {
        title: "Role Upgrade Approvals",
        description: "Approves requested transitions from tenant accounts to property owners.",
        whatItDoes: "Allows review of property owner application details (estimated properties, rooms) and updates account permissions.",
        howItWorks: "Manages status in RoleUpgradeRequest, upgrading User.primaryRole to 'OWNER' upon approval.",
        whoUsesIt: "Compliance Managers to onboard verified property owners."
    },
    "/dashboard/admin/verifications": {
        title: "Verification Centre",
        description: "Legal and compliance document audit hub.",
        whatItDoes: "Audits uploaded government KYC documentation (Aadhaar, PAN, Student IDs) for accuracy.",
        howItWorks: "Loads TenantDocument files, updating state to APPROVED or REJECTED with feedback notes.",
        whoUsesIt: "Verifier Staff to ensure legal tenant onboarding."
    },
    "/dashboard/admin/properties": {
        title: "Property Approval Queue",
        description: "Property listing quality control queue.",
        whatItDoes: "Reviews owner listings, pricing structures, photos, bank details, and license verification documents.",
        howItWorks: "Switches Property.status from 'PENDING_VERIFICATION' to 'VERIFIED' (visible on home search) or rejects it.",
        whoUsesIt: "Onboarder Staff to approve and launch active PGs on the web search portal."
    },
    "/dashboard/admin/deactivation-requests": {
        title: "Property Deactivation Control",
        description: "Listing deactivation and deletion queue.",
        whatItDoes: "Safely takes properties offline or deactivates them, ensuring no active tenancies are harmed.",
        howItWorks: "Reviews pending property closure requests, updating status to DEACTIVATED if all balances are cleared.",
        whoUsesIt: "Super Admins to handle business exit or compliance shutdowns."
    },
    "/dashboard/admin/bookings": {
        title: "Customer Bookings Hub",
        description: "Platform reservation tracker and onboarding checkpoint.",
        whatItDoes: "Monitors onboarding status, deposit payments, agreement signatures, and check-in schedules.",
        howItWorks: "Tracks state changes in the Booking schema (APPLIED, APPROVED, TOKEN_PAID, AGREEMENT_SIGNED, ACTIVE).",
        whoUsesIt: "Booking Staff to resolve onboarding issues and monitor student entry."
    },
    "/dashboard/admin/tenants": {
        title: "Master Tenants Ledger",
        description: "Unified view of active residents across the platform.",
        whatItDoes: "Details current room assignments, tenancy start dates, and tracks monthly rent status.",
        howItWorks: "Aggregates the Tenant database joined with active RentRecord entries for current and historical billing.",
        whoUsesIt: "Operations Team to audits current residents and platform occupancy."
    },
    "/dashboard/admin/cities": {
        title: "City & Area Configurator",
        description: "Administrative control of search parameters and coverage areas.",
        whatItDoes: "Adds, removes, or modifies active operating cities and local search tags.",
        howItWorks: "Updates search index databases, configuring geographical areas available to students.",
        whoUsesIt: "Operations Team to expand platform services to new cities."
    },
    "/dashboard/admin/tickets": {
        title: "Support Tickets Helpdesk",
        description: "Platform-wide customer support resolution center.",
        whatItDoes: "Resolves disputes, assigns staff to issues, logs communication notes, and updates ticket status.",
        howItWorks: "Uses Ticket and TicketMessage models to route communication between users and admins.",
        whoUsesIt: "Support Managers to resolve tenant and owner complaints."
    },
    "/dashboard/admin/refunds": {
        title: "Refund Control Center",
        description: "Treasury management for platform cashflows.",
        whatItDoes: "Audits, processes, and tracks platform fee refunds or security deposit releases.",
        howItWorks: "Bridges Payment logs with payment gateway APIs (Razorpay) to verify refund execution.",
        whoUsesIt: "Finance Managers to verify and execute monetary refunds."
    },
    "/dashboard/admin/notifications/send": {
        title: "Bulk Notification Center",
        description: "Broadcasting hub for platform messages.",
        whatItDoes: "Sends real-time banner alerts or transactional emails in bulk to target roles.",
        howItWorks: "Writes records into the Notification model and triggers system-wide push and email tasks.",
        whoUsesIt: "Marketing and Operations Team for system alerts and announcements."
    },
    "/dashboard/admin/payouts": {
        title: "Owner Payouts Desk",
        description: "Fintech control hub for property owner disbursements.",
        whatItDoes: "Releases student rent collections from nodal accounts to individual owners, minus commissions.",
        howItWorks: "Initiates Razorpay Route transfers, checking transferStatus and logging payout completions.",
        whoUsesIt: "Finance Admins to execute monthly disbursements safely."
    },
    "/dashboard/admin/deposit-control": {
        title: "🛡️ Deposit Control",
        description: "Security deposit escrow audit and compliance shield.",
        whatItDoes: "Ensures owners refund security deposits within 15 days of move-out. Blocks payouts if breached.",
        howItWorks: "Reads SecurityDeposit table, triggering Rent Withholding shields on overdue refunds.",
        whoUsesIt: "Compliance Officers to protect tenant deposit rights."
    },
    "/dashboard/admin/onboarding-fees": {
        title: "Property Listing Fees",
        description: "Tracks owner payment for property listings.",
        whatItDoes: "Monitors PG onboarding payments, invoices, and payment statuses.",
        howItWorks: "Reads Payment records marked for property registration fees.",
        whoUsesIt: "Finance Admins to audit listing revenues."
    },
    "/dashboard/admin/financial-ledger": {
        title: "Financial Ledger & Taxes",
        description: "GST and commission revenue reporting dashboard.",
        whatItDoes: "Calculates total platform fee collections, 18% GST allocations, and net platform revenues.",
        howItWorks: "Aggregates revenue calculations from PlatformFee data for GST audits and accounting reports.",
        whoUsesIt: "Finance Head and Chartered Accountants (CAs) for corporate tax filing."
    },
    "/dashboard/admin/transactions": {
        title: "Global Transactions Ledger",
        description: "Comprehensive financial transaction registry.",
        whatItDoes: "Logs every transaction (rent, deposits, platform fees) processed via the platform.",
        howItWorks: "Fetches live transactional details from the Payment model with gateway references (Razorpay ID).",
        whoUsesIt: "Finance Officers to audit and reconcile transaction failures."
    },
    "/dashboard/admin/platform-fees": {
        title: "Commission & Configuration Settings",
        description: "Platform tariff and core parameter engine.",
        whatItDoes: "Adjusts global commission percentages, convenience fee rates, and onboarding fees.",
        howItWorks: "Mutates singleton values in PlatformSettings, applying updates instantly across all checkout pages.",
        whoUsesIt: "Super Admins to update platform monetisation settings."
    },
    "/dashboard/admin/fraud": {
        title: "Fraud Prevention & Flags",
        description: "Security and anti-fraud monitoring dashboard.",
        whatItDoes: "Flags duplicate device fingerprints, suspicious payment behavior, and multi-tenant spoofing.",
        howItWorks: "Scans UserFingerprint and logs flags, flagging anomalies under the FraudAlert model.",
        whoUsesIt: "Security Head to maintain system safety and integrity."
    },
    "/dashboard/admin/audit-log": {
        title: "Security Audit Logs",
        description: "Immutable log of all administrative actions.",
        whatItDoes: "Maintains an audit trail of all database writes, updates, and deletes performed by admins.",
        howItWorks: "Inserts detailed actions including IP addresses, actor names, and previous/new values into the AuditLog table.",
        whoUsesIt: "Security Officers and Auditors for corporate compliance."
    },
    "/dashboard/admin/settings": {
        title: "Platform Settings",
        description: "Global system configuration dashboard.",
        whatItDoes: "Enables maintenance mode, configures booking limit thresholds, and manages platform rules.",
        howItWorks: "Updates the global PlatformSettings record.",
        whoUsesIt: "Super Admins to handle emergency configurations."
    }
};

const ownerGuides: Record<string, GuideItem> = {
    "/dashboard/owner": {
        title: "Business Overview",
        description: "Analytical overview for property owners and staff.",
        whatItDoes: "Displays key revenue metrics, occupancy percentages, collection statuses, and pending actions.",
        howItWorks: "Aggregates tenant counts and compiles paid rent records from the database.",
        whoUsesIt: "Property Owners and Staff to evaluate business health."
    },
    "/dashboard/owner/properties": {
        title: "Property & Room Management",
        description: "PG listings catalog and configuration center.",
        whatItDoes: "Manages PG settings, adds rooms, defines bed occupancies, and configures pricing/amenities.",
        howItWorks: "Mutates Property, Room, and Bed models to match building changes.",
        whoUsesIt: "Owners and staff to update room inventories."
    },
    "/dashboard/owner/food-menu": {
        title: "Food Menu Planner",
        description: "Manage dining services for residents.",
        whatItDoes: "Publishes weekly menu schedules for breakfast, lunch, and dinner.",
        howItWorks: "Updates the FoodMenu entries, displaying options on the student portal.",
        whoUsesIt: "Kitchen Managers and Property Staff to coordinate meals."
    },
    "/dashboard/owner/bookings": {
        title: "Bookings & Onboarding Portal",
        description: "Onboarding and check-in pipeline for new residents.",
        whatItDoes: "Approves rental requests, monitors token payments, and tracks digital agreement execution.",
        howItWorks: "Guides booking requests through verification workflows.",
        whoUsesIt: "Onboarding Teams and Staff to complete check-ins."
    },
    "/dashboard/owner/verifications": {
        title: "KYC & Document Verifications",
        description: "Resident documentation audit portal.",
        whatItDoes: "Reviews tenant Aadhaar, PAN, and student credentials to ensure profile verification.",
        howItWorks: "Updates the status of TenantDocument uploads, triggering alerts on verification failure.",
        whoUsesIt: "Compliance Staff to verify tenant profiles before move-in."
    },
    "/dashboard/owner/tenants": {
        title: "Active Tenants Directory",
        description: "Core directory of current and historical residents.",
        whatItDoes: "Manages manual payments, initiates vacating notices, and tracks outstanding tenant dues.",
        howItWorks: "Updates the Tenant status and manages the SettlementRecord model during check-out.",
        whoUsesIt: "Property Owners and Staff to manage daily tenant operations."
    },
    "/dashboard/owner/notices": {
        title: "Vacating Notices",
        description: "Notice period and move-out scheduler.",
        whatItDoes: "Logs and approves notice periods, scheduling final move-out dates.",
        howItWorks: "Updates the VacatingNotice record and calculates pro-rata rent variables.",
        whoUsesIt: "Property Owners to schedule check-outs and plan room allocations."
    },
    "/dashboard/owner/room-changes": {
        title: "Room Change Manager",
        description: "Internal bed transfer manager.",
        whatItDoes: "Approves internal student transfer requests to new rooms or properties.",
        howItWorks: "Reassigns the bedId and room references on the Tenant profile.",
        whoUsesIt: "Staff to coordinate room changes."
    },
    "/dashboard/owner/payments": {
        title: "Rent & Payments Ledger",
        description: "Consolidated list of rent collections.",
        whatItDoes: "Records cash collections, logs bank transfers, and displays rent receipts.",
        howItWorks: "Tracks RentInvoice and Payment states.",
        whoUsesIt: "Accounting Staff to monitor monthly rent collections."
    },
    "/dashboard/owner/deposits": {
        title: "Security Deposits Ledger",
        description: "Tracks safety deposits held.",
        whatItDoes: "Monitors deposit statuses, releases refunds, and audits deductions.",
        howItWorks: "Interacts with the SecurityDeposit table, tracking refund due timelines.",
        whoUsesIt: "Owners to audit holding escrows."
    },
    "/dashboard/owner/onboarding-fees": {
        title: "Listing Onboarding Fees",
        description: "Onboarding payment tracker.",
        whatItDoes: "Monitors onboarding status and payment records for your properties.",
        howItWorks: "Checks listing payment confirmations.",
        whoUsesIt: "Owners to track onboarding compliance."
    },
    "/dashboard/owner/invoices/generate": {
        title: "Bulk Rent Invoice Generator",
        description: "Automated monthly billing module.",
        whatItDoes: "Manually triggers monthly rent invoice generation for all active tenants.",
        howItWorks: "Loops through active BillingProfiles and generates new RentRecords.",
        whoUsesIt: "Property Owners to trigger monthly billing cycles."
    },
    "/dashboard/owner/tax-summary": {
        title: "GST Tax Summary & Payout Ledger",
        description: "CA-ready financial ledger and commission invoice registry.",
        whatItDoes: "Lists platform commissions paid, tax deductions, and provides bulk exports for auditing.",
        howItWorks: "Queries PlatformFee records for properties, calculating GST breakdowns.",
        whoUsesIt: "Owners and Chartered Accountants (CAs) for corporate tax filing."
    },
    "/dashboard/owner/settings/payment": {
        title: "Payment Settings",
        description: "Payout banking configurations.",
        whatItDoes: "Manages bank accounts and UPI IDs for direct payout routing.",
        howItWorks: "Configures User.bankAccountNo and payment routing metadata.",
        whoUsesIt: "Owners to set up payout destinations."
    },
    "/dashboard/owner/staff": {
        title: "Management & Staff Team",
        description: "Access control roster for property staff.",
        whatItDoes: "Adds team members and defines specific permissions (e.g. food, tickets).",
        howItWorks: "Registers records in the OwnerStaff table and manages staff access tokens.",
        whoUsesIt: "Property Owners to manage staff access levels."
    },
    "/dashboard/owner/availability": {
        title: "Room Calendar & Occupancy Grid",
        description: "Real-time occupancy calendar.",
        whatItDoes: "Visualizes bed availability across properties to simplify check-in planning.",
        howItWorks: "Renders bed statuses (AVAILABLE, OCCUPIED, MAINTENANCE) in a visual matrix.",
        whoUsesIt: "Booking Coordinators to assign beds."
    },
    "/dashboard/owner/broadcast": {
        title: "WhatsApp Broadcast",
        description: "Automated resident communication portal.",
        whatItDoes: "Broadcasts announcements or rent reminders to active residents.",
        howItWorks: "Integrates template dispatch services to send messages directly to tenant numbers.",
        whoUsesIt: "Owners and Staff to make announcements."
    },
    "/dashboard/owner/tickets": {
        title: "Complaints & Support Helpdesk",
        description: "Resident helpdesk ticket coordinator.",
        whatItDoes: "Reviews resident complaints, assigns maintenance, and replies to issues.",
        howItWorks: "Pulls and updates data in Ticket and TicketMessage models.",
        whoUsesIt: "Property Managers and Maintenance Staff to coordinate repairs."
    },
    "/dashboard/owner/activity-log": {
        title: "Owner Activity Log",
        description: "Operations log for property events.",
        whatItDoes: "Displays changes made by staff (e.g., room additions, rent updates).",
        howItWorks: "Queries AuditLog and logs events filtered for the owner's properties.",
        whoUsesIt: "Property Owners to monitor staff actions."
    }
};

interface ExplainerProps {
    role: "admin" | "owner";
}

export function PageExplainer({ role }: ExplainerProps) {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    // Read guide based on current pathname
    const guides = role === "admin" ? adminGuides : ownerGuides;
    
    // Normalize path (handle subpages by checking start of path)
    // Sort keys by length descending to match the most specific path first
    const sortedKeys = Object.keys(guides).sort((a, b) => b.length - a.length);
    const matchedPath = sortedKeys.find(
        (key) => pathname === key || pathname.startsWith(key + "/")
    );
    const guide = matchedPath ? guides[matchedPath] : null;

    useEffect(() => {
        // Automatically close when switching tabs
        setOpen(false);
    }, [pathname]);

    if (!guide) return null;

    return (
        <div className="mb-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden transition-all duration-300">
            {/* Header toggle */}
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-6 py-4 bg-slate-50/50 hover:bg-slate-50 transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        <HelpCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                            {guide.title}
                            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                Tab Guide
                            </span>
                        </h4>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            {guide.description}
                        </p>
                    </div>
                </div>
                <div className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                    {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
            </button>

            {/* Content area */}
            {open && (
                <div className="px-6 py-5 border-t border-slate-100 bg-white grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top duration-300">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                            What it does
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                            {guide.whatItDoes}
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
                            <Layers className="w-3.5 h-3.5 text-indigo-500" />
                            How it works
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                            {guide.howItWorks}
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
                            <ShieldAlert className="w-3.5 h-3.5 text-indigo-500" />
                            Who uses it
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                            {guide.whoUsesIt}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
