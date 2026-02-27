# RentPe — Complete Project Documentation

> **Last updated:** 26 Feb 2026
> **Framework:** Next.js 16 (App Router) · TypeScript · Tailwind CSS · Prisma ORM · SQLite
> **Dev server:** `npm run dev` → `http://localhost:3000`

---

## 1. Technology Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| Framework | Next.js 16.1.6 | App Router, Turbopack, Server Actions |
| Language | TypeScript | Strict mode |
| UI | React 19 + Tailwind CSS | Custom components in `src/components/ui/` |
| Database | SQLite via Prisma ORM | File: `dev.db`, schema: `prisma/schema.prisma` |
| Auth | Custom JWT | Cookie `rentpe_session`, 24h expiry, httpOnly |
| Payment | Razorpay | INR, paise conversion (×100) |
| Password | bcrypt + HMAC | `encryptPassword()`, `comparePassword()` in `src/lib/auth.ts` |

### Environment Variables (`.env`)
| Variable | Purpose |
|----------|---------|
| `RENTPE_DATABASE_URL` | SQLite connection (`file:./dev.db`) |
| `JWT_SECRET` | Signs session JWTs |
| `RAZORPAY_KEY_ID` | Razorpay merchant key (server) |
| `RAZORPAY_KEY_SECRET` | Razorpay secret (server) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay key (client-side) |
| `NEXT_PUBLIC_APP_URL` | Base URL (localhost:3000 or production) |

---

## 2. Database Schema — 18 Models

### User
| Field | Type | Details |
|-------|------|---------|
| `id` | UUID | Primary key |
| `displayId` | String? | `OW-000001`, `TNT-000001`, `ONB-000001`, `VER-000001`, `ADM-000001` |
| `email` | String | Unique |
| `passwordHash` | String | bcrypt hash |
| `role` | String | `USER`, `OWNER`, `ADMIN`, `ONBOARDER`, `VERIFIER` |
| `name` | String? | First + last name |
| `phone` | String? | Optional |
| `status` | String | `ACTIVE` or `BANNED` |
| `bannedReason` | String? | Reason for ban |
| `deletedAt` | DateTime? | Soft-delete timestamp |
| `createdAt` | DateTime | Auto-set on creation |
| `updatedAt` | DateTime | Auto-updated |

**Relations:** → `Property[]`, `Booking[]`, `Ticket[]`, `Notification[]`, `AuditLog[]`, `ActionNote[]`, `OwnerOnboarding[]`

---

### Property
| Field | Type | Details |
|-------|------|---------|
| `id` | UUID | Primary key |
| `ownerId` | String | FK → User |
| `name` | String | Property display name |
| `address` | String | Full street address |
| `city` | String | City name |
| `description` | String? | Text description |
| `amenities` | String | JSON array: `["WiFi","AC","Parking"]` |
| `images` | String | JSON: `{front:[],room:[],bathroom:[],common:[],balcony:[],other:[]}` |
| `ownerName` | String? | Building owner name |
| `pgLicence` | String? | PG/Hostel licence number |
| `createdAt` / `updatedAt` | DateTime | Timestamps |

**Relations:** → `Room[]`, `FoodMenu[]`, `Ticket[]`, `Tenant[]`

---

### Room
| Field | Type | Details |
|-------|------|---------|
| `id` | UUID | Primary key |
| `propertyId` | String | FK → Property |
| `roomNumber` | String | e.g. "204" |
| `type` | String | `Single`, `Double`, `Triple` |
| `price` | Float | Monthly rent in ₹ |
| `availability` | Int | Number of beds available |

---

