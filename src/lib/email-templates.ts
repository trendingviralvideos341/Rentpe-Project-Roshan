/**
 * HTML Email Templates for RentPe Notifications
 * Using simple, responsive inline styles for maximum compatibility.
 */

const LOGO_URL = 'https://rentpe.in/logo.png'; // Placeholder for actual logo
const PRIMARY_COLOR = '#8b5cf6'; // Violet-600

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
    .footer-links a { color: #6366f1; text-decoration: none; margin: 0 8px; }
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
        <a href="https://rentpe.in/terms">Terms</a>
        <a href="https://rentpe.in/privacy">Privacy</a>
        <a href="https://rentpe.in/contact">Contact Us</a>
      </div>
      <p style="margin-top: 16px;">123 Startup Hub, Koramangala, Bangalore - 560034</p>
    </div>
  </div>
</body>
</html>
`;

export const WelcomeTemplate = (name: string) => BaseLayout(`
  <h2 style="margin-top: 0;">Welcome to RentPe, ${name}! 🚀</h2>
  <p>We're thrilled to have you join India's smartest PG & Hostel marketplace. Your account is now active and ready to go.</p>
  <p><strong>What can you do now?</strong></p>
  <ul>
    <li>Browse 100% verified premium stays.</li>
    <li>Book your bed with just a small token.</li>
    <li>Manage your entire stay from your digital dashboard.</li>
  </ul>
  <a href="https://rentpe.in/login" class="button">Go to My Dashboard</a>
  <p style="margin-top: 24px; font-size: 14px; font-style: italic;">If you have any questions, just reply to this email, or raise a support ticket from your dashboard.</p>
`);

export const BookingPendingTemplate = (tenantName: string, propertyName: string, bookingId: string) => BaseLayout(`
  <h2 style="margin-top: 0;">Booking Request Received! 🕒</h2>
  <p>Hi ${tenantName},</p>
  <p>Your request to book a bed at <strong>${propertyName}</strong> has been received by the owner.</p>
  <p><strong>Booking ID:</strong> <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${bookingId}</code></p>
  <p>The owner has 48 hours to approve or reject your request. Your booking token is currently locked and will only be processed if the owner approves.</p>
  <a href="https://rentpe.in/dashboard/student" class="button">Track My Booking</a>
`);

export const BookingConfirmedTemplate = (tenantName: string, propertyName: string, checkInDate: string) => BaseLayout(`
  <h2 style="margin-top: 0; color: #10b981;">Booking Confirmed! ✅</h2>
  <p>Hi ${tenantName},</p>
  <p>Pack your bags! Your stay at <strong>${propertyName}</strong> has been confirmed by the owner.</p>
  <p><strong>Check-in Date:</strong> ${checkInDate}</p>
  <p>Next steps:</p>
  <ul>
    <li>Complete your KYC if not already done.</li>
    <li>Pay your first month's rent via the dashboard.</li>
    <li>A digital Tenant Agreement will be shared shortly.</li>
  </ul>
  <a href="https://rentpe.in/dashboard/student" class="button">Complete Onboarding</a>
`);

export const KycStatusTemplate = (name: string, status: 'APPROVED' | 'REJECTED', notes?: string) => BaseLayout(`
  <h2 style="margin-top: 0;">KYC Verification Update</h2>
  <p>Hi ${name},</p>
  <p>Your KYC document verification status has been updated.</p>
  <div style="background: ${status === 'APPROVED' ? '#ecfdf5' : '#fef2f2'}; border: 1px solid ${status === 'APPROVED' ? '#10b981' : '#ef4444'}; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0; font-weight: bold; color: ${status === 'APPROVED' ? '#065f46' : '#991b1b'};">Status: ${status}</p>
    ${notes ? `<p style="margin-top: 8px; font-size: 14px;"><strong>Note:</strong> ${notes}</p>` : ''}
  </div>
  ${status === 'REJECTED' ? '<p>Please log in to re-upload your documents for verification.</p>' : ''}
  <a href="https://rentpe.in/dashboard" class="button">Go to Dashboard</a>
`);

export const InvoiceGeneratedTemplate = (name: string, month: string, amount: number, dueDate: string) => BaseLayout(`
  <h2 style="margin-top: 0;">New Rent Invoice Generated 📜</h2>
  <p>Hi ${name},</p>
  <p>A new rent invoice has been generated for <strong>${month}</strong>.</p>
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin: 24px 0;">
    <p style="margin: 0; font-size: 14px; color: #64748b;">Amount Due</p>
    <p style="margin: 4px 0 16px 0; font-size: 28px; font-weight: 800; color: #1e293b;">₹${amount.toLocaleString('en-IN')}</p>
    <p style="margin: 0; font-size: 14px; color: #64748b;">Due Date</p>
    <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: #ef4444;">${dueDate}</p>
  </div>
  <p>Please ensure payment is made by the due date to avoid any late fees or service interruptions.</p>
  <a href="https://rentpe.in/dashboard/student" class="button">Pay Now</a>
  <p style="margin-top: 24px; font-size: 13px; color: #94a3b8;">You can download the formal PDF receipt from your dashboard after successful payment.</p>
`);
