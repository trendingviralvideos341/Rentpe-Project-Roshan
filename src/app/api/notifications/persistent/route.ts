import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !(session as any).userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session as any).userId;

    const SKIP_CATEGORIES = ['REQUEST_ACCEPTED', 'TOKEN_CASH_CONFIRMED', 'APPROVED_PENDING_TOKEN', 'ONBOARDING_COMPLETED'];

    // Fetch unread persistent notifications (excluding old token categories)
    const notifications = await (prisma.notification as any).findMany({
      where: {
        userId,
        isRead: false,
        isPersistent: true,
        category: { notIn: SKIP_CATEGORIES },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error("Fetch Persistent Notifications Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
