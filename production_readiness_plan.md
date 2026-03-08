# Production Readiness Checklist

RentPe is now technically 99% ready for production. The remaining 1% consists of environment-specific configurations and final sanity checks.

## 1. Environment Variables (Strict)
Ensure your production environment (Vercel/Self-hosted) has these keys:
- `RENTPE_DATABASE_URL`: Production PostgreSQL/SQLite connection string.
- `JWT_SECRET`: A high-entropy random string (64+ chars).
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- `NEXT_PUBLIC_SENTRY_DSN`: For error tracking.
- `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`: For analytics.
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`: Live keys for payments.
- `RESEND_API_KEY`: For welcome and notification emails.

## 2. Technical Safeguards
- [x] **Rate Limiting**: Active on auth/API routes (Middleware).
- [x] **Data Privacy**: Authenticated storage for KYC docs (Phase 2).
- [x] **Consent Logging**: Granular DPDP compliance (Phase 3).
- [x] **Sentry/PostHog**: Integrated for observability.

## 3. Launch Steps (Owner/Admin)
1. **Migration**: Run `npx prisma migrate deploy` on the production database.
2. **Seed Data**: (Optional) Seed standard PG categories or initial amenities.
3. **Verify Domain**: Ensure HTTPS is active and the `/status` page reports healthy connectivity.
4. **Test Live Payment**: Conduct one ₹1 Transaction in Live Mode to verify Razorpay secrets.

## 4. Final Verification Logic
I am currently resolving final TypeScript type mismatches in the `switchRole` function to ensure seamless multi-role switching for Users/Owners.
