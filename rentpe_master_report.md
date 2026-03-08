# RentPe: Master Product & Technical Report
**Version**: 1.0.0
**Date**: March 8, 2026
**Prepared For**: Stakeholders, Investing Partners, and Technical Leadership
**Prepared By**: RentPe Product Strategy & Engineering Team

---

## 1. Executive Summary
**RentPe** is a cutting-edge, technology-first marketplace designed to revolutionize the "Paying Guest" (PG) and student housing industry in India. Leveraging a modern full-stack architecture, RentPe provides a seamless, "Airbnb-style" experience for students looking for quality accommodation and a professional management suite for property owners. Operating at the intersection of PropTech and FinTech, the platform ensures trust through verified KYCs, financial transparency through automated billing, and operational reliability through cloud-native infrastructure.

---

## 2. Company Overview
*   **Company Story**: Born from the frustration of students navigating fragmented, unverified rental listings, RentPe was built to bring "Standardized Living" to the urban rental market.
*   **Mission**: To make finding and managing student accommodation as simple as booking a hotel.
*   **Vision**: To be India's largest and most trusted network of student-friendly living spaces.
*   **Core Values**: Transparency, Security, Innovation, and Community-First.
*   **Market Problem**: High fragmentation, lack of trust between owners and tenants, manual/opaque billing cycles, and non-existent digital audit trails.

---

## 3. Business Model
RentPe operates a **Hybrid Commission & Subscription Model**:
*   **Commission Model**: A percentage-based fee (e.g., 5-10%) on every booking and monthly rent processed through the platform.
*   **Onboarding Fees**: One-time setup fee for owners to list their property and receive "Verified" status.
*   **Premium Listings**: Subscription model for owners to feature their properties at the top of search results.
*   **Value-Added Services**: Monetization through curated services like housekeeping, high-speed Wi-Fi upgrades, and student insurance.
*   **Pricing Strategy**: Dynamic pricing based on occupancy trends, local university demand, and property amenities.

---

## 4. Full Platform Architecture
RentPe utilizes a **Next-generation Hybrid Architecture**:
*   **Frontend**: Next.js 15 (React) with Server Components for SEO and speed.
*   **Backend**: Next.js Server Actions & API Routes (Edge-ready logic).
*   **Database**: PostgreSQL hosted on Vercel/Supabase, managed via **Prisma ORM**.
*   **File Storage**: **Cloudinary** (Secure, multi-tier storage with authenticated access).
*   **Intelligence**: PostHog for behavior analysis and Sentry for error instrumentation.

---

## 5. Technology Stack
| Category | Technology | Rationale |
| :--- | :--- | :--- |
| **Framework** | Next.js 15+ | Industry standard for full-stack performance and SSR. |
| **Styling** | Tailwind CSS / Vanilla | Rapid development with a premium, sleek aesthetic. |
| **Database** | PostgreSQL | Relational integrity for complex booking/billing logic. |
| **Auth** | NextAuth.js | Secure JWT-based strategy with multi-role support. |
| **Payments** | Razorpay | Leading India-specific gateway with split-payment support. |
| **Storage** | Cloudinary | Auto-optimization and secure, authenticated KYC storage. |
| **Monitoring** | Sentry | Full-stack error tracking and performance profiling. |
| **Analytics** | PostHog | Privacy-first behavioral tracking and funnel analysis. |

---

## 6. Application Components
1.  **Public Website**: High-conversion landing pages, property search, and map-view interfaces.
2.  **Student Dashboard**: Central hub for bookings, rent payments, KYC document management, and status tracking.
3.  **Owner Dashboard**: High-level property management, occupancy stats, revenue tracking, and document verification portal.
4.  **Admin Panel**: The "God Mode" interface for platform settings, 2FA management, global status monitoring, and support resolution.
5.  **Internal Staff Portals**: Streamlined dashboards for Verifiers (KYC checks) and Onboarders (Property listing approvals).

---