### Booking
| Field | Type | Details |
|-------|------|---------|
| `id` | UUID | Primary key |
| `displayId` | String | `REQ-12345678` (random 8 digits) |
| `userId` | String | FK → User (who booked) |
| `roomId` | String? | FK → Room (assigned later by owner) |
| `propertyName` | String | Which PG |
| `occupancy` | String | `Single` / `Double` / `Triple` |
| `guestName` | String | Full name |
| `guestEmail` | String? | Collected during onboarding |
| `guestPhone` | String? | +91 prefix, 10 digits |
| `guestAddress` | String? | Street address |
| `guestCity` | String? | City |
| `guestPincode` | String? | 6-digit (Indian) |
| `guestCountry` | String? | Default: `India` |
| `occupationType` | String? | `Student` / `Working Professional` / `Other` |
| `occupationDetail` | String? | College name / Company / etc |
| `onboardingDate` | String? | Actual move-in confirmed by owner |
| `moveInDate` | String | Requested move-in date |
| `status` | String | See status lifecycle below |
| `paymentStatus` | String | `UNPAID` / `PAID` |
| `paymentMethod` | String? | `ONLINE` / `CASH` |
| `paidAt` | DateTime? | When payment was confirmed |
| `amount` | String | Rent amount as string |
| `roomAssigned` | String? | e.g. `"204 (Double)"` |
| `pendingAmount` | String? | Additional balance after owner edits |
| `agreementSigned` | Boolean | Default: false |
| `deletedAt` | DateTime? | Soft-delete |

**Booking Status Lifecycle:**
```
PENDING_APPROVAL → APPROVED_PAYMENT_PENDING → PAID → (active tenant)
         ↓                                       ↓
     CANCELLED                              REJECTED
```

---

### Tenant
| Field | Type | Details |
|-------|------|---------|
| `id` | UUID | Primary key |
| `displayId` | String | `TNT-XXXXXX` |
| `name`, `phone`, `email` | String | Contact details |
| `address`, `city`, `pincode`, `country` | String? | Full postal address |
| `occupationType`, `occupationDetail` | String? | Job/study details |
| `propertyId`, `roomId` | String | FK refs |
| `roomNumber`, `roomType` | String | Room info |
| `rent` | String | Monthly rent |
| `startDate` | String | Move-in date |
| `status` | String | `ACTIVE` / `VACATED` |
| `vacatedOn` | String? | Timestamp when vacated |
| `vacateNote` | String? | Mandatory reason |

**Created automatically when booking is marked PAID** — from booking data.

---

### RentRecord
| Field | Type | Details |
|-------|------|---------|
| `tenantId` | String | FK → Tenant |
| `month` | String | e.g. `"Feb 2024"` |
| `amount` | String | Monthly rent |
| `paid` | Boolean | Default: false |
| `paidOn` | String? | Date string when paid |

---

### Payment
| Field | Type | Details |
|-------|------|---------|
| `bookingId` | String | FK → Booking |
| `amount` | Float | Amount in ₹ |
| `method` | String | `ONLINE`, `CASH_TO_OWNER`, `UPI_TO_OWNER`, `SIMULATED` |
| `status` | String | `PENDING` → `VERIFIED` / `FAILED` |
| `razorpayOrderId` | String? | Razorpay order ID |
| `razorpayId` | String? | Razorpay payment ID |
| `verifiedBy` | String? | `SYSTEM`, `OWNER`, `ADMIN` |

---

### TenantDocument
| Field | Type | Details |
|-------|------|---------|
| `bookingId` | String | FK → Booking |
| `type` | String | `ID_PROOF`, `ADDRESS_PROOF`, `COLLEGE_COMPANY`, `SELFIE` |
| `fileData` | String | Base64 encoded file |
| `fileName` | String? | Original filename |
| `status` | String | `PENDING` → `VERIFIED` / `REJECTED` |
| `rejectedNote` | String? | Reason if rejected |
| `verifiedAt` | DateTime? | When verified |
| `verifiedBy` | String? | User ID of verifier |

---

