import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Building2,
  Users,
  Star,
  MapPin,
  Shield,
  Clock,
  TrendingUp,
  CheckCircle,
  Zap,
  Heart,
  Globe,
  Award,
} from 'lucide-react';

// ─── Metadata ────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: 'About RentPe | Redefining Student Housing in India',
  description:
    "Learn about RentPe — India's trusted platform connecting college students with verified PGs, hostels, and co-living spaces across 50+ cities. Our mission, team, values, and story.",
  openGraph: {
    title: 'About RentPe | Redefining Student Housing in India',
    description:
      'RentPe connects 10,000+ students with 500+ verified PGs across 50+ Indian cities. Discover our story, mission, and the team behind the platform.',
    type: 'website',
    url: 'https://rentpe.in/about',
    siteName: 'RentPe',
    images: [
      {
        url: 'https://rentpe.in/og-about.png',
        width: 1200,
        height: 630,
        alt: 'RentPe – Redefining Student Housing in India',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About RentPe | Redefining Student Housing in India',
    description:
      'Discover how RentPe is transforming student housing across India with verified PGs, transparent pricing, and tech-first experience.',
  },
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const stats = [
  { value: '10,000+', label: 'Students Housed', icon: Users },
  { value: '500+', label: 'Verified PGs', icon: Building2 },
  { value: '50+', label: 'Cities Covered', icon: MapPin },
  { value: '4.8★', label: 'Average Rating', icon: Star },
];

const steps = [
  {
    step: '01',
    icon: MapPin,
    title: 'Search',
    description:
      'Browse hundreds of verified PGs and hostels near your college with powerful filters — budget, amenities, gender preference, distance and more.',
  },
  {
    step: '02',
    icon: CheckCircle,
    title: 'Book',
    description:
      'Schedule free virtual or in-person tours, review transparent pricing with no hidden charges, and secure your room with a digital rental agreement.',
  },
  {
    step: '03',
    icon: Zap,
    title: 'Move In',
    description:
      'Complete a smooth onboarding, connect with fellow residents, and enjoy your new home — backed by our 24/7 student support team.',
  },
];

const founders = [
  {
    initials: 'AK',
    color: 'from-indigo-500 to-purple-600',
    name: 'Arjun Kumar',
    role: 'Co-Founder & CEO',
    bio: 'IIT Delhi alumnus who struggled to find a decent PG in his first year. Built RentPe so no student has to go through that experience again.',
  },
  {
    initials: 'PS',
    color: 'from-purple-500 to-pink-600',
    name: 'Priya Sharma',
    role: 'Co-Founder & CTO',
    bio: 'Ex-Google engineer passionate about using technology to solve real-world housing problems for millions of Indian students.',
  },
  {
    initials: 'RV',
    color: 'from-pink-500 to-rose-600',
    name: 'Rahul Verma',
    role: 'Co-Founder & COO',
    bio: 'Former McKinsey consultant who has personally verified 200+ PGs across India to build the trust layer at the heart of RentPe.',
  },
];

const values = [
  {
    icon: Shield,
    title: 'Trust',
    description:
      "Every listing on RentPe is physically verified by our team. We never list a property we wouldn't stay in ourselves.",
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
  },
  {
    icon: Globe,
    title: 'Transparency',
    description:
      'All-inclusive pricing, zero hidden charges, and digital agreements — what you see is exactly what you pay.',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    icon: Heart,
    title: 'Safety',
    description:
      'Background-checked landlords, 24/7 emergency support, and verified entry systems keep every student safe.',
    color: 'text-pink-600',
    bg: 'bg-pink-50',
  },
  {
    icon: TrendingUp,
    title: 'Affordability',
    description:
      'We negotiate bulk deals with PG owners so students always get the best market rates without a broker fee.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: Zap,
    title: 'Technology',
    description:
      'AI-powered matching, virtual 360° tours, and smart contracts make finding and renting a PG effortless.',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    icon: Users,
    title: 'Community',
    description:
      'RentPe Circles connects residents of the same building, fostering friendships and a support network from day one.',
    color: 'text-sky-600',
    bg: 'bg-sky-50',
  },
];

const milestones = [
  {
    year: '2024',
    quarter: 'Q1',
    title: 'RentPe Founded',
    description:
      "Three co-founders quit their high-paying jobs to solve India's student housing crisis from a tiny Bengaluru apartment.",
    icon: Award,
    color: 'bg-indigo-600',
  },
  {
    year: '2024',
    quarter: 'Q3',
    title: 'Seed Round Closed',
    description:
      'Raised ₹4 Cr seed funding from top Indian angel investors and launched in 5 cities with 50 verified listings.',
    icon: TrendingUp,
    color: 'bg-purple-600',
  },
  {
    year: '2025',
    quarter: 'Q1',
    title: '100 Verified PGs',
    description:
      'Hit the milestone of 100 verified PG listings with an average rating of 4.7 stars from student reviews.',
    icon: Building2,
    color: 'bg-pink-600',
  },
  {
    year: '2025',
    quarter: 'Q3',
    title: 'Series A & 25 Cities',
    description:
      'Expanded to 25 cities with a ₹22 Cr Series A round and introduced AI-powered PG matching.',
    icon: Globe,
    color: 'bg-indigo-600',
  },
  {
    year: '2026',
    quarter: 'Q1',
    title: '10,000 Students Housed',
    description:
      'Crossed 10,000 students successfully housed — with a 96% satisfaction rate and zero broker-fee model.',
    icon: Users,
    color: 'bg-purple-600',
  },
  {
    year: '2026',
    quarter: 'Q3',
    title: '50+ Cities & Beyond',
    description:
      'Reached 50+ Indian cities and announced RentPe International, bringing the model to South-East Asia.',
    icon: MapPin,
    color: 'bg-pink-600',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white font-[var(--font-inter)]">

      {/* ── Hero Section ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden min-h-[92vh] flex items-center justify-center">
        {/* Mesh gradient background */}
        <div className="absolute inset-0 mesh-gradient" aria-hidden="true" />

        {/* Decorative blobs */}
        <div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #ec4899 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)' }}
          aria-hidden="true"
        />

        {/* Hero Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-24">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            India&apos;s Fastest-Growing Student Housing Platform
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold font-[var(--font-outfit)] text-white leading-tight tracking-tight mb-6">
            We&apos;re Redefining{' '}
            <span className="relative inline-block">
              <span className="relative z-10">Student Housing</span>
              <span
                className="absolute inset-x-0 bottom-1 h-3 opacity-40 rounded-sm"
                style={{ background: 'linear-gradient(90deg, #ec4899, #6366f1)' }}
                aria-hidden="true"
              />
            </span>{' '}
            in India
          </h1>

          <p className="text-lg sm:text-xl md:text-2xl text-white/80 max-w-3xl mx-auto mb-10 leading-relaxed">
            RentPe connects college students across India with safe, verified, and affordable
            PGs and hostels — with zero broker fees, transparent pricing, and a community
            that feels like home.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/search"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white text-indigo-600 font-semibold text-lg shadow-2xl hover:shadow-white/25 hover:scale-105 transition-all duration-300"
            >
              <Building2 className="w-5 h-5" aria-hidden="true" />
              Find a PG
            </Link>
            <Link
              href="/list-property"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/30 text-white font-semibold text-lg hover:bg-white/20 hover:scale-105 transition-all duration-300"
            >
              <TrendingUp className="w-5 h-5" aria-hidden="true" />
              List Your Property
            </Link>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/50 text-xs">
            <span>Scroll to explore</span>
            <div className="w-px h-8 bg-gradient-to-b from-white/50 to-transparent animate-pulse" />
          </div>
        </div>
      </section>

      {/* ── Mission & Vision + Stats ──────────────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-slate-50" aria-labelledby="mission-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left: Mission text */}
            <div>
              <span className="inline-block text-indigo-600 font-semibold text-sm uppercase tracking-widest mb-4">
                Our Purpose
              </span>
              <h2
                id="mission-heading"
                className="text-3xl sm:text-4xl lg:text-5xl font-bold font-[var(--font-outfit)] text-slate-900 leading-tight mb-6"
              >
                A Mission Born From{' '}
                <span className="text-gradient">Real Struggle</span>
              </h2>
              <p className="text-slate-600 text-lg leading-relaxed mb-6">
                Every year, millions of Indian students leave home to pursue their dreams —
                only to spend their first weeks stressed about finding a safe, affordable place
                to live. We&apos;ve lived that story. RentPe was built to end it.
              </p>
              <p className="text-slate-600 text-lg leading-relaxed mb-8">
                Our mission is simple: make student housing in India as easy, trustworthy, and
                affordable as ordering food online. Our vision is a future where every student
                can find a home — anywhere in India — in under 10 minutes.
              </p>
              <div className="flex items-center gap-3">
                <div className="flex -space-x-3">
                  {['from-indigo-500 to-purple-500', 'from-purple-500 to-pink-500', 'from-pink-500 to-rose-500'].map(
                    (grad, i) => (
                      <div
                        key={i}
                        className={`w-10 h-10 rounded-full bg-gradient-to-br ${grad} border-2 border-white flex items-center justify-center text-white text-xs font-bold`}
                        aria-hidden="true"
                      >
                        {['AK', 'PS', 'RV'][i]}
                      </div>
                    )
                  )}
                </div>
                <span className="text-slate-500 text-sm">Founded by students, for students</span>
              </div>
            </div>

            {/* Right: Stats grid */}
            <div className="grid grid-cols-2 gap-5">
              {stats.map(({ value, label, icon: Icon }) => (
                <div
                  key={label}
                  className="glass-card hover-lift rounded-2xl p-6 lg:p-8 flex flex-col items-start gap-3 border border-slate-200 bg-white shadow-sm"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <Icon className="w-6 h-6 text-white" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-3xl lg:text-4xl font-bold font-[var(--font-outfit)] text-slate-900">
                      {value}
                    </p>
                    <p className="text-slate-500 text-sm font-medium mt-0.5">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-white" aria-labelledby="how-it-works-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-indigo-600 font-semibold text-sm uppercase tracking-widest mb-4">
              Simple Process
            </span>
            <h2
              id="how-it-works-heading"
              className="text-3xl sm:text-4xl lg:text-5xl font-bold font-[var(--font-outfit)] text-slate-900"
            >
              From Search to{' '}
              <span className="text-gradient">Move-In</span> in 3 Steps
            </h2>
            <p className="mt-4 text-slate-500 text-lg max-w-2xl mx-auto">
              We&apos;ve stripped away every friction point so you can focus on what matters —
              your studies and your life.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line (desktop) */}
            <div
              className="hidden md:block absolute top-14 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300"
              aria-hidden="true"
            />

            {steps.map(({ step, icon: Icon, title, description }) => (
              <div
                key={step}
                className="hover-lift relative flex flex-col items-center text-center p-8 rounded-3xl border border-slate-100 bg-white shadow-sm hover:shadow-xl transition-all duration-300"
              >
                {/* Step number badge */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                  {step}
                </div>

                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 flex items-center justify-center mb-6 mt-4">
                  <Icon className="w-9 h-9 text-indigo-600" aria-hidden="true" />
                </div>

                <h3 className="text-xl font-bold font-[var(--font-outfit)] text-slate-900 mb-3">
                  {title}
                </h3>
                <p className="text-slate-500 leading-relaxed text-sm">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Meet The Founders ─────────────────────────────────────────────── */}
      <section
        className="py-20 lg:py-28 bg-slate-50"
        aria-labelledby="founders-heading"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-indigo-600 font-semibold text-sm uppercase tracking-widest mb-4">
              The Team
            </span>
            <h2
              id="founders-heading"
              className="text-3xl sm:text-4xl lg:text-5xl font-bold font-[var(--font-outfit)] text-slate-900"
            >
              Meet the <span className="text-gradient">Founders</span>
            </h2>
            <p className="mt-4 text-slate-500 text-lg max-w-xl mx-auto">
              Three people who got tired of complaining about bad student housing — and decided
              to fix it.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {founders.map(({ initials, color, name, role, bio }) => (
              <article
                key={name}
                className="glass-card hover-lift bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300"
              >
                {/* Avatar */}
                <div className={`w-full h-52 bg-gradient-to-br ${color} flex items-center justify-center relative overflow-hidden`}>
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle at 30% 70%, white 1px, transparent 1px), radial-gradient(circle at 70% 30%, white 1px, transparent 1px)',
                      backgroundSize: '24px 24px',
                    }}
                    aria-hidden="true"
                  />
                  <span className="relative text-5xl font-bold font-[var(--font-outfit)] text-white opacity-90 tracking-wider">
                    {initials}
                  </span>
                </div>

                {/* Info */}
                <div className="p-7">
                  <h3 className="text-xl font-bold font-[var(--font-outfit)] text-slate-900">
                    {name}
                  </h3>
                  <p className="text-indigo-600 font-medium text-sm mt-1 mb-3">{role}</p>
                  <p className="text-slate-500 text-sm leading-relaxed">{bio}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Core Values ───────────────────────────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-white" aria-labelledby="values-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-indigo-600 font-semibold text-sm uppercase tracking-widest mb-4">
              What We Stand For
            </span>
            <h2
              id="values-heading"
              className="text-3xl sm:text-4xl lg:text-5xl font-bold font-[var(--font-outfit)] text-slate-900"
            >
              Our <span className="text-gradient">Core Values</span>
            </h2>
            <p className="mt-4 text-slate-500 text-lg max-w-xl mx-auto">
              Every decision we make is filtered through these six principles.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map(({ icon: Icon, title, description, color, bg }) => (
              <div
                key={title}
                className="hover-lift group rounded-2xl border border-slate-100 p-7 hover:shadow-xl transition-all duration-300 bg-white"
              >
                <div className={`w-14 h-14 rounded-xl ${bg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-7 h-7 ${color}`} aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold font-[var(--font-outfit)] text-slate-900 mb-2">
                  {title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Milestones Timeline ───────────────────────────────────────────── */}
      <section
        className="py-20 lg:py-28 bg-slate-900 relative overflow-hidden"
        aria-labelledby="timeline-heading"
      >
        {/* Background decoration */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
          aria-hidden="true"
        />
        <div
          className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }}
          aria-hidden="true"
        />
        <div
          className="absolute bottom-0 left-0 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #ec4899, transparent)' }}
          aria-hidden="true"
        />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-indigo-400 font-semibold text-sm uppercase tracking-widest mb-4">
              Our Journey
            </span>
            <h2
              id="timeline-heading"
              className="text-3xl sm:text-4xl lg:text-5xl font-bold font-[var(--font-outfit)] text-white"
            >
              Milestones That{' '}
              <span
                className="inline-block"
                style={{
                  background: 'linear-gradient(135deg, #818cf8, #ec4899)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Define Us
              </span>
            </h2>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Central vertical line */}
            <div
              className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500 opacity-40"
              aria-hidden="true"
            />

            <ol className="space-y-10">
              {milestones.map(({ year, quarter, title, description, icon: Icon, color }, index) => (
                <li
                  key={`${year}-${quarter}`}
                  className={`relative flex items-start gap-6 md:gap-0 ${
                    index % 2 === 0
                      ? 'md:flex-row'
                      : 'md:flex-row-reverse'
                  }`}
                >
                  {/* Content box */}
                  <div
                    className={`flex-1 md:w-[calc(50%-2rem)] ${
                      index % 2 === 0
                        ? 'md:pr-12 md:text-right'
                        : 'md:pl-12 md:text-left'
                    } ml-10 md:ml-0`}
                  >
                    <div
                      className={`inline-block glass-card bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm hover:bg-white/10 transition-colors duration-300 text-left`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                          {year} · {quarter}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold font-[var(--font-outfit)] text-white mb-2">
                        {title}
                      </h3>
                      <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
                    </div>
                  </div>

                  {/* Center dot */}
                  <div
                    className={`absolute left-4 md:left-1/2 -translate-x-1/2 w-10 h-10 rounded-full ${color} flex items-center justify-center shadow-lg ring-4 ring-slate-900 z-10`}
                    aria-hidden="true"
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>

                  {/* Empty right side for alternating layout */}
                  <div className="hidden md:block flex-1" aria-hidden="true" />
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── Final CTA Section ─────────────────────────────────────────────── */}
      <section className="py-20 lg:py-28 relative overflow-hidden" aria-labelledby="cta-heading">
        {/* Gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, #4f46e5 0%, #7c3aed 40%, #db2777 100%)',
          }}
          aria-hidden="true"
        />

        {/* Decorative circles */}
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full border border-white/10"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full border border-white/10"
          aria-hidden="true"
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/5"
          aria-hidden="true"
        />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Icon cluster */}
          <div className="flex justify-center gap-3 mb-8">
            {[Building2, Users, Star, Shield].map((Icon, i) => (
              <div
                key={i}
                className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center"
                aria-hidden="true"
              >
                <Icon className="w-5 h-5 text-white" />
              </div>
            ))}
          </div>

          <h2
            id="cta-heading"
            className="text-3xl sm:text-4xl lg:text-5xl font-bold font-[var(--font-outfit)] text-white leading-tight mb-6"
          >
            Your Perfect PG is Waiting.{' '}
            <br className="hidden sm:block" />
            Let&apos;s Find It Together.
          </h2>

          <p className="text-white/80 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Join 10,000+ students who found their home with RentPe. Sign up for free and
            browse verified PGs near your college — no broker, no hidden fees, no stress.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 rounded-2xl bg-white text-indigo-600 font-bold text-lg shadow-2xl hover:shadow-white/20 hover:scale-105 transition-all duration-300"
            >
              <Users className="w-5 h-5" aria-hidden="true" />
              Get Started for Free
            </Link>
            <Link
              href="/search"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/30 text-white font-semibold text-lg hover:bg-white/20 hover:scale-105 transition-all duration-300"
            >
              <MapPin className="w-5 h-5" aria-hidden="true" />
              Browse PGs Near Me
            </Link>
          </div>

          {/* Trust badges */}
          <div className="mt-12 flex flex-wrap justify-center items-center gap-6 text-white/60 text-sm">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              Zero Broker Fee
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              Verified Listings Only
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              24/7 Student Support
            </span>
            <span className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-400" aria-hidden="true" />
              4.8★ Average Rating
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
