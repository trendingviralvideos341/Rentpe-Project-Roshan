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

  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <CSPostHogProvider>
          <SessionSync userId={activeUserId} role={activeRole} />
          <SessionGuard />
          <Navbar session={freshSession} />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
          <Toaster position="top-right" richColors closeButton />
        </CSPostHogProvider>
      </body>
    </html>
  );
}
