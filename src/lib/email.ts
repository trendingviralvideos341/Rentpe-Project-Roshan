import nodemailer from 'nodemailer';

// Email transporter configuration via environment variables
// For production, use a professional ESP like Resend, SendGrid, or Amazon SES.
// For development/testing, Ethereal or Mailtrap can be used.

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER || 'test@example.com',
    pass: process.env.EMAIL_PASS || 'test_pass',
  },
});

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends an email using the configured transporter.
 * Returns true if successful, false otherwise.
 */
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<boolean> {
  // If no email credentials are set, log the email content to console in development
  if (!process.env.EMAIL_USER && process.env.NODE_ENV === 'development') {
    console.warn('--- EMAIL MOCK (No EMAIL_USER set) ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content: ${html.substring(0, 500)}...`);
    console.warn('-------------------------------------');
    return true;
  }

  try {
    const info = await transporter.sendMail({
      from: `"RentPe Support" <${process.env.EMAIL_FROM || 'support@rentpe.in'}>`,
      to,
      subject,
      html,
    });

    console.log('Message sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}
