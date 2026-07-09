/**
 * Slack Webhook Utility — RentPe Phase 1 Free Direct Automations
 *
 * Usage:
 *   import { sendSlackNotification } from '@/lib/slack';
 *   await sendSlackNotification('Payment received!', { amount: '₹5000', student: 'Ravi' });
 *
 * Setup:
 *   1. Go to https://api.slack.com/apps → Create App → Incoming Webhooks
 *   2. Activate Incoming Webhooks and add a webhook to your channel
 *   3. Copy the Webhook URL into SLACK_WEBHOOK_URL in your .env
 */

/**
 * Send a formatted Slack Block Kit notification.
 * Never throws — wraps everything in try/catch.
 *
 * @param message  - Primary headline text (shown as bold header in Slack)
 * @param details  - Optional key-value pairs rendered as a field list beneath the message
 */
export async function sendSlackNotification(
  message: string,
  details?: Record<string, string>
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn(
      '[Slack] SLACK_WEBHOOK_URL is not set — skipping Slack notification.'
    );
    return;
  }

  try {
    const timestamp = new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });

    // Build Block Kit payload
    const blocks: object[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🏠 RentPe — ${message}`,
          emoji: true,
        },
      },
    ];

    // Add details as a two-column section if provided
    if (details && Object.keys(details).length > 0) {
      const fields = Object.entries(details).map(([key, value]) => ({
        type: 'mrkdwn',
        text: `*${key}:*\n${value}`,
      }));

      // Slack allows max 10 fields per section; chunk if needed
      for (let i = 0; i < fields.length; i += 10) {
        blocks.push({
          type: 'section',
          fields: fields.slice(i, i + 10),
        });
      }
    }

    // Timestamp context footer
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🕐 *${timestamp} IST*`,
        },
      ],
    });

    // Divider for visual separation
    blocks.push({ type: 'divider' });

    const payload = { blocks };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(
        `[Slack] Webhook responded with status ${response.status}: ${await response.text()}`
      );
    }
  } catch (err) {
    // Never crash the app — log and swallow
    console.error('[Slack] Failed to send notification:', err);
  }
}