### OwnerOnboarding (Onboarder/Verifier Pipeline)
| Field | Type | Details |
|-------|------|---------|
| `displayId` | String | `OOB-000001` |
| `source` | String | `SELF_SUBMITTED` or `TEAM_VISIT` |
| `ownerName`, `ownerEmail`, `ownerPhone` | String | Owner contact |
| `buildingName`, `address`, `city`, `pincode`, `country` | String | Property address |
| `pgLicenceNumber` | String? | PG licence |
| `notes` | String? | Remarks |
| `idProofData/Name` | String? | Base64 ID proof |
| `pgLicenceData/Name` | String? | Base64 PG licence doc |
| `buildingImageData/Name` | String? | Base64 building photo |
| `additionalPhotos` | String | JSON: `[{name, data}]` |
| `status` | String | See pipeline below |
| `submittedById` | String? | Owner who self-submitted |
| `onboardedById` | String? | Onboarder who processed |
| `verifiedById` | String? | Verifier who reviewed |
| `onboardedAt`, `verifiedAt` | DateTime? | Timestamps |
| `rejectedReason` | String? | If rejected |
| `auditTrail` | String | JSON: `[{status, actorId, actorName, note, timestamp}]` |

**Pipeline:**
```
PENDING_ONBOARDING → ACCEPTED_BY_ONBOARDER → PENDING_VERIFICATION → VERIFIED / REJECTED
```

---

### Other Models

| Model | Purpose |
|-------|---------|
| **FoodMenu** | Day/meal menu per property (`dayOfWeek`, `mealType`, `items`) |
| **Ticket** | Support tickets (`TCK-123456`, categories: CLEANING/WIFI/FOOD/PAYMENT/APP_ISSUE) |
| **Notification** | In-app notifications (type, message, isRead) |
| **AuditLog** | Every action with `action`, `targetId`, `targetType`, `details`, `performedBy`, `timestamp` |
| **ActionNote** | Persistent history for ban/unban/block actions with reason |
| **TeamMember** | Admin team members (`ADM-T001`, role text, permissions JSON) |
| **OwnerStaff** | Owner's staff (`STF-001`, designation, ID proof, address proof, photo) |
| **PlatformSettings** | Singleton fee config (customer/owner fee flat/percent, wallet balance) |
| **PlatformFee** | Per-booking fee record (grossAmount, customerFee, ownerFee, platformEarned) |
| **FeeExemption** | Per-user or per-PG fee exemptions with reason |

---

## 3. User Roles & Access Control

### 5 Roles

| Role | Display ID | Sign-up | Redirect After Login | Dashboard |
|------|-----------|---------|---------------------|-----------|
| **USER** | `TNT-XXXXXX` | ✅ Self (Blue chip) | `/` (homepage) | `/dashboard/student` |
| **OWNER** | `OW-XXXXXX` | ✅ Self (Orange chip) | `/dashboard/owner` | `/dashboard/owner` |
| **ADMIN** | `ADM-XXXXXX` | ❌ Assigned by admin | `/dashboard/admin` | `/dashboard/admin` |
| **ONBOARDER** | `ONB-XXXXXX` | ❌ Assigned by admin | `/dashboard/onboarder` | `/dashboard/onboarder` |
| **VERIFIER** | `VER-XXXXXX` | ❌ Assigned by admin | `/dashboard/verifier` | `/dashboard/verifier` |

### Auth Flow
1. **Signup** → validates (firstName≥2, lastName≥2, email, password≥6, role=USER|OWNER) → generates `displayId` → save to DB → redirect to `/login`
2. **Login** → find user by email → bcrypt compare → create JWT (userId, email, role, expiresAt 24h) → set cookie `rentpe_session` (httpOnly, secure in prod, sameSite lax) → redirect by role
3. **Logout** → delete cookie → client redirects to `/login`

---

## 4. Complete Data Flows

### Flow 1: Student Books a PG

