
// ─── Password Reset Template (appended) ──────────────────────────────────────
export const PasswordResetTemplate = (name: string, resetUrl: string): string => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your RentPe Password</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f8f9ff;margin:0;padding:40px 20px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(88,28,235,0.08);">
    <div style="background:linear-gradient(135deg,#3b5bdb 0%,#7048e8 100%);padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;">🔐 RentPe</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Password Reset Request</p>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#1e293b;font-size:20px;font-weight:800;margin:0 0 12px;">Hi ${name},</h2>
      <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 24px;">
        We received a request to reset your RentPe password. Click the button below to set a new password.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#3b5bdb,#7048e8);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:800;font-size:15px;letter-spacing:0.3px;">
          Reset My Password →
        </a>
      </div>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 16px;margin:24px 0;">
        <p style="color:#c2410c;font-size:13px;font-weight:700;margin:0;">
          ⚠️ This link expires in <strong>30 minutes</strong>.
        </p>
      </div>
      <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0;">
        If you didn't request this, please ignore this email. Your password will remain unchanged. Never share this link — RentPe will never ask for it.
      </p>
      <p style="color:#cbd5e1;font-size:11px;margin:16px 0 0;word-break:break-all;">
        If the button doesn't work, copy this URL: ${resetUrl}
      </p>
    </div>
    <div style="background:#f8f9ff;padding:20px 32px;border-top:1px solid #e2e8f0;">
      <p style="color:#94a3b8;font-size:12px;margin:0;text-align:center;">
        © ${new Date().getFullYear()} RentPe. India's trusted PG &amp; Hostel platform.
      </p>
    </div>
  </div>
</body>
</html>`;
};
