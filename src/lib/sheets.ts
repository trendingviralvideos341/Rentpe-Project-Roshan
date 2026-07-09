/**
 * Google Sheets Utility — RentPe Phase 1 Free Direct Automations
 *
 * Uses the FREE, zero-dependency approach via a Google Apps Script Web App.
 * No googleapis package required — just fetch().
 *
 * HOW TO SET UP YOUR FREE GOOGLE APPS SCRIPT ENDPOINT:
 * ─────────────────────────────────────────────────────
 * 1. Open Google Sheets → Extensions → Apps Script
 * 2. Paste this script and save:
 *
 *    function doPost(e) {
 *      try {
 *        var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
 *        var data = JSON.parse(e.postData.contents);
 *        sheet.appendRow(data.row);
 *        return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
 *          .setMimeType(ContentService.MimeType.JSON);
 *      } catch (err) {
 *        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: String(err) }))
 *          .setMimeType(ContentService.MimeType.JSON);
 *      }
 *    }
 *
 * 3. Deploy → New Deployment → Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the Web App URL into GOOGLE_SHEET_WEBHOOK_URL in your .env
 *
 * Recommended column headers for the payments sheet (Row 1):
 *   Date | Booking ID | Student Name | Property Name | Amount (₹) | Type
 */

/**
 * Append a row of data to a Google Sheet via a Google Apps Script Web App.
 * Never throws — wraps everything in try/catch.
 *
 * @param row - Array of strings representing cell values, left-to-right
 */
export async function appendToSheet(row: string[]): Promise<void> {
  const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn(
      '[Sheets] GOOGLE_SHEET_WEBHOOK_URL is not set — skipping Google Sheets append.'
    );
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row }),
    });

    if (!response.ok) {
      console.warn(
        `[Sheets] Apps Script responded with status ${response.status}: ${await response.text()}`
      );
      return;
    }

    const result = await response.json().catch(() => null);
    if (result && result.status !== 'ok') {
      console.warn('[Sheets] Apps Script returned non-ok response:', result);
    }
  } catch (err) {
    // Never crash the app — log and swallow
    console.error('[Sheets] Failed to append row:', err);
  }
}
