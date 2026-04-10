import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SessionGuard from "@/components/layout/SessionGuard";
import SessionSync from "@/components/layout/SessionSync";
import { Toaster } from 'sonner';
import { getSession } from "@/lib/auth";
import { CSPostHogProvider } from "@/components/providers/posthog-provider";
import NotificationSync from "@/components/layout/NotificationSync";
import prisma from "@/lib/prisma";
import { Activity } from "lucide-react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://rentpe.in";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "RentPe | Verified PGs & Hostels for Students",
    template: "%s | RentPe",
  },
  description:
    "Find verified PGs, hostels, and shared rooms near your college. Hassle-free booking, digital agreements, KYC onboarding — India's smartest student housing platform.",
  keywords: [
    "PG near me", "student PG", "verified hostel", "PG booking India",
    "student accommodation", "RentPe", "list property India",
    "Kota PG", "Pune PG", "Delhi PG", "Mumbai PG", "Bangalore PG",
  ],
  authors: [{ name: "RentPe Technologies Pvt. Ltd.", url: BASE_URL }],
  creator: "RentPe",
  publisher: "RentPe Technologies Pvt. Ltd.",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: BASE_URL,
    siteName: "RentPe",
    title: "RentPe | Verified PGs & Hostels for Students",
    description:
      "Find verified PGs, hostels, and shared rooms near your college. Digital agreements, KYC onboarding — India's smartest student housing platform.",
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "RentPe — Verified PGs & Hostels for Students",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RentPe | Verified PGs & Hostels for Students",
    description:
      "Find verified PGs & hostels near your college. Hassle-free booking, digital agreements, KYC — India's smartest student housing platform.",
    images: [`${BASE_URL}/og-image.png`],
    creator: "@rentpe_in",
    site: "@rentpe_in",
  },
  alternates: {
    canonical: BASE_URL,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  // Always fetch the REAL name and role from the database — never trust stale JWT for display
  let freshSession = session;
  let activeUserId: string | null = null;
  let activeRole: string | null = null;

  if (session && (session as any).userId) {
    activeUserId = (session as any).userId;
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: activeUserId! },
        select: { name: true, role: true, roles: true, adminRole: true }
      });
      if (dbUser) {
        activeRole = dbUser.role;
        // IMPORTANT: Only take `name` and `roles[]` from DB.
        // DO NOT override session.role with dbUser.role.
        // session.role = the active JWT role the user has switched to (e.g. 'USER' after switch)
        // dbUser.role  = the immutable signup role (e.g. 'OWNER') — overriding would break the Navbar switcher
        freshSession = {
          ...session,
          name: dbUser.name,
          roles: dbUser.roles,
          // Enrich with isSuperAdmin so Navbar top nav differentiates admin vs admin team
          isSuperAdmin: (session as any).isSuperAdmin ?? (dbUser.adminRole === 'SUPER_ADMIN'),
          // session.role is kept as-is (from JWT — the active context role)
        } as any;
      }
    } catch (e) {
      // Fallback to JWT session on DB error (e.g., build time)
    }
  }

  // Check for global maintenance mode (Step 10)
  let maintenanceMode = false;
  let maintenanceMessage = "";
  try {
    const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
    if (settings?.maintenanceMode) {
        maintenanceMode = true;
        maintenanceMessage = settings.maintenanceMessage || "RentPe is currently undergoing scheduled maintenance.";
    }
  } catch (e) {}

  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${outfit.variable} font-inter antialiased min-h-screen flex flex-col`}
      >
        <CSPostHogProvider>
          {maintenanceMode ? (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center select-none">
                <div className="w-24 h-24 bg-indigo-50 rounded-3xl flex items-center justify-center mb-8 animate-bounce">
                    <Activity className="w-12 h-12 text-indigo-600" />
                </div>
                <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-4 leading-tight max-w-lg">
                    {maintenanceMessage}
                </h1>
                <p className="text-lg text-slate-400 font-medium max-w-sm mb-10 leading-relaxed">
                    We&apos;re making things better for you. Our systems will be back online very soon!
                </p>
                <div className="flex gap-4">
                    <a href="/status" className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm tracking-tight hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10">
                        Check System Status
                    </a>
                </div>
                <div className="mt-20 pt-8 border-t border-slate-100 max-w-xs w-full">
                    <p className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">&copy; 2026 RentPe Inc.</p>
                </div>
            </div>
          ) : (
            <>
              <NotificationSync />
              <SessionSync userId={activeUserId} role={activeRole} />
              <SessionGuard />
              <Navbar session={freshSession} />
              <main className="flex-1">
                {children}
              </main>
              <Footer />
            </>
          )}
          <Toaster position="top-right" richColors closeButton />
        </CSPostHogProvider>
      </body>
    </html>
  );
}