```
Student visits /search → searches by city, price range, room type
       ↓
Student clicks property card → /property/[id]
       ↓
Property detail page shows: name, address, owner name, description, amenities,
food menu (if exists), room cards with availability + prices
       ↓
Student fills booking form:
  • First/Last Name (letters + spaces only validation)
  • Email (format validation)
  • Phone (+91 prefix, 10-digit numeric only)
  • Occupation Type (Student / Working Professional / Other) — chip selector
  • Occupation Detail (manual text)
  • Preferred Move-in Date
  • Room Type selector + Amount auto-fills
       ↓
Submits → createBooking() server action:
  • Booking.displayId = "REQ-" + random 8 digits
  • status = PENDING_APPROVAL
  • paymentStatus = UNPAID
  • AuditLog entry: BOOKING_REQUESTED
  • revalidatePath('/dashboard/student', '/dashboard/owner/bookings')
       ↓
Student sees confirmation at /booking/requested:
  "Your request has been sent. Wait for owner approval."
  • Blue gradient "Back to Home" button
  • Purple gradient "Go to My Dashboard" button
       ↓
Student dashboard (/dashboard/student):
  • Shows all bookings with status badges
  • Red "Cancel Request" button for PENDING_APPROVAL bookings
  • Owner contact section (name, email, phone from property owner)
  • Red pending payment banner if pendingAmount > 0
```

### Flow 2: Owner Approves/Rejects Booking

```
Owner dashboard → /dashboard/owner/bookings
Shows all bookings for owner's properties with status badges
       ↓
For PENDING_APPROVAL bookings:
  • "Approve" button → opens onboarding form
  • "Reject" button → rejects with audit log
       ↓
Onboarding form (/dashboard/owner/onboarding):
  • Indian/International citizen toggle
  • Phone: +91 prefix, 10-digit numeric (Indian)
  • Email, Address, City
  • Pincode: 6-digit → auto-fetches city via api.postalpincode.in (Indian users)
  • Country defaults to India
  • Occupation Type/Detail
  • Room assignment (dropdown of available rooms)
  • Amount (numeric, up to 2 decimal places)
  • Onboarding date
       ↓
Save → approveBooking() server action:
  • status = APPROVED_PAYMENT_PENDING
  • All guest fields updated
  • If booking was already PAID and owner edits → prompt for pendingAmount
  • AuditLog: BOOKING_APPROVED
       ↓
Student sees "Approved — Payment Pending" on their dashboard
```

### Flow 3: Payment (Online via Razorpay)

```
Student lands on /secure/payment (after approval)
       ↓
createRazorpayOrder(bookingId):
  • Reads booking.amount → strips ₹ symbol → converts to paise (×100)
  • Creates Razorpay order
  • Creates Payment record (status=PENDING, razorpayOrderId)
  • Returns order ID + key to client
       ↓
Client opens Razorpay checkout modal
       ↓
On success → verifyPayment():
  • Updates Payment status → VERIFIED
  • Updates Booking status → PAID, paymentStatus → PAID
  • Auto-creates Tenant record from booking data
  • AuditLog: BOOKING_PAID
```

### Flow 3b: Payment (Cash)

```
Owner marks cash payment → markBookingPaid(id, "CASH"):
  • status → PAID, paymentMethod → CASH, paidAt → now()
  • Auto-creates Tenant record (if roomId exists)
  • Creates initial RentRecord for current month (paid=true)
  • AuditLog: BOOKING_PAID + TENANT_CREATED
```

### Flow 4: Tenant Management

```
After payment → Tenant auto-created:
  • displayId = "TNT-XXXXXX"
  • Copies all data from booking (name, phone, email, address, occupation, etc.)
  • Creates first RentRecord for current month
       ↓
Owner → /dashboard/owner/tenants:
  • View all tenants with rent history
  • Mark rent as Paid/Unpaid with note
  • Block tenant (sets VACATED + reason) → AuditLog: TENANT_BLOCKED
  • Unblock tenant (ACTIVE again) → AuditLog: TENANT_UNBLOCKED
```

### Flow 5: Document Verification

