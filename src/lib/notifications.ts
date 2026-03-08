import prisma from "./prisma";
import { sendEmail } from "./email";
import * as Templates from "./email-templates";

export type RecipientRole = "USER" | "OWNER" | "VERIFIER";

export interface NotificationPayload {
  bookingId: string;
  userId: string;
  type: "BOOKING" | "KYC" | "PAYMENT" | "SYSTEM";
  category: string;
  message: string;
  isPersistent?: boolean;
  targetRole: RecipientRole;
  actionUrl?: string;
  actionLabel?: string;
  emailHtml?: string;
  emailSubject?: string;
}

export class NotificationService {
  /**
   * Primary method to trigger a notification event.
   */
  static async trigger(payload: NotificationPayload) {
    try {
      const metadata = JSON.stringify({
        bookingId: payload.bookingId,
        actionUrl: payload.actionUrl,
        actionLabel: payload.actionLabel,
      });

      // 1. Create DB Notification
      const notification = await (prisma.notification as any).create({
        data: {
          userId: payload.userId,
          type: payload.type,
          category: payload.category,
          message: payload.message,
          isPersistent: payload.isPersistent || false,
          targetRole: payload.targetRole,
          metadata: metadata,
        },
        include: { user: { select: { email: true, name: true } } },
      });

      // 2. Trigger Email (Asynchronous)
      if (notification.user?.email && payload.emailHtml) {
        await sendEmail({
          to: notification.user.email,
          subject: payload.emailSubject || `RentPe Update: ${payload.category}`,
          html: payload.emailHtml
        });
      }

      return notification;
    } catch (error) {
      console.error("Notification trigger error:", error);
    }
  }

  // --- SPECIFIC LIFECYCLE METHODS ---

  static async onBookingRequest(booking: any, ownerId: string) {
    // Notify Tenant
    await this.trigger({
      bookingId: booking.id,
      userId: booking.userId,
      type: "BOOKING",
      category: "BOOKING_REQUEST_SENT",
      message: `Your booking request for ${booking.propertyName} has been sent!`,
      actionUrl: "/dashboard/student",
      actionLabel: "Track Status",
      emailSubject: "Booking Request Received 🕒",
      emailHtml: Templates.BookingRequestSentTemplate(booking.guestName, booking.propertyName),
      targetRole: "USER"
    });

    // Notify Owner
    await this.trigger({
      bookingId: booking.id,
      userId: ownerId,
      type: "BOOKING",
      category: "BOOKING_REQUEST_NEW",
      message: `New booking request from ${booking.guestName} for ${booking.propertyName}.`,
      actionUrl: "/dashboard/owner/bookings",
      actionLabel: "View Request",
      isPersistent: true,
      targetRole: "OWNER"
    });
  }

  static async onRequestAccepted(booking: any) {
    await this.trigger({
      bookingId: booking.id,
      userId: booking.userId,
      type: "BOOKING",
      category: "REQUEST_ACCEPTED",
      message: `Your request for ${booking.propertyName} was accepted! Pay token to reserve.`,
      actionUrl: "/dashboard/student",
      actionLabel: "Pay Token",
      isPersistent: true,
      emailSubject: "Request Accepted! 🎉",
      emailHtml: Templates.RequestAcceptedTemplate(booking.guestName, booking.propertyName),
      targetRole: "USER"
    });
  }

  static async onRoomAllocated(booking: any, roomNumber: string) {
    await this.trigger({
      bookingId: booking.id,
      userId: booking.userId,
      type: "BOOKING",
      category: "ROOM_ALLOCATED",
      message: `Room ${roomNumber} has been allocated to you at ${booking.propertyName}.`,
      actionUrl: "/dashboard/student",
      actionLabel: "View Room",
      emailSubject: "Room Allocated 🏠",
      emailHtml: Templates.RoomAllocatedTemplate(booking.guestName, booking.propertyName, roomNumber),
      targetRole: "USER"
    });
  }

  static async onPaymentCompleted(booking: any, amount: number, ownerId: string) {
    // Notify Tenant
    await this.trigger({
      bookingId: booking.id,
      userId: booking.userId,
      type: "PAYMENT",
      category: "PAYMENT_COMPLETED",
      message: `Payment of ₹${amount} successful for ${booking.propertyName}.`,
      actionUrl: "/dashboard/student",
      actionLabel: "View Receipt",
      emailSubject: "Payment Successful 💳",
      emailHtml: Templates.PaymentCompletedTemplate(booking.guestName, booking.propertyName, amount.toString()),
      targetRole: "USER"
    });

    // Notify Owner
    await this.trigger({
      bookingId: booking.id,
      userId: ownerId,
      type: "PAYMENT",
      category: "PAYMENT_RECEIVED",
      message: `Payment of ₹${amount} received from ${booking.guestName}.`,
      actionUrl: "/dashboard/owner/bookings",
      actionLabel: "View Payment",
      targetRole: "OWNER"
    });
  }

