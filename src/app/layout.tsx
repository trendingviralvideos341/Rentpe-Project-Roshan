import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SessionGuard from "@/components/layout/SessionGuard";
import SessionSync from "@/components/layout/SessionSync";
import { Toaster } from 'sonner';
import { getSession } from "@/lib/auth";
import { CSPostHogProvider } from "@/components/providers/posthog-provider";
import prisma from "@/lib/prisma";
import { Activity } from "lucide-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RentPe | Premium PGs & Hostels",
  description: "Find your perfect student home away from home with RentPe. Verified listings, premium amenities, and hassle-free booking.",
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
        select: { name: true, email: true, role: true }
      });
      if (dbUser) {
        activeRole = dbUser.role;
        // Merge fresh DB data over stale JWT values
        freshSession = { ...session, name: dbUser.name, role: dbUser.role } as any;
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
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
                    We're making things better for you. Our systems will be back online very soon!
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