```
Student uploads documents at /dashboard/student/documents:
  • 4 types: ID_PROOF, ADDRESS_PROOF, COLLEGE_COMPANY, SELFIE
  • Base64 encoded, upsert (replaces if same type exists)
  • status = PENDING
       ↓
Owner sees at /dashboard/owner/verifications:
  • View uploaded files
  • ✅ Verify → status=VERIFIED, verifiedAt, verifiedBy
  • ❌ Reject → status=REJECTED, rejectedNote
  • AuditLog: DOCUMENT_VERIFIED / DOCUMENT_REJECTED
```

### Flow 6: Owner Onboarding Pipeline (Onboarder → Verifier)

```
PATH A — Owner self-submits (List Property form):
  selfSubmitOnboarding() → creates OwnerOnboarding:
    • source = SELF_SUBMITTED
    • status = PENDING_ONBOARDING
    • auditTrail appended: "Self-submitted by owner"
       ↓
  Appears in Onboarder Queue (/dashboard/onboarder/queue)
       ↓
  Onboarder opens → sees all owner details → uploads docs:
    • 🪪 ID Proof (Aadhaar/PAN)
    • 📄 PG/Hostel Licence
    • 🏠 Building Photo
    • 📷 Additional Photos (multi-upload)
       ↓
  acceptOnboarding() → status = PENDING_VERIFICATION
    • onboardedById set, onboardedAt = now()
    • auditTrail appended: "Accepted by Onboarding Team"
       ↓
  Appears in Verifier Queue (/dashboard/verifier/reviews)

PATH B — Onboarder field visit:
  teamSubmitOnboarding() → creates OwnerOnboarding:
    • source = TEAM_VISIT
    • status = PENDING_VERIFICATION (skips queue)
    • All docs uploaded directly
    • auditTrail appended: "Field visit — direct to verification"
       ↓
  Goes directly to Verifier Queue

VERIFIER REVIEW:
  • View all details + documents + photos
  • ✏️ Edit any field (correct mistakes)
  • ✅ verifyOnboarding() → status=VERIFIED, verifiedById, verifiedAt
    → auditTrail: "Verified — all documents accepted" (or "Verified with corrections: [fields]")
  • ❌ rejectByVerifier() → status=REJECTED, rejectedReason
    → auditTrail: "Rejected by Verification Team: [reason]"
```

---

## 5. Platform Fee Engine

```
Admin toggles feesEnabled at /dashboard/admin/platform-fees
       ↓
When a payment is processed:
  calculateFees(amount, userId?, propertyName?):
    • Customer fee = max(customerFeeFlat ₹10, customerFeePercent 0.09% × amount)
    • Owner fee = max(ownerFeeFlat ₹10, ownerFeePercent 0.10% × amount)
    • totalCharged = amount + customerFee
    • ownerNet = amount − ownerFee
    • platformEarned = customerFee + ownerFee
    • Checks FeeExemption table (per-user or per-PG overrides)
       ↓
  recordPlatformFee() → stores PlatformFee record + increments wallet balance
```

---

## 6. Admin Panel Features

| Page | Actions |
|------|---------|
| `/dashboard/admin` | Stats: total users, bookings, open tickets, properties, system health |
| `/dashboard/admin/users` | Ban/unban users with reason. View user properties, bookings, action history |
| `/dashboard/admin/team` | Assign roles (ONBOARDER/VERIFIER/ADMIN), revoke roles, search by email |
| `/dashboard/admin/transactions` | View all Payment records with booking + user details |
| `/dashboard/admin/audit-log` | Last 100 audit log entries |
| `/dashboard/admin/platform-fees` | Toggle fee engine, set rates, manage exemptions, view wallet balance |
| `/dashboard/admin/data-management` | Archive/restore/purge Users, Bookings, Tenants, Properties |

### Data Deletion Levels
1. **Archive** (soft-delete): sets `deletedAt` timestamp
2. **Restore**: clears `deletedAt`
3. **Purge** (permanent): cascading delete of all related records

---

## 7. UI Color System

