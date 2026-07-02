import type { Metadata } from "next";
import Link from "next/link";
import {
  Mail,
  Phone,
  MessageCircle,
  Scale,
  Clock,
  ThumbsUp,
  CheckCircle,
  MapPin,
  BookOpen,
  CreditCard,
  UserCheck,
  Bug,
  Building2,
  ShieldCheck,
  ArrowRight,
  Headphones,
  ChevronRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Contact Us | RentPe – Student Housing Support",
  description:
    "Get in touch with RentPe's support team 24/7. Find email, phone, WhatsApp, and legal contact details. We resolve 98% of issues and respond within 4 hours.",
};

const contactChannels = [
  {
    icon: Mail,
    title: "Email Support",
    value: "support@rentpe.in",
    detail: "Response within 24 hours",
    badge: "24h SLA",
    badgeColor: "bg-indigo-100 text-indigo-700",
    href: "mailto:support@rentpe.in",
    external: false,
    gradient: "from-indigo-500 to-violet-600",
    bg: "bg-indigo-50",
  },
  {
    icon: Phone,
    title: "Phone Support",
    value: "+91-9090909090",
    detail: "Mon–Sat, 9 AM – 6 PM IST",
    badge: "Live Call",
    badgeColor: "bg-violet-100 text-violet-700",
    href: "tel:+919090909090",
    external: false,
    gradient: "from-violet-500 to-purple-600",
    bg: "bg-violet-50",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp",
    value: "+91-9090909090",
    detail: "For quick queries & updates",
    badge: "Instant",
    badgeColor: "bg-green-100 text-green-700",
    href: "https://wa.me/919090909090",
    external: true,
    gradient: "from-green-500 to-emerald-600",
    bg: "bg-green-50",
  },
  {
    icon: Scale,
    title: "Legal / Grievance",
    value: "legal@rentpe.in",
    detail: "Legal notices — IT Act 2000",
    badge: "Compliance",
    badgeColor: "bg-pink-100 text-pink-700",
    href: "mailto:legal@rentpe.in",
    external: false,
    gradient: "from-pink-500 to-rose-600",
    bg: "bg-pink-50",
  },
];

const slaMetrics = [
  {
    icon: ThumbsUp,
    value: "94%",
    label: "Customer Satisfaction",
    sub: "Based on 12,000+ reviews",
    color: "text-indigo-600",
    iconBg: "bg-indigo-100",
  },
  {
    icon: Clock,
    value: "< 4 hrs",
    label: "First Response Time",
    sub: "Across all support channels",
    color: "text-violet-600",
    iconBg: "bg-violet-100",
  },
  {
    icon: CheckCircle,
    value: "98%",
    label: "Issues Resolved",
    sub: "Without escalation needed",
    color: "text-pink-600",
    iconBg: "bg-pink-100",
  },
];