## 7. Data Architecture
*   **Database Structure**: Normalized relational schema with 20+ tables (Users, Properties, Bookings, Documents, Payments, AuditLogs).
*   **Data Relationships**: 1:N (Owners to Properties), 1:N (Properties to Bookings), 1:1 (Bookings to Payments).
*   **Data Integrity**: Managed via Prisma's strict typing and foreign key constraints.
*   **Backup Strategy**: Automated daily snapshots with Point-in-Time Recovery (PITR).
*   **Privacy Handling**: Sensitive data (Aadhaar/PAN) is stored in **Authenticated Buffers** inside Cloudinary, accessible only via temporary signed URLs.

---

## 8. Data Flow
**Core Lifecycle**:
1.  **Input**: User enters search criteria on the Frontend.
2.  **Processing**: Next.js Server Action fetches filtered records from Prisma.
3.  **Storage**: Metadata stored in PostgreSQL; visual assets served via Cloudinary CDN.
4.  **Output**: Real-time property list rendered with optimized images.

---

## 9. Request Flow
**Security-First Execution**:
1.  **Request**: User clicks "Book Now".
2.  **Middleware**: Checks IP Rate Limit → Validates Session → Checks Role Permissions.
3.  **Verification**: Backend validates input data (Zod) → Checks room availability.
4.  **DB Transaction**: Locks the room record → Creates Pending Booking → Generates Audit Log.
5.  **Response**: Frontend receives success signal and redirects to payment.

---

## 10. User Signup Flow
1.  **Authentication**: Email/Password or Social OAuth.
2.  **Verification**: 
    - **Email**: Magic link or OTP verification.
    - **Phone**: SMS OTP verification via integrated gateway.
3.  **Role Selection**: User identifies as Tenant, Owner, or Staff.
4.  **KYC Initiation**: User uploads ID Proof (Private storage) + Personal details.
5.  **Completion**: User directed to personalized dashboard based on role.

---

## 11. Booking Flow
*   **Step 1: Discover**: Search by university name, budget, or amenities.
*   **Step 2: Reserve**: User selects a bed and initiates "Reservation" (Room locked for 15m).
*   **Step 3: KYC**: Student uploads required documents for owner approval.
*   **Step 4: Approval**: Owner/Admin verifies documents.
*   **Step 5: Payment**: Secure checkout via Razorpay.
*   **Step 6: Confirmation**: Digital receipt + Automated Check-in instructions sent via Email.

---

## 12. Payment Flow
*   **Integration**: Seamless Razorpay Standard Checkout.
*   **Capture**: Server-side webhook verification to prevent "Partial Payment" fraud.
*   **Commission**: Logic to auto-deduct platform fee before settling to owner.
*   **Payouts**: Automated Transfers (T+2) to owner bank accounts.
*   **Refunds**: Managed through Admin Portal with automated ledger updates.

---

## 13. Error Handling Flow
*   **User Layer**: Real-time field validation with descriptive "Toasts" (Sonner).
*   **API Layer**: Structured Error objects (400, 401, 403, 500) caught by Global Error Boundaries.
*   **Failure Recovery**: Fallback to mock data in dev; high-availability failover in prod.
*   **Logging**: Every system error is piped to **Sentry** with full stack traces and breadcrumbs.

---

## 14. Security Monitoring & Threat Detection (Phase 3)
To ensure long-term resilience, RentPe implements proactive security measures:
*   **Brute-Force Protection**: API-level rate limiting combined with server-side tracking of failed login attempts.
*   **Auditability**: Every critical action (KYC verification, payment, account deletion) is logged with a permanent trail.
*   **Session Guard**: Multi-device session tracking with one-click "Sign Out from All Devices" capability.

---

## 15. Legal & Regulatory Compliance (DPDP Act 2023)
RentPe is built to be "Privacy First" by design:
*   **Granular Consent**: Users provide explicit, informed consent for specific data uses (Mandatory for service, Optional for marketing).
*   **Right to Erasure**: A "Purge My Account" feature that permanently scrubs PII and deletes all cloud-stored identification documents.
*   **Data Minimization**: We only collect KYC data required by Indian law and local police regulations.

---