### Buttons & Gradients
| Element | Colors (Tailwind) |
|---------|------------------|
| **Sign In / Sign Up** | `from-violet-600 via-purple-600 to-blue-600` |
| **Request Booking** | `from-green-500 to-emerald-600` |
| **Cancel Request** | `bg-red-500` / `text-red-600` |
| **Back to Home** | `from-blue-600 to-indigo-600` |
| **Go to Dashboard** | `from-purple-600 to-violet-600` |
| **New Field Visit** | `from-violet-600 to-blue-600` |
| **Accept & Forward** | `from-green-500 to-emerald-600` |
| **Reject** | Red outline: `text-red-600 border-red-200` |
| **Gradient accent bar** (all cards) | `from-violet-600 via-purple-600 to-blue-600` (2px top) |

### Signup Role Chips
| Role | Color | Selected State |
|------|-------|---------------|
| Student/Tenant | Blue-indigo gradient | Filled `from-blue-600 to-indigo-600` + white text + checkmark |
| Property Owner | Orange-amber gradient | Filled `from-orange-500 to-amber-500` + white text + checkmark |

### Status Badges
| Status | Badge Color |
|--------|------------|
| ⏳ PENDING_APPROVAL | `bg-amber-100 text-amber-700` |
| ✅ APPROVED_PAYMENT_PENDING | `bg-blue-100 text-blue-700` |
| 💰 PAID | `bg-green-100 text-green-700` |
| 💵 Paid (Cash) | `CASH_PAID` label |
| 💵 Waiting Cash — Pending | `CASH_PENDING` label |
| ❌ REJECTED | `bg-red-100 text-red-700` |
| 🚫 CANCELLED | Gray badge |
| 🔍 PENDING_VERIFICATION | `bg-indigo-100 text-indigo-700` |
| ✅ VERIFIED | `bg-green-100 text-green-700` |

### Stats Cards
| Metric | Icon Color |
|--------|-----------|
| Pending | `text-amber-500` |
| In Verification | `text-blue-500` |
| Verified | `text-green-500` |
| Rejected | `text-red-500` |
| Open Tickets | `text-destructive` (red) |
| Properties | `text-green-500` |

### Password Strength Meter
| Level | Bar Color | Text |
|-------|----------|------|
| Very Weak | `bg-red-500` | `text-red-600` |
| Weak | `bg-orange-500` | `text-orange-600` |
| Fair | `bg-yellow-500` | `text-yellow-600` |
| Strong | `bg-blue-500` | `text-blue-600` |
| Very Strong | `bg-green-500` | `text-green-600` |

---

## 8. Input Validation Rules

| Field | Rule | Where Applied |
|-------|------|--------------|
| First/Last Name | Letters + spaces only (`/[^a-zA-Z\s]/g` stripped) | Signup, Booking form |
| Email | Standard email format, `type="email"` | All forms |
| Phone | `+91` prefix, 10-digit numeric only | Booking form, Onboarding |
| Pincode | 6-digit numeric (Indian) → auto-fetch city | Onboarding form |
| Amount | Numeric, up to 2 decimal places | Onboarding form |
| Password | Min 8 chars, uppercase, lowercase, number required | Signup |
| Occupation Detail | Alphanumeric + spaces | Booking form |

---

## 9. File Structure (67 Source Files)

