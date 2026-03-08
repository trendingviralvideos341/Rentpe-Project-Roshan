/**
 * HTML Email Templates for RentPe Notifications
 * Using simple, responsive inline styles for maximum compatibility.
 */

const PRIMARY_COLOR = '#8b5cf6'; // Violet-600
const SUCCESS_COLOR = '#10b981'; // Emerald-500
const WARNING_COLOR = '#f59e0b'; // Amber-500

const BaseLayout = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 1px solid #e2e8f0; }
    .header { text-align: center; margin-bottom: 32px; }
    .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #94a3b8; }
    .button { display: inline-block; background-color: ${PRIMARY_COLOR}; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 24px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: bold; text-transform: uppercase; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="color: ${PRIMARY_COLOR}; margin: 0;">RentPe</h1>
      <p style="font-size: 14px; font-weight: 500; margin-top: 4px;">Smart Student Housing</p>
    </div>
    <div class="card">
      ${content}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} RentPe Technologies Pvt. Ltd.</p>
      <div class="footer-links">
        <a href="https://rentpe.in/terms" style="color: #6366f1; text-decoration: none; margin: 0 8px;">Terms</a>
        <a href="https://rentpe.in/privacy" style="color: #6366f1; text-decoration: none; margin: 0 8px;">Privacy</a>
        <a href="https://rentpe.in/contact" style="color: #6366f1; text-decoration: none; margin: 0 8px;">Contact Us</a>
      </div>
    </div>
  </div>
</body>
</html>
`;

export const LifecycleTemplate = (data: {
  title: string;
  name: string;
  status: string;
  message: string;
  nextStep: string;
  actionLabel: string;
  actionUrl: string;
  isSuccess?: boolean;
}) => BaseLayout(`
  <div class="status-badge" style="background: ${data.isSuccess ? '#ecfdf5' : '#eef2ff'}; color: ${data.isSuccess ? SUCCESS_COLOR : PRIMARY_COLOR};">
    ${data.status}
  </div>
  <h2 style="margin-top: 0;">${data.title}</h2>
  <p>Hi ${data.name},</p>
  <p>${data.message}</p>
  <div style="background: #f8fafc; border-left: 4px solid ${PRIMARY_COLOR}; padding: 16px; margin: 24px 0; border-radius: 4px;">
    <p style="margin: 0; font-weight: bold; color: #1e293b;">Next Step:</p>
    <p style="margin: 4px 0 0 0; font-size: 14px;">${data.nextStep}</p>
  </div>
  <a href="https://rentpe.in${data.actionUrl}" class="button">${data.actionLabel}</a>
`);

// 1. BOOKING_REQUEST_SENT (Tenant)
export const BookingRequestSentTemplate = (name: string, propertyName: string) => LifecycleTemplate({
  title: "Booking Request Received 🕒",
  name,
  status: "REQUEST_SENT",
  message: `Your request for <strong>${propertyName}</strong> has been sent to the owner. We'll notify you as soon as they respond.`,
  nextStep: "Wait for owner approval (usually within 24 hours).",
  actionLabel: "Track Booking Status",
  actionUrl: "/dashboard/student",
});

// 2. REQUEST_ACCEPTED (Tenant)
export const RequestAcceptedTemplate = (name: string, propertyName: string) => LifecycleTemplate({
  title: "Request Accepted! 🎉",
  name,
  status: "APPROVED",
  message: `Great news! The owner of <strong>${propertyName}</strong> has accepted your booking request.`,
  nextStep: "Pay the token amount to reserve your bed.",
  actionLabel: "Pay Token Amount",
  actionUrl: "/dashboard/student",
  isSuccess: true,
});

// 3. ROOM_ALLOCATED (Tenant)
export const RoomAllocatedTemplate = (name: string, propertyName: string, roomNumber: string) => LifecycleTemplate({
  title: "Room Allocated 🏠",
  name,
  status: "ALLOCATED",
  message: `You have been assigned <strong>Room ${roomNumber}</strong> at ${propertyName}.`,
  nextStep: "Review your room details and proceed with onboarding.",
  actionLabel: "View Room Details",
  actionUrl: "/dashboard/student",
  isSuccess: true,
});

// 4. ONBOARDING_COMPLETED (Tenant)
export const OnboardingCompletedTemplate = (name: string, propertyName: string) => LifecycleTemplate({
  title: "Onboarding Confirmed! ✅",
  name,
  status: "ONBOARDED",
  message: `Your basic onboarding for <strong>${propertyName}</strong> is complete. Your reservation is now fully active.`,
  nextStep: "Complete your professional KYC verification.",
  actionLabel: "Upload KYC Docs",
  actionUrl: "/dashboard/student?tab=kyc",
  isSuccess: true,
});

// 5. PAYMENT_COMPLETED (Tenant)
export const PaymentCompletedTemplate = (name: string, propertyName: string, amount: string) => LifecycleTemplate({
  title: "Payment Successful 💳",
  name,
  status: "PAID",
  message: `A payment of <strong>₹${amount}</strong> for ${propertyName} has been successfully processed.`,
  nextStep: "Download your receipt and prepare for move-in.",
  actionLabel: "Download Receipt",
  actionUrl: "/dashboard/student",
  isSuccess: true,
});

