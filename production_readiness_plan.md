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

## 5. Pre-Live Security & Deployment Checklist (CRITICAL)
When the command is given to move to "Testing" or "Fully Live Production", the following security actions MUST be verified:

### A. Content Security Policy (CSP) Verification
- [ ] **Verify `next.config.ts`**: Ensure the strict global CSP is active.
- [ ] **Verify Payment Exemption**: Double-check that `/secure/payment` specifically retains the `https:` exception in `frame-src` so Razorpay bank redirects (3D-Secure/OTP) never crash.
- [ ] **Violation Monitoring**: Ensure Sentry is fully catching and reporting any unexpected blocked scripts on production devices.

### B. Business & Payment Configuration (Razorpay Dashboard)
- [ ] **Disable Credit Cards for Rent**: If the business strategy dictates zero MDR fees, physically log into the Razorpay Live Dashboard and disable the "Credit Card" method so students are routed to UPI/Netbanking.
- [ ] **Live Keys Swap**: Ensure the codebase `.env` is swapped from `rzp_test_...` to `rzp_live_...`.
- [ ] **Test ₹1 Transaction**: Before opening to the public, process a ₹1 Live Token transaction and let it hit the bank redirect to guarantee the CSP is holding up in the live banking environment.

### C. Secrets & Environment Hardening
- [ ] Ensure `JWT_SECRET` is rotated to a massive, unguessable string in the Vercel production environment variables.
- [ ] Verify that no `console.log` statements are leaking user KYC data or Razorpay response tokens to the browser console.

### D. Error Tracking & Observability (Sentry)
- [ ] **Sentry DSN**: Create an account on Sentry.io, generate a real Next.js DSN, and add it to the Vercel dashboard as `NEXT_PUBLIC_SENTRY_DSN`. This ensures we catch production crashes and bugs instantly instead of relying on students to report them.

### E. Database Performance & Indexing (Scalability)
- [ ] **Booking Indexes**: Add database indexes to fields that are searched frequently (e.g., indexes on `onboardingDate` and `status` inside `prisma/schema.prisma`) to keep the dashboard and automated cron jobs running fast once you scale past 1,000+ bookings.
- [ ] **Production Migration**: Run `npx prisma migrate deploy` to deploy the schema changes on your live database.