const supportTopics = [
  {
    icon: BookOpen,
    title: "Booking Help",
    desc: "Issues with booking, check-in, or check-out",
    href: "/bookings",
    color: "text-indigo-600",
    iconBg: "bg-indigo-100",
    hoverBorder: "hover:border-indigo-300",
  },
  {
    icon: CreditCard,
    title: "Payment Issues",
    desc: "Failed transactions, refunds & receipts",
    href: "/secure/payment",
    color: "text-violet-600",
    iconBg: "bg-violet-100",
    hoverBorder: "hover:border-violet-300",
  },
  {
    icon: UserCheck,
    title: "Account & KYC",
    desc: "Profile setup, verification & KYC docs",
    href: "/signup",
    color: "text-purple-600",
    iconBg: "bg-purple-100",
    hoverBorder: "hover:border-purple-300",
  },
  {
    icon: Bug,
    title: "Report a Bug",
    desc: "Found an issue? Help us fix it faster",
    href: "/bug-bounty",
    color: "text-rose-600",
    iconBg: "bg-rose-100",
    hoverBorder: "hover:border-rose-300",
  },
  {
    icon: Building2,
    title: "PG Owner Support",
    desc: "Listing, dashboards & occupancy tools",
    href: "/list-property",
    color: "text-pink-600",
    iconBg: "bg-pink-100",
    hoverBorder: "hover:border-pink-300",
  },
  {
    icon: ShieldCheck,
    title: "Community Safety",
    desc: "Report unsafe conditions or misconduct",
    href: "/safety",
    color: "text-emerald-600",
    iconBg: "bg-emerald-100",
    hoverBorder: "hover:border-emerald-300",
  },
];

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* ── Hero Section ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="mesh-gradient absolute inset-0 opacity-60" aria-hidden="true" />
        {/* Decorative blobs */}
        <div
          className="pointer-events-none absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-indigo-300 opacity-20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -right-24 h-[400px] w-[400px] rounded-full bg-pink-300 opacity-20 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Eyebrow badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/70 px-4 py-1.5 backdrop-blur-sm shadow-sm">
            <Headphones className="h-4 w-4 text-indigo-500" aria-hidden="true" />
            <span className="text-sm font-medium text-indigo-700">24/7 Student Support</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="text-gradient">We&rsquo;re Here</span>{" "}
            <span className="text-gray-900">to Help</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 sm:text-xl leading-relaxed">
            Our dedicated support team is available{" "}
            <strong className="text-indigo-600">24 hours a day, 7 days a week</strong> with a
            guaranteed first-response SLA of under 4 hours — because your housing shouldn&rsquo;t
            wait.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="mailto:support@rentpe.in"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-indigo-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 hover:shadow-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Email Us Now
            </a>
            <a
              href="https://wa.me/919090909090"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-gray-200 bg-white/80 px-7 py-3 text-sm font-semibold text-gray-800 shadow-sm backdrop-blur-sm transition hover:border-indigo-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <MessageCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* ── Contact Channels Grid ─────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-gray-50/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Reach Us Your Way</h2>
            <p className="mt-3 text-gray-500">
              Multiple channels — pick whatever works best for you.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {contactChannels.map((channel) => {
              const Icon = channel.icon;
              return (
                <a
                  key={channel.title}
                  href={channel.href}
                  target={channel.external ? "_blank" : undefined}
                  rel={channel.external ? "noopener noreferrer" : undefined}
                  className="glass-card hover-lift group flex flex-col gap-4 rounded-2xl border border-white/60 bg-white p-6 shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {/* Icon bubble */}
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${channel.gradient} shadow-md`}
                    aria-hidden="true"
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{channel.title}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${channel.badgeColor}`}
                      >
                        {channel.badge}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-indigo-600 break-all">
                      {channel.value}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">{channel.detail}</p>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-medium text-indigo-500 group-hover:text-indigo-700 transition">
                    Contact now <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── SLA Metrics Bar ───────────────────────────────────────── */}
      <section className="py-14 sm:py-18 bg-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-pink-50 p-8 shadow-sm sm:p-10">
            <h2 className="mb-8 text-center text-2xl font-bold text-gray-900 sm:text-3xl">
              Our Support Promise
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {slaMetrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <div
                    key={metric.label}
                    className="flex flex-col items-center gap-3 text-center"
                  >
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-full ${metric.iconBg}`}
                      aria-hidden="true"
                    >
                      <Icon className={`h-7 w-7 ${metric.color}`} />
                    </div>
                    <div>
                      <p className={`text-3xl font-extrabold ${metric.color}`}>{metric.value}</p>
                      <p className="mt-1 text-sm font-semibold text-gray-800">{metric.label}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{metric.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Office Address ────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-gray-50/60">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Visit Our Office</h2>
            <p className="mt-3 text-gray-500">
              We&rsquo;re headquartered in the heart of Bengaluru&rsquo;s tech corridor.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Address card */}
            <div className="glass-card rounded-2xl border border-white/60 bg-white p-8 shadow-md lg:col-span-2 flex flex-col justify-between">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md mb-5" aria-hidden="true">
                  <MapPin className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">RentPe Technologies Pvt. Ltd.</h3>
                <address className="mt-3 not-italic space-y-1 text-sm text-gray-600 leading-relaxed">
                  <p>5th Floor, WeWork Galaxy</p>
                  <p>MG Road, Bengaluru</p>
                  <p>Karnataka 560001, India</p>
                </address>
              </div>
              <a
                href="https://maps.google.com/?q=WeWork+Galaxy+MG+Road+Bengaluru"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-indigo-200 px-4 py-2.5 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Open RentPe office location in Google Maps"
              >
                <MapPin className="h-4 w-4" aria-hidden="true" />
                Open in Google Maps
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>

            {/* Map placeholder */}
            <div
              className="relative flex min-h-[260px] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-700 shadow-md lg:col-span-3"
              role="img"
              aria-label="Map showing RentPe office at WeWork Galaxy, MG Road, Bengaluru"
            >
              {/* Decorative grid */}
              <div
                className="pointer-events-none absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }}
                aria-hidden="true"
              />
              {/* Pin icon */}
              <div className="relative z-10 flex flex-col items-center gap-3 text-white">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm shadow-lg border border-white/30">
                  <MapPin className="h-7 w-7 text-white" aria-hidden="true" />
                </div>
                <p className="text-lg font-bold tracking-wide">Map Coming Soon</p>
                <p className="text-sm text-white/70">Interactive map integration in progress</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Support Topics Grid ───────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Browse by Topic</h2>
            <p className="mt-3 text-gray-500">
              Jump directly to the help section most relevant to you.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {supportTopics.map((topic) => {
              const Icon = topic.icon;
              return (
                <Link
                  key={topic.title}
                  href={topic.href}
                  className={`glass-card hover-lift group flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition ${topic.hoverBorder} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
                >
                  <div
                    className={`flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-xl ${topic.iconBg}`}
                    aria-hidden="true"
                  >
                    <Icon className={`h-5 w-5 ${topic.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition">
                      {topic.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 leading-relaxed">{topic.desc}</p>
                  </div>
                  <ChevronRight
                    className="mt-1 h-4 w-4 flex-shrink-0 text-gray-300 group-hover:text-indigo-500 transition"
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── For Owners CTA Banner ─────────────────────────────────── */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900 px-8 py-14 text-center shadow-2xl sm:px-14">
            {/* Decorative blobs */}
            <div
              className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-indigo-600 opacity-20 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-pink-600 opacity-20 blur-3xl"
              aria-hidden="true"
            />

            <div className="relative z-10">
              <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                Property Owners
              </span>
              <h2 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">
                List Your Property on RentPe
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-white/70 leading-relaxed">
                Reach 50,000+ verified students actively searching for quality PGs, hostels &
                apartments. Get zero-vacancy months with RentPe&rsquo;s smart listing tools.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/list-property"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-indigo-500 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  Start Listing for Free
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a
                  href="mailto:owners@rentpe.in"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/20 bg-white/10 px-8 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Contact Owner Team
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Grievance Officer Section ─────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-gray-50/60">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Grievance Officer</h2>
            <p className="mt-3 text-gray-500 text-sm max-w-xl mx-auto leading-relaxed">
              As mandated by the{" "}
              <strong>Information Technology Act, 2000</strong> and the{" "}
              <strong>Digital Personal Data Protection Act, 2023</strong>, we have designated a
              Grievance Officer to address your concerns.
            </p>
          </div>

          <div className="glass-card rounded-2xl border border-indigo-100 bg-white p-8 shadow-md sm:p-10">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
              {/* Avatar / icon */}
              <div className="flex-shrink-0">
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg text-3xl font-bold text-white select-none"
                  aria-hidden="true"
                >
                  AS
                </div>
              </div>

              {/* Details */}
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Arjun Sharma</h3>
                  <p className="text-sm font-medium text-indigo-600 mt-0.5">Grievance Officer</p>
                  <p className="text-xs text-gray-400 mt-0.5">RentPe Technologies Pvt. Ltd.</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <Mail className="h-4 w-4 flex-shrink-0 text-indigo-500" aria-hidden="true" />
                    <div>
                      <p className="text-xs text-gray-400 font-medium">Email</p>
                      <a
                        href="mailto:grievance@rentpe.in"
                        className="text-sm font-medium text-gray-800 hover:text-indigo-600 transition break-all"
                      >
                        grievance@rentpe.in
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <Clock className="h-4 w-4 flex-shrink-0 text-violet-500" aria-hidden="true" />
                    <div>
                      <p className="text-xs text-gray-400 font-medium">Response Time</p>
                      <p className="text-sm font-medium text-gray-800">
                        15 days as per IT Act
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700 leading-relaxed">
                  <strong>Note:</strong> Grievance complaints must be submitted in writing via email
                  with your registered email address and a detailed description of the issue.
                  Complaints are acknowledged within <strong>48 hours</strong> and resolved within{" "}
                  <strong>15 working days</strong> as required under Rule 3(2) of the IT
                  (Intermediary Guidelines) Rules, 2011 and the DPDP Act 2023.
                </div>
              </div>
            </div>
          </div>

          {/* Legal links */}
          <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-gray-400">
            <Link
              href="/privacy"
              className="hover:text-indigo-600 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded"
            >
              Privacy Policy
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              href="/terms"
              className="hover:text-indigo-600 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded"
            >
              Terms of Service
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              href="/refund"
              className="hover:text-indigo-600 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded"
            >
              Refund Policy
            </Link>
            <span aria-hidden="true">·</span>
            <a
              href="mailto:legal@rentpe.in"
              className="hover:text-indigo-600 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded"
            >
              Legal Notices
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