### Server Actions (`src/actions/`)
| File | Functions |
|------|----------|
| `auth.ts` | `signup()`, `login()`, `logout()` |
| `bookings.ts` | `createBooking()`, `getBookings()`, `approveBooking()`, `rejectBooking()`, `markBookingPaid()`, `cancelBooking()`, `getBookingById()`, `getPendingBookingsCount()`, `updateBookingStatus()` |
| `onboarding.ts` | `selfSubmitOnboarding()`, `teamSubmitOnboarding()`, `acceptOnboarding()`, `rejectByOnboarder()`, `getPendingOnboardingQueue()`, `getMyOnboardings()`, `getAllOnboardings()`, `getPendingVerifications()`, `getAllVerifications()`, `verifyOnboarding()`, `rejectByVerifier()`, `getOnboardingStats()` |
| `properties.ts` | `getProperties()`, `getPropertyById()`, `createProperty()` |
| `payments.ts` | `createRazorpayOrder()`, `verifyPayment()` |
| `documents.ts` | `uploadTenantDocument()`, `getTenantDocuments()`, `getPendingDocuments()`, `verifyDocument()` |
| `admin.ts` | `getAdminStats()`, `getAuditLogs()`, `getUsers()`, `updateUserStatus()`, `getTransactions()`, `adminDeleteUser()`, `adminRestoreUser()`, `adminPurgeUser()`, `adminDeleteBooking()`, `adminRestoreBooking()`, `adminPurgeBooking()`, `adminDeleteTenant()`, `adminDeleteProperty()`, `getTeamMembers()`, `assignRole()`, `revokeRole()`, `searchUserByEmail()` |
| `tenants.ts` | `getTenants()`, `markRentAsPaid()`, `markRentAsUnpaid()`, `blockTenant()`, `unblockTenant()` |
| `platform.ts` | `getPlatformSettings()`, `updatePlatformSettings()`, `calculateFees()`, `recordPlatformFee()`, `getPlatformWalletBalance()`, `getPlatformFees()`, `getPlatformChangeLogs()`, `getFeeExemptions()`, `addFeeExemption()`, `removeFeeExemption()` |
| `rooms.ts` | `getAvailableRooms()`, room CRUD |
| `staff.ts` | Owner staff management |
| `search.ts` | Property search with filters |
| `dashboard.ts` | Owner dashboard stats |
| `activity.ts` | Activity log for owner |
| `team.ts` | Admin team member CRUD |
| `ops.ts` | Operational functions |

### Pages (`src/app/`)
| Path | Purpose |
|------|---------|
| `/` | Homepage — hero, search bar, featured PGs |
| `/login` | Login form with 🙈/🐵 password toggle |
| `/signup` | Signup with colored role chip selector |
| `/search` | Property search with city/price/type filters |
| `/property/[id]` | Property detail + booking form |
| `/booking/requested` | Post-booking confirmation |
| `/bookings` | General bookings view |
| `/list-property` | Owner lists new property |
| `/secure/payment` | Razorpay payment page |
| `/dashboard/student` | Student bookings, cancel, owner contact |
| `/dashboard/student/documents` | Upload ID/address/selfie docs |
| `/dashboard/owner` | Owner overview stats |
| `/dashboard/owner/properties` | Property list |
| `/dashboard/owner/properties/new` | Create new property with rooms, images, amenities |
| `/dashboard/owner/bookings` | Manage bookings (approve/reject) |
| `/dashboard/owner/onboarding` | Fill onboarding details, edit after approval |
| `/dashboard/owner/tenants` | Tenant management, rent tracking |
| `/dashboard/owner/rooms` | Room management |
| `/dashboard/owner/verifications` | Verify tenant documents |
| `/dashboard/owner/payments` | Payment history |
| `/dashboard/owner/food-menu` | Weekly food menu editor |
| `/dashboard/owner/staff` | Staff management (add/block/remove) |
| `/dashboard/owner/tickets` | Support ticket management |
| `/dashboard/owner/activity-log` | Chronological activity feed |
| `/dashboard/admin` | Platform stats overview |
| `/dashboard/admin/users` | User management (ban/unban) |
| `/dashboard/admin/team` | Role assignment (ONBOARDER/VERIFIER/ADMIN) |
| `/dashboard/admin/transactions` | All payment records |
| `/dashboard/admin/audit-log` | Full audit trail |
| `/dashboard/admin/platform-fees` | Fee engine config |
| `/dashboard/admin/data-management` | Archive/purge data |
| `/dashboard/onboarder` | Onboarder overview + stats |
| `/dashboard/onboarder/queue` | Pending self-submitted owner requests |
| `/dashboard/verifier` | Verifier overview + stats |