## 16. Security Architecture
**The "Hardened" Framework**:
*   **Injection**: Prisma ORM auto-escapes all queries (No SQLi).
*   **XSS**: Next.js auto-sanitizes outputs; strict CSP (Content Security Policy) headers.
*   **CSRF**: Integrated CSRF protection in NextAuth.
*   **Rate Limiting**: IP-based throttling in Middleware to stop brute-force attacks.
*   **Asset Privacy**: Sensitive KYCs use "Authenticated" access mode (Not public).

---

## 17. Legal and Compliance
*   **Privacy Policy**: Transparent disclosure on data collection and Cloudinary storage.
*   **Terms of Service**: Clearly defined booking cancellation and refund rules.
*   **DPDP Compliance** (India): Implemented Purpose Limitation and strict Access Control for personal data.
*   **Financial Compliance**: Integrated GST invoicing and TDS compliance logic for transfers.

---

## 18. Trust and Safety System
*   **Double-Blind KYC**: Verifiers check documents without seeing PII if not required.
*   **Property Shield**: Every property undergoes a physical or digital verification check before "Go-Live".
*   **Fraud Detection**: PostHog flags suspicious login patterns or high-frequency booking attempts.

---

## 17. Operations and Business Systems
*   **Support**: Zendesk/Intercom integration for ticket management.
*   **CRM**: Automated Hubspot sync for lead management.
*   **Marketing**: Newsletter automation via Resend/SendGrid.
*   **Finance**: Tally/Quickbooks exportable reports from the Admin Dashboard.

---

## 18. Monitoring and Reliability
*   **Uptime**: Public status page (`/status`) monitoring DB, Storage, and API.
*   **Observability**: Real-time performance monitoring via Sentry.
*   **Backups**: 24-hour cycle Postgres backups.
*   **Health Checks**: Automated pings to core dependencies every 60 seconds.

---

## 19. Growth Strategy
*   **Referral Loop**: "Refer a Roommate" - Discounts for both the referrer and the new tenant.
*   **SEO**: Dynamic `/pg-near-[university]` pages for organic search dominance.
*   **Micro-Influencers**: Campus Ambassador programs with trackable referral links.

---

## 20. Complete Platform Workflow Summary
1.  **Owner** lists Property → **Onboarder** approves.
2.  **Student** searches → **Finds** Dream Room.
3.  **Student** uploads KYC → **Verifier** approves.
4.  **Student** pays → **Booking** Confirmed.
5.  **Automation** generates Invoice → **Owner** gets Payout.
6.  **Sentry/PostHog** monitors the entire journey for quality.

---

## 21. Industry Benchmark Analysis
| Feature | Airbnb | NestAway | RentPe (Ours) |
| :--- | :--- | :--- | :--- |
| **Market Focus** | Worldwide Travel | Managed Indian Rental | **Student/PG Niche** |
| **Trust Layer** | Government ID | Physical Audit | **Digital/Physical KYC** |
| **Payment** | Global Stripe | Manual/Bank Transfer | **Integrated Razorpay** |
| **Technology** | Custom Framework | Legacy PHP/Node | **Modern Next.js 15** |

---

## 22. Risk Analysis
*   **Cyber Risks**: Mitigated by Rate Limiting, Signed URLs, and 2FA.
*   **Fraudulent Bookings**: Mitigated by Escrow-style payments (Razorpay).
*   **System Failures**: High-availability cloud hosting with multi-region redundancy.

---

## 23. Future Scalability Plan
*   **Compute**: Horizontal auto-scaling via Vercel Edge functions.
*   **Data**: Transition to Read-Replicas and Redis-caching for search.
*   **Architecture**: Potential move to Microservices for Payment and Verification modules once at 1M+ users.

---

## 24. Final Recommendations
RentPe is currently **Production-Ready**. We recommend:
1.  **Security**: Conduct a 3rd-party VAPT (Vulnerability Assessment) before 10k users.
2.  **Compliance**: Regular audits of the signed-URL expiration logic in Cloudinary.
3.  **Automation**: Invest in further AI-based auto-verification for student IDs to speed up the booking flow.

---
**END OF REPORT**