// 6. AGREEMENT_SIGNED (Tenant)
export const AgreementSignedTemplate = (name: string, propertyName: string) => LifecycleTemplate({
  title: "Agreement Signed ✍️",
  name,
  status: "SIGNED",
  message: `Your digital rental agreement for <strong>${propertyName}</strong> has been successfully signed.`,
  nextStep: "Your move-in details are being finalized.",
  actionLabel: "View Agreement",
  actionUrl: "/dashboard/student",
  isSuccess: true,
});

// 7. CHECKIN_CONFIRMED (Tenant)
export const CheckinConfirmedTemplate = (name: string, propertyName: string) => LifecycleTemplate({
  title: "Check-in Confirmed! 🎒",
  name,
  status: "CHECKED_IN",
  message: `Welcome home! Your check-in at <strong>${propertyName}</strong> is confirmed.`,
  nextStep: "Explore your resident dashboard and raise any service requests.",
  actionLabel: "Explore Dashboard",
  actionUrl: "/dashboard/student",
  isSuccess: true,
});

// 8. KYC_SUBMITTED (User/Verification Team)
export const KycSubmittedTemplate = (name: string) => LifecycleTemplate({
  title: "KYC Under Review 🔍",
  name,
  status: "KYC_PENDING",
  message: `Your KYC documents have been submitted and are now being reviewed by our verification team.`,
  nextStep: "Verification usually takes 24-48 hours. Stay tuned!",
  actionLabel: "Check KYC Status",
  actionUrl: "/dashboard/student",
});

// 9. OWNER_REVIEWED (Tenant)
export const OwnerReviewedTemplate = (name: string, propertyName: string) => LifecycleTemplate({
  title: "Documents Received by Owner 📋",
  name,
  status: "DOCS_RECEIVED",
  message: `The owner of <strong>${propertyName}</strong> has acknowledged receipt of your documents.`,
  nextStep: "Wait for final verification team approval.",
  actionLabel: "View Documents",
  actionUrl: "/dashboard/student",
  isSuccess: true,
});

// 10. KYC_VERIFIED (Tenant)
export const KycVerifiedTemplate = (name: string) => LifecycleTemplate({
  title: "KYC Verified! ✅",
  name,
  status: "KYC_CLEARED",
  message: `Congratulations! Your professional KYC verification is complete. You are now a fully verified RentPe resident.`,
  nextStep: "Your trust score has been upgraded to 'Excellent'.",
  actionLabel: "My Verified Profile",
  actionUrl: "/dashboard/student",
  isSuccess: true,
});

// OWNER NOTIFICATION TEMPLATE
export const OwnerNotificationTemplate = (ownerName: string, eventTitle: string, message: string, actionUrl: string, actionLabel: string) => BaseLayout(`
  <h2 style="margin-top: 0;">Business Update: ${eventTitle}</h2>
  <p>Hi ${ownerName},</p>
  <p>${message}</p>
  <a href="https://rentpe.in${actionUrl}" class="button">${actionLabel}</a>
`);

// VERIFICATION TEAM TEMPLATE
export const VerifierNotificationTemplate = (message: string, actionUrl: string) => BaseLayout(`
  <h2 style="margin-top: 0; color: ${PRIMARY_COLOR};">KYC Action Required</h2>
  <p>An update requires verification team attention:</p>
  <div style="background: #fdf2f8; border: 1px solid #fbcfe8; padding: 16px; border-radius: 8px; font-weight: 500;">
    ${message}
  </div>
  <a href="https://rentpe.in${actionUrl}" class="button">Verify Documents</a>
`);

// ─────────────────────────────────────────────
// RESTORED TEMPLATES (Auth & Billing)
// ─────────────────────────────────────────────

export const WelcomeTemplate = (name: string) => `
${BaseLayout(`
  <div class="header">Welcome to RentPe! 🎉</div>
  <p>Hi ${name},</p>
  <p>We're thrilled to have you on board. RentPe is your one-stop solution for finding and managing premium student housing.</p>
  <p>Explore verified properties, manage your bookings, and experience hassle-free living.</p>
  <a href="https://rentpe.in/properties" class="btn">Explore Properties</a>
`)}
`;

export const InvoiceGeneratedTemplate = (tenantName: string, monthLabel: string, amount: number, dueDate: string) => `
${BaseLayout(`
  <div class="header">New Rent Invoice Generated 🧾</div>
  <p>Hi ${tenantName},</p>
  <p>Your rent invoice for <strong>${monthLabel}</strong> has been generated.</p>
  <p><strong>Amount Due:</strong> ₹${amount.toLocaleString('en-IN')}</p>
  <p><strong>Due Date:</strong> ${dueDate}</p>
  <p>Please pay your rent on time to avoid late fees.</p>
  <a href="https://rentpe.in/dashboard/student/payments" class="btn">View & Pay Invoice</a>
`)}
`;
