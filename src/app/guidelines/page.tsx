import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  Users,
  Building2,
  ShieldAlert,
  AlertTriangle,
  Scale,
  CheckCircle,
  HelpCircle,
  Mail,
  Heart,
  FileText,
  Clock,
  ExternalLink,
  ChevronRight,
  Shield,
  ThumbsUp,
  Phone,
  MessageCircle,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Community Guidelines & Code of Conduct | RentPe",
  description:
    "Review RentPe's Community Guidelines. Read the rules and expectations for students, property owners, prohibited activities, and dispute resolution policies.",
};

const studentRules = [
  {
    title: "Booking & Cancellations",
    desc: "Do not create multiple simultaneous bookings at the same property. If your plans change, cancel bookings at least 48 hours in advance to allow other students to rent.",
  },
  {
    title: "Property Care & Cleaning",
    desc: "Treat the room and common areas with respect. Report damages immediately to the owner, keep shared spaces clean, and perform no unauthorized structural modifications.",
  },
  {
    title: "Timely Rent Payments",
    desc: "Pay your rent on or before the 1st of every month. Keep digital receipts for all payments and always use RentPe's secure portal to avoid disputes.",
  },
  {
    title: "Behavioral Expectations",
    desc: "Respect local curfews, noise limits, and building rules. Subletting rooms is strictly prohibited. Treat roommates and neighbors with dignity.",
  },
  {
    title: "KYC & Verification",
    desc: "Complete your online identity verification (Aadhaar, Passport, or College ID) within 7 days of booking approval. Providing forged documents leads to immediate eviction.",
  },
];

const ownerRules = [
  {
    title: "Accurate Listings",
    desc: "Provide authentic photos, exact locations, current prices, and real amenities. Do not hide fees, utilities, or maintenance costs from students.",
  },
  {
    title: "Tenant Relations & Communication",
    desc: "Respond to tenant queries, repair requests, or emergencies within 24 hours. Provide a formal, written 30-day notice prior to requesting a move-out.",
  },
  {
    title: "Maintenance & Basic Amenities",
    desc: "Ensure continuous supply of clean water, electricity, and functional internet. Address plumbing, wiring, or structural issues within 72 hours of report.",
  },
  {
    title: "Legal & Safety Compliance",
    desc: "Register your property as per local municipality rules. Install active fire extinguishers, secure entry gates, and respect tenants' privacy (no unannounced entry).",
  },
  {
    title: "Payment Transparency",
    desc: "Disclose deposit structures, utility sharing, and cleaning fees upfront. Provide itemized receipts and do not make arbitrary deductions from the security deposit.",
  },
];

const prohibitedActions = [
  {
    title: "Fraud & Scams",
    desc: "Creating fake listings, posting fabricated reviews, requesting direct off-platform payments to bypass RentPe security, or running rental deposits scams.",
  },
  {
    title: "Harassment & Discrimination",
    desc: "Any form of abuse, hate speech, or discrimination based on religion, gender, caste, race, nationality, sexual orientation, or dietary choices.",
  },
  {
    title: "Privacy Violations",
    desc: "Recording video/audio of other tenants without consent, sharing phone numbers or personal information publicly, or entering rented rooms without permission.",
  },
  {
    title: "Illegal Activities",
    desc: "Possession or consumption of banned substances, storage of hazardous materials, illegal gambling, or harboring unregistered guests in violation of local laws.",
  },
];

const enforcementSteps = [
  {
    step: "01",
    title: "First Warning",
    desc: "A formal warning is sent detailing the violation. The user has 48 hours to correct the behavior.",
    color: "from-blue-500 to-indigo-600",
  },
  {
    step: "02",
    title: "Account Suspension",
    desc: "Temporary lock on bookings, listing visibility, and payouts for 7 to 14 days during review.",
    color: "from-amber-500 to-orange-600",
  },
  {
    step: "03",
    title: "Permanent Ban",
    desc: "Permanent account termination and blacklisting. Security deposits or active bookings are handled legally.",
    color: "from-red-500 to-rose-600",
  },
];

const disputeSteps = [
  {
    icon: FileText,
    title: "1. File a Dispute",
    desc: "Submit a claim through your RentPe dashboard with rent receipts, photos, chats, or rental agreement copy.",
  },
  {
    icon: Clock,
    title: "2. Mediation Period",
    desc: "RentPe's dispute team reviews submissions, contacts both parties, and suggests a resolution within 5 business days.",
  },
  {
    icon: CheckCircle,
    title: "3. Resolution & Payout",
    desc: "Once resolved, necessary refunds, deposit releases, or billing corrections are disbursed directly within 48 hours.",
  },
];

