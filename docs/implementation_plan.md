# RentPe Production Refinement: Implementation Plan

Audit-driven roadmap to transform the current prototype into a production-grade, legally compliant, and secure PG platform.

## 1. Data Layer & Compliance (DPDP/Security)

### [MODIFY] [schema.prisma](file:///c:/Antigravity/ANTIGRATIVITY project/rentpe/prisma/schema.prisma)
*   **User Model**: Add `dpdpConsentVersion` (Int) and `isKycVerified` (Boolean).
*   **Property Model**: Add `licenseNumber` (String), `reraId` (String).
*   **Booking Model**: Add `moveInDate` (DateTime), `stayDuration` (Int), `occupants` (Int).

### [MODIFY] [auth.ts](file:///c:/Antigravity/ANTIGRATIVITY project/rentpe/src/actions/auth.ts)
*   Implement `POSTHOG` event tracking for legal consent audits.

## 2. Onboarding Flow (Owner)

### [MODIFY] [Property Multi-Step Form](file:///c:/Antigravity/ANTIGRATIVITY project/rentpe/src/app/dashboard/owner/properties/new/page.tsx)
*   **Step 4 (Photos)**: Enforce 4-photo limit per category using Cloudinary widget feedback.
*   **New Step 5**: Room configuration grid for specific room numbering and bed types.

## 3. Booking Flow (Student)

### [NEW] [Booking Page](file:///c:/Antigravity/ANTIGRATIVITY project/rentpe/src/app/properties/[id]/book/page.tsx)
*   Implement the 4-field request form: Move-in, Duration, Occupants, Message.
*   **Logic**: Auto-fill name/email/phone as READ-ONLY from session.

## 4. Admin & Security

### [MODIFY] [Admin Users Page](file:///c:/Antigravity/ANTIGRATIVITY project/rentpe/src/app/dashboard/admin/users/page.tsx)
*   Add ability to edit name/email/phone (Audit-logged operation).

## 5. Global Policy (Spam/Hacker Prevention)
*   **Rule**: Users must have a `Verified Phone` to post a booking request.
*   **Rule**: Limit to 3 active booking requests per user to prevent spam.

## Verification
*   Manual walk-through of the 5-step property form.
*   Attempting to edit read-only profile fields via browser console (Server-side validation check).