  static async onAgreementSigned(booking: any, ownerId: string) {
    // Notify Tenant
    await this.trigger({
      bookingId: booking.id,
      userId: booking.userId,
      type: "BOOKING",
      category: "AGREEMENT_SIGNED",
      message: `Your agreement for ${booking.propertyName} has been signed.`,
      actionUrl: "/dashboard/student",
      actionLabel: "View Agreement",
      emailSubject: "Agreement Signed ✍️",
      emailHtml: Templates.AgreementSignedTemplate(booking.guestName, booking.propertyName),
      targetRole: "USER"
    });

    // Notify Owner
    await this.trigger({
      bookingId: booking.id,
      userId: ownerId,
      type: "BOOKING",
      category: "AGREEMENT_SIGNED",
      message: `${booking.guestName} has signed the rental agreement.`,
      actionUrl: "/dashboard/owner/bookings",
      actionLabel: "View Agreement",
      targetRole: "OWNER"
    });
  }

  static async onCheckinConfirmed(booking: any, ownerId: string) {
    await this.trigger({
      bookingId: booking.id,
      userId: booking.userId,
      type: "BOOKING",
      category: "CHECKIN_CONFIRMED",
      message: `Check-in confirmed! Welcome to ${booking.propertyName}.`,
      actionUrl: "/dashboard/student",
      actionLabel: "My Dashboard",
      isPersistent: true,
      emailSubject: "Check-in Confirmed! 🎒",
      emailHtml: Templates.CheckinConfirmedTemplate(booking.guestName, booking.propertyName),
      targetRole: "USER"
    });
  }

  static async onKycSubmitted(booking: any, ownerId: string) {
    // Notify Tenant
    await this.trigger({
      bookingId: booking.id,
      userId: booking.userId,
      type: "KYC",
      category: "KYC_SUBMITTED",
      message: `Your KYC documents are under review.`,
      actionUrl: "/dashboard/student",
      actionLabel: "Check Status",
      emailSubject: "KYC Under Review 🔍",
      emailHtml: Templates.KycSubmittedTemplate(booking.guestName),
      targetRole: "USER"
    });

    // Notify Owner
    await this.trigger({
      bookingId: booking.id,
      userId: ownerId,
      type: "KYC",
      category: "KYC_RECEIVED",
      message: `KYC documents submitted by ${booking.guestName}. Please mark as received.`,
      actionUrl: "/dashboard/owner/bookings",
      actionLabel: "Review Documents",
      isPersistent: true,
      targetRole: "OWNER"
    });

    // Notify Verification Team
    await this.notifyVerifiers(booking.id, "KYC_PENDING", `New KYC submission from ${booking.guestName} for ${booking.propertyName}.`, "/dashboard/verifier/kyc");
  }

  static async onOwnerReviewed(booking: any) {
    // Notify Tenant
    await this.trigger({
      bookingId: booking.id,
      userId: booking.userId,
      type: "KYC",
      category: "OWNER_REVIEWED",
      message: `Documents acknowledged by owner. Final verification pending.`,
      actionUrl: "/dashboard/student",
      actionLabel: "Check Status",
      emailSubject: "Documents Received by Owner 📋",
      emailHtml: Templates.OwnerReviewedTemplate(booking.guestName, booking.propertyName),
      targetRole: "USER"
    });

    // Notify Verification Team
    await this.notifyVerifiers(booking.id, "DOCS_READY_FOR_FINAL", `${booking.guestName}'s docs are owner-reviewed and ready for final approval.`, "/dashboard/verifier/kyc");
  }

  static async onKycVerified(booking: any, ownerId: string) {
    // Notify Tenant
    await this.trigger({
      bookingId: booking.id,
      userId: booking.userId,
      type: "KYC",
      category: "KYC_VERIFIED",
      message: `Your KYC has been verified! You are now a verified resident.`,
      actionUrl: "/dashboard/student",
      actionLabel: "View Profile",
      isPersistent: true,
      emailSubject: "KYC Verified! ✅",
      emailHtml: Templates.KycVerifiedTemplate(booking.guestName),
      targetRole: "USER"
    });

    // Notify Owner
    await this.trigger({
      bookingId: booking.id,
      userId: ownerId,
      type: "KYC",
      category: "KYC_VERIFIED",
      message: `KYC cleared for ${booking.guestName}.`,
      actionUrl: "/dashboard/owner/bookings",
      actionLabel: "View Booking",
      targetRole: "OWNER"
    });
  }

  /**
   * Helper to notify the verification team.
   */
  static async notifyVerifiers(bookingId: string, category: string, message: string, actionUrl: string) {
    const verifiers = await prisma.user.findMany({
      where: { OR: [{ isVerifier: true }, { adminRole: "COMPLIANCE" }] },
      select: { id: true, email: true },
    });

    for (const v of verifiers) {
      await this.trigger({
        bookingId,
        userId: v.id,
        type: "KYC",
        category,
        message,
        targetRole: "VERIFIER",
        actionUrl,
        actionLabel: "Verify Documents",
      });
    }
  }
}
