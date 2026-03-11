# RentPe: Production-Grade Audit & Roadmap

This audit evaluates the current RentPe implementation against Tier-1 platform standards, Indian legal compliance (DPDP/RERA), and enterprise security requirements.

## 1. Governance & Legal Alignment (Lawyer Perspective)

### DPDP Act 2023 (Digital Personal Data Protection)
*   **Current State**: Basic T&C consent logging exists.
*   **Gaps**: 
    *   Missing "Notice for Collection" (Privacy Policy pop-up during signup).
    *   Missing granular consent for marketing vs. functional data.
    *   **Action**: Implement a Data Consent Manager and a `privacy_policy` versioning system.

### RERA / Rental Regulation
*   **Current State**: Property listings are self-reported.
*   **Gaps**: 
    *   PG accommodations in many states require "Form 1" registration.
    *   **Action**: Add a mandatory `RERA_No` or `Property_License_Number` field for commercial listings to shield the platform from liability.

---

## 2. Technical Architecture Audit (Architect Perspective)

### Database Integrity
*   **Existing Pattern**: Comma-separated strings for roles and amenities.
*   **Critique**: This is a "Technical Debt" anti-pattern for a senior architect.
*   **Action**: Normalize `Amenities` and `Roles` into separate tables with relational links to enable advanced filtering and granular permissions.

### Concurrency & Overbooking
*   **Vulnerability**: Two students can currently "Request Booking" for the same bed simultaneously without a locking mechanism.
*   **Action**: Implement `Row-Level Locking` or a `Redis-based Reservation Buffer` (15-min lock) when a user enters the booking flow.

---

## 3. Security & Bounty Hunter Perspective

### Account Takeover (ATO) Prevention
*   **Vulnerability**: No rate limiting on 2FA or Password Reset endpoints.
*   **Action**: Implement `Express-Rate-Limit` or Prisma-based request tracking to block brute-force attempts.

### Data Exfiltration
*   **Risk**: The `getCurrentUser` action might return sensitive fields if a developer accidentally adds them to the `select` block.
*   **Action**: Create strict `DTO` (Data Transfer Object) schemas for all API responses.

---

## 4. Business & Growth Polish (Business Head Perspective)

### Trust & Safety (The "Bounty Hunter" deterrent)
*   **Current State**: Manual Admin approval.
*   **Gaps**: Missing "Verified Profile" badges for Owners.
*   **Action**: Integrate an e-KYC provider (like Digio or Hyperverge) for instant Aadhaar/PAN verification for Owners.

### Revenue Flow
*   **Gap**: Currently, the platform connects users but doesn't capture the security deposit/token amount during the booking request.
*   **Action**: Implement a "Token Payment" (e.g., ₹999) requirement to "Confirm" a booking request, reducing spam bookings.

---

## 5. Implementation Roadmap (Priority Order)

1.  **Phase A (Security/Legal)**: Rate limiting, Privacy Policy logic, e-KYC UI stubs.
2.  **Phase B (Property Logic)**: 5-Step Form refinement (Exterior/Interior/Washroom mandatory photos), License Number validation.
3.  **Phase C (Booking Flow)**: Dynamic occupancy pricing, Move-in/Stay duration logic validation, Token Payment trigger.
4.  **Phase D (Admin Panel)**: Role-locked profile editing, "Verified" badge toggle.