### Components (`src/components/`)
| Path | Purpose |
|------|---------|
| `layout/Navbar.tsx` | Top navigation bar |
| `layout/Footer.tsx` | Footer |
| `layout/DashboardSidebar.tsx` | Role-based sidebar (owner/admin/student/onboarder/verifier) |
| `layout/LogoutButton.tsx` | Logout with client-side redirect |
| `ui/button.tsx` | Button component + `cn()` utility |
| `ui/card.tsx` | Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription |
| `ui/input.tsx` | Input component |

### Libraries (`src/lib/`)
| File | Purpose |
|------|---------|
| `auth.ts` | `encryptPassword()`, `comparePassword()`, `signJWT()`, `getSession()` |
| `prisma.ts` | Singleton Prisma client |
| `razorpay.ts` | Razorpay client instance |

---

## 10. Audit Trail System

**Every significant action** creates an `AuditLog` entry:

| Action | Trigger |
|--------|---------|
| `BOOKING_REQUESTED` | Student submits booking |
| `BOOKING_APPROVED` | Owner approves + assigns room |
| `BOOKING_REJECTED` | Owner rejects |
| `BOOKING_CANCELLED` | Student cancels pending booking |
| `BOOKING_PAID` | Payment confirmed (online or cash) |
| `TENANT_CREATED` | Auto-created on payment |
| `TENANT_BLOCKED` | Owner blocks/vacates tenant |
| `TENANT_UNBLOCKED` | Owner restores tenant |
| `RENT_PAID` / `RENT_UNPAID` | Rent record toggled |
| `DOCUMENT_VERIFIED` / `DOCUMENT_REJECTED` | Doc verification |
| `USER_BANNED` / `USER_UNBANNED` | Admin moderates user |
| `ADMIN_ASSIGN_ROLE` / `ADMIN_REVOKE_ROLE` | Role assignment |
| `ADMIN_ARCHIVE_USER/BOOKING` | Soft-delete |
| `ADMIN_RESTORE_USER/BOOKING` | Restore from archive |
| `ADMIN_PURGE_USER/BOOKING` | Permanent delete |
| `ADMIN_DELETE_TENANT/PROPERTY` | Hard delete |
| `PLATFORM_SETTINGS_UPDATED` | Fee settings changed |
| `FEE_EXEMPTION_ADDED/REMOVED` | Exemption management |

Each entry stores: `action`, `targetId`, `targetType`, `details`, `performedBy` (user ID), `timestamp`.

### Owner Onboarding Audit Trail (Embedded JSON)
Stored per `OwnerOnboarding` record as JSON array. Each entry:
```json
{
  "status": "PENDING_VERIFICATION",
  "actorId": "uuid-of-onboarder",
  "actorName": "Rahul Sharma (ONB-000001)",
  "note": "Accepted and completed by Onboarding Team",
  "timestamp": "2026-02-26T10:30:00.000Z"
}
```

---

## 11. Sidebar Navigation

### Owner Panel
Overview · My Properties · Bookings (with pending badge) · Onboarding · Tenants · Doc Verifications · My Staff · Food Menu · Support Tickets · Payments · Activity Log

### Admin Panel
Overview · User Management · Team Access · All Transactions · Audit Log · Resolutions · Platform Fees · Data Management · Settings

### Student Dashboard
My Bookings · My Documents · Find PG · Support Tickets

### Onboarder Panel
Overview · Pending Queue · New Field Visit · My Submissions

### Verifier Panel
Overview · Pending Verification · Verified · Rejected

---

## 12. Auto-Start Setup (Windows)

| File | Purpose |
|------|---------|
| `c:\Antigravity\start-rentpe.ps1` | PowerShell script: `cd project → npm.cmd run dev` with full path |
| `c:\Antigravity\start-rentpe-silent.vbs` | VBScript: launches PS1 hidden (no window) |
| Windows Startup folder | VBS runs on every login |
| `c:\Antigravity\rentpe-log.txt` | Log file for debugging startup issues |
