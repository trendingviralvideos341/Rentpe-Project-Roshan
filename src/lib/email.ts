import { Resend } from 'resend';

// Initialize Resend SDK using environment variable (with fallback for Next.js build time)
const resend = new Resend(process.env.RESEND_API_KEY || 're_build_dummy');

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends an email using the Resend SDK.
 * Handles failures gracefully to avoid breaking application flows.
 * Returns true if successful, false otherwise.
 */
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<boolean> {
  // If no API key is set, mock the email (useful for local development without keys)
  if (!process.env.RESEND_API_KEY && process.env.NODE_ENV === 'development') {
    console.warn('--- EMAIL MOCK (No RESEND_API_KEY set) ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content: ${html.substring(0, 500)}...`);
    console.warn('-------------------------------------');
    return true;
  }

  // Get sender from environment or fallback to Resend testing domain
  const sender = process.env.EMAIL_FROM || 'RentPe Development <onboarding@resend.dev>';

  try {
    const { data, error } = await resend.emails.send({
      from: sender,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Resend API Error:', error);
      return false;
    }

    console.log('Email sent successfully via Resend. ID:', data?.id);
    return true;
  } catch (error) {
    console.error('Unexpected error sending email with Resend:', error);
    return false;
  }
}
