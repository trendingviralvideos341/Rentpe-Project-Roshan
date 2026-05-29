import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Booking statuses that mean "token has been paid" (ROOM_RESERVED or beyond).
 * If a TOKEN_PAYMENT_REQUIRED or ROOM_ALLOCATED notification exists and the
 * booking is already in one of these states, the action is done → auto-mark read.
 */
const TOKEN_PAID_STATUSES = [
  'ROOM_RESERVED',
  'PHYSICAL_VERIFIED',
  'AGREEMENT_PENDING',
  'BOOKING_CONFIRMED',
  'MOVE_IN_SCHEDULED',
  'PAID',
  'CASH_PAID',
  'ACTIVE',
  'CHECKED_IN',
  'CHECKIN_CONFIRMED',
  'COMPLETED',
  'CHECKED_OUT',
];

/**
 * Booking statuses that mean "the student has already moved in / is active".
 * FINAL_PAYMENT_REQUIRED notifications should be suppressed at this point.
 */
const ACTIVE_STATUSES = [
  'ACTIVE',
  'CHECKED_IN',
  'CHECKIN_CONFIRMED',
  'COMPLETED',
  'CHECKED_OUT',
];

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !(session as any).userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session as any).userId;

    // These old-style categories are always skipped (already in skip list)
    const SKIP_CATEGORIES = [
      'REQUEST_ACCEPTED',
      'TOKEN_CASH_CONFIRMED',
      'APPROVED_PENDING_TOKEN',
      'ONBOARDING_COMPLETED',
    ];

    // Fetch all unread persistent notifications for this user
    const notifications = await (prisma.notification as any).findMany({
      where: {
        userId,
        isRead: false,
        isPersistent: true,
        category: { notIn: SKIP_CATEGORIES },
      },
      orderBy: { createdAt: "desc" },
    });

    if (notifications.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch all active bookings for this user (only fields we need)
    const bookings = await prisma.booking.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        agreementSigned: true,
      },
    });

    // Build a map: bookingId → booking for fast lookup
    const bookingMap = new Map(bookings.map((b) => [b.id, b]));

    // IDs of notifications that should be auto-marked as read because their
    // action has already been completed.
    const staleIds: string[] = [];

    const activeNotifications = notifications.filter((n: any) => {
      const booking = n.bookingId ? bookingMap.get(n.bookingId) : null;

      // ── TOKEN_PAYMENT_REQUIRED ──────────────────────────────────────────────
      // Fires when a bed is allocated. Stale once token is paid (status ≥ ROOM_RESERVED).
      if (n.category === 'TOKEN_PAYMENT_REQUIRED') {
        if (booking && TOKEN_PAID_STATUSES.includes(booking.status)) {
          staleIds.push(n.id);
          return false;
        }
        // No booking link? Check any booking that has a status beyond token stage
        if (!booking) {
          const anyPaid = bookings.some((b) => TOKEN_PAID_STATUSES.includes(b.status));
          if (anyPaid) { staleIds.push(n.id); return false; }
        }
      }

      // ── ROOM_ALLOCATED ──────────────────────────────────────────────────────
      // Fires when room/bed is first assigned. Stale once token is paid.
      if (n.category === 'ROOM_ALLOCATED') {
        if (booking && TOKEN_PAID_STATUSES.includes(booking.status)) {
          staleIds.push(n.id);
          return false;
        }
      }

      // ── CHECKIN_CONFIRMED ───────────────────────────────────────────────────
      // Fires on physical verification → "sign agreement now".
      // Stale once the agreement is signed OR status moves beyond PHYSICAL_VERIFIED.
      if (n.category === 'CHECKIN_CONFIRMED') {
        if (booking) {
          const agreementDone = booking.agreementSigned === true;
          const statusPast = ACTIVE_STATUSES.includes(booking.status) ||
            booking.status === 'AGREEMENT_PENDING' ||
            booking.status === 'BOOKING_CONFIRMED' ||
            booking.status === 'MOVE_IN_SCHEDULED';
          if (agreementDone || statusPast) {
            staleIds.push(n.id);
            return false;
          }
        }
      }

      // ── FINAL_PAYMENT_REQUIRED ──────────────────────────────────────────────
      // Fires when final joining payment is due. Stale once tenant is active.
      if (n.category === 'FINAL_PAYMENT_REQUIRED') {
        if (booking && ACTIVE_STATUSES.includes(booking.status)) {
          staleIds.push(n.id);
          return false;
        }
      }

      // ── AGREEMENT_COUNTERSIGNED ─────────────────────────────────────────────
      // Informational only — keep showing (one-time, user should dismiss).
      // No auto-dismiss rule needed.

      // ── BOOKING_COMPLETED ───────────────────────────────────────────────────
      // Booking is completed/checked-out — no further action needed, auto-dismiss.
      if (n.category === 'BOOKING_COMPLETED') {
        staleIds.push(n.id);
        return false;
      }

      return true; // Keep all other notifications
    });

    // Auto-mark stale notifications as read in the background (non-blocking)
    if (staleIds.length > 0) {
      prisma.notification
        .updateMany({
          where: { id: { in: staleIds } },
          data: { isRead: true },
        })
        .catch((e: any) =>
          console.error("Auto-mark stale notifications error:", e)
        );
    }

    return NextResponse.json(activeNotifications);
  } catch (error) {
    console.error("Fetch Persistent Notifications Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