export default function GuidelinesPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* ── Hero Section ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div className="mesh-gradient absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="pointer-events-none absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-indigo-300 opacity-20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-[400px] w-[400px] rounded-full bg-pink-300 opacity-20 blur-3xl" aria-hidden="true" />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Eyebrow badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/70 px-4 py-1.5 backdrop-blur-sm shadow-sm">
            <Shield className="h-4 w-4 text-indigo-500" aria-hidden="true" />
            <span className="text-sm font-semibold text-indigo-700 uppercase tracking-wider">Community Standards</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-gray-900 leading-tight">
            Community Guidelines & <br />
            <span className="text-gradient">Code of Conduct</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 leading-relaxed">
            Our mission is to build India's most trusted, safe, and transparent student housing marketplace. We expect all students, co-living residents, and property owners to adhere to these core guidelines.
          </p>
        </div>
      </section>

      {/* ── Table of Contents & Main Layout ────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-4">
          
          {/* Sticky Sidebar Nav (Desktop Only) */}
          <aside className="hidden lg:block">
            <nav className="sticky top-28 space-y-2 rounded-2xl border border-gray-100 bg-gray-50/50 p-5">
              <p className="px-3 text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">On This Page</p>
              {[
                { label: "Overview", href: "#overview" },
                { label: "For Students", href: "#students" },
                { label: "For Property Owners", href: "#owners" },
                { label: "Prohibited Actions", href: "#prohibited" },
                { label: "Enforcement Policy", href: "#enforcement" },
                { label: "Dispute Resolution", href: "#disputes" },
                { label: "Legal Framework", href: "#legal" },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-white hover:text-indigo-600 hover:shadow-sm transition"
                >
                  {item.label}
                  <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 text-indigo-500 transition" />
                </a>
              ))}
            </nav>
          </aside>

          {/* Main Content Area */}
          <div className="space-y-16 lg:col-span-3">

            {/* Quick Summary Callout */}
            <section id="overview" className="scroll-mt-24">
              <div className="rounded-2xl border-2 border-indigo-100 bg-indigo-50/40 p-6 sm:p-8">
                <h2 className="text-lg font-bold text-indigo-950 flex items-center gap-2 mb-3">
                  <ThumbsUp className="h-5 w-5 text-indigo-600" />
                  TL;DR: The Core Rule
                </h2>
                <p className="text-sm sm:text-base text-indigo-900 leading-relaxed">
                  Be respectful to your roommates and neighbors, list details honestly, take reasonable care of the property, pay dues on time, and communicate openly. If any issue arises, use RentPe's secure channels and dispute mediation services rather than escalating.
                </p>
              </div>
            </section>

            {/* Rules for Students Section */}
            <section id="students" className="scroll-mt-24">
              <div className="border-l-4 border-indigo-500 pl-4 mb-8">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest block mb-1">Code of Conduct</span>
                <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Expectations for Students & Residents</h2>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {studentRules.map((rule, idx) => (
                  <div key={rule.title} className="glass-card hover-lift flex flex-col gap-3 rounded-2xl border border-indigo-50/50 bg-indigo-50/10 p-6 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <h3 className="font-semibold text-gray-900">{rule.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed flex-1">{rule.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Rules for Property Owners Section */}
            <section id="owners" className="scroll-mt-24">
              <div className="border-l-4 border-purple-500 pl-4 mb-8">
                <span className="text-xs font-bold text-purple-600 uppercase tracking-widest block mb-1">Owner Guidelines</span>
                <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Expectations for Property Owners & Landlords</h2>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {ownerRules.map((rule, idx) => (
                  <div key={rule.title} className="glass-card hover-lift flex flex-col gap-3 rounded-2xl border border-purple-50/50 bg-purple-50/10 p-6 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-xs font-bold text-purple-700">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <h3 className="font-semibold text-gray-900">{rule.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed flex-1">{rule.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Prohibited Actions Section */}
            <section id="prohibited" className="scroll-mt-24">
              <div className="border-l-4 border-rose-500 pl-4 mb-8">
                <span className="text-xs font-bold text-rose-600 uppercase tracking-widest block mb-1">Strict Violations</span>
                <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Prohibited Activities & Behavior</h2>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50/20 p-6 sm:p-8">
                <p className="text-sm text-rose-700 font-medium mb-6">
                  Engaging in any of the following activities will result in immediate suspension, loss of security deposits, and potential referral to local law enforcement.
                </p>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {prohibitedActions.map((action) => (
                    <div key={action.title} className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100/80 text-rose-600">
                          <ShieldAlert className="h-5 w-5" />
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm mb-1">{action.title}</h3>
                        <p className="text-xs text-gray-600 leading-relaxed">{action.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Enforcement Policy Section */}
            <section id="enforcement" className="scroll-mt-24">
              <div className="border-l-4 border-amber-500 pl-4 mb-8">
                <span className="text-xs font-bold text-amber-600 uppercase tracking-widest block mb-1">Our Process</span>
                <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Enforcement & Penalty Policy</h2>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-6 sm:p-8">
                <p className="text-sm text-gray-600 leading-relaxed mb-8">
                  We review reports and violations neutrally. Our enforcement actions follow a structured tier system based on the severity and frequency of the violation.
                </p>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3 relative">
                  {enforcementSteps.map((step) => (
                    <div key={step.step} className="glass-card flex flex-col gap-4 rounded-xl border border-white/60 bg-white p-5 shadow-sm">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${step.color} shadow-sm text-white font-bold text-sm`}>
                        {step.step}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-950 text-sm mb-1">{step.title}</h3>
                        <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Dispute Resolution Section */}
            <section id="disputes" className="scroll-mt-24">
              <div className="border-l-4 border-emerald-500 pl-4 mb-8">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest block mb-1">Conflict Resolution</span>
                <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">RentPe Dispute Resolution Mechanism</h2>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-8">
                Disagreements regarding deposits, rent calculations, food billing, or early move-outs should be raised formally. RentPe provides a 3-step structured mediation path.
              </p>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                {disputeSteps.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.title} className="flex flex-col gap-3 rounded-2xl border border-gray-100 p-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600" aria-hidden="true">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="font-bold text-gray-900 text-sm">{step.title}</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Legal Framework Section */}
            <section id="legal" className="scroll-mt-24">
              <div className="border-l-4 border-slate-700 pl-4 mb-8">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest block mb-1">Statutory Compliance</span>
                <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Legal Framework & Local Regulations</h2>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6 sm:p-8 space-y-6">
                <p className="text-sm text-slate-700 leading-relaxed">
                  RentPe operates in compliance with active central and state laws in India governing digital platforms, e-commerce, tenancy, and personal data.
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
                  <div className="rounded-xl border bg-white p-4">
                    <h4 className="font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                      <Scale className="h-4 w-4 text-indigo-500" />
                      Information Technology Act, 2000
                    </h4>
                    <p className="text-slate-500 leading-relaxed">
                      We act as an intermediary under Section 79 of the IT Act. We maintain due diligence standards and promptly remove listings flagged by local authorities.
                    </p>
                  </div>
                  <div className="rounded-xl border bg-white p-4">
                    <h4 className="font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                      <Scale className="h-4 w-4 text-purple-500" />
                      Model Tenancy Act (MTA), 2021
                    </h4>
                    <p className="text-slate-500 leading-relaxed">
                      Our digital tenant agreements follow state-adapted variations of MTA, establishing clear terms for security deposits, eviction rules, and notices.
                    </p>
                  </div>
                  <div className="rounded-xl border bg-white p-4">
                    <h4 className="font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                      <Scale className="h-4 w-4 text-emerald-500" />
                      DPDP Act, 2023
                    </h4>
                    <p className="text-slate-500 leading-relaxed">
                      KYC documents, student profiles, and landlord registrations are processed securely. Your data is not shared without explicit consent.
                    </p>
                  </div>
                  <div className="rounded-xl border bg-white p-4">
                    <h4 className="font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                      <Scale className="h-4 w-4 text-rose-500" />
                      Consumer Protection Rules, 2020
                    </h4>
                    <p className="text-slate-500 leading-relaxed">
                      We prevent unfair trade practices by requiring owners to list true prices. RentPe does not deduct arbitrary fees from bookings.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Reporting Violations Contact CTA */}
            <section className="rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-purple-950 p-8 sm:p-12 text-center text-white relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_white_1px,_transparent_0)] bg-[size:24px_24px]" aria-hidden="true" />
              <div className="relative z-10">
                <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-3">Notice a Violation of Guidelines?</h3>
                <p className="text-indigo-200 text-sm max-w-xl mx-auto mb-8 leading-relaxed">
                  If you spot an inaccurate listing, face harassment from a landlord or roommate, or encounter an off-platform payment request, report it immediately to our compliance desk.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <a
                    href="mailto:guidelines@rentpe.in"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-indigo-500 px-7 py-3 text-sm font-semibold text-white hover:bg-indigo-400 shadow-md shadow-indigo-900/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                  >
                    <Mail className="h-4 w-4" />
                    Report to guidelines@rentpe.in
                  </a>
                  <Link
                    href="/bug-bounty"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/20 bg-white/10 px-7 py-3 text-sm font-semibold text-white hover:bg-white/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  >
                    <Shield className="h-4 w-4 text-emerald-400" />
                    Security Disclosures
                  </Link>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </main>
  );
}
