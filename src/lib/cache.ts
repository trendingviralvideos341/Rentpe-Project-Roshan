/**
 * CENTRALIZED GLOBAL CACHE MANAGER
 *
 * This is the single source of truth for Next.js cache invalidation.
 * Instead of scattered, role-specific `revalidatePath` calls across 47 files,
 * all cache purges are managed here.
 *
 * RULE: When data changes, it must be visible to ALL roles simultaneously.
 * An Owner update must flush Admin + Staff caches. An Admin update must flush Owner caches.
 *
 * Architecture: Group purges by entity (Booking, Tenant, Property, etc.)
 * so that every dashboard that DISPLAYS that entity gets cleared atomically.
 */

'use server';

import { revalidatePath } from 'next/cache';

// ─────────────────────────────────────────────────────────────────────────────
// BOOKINGS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purges booking-related caches across ALL roles.
 * Call after ANY booking create/update/cancel/check-in/checkout action.
 */
export function revalidateGlobalBookings() {
    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/staff/bookings');
    revalidatePath('/dashboard/admin/bookings');
    revalidatePath('/dashboard/student');
}

// ─────────────────────────────────────────────────────────────────────────────
// TENANTS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purges tenant-related caches across ALL roles.
 * Call after ANY tenant create/update/move-out/notice action.
 */
export function revalidateGlobalTenants() {
    revalidatePath('/dashboard/owner/tenants');
    revalidatePath('/dashboard/staff/tenants');
    revalidatePath('/dashboard/admin/tenants');
    revalidatePath('/dashboard/student');
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENTS & BILLING (Financial)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purges payment/financial caches across ALL roles.
 * Call after ANY payment record, billing entry, or payout action.
 */
export function revalidateGlobalPayments() {
    revalidatePath('/dashboard/owner/payments');
    revalidatePath('/dashboard/owner/financials');
    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/staff/payments');
    revalidatePath('/dashboard/admin/payments');
    revalidatePath('/dashboard/admin');
    revalidatePath('/dashboard/student');
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPERTIES
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purges property-level caches across ALL roles.
 * Call after property details (name, address, amenities, status) are updated.
 * @param propertyId - Required for per-property dynamic route purge.
 */
export function revalidateGlobalProperty(propertyId: string) {
    revalidatePath('/dashboard/owner/properties');
    revalidatePath(`/dashboard/owner/properties/${propertyId}`);
    revalidatePath(`/dashboard/staff/properties/${propertyId}`);
    revalidatePath('/dashboard/admin/properties');
    revalidatePath(`/dashboard/admin/properties/${propertyId}`);
    revalidatePath('/dashboard/admin/property-approval');
    revalidatePath(`/property/${propertyId}`);
    revalidatePath('/search');
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOMS & BEDS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purges room/bed caches across ALL roles.
 * Call after any room/bed create/update/delete action.
 * @param propertyId - Required to target all related dashboard routes.
 */
export function revalidateGlobalRooms(propertyId: string) {
    revalidatePath('/dashboard/owner/properties');
    revalidatePath(`/dashboard/owner/properties/${propertyId}`);
    revalidatePath(`/dashboard/staff/properties/${propertyId}`);
    revalidatePath('/dashboard/admin/properties');
    revalidatePath(`/dashboard/admin/properties/${propertyId}`);
    revalidatePath(`/property/${propertyId}`);
    revalidatePath('/search');
    // Booking pages show bed/room availability — must be cleared too
    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/staff/bookings');
}

// ─────────────────────────────────────────────────────────────────────────────
// BEDS (Availability)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purges bed availability caches across ALL roles.
 * Lighter version of room purge — for bed status changes only.
 */
export function revalidateGlobalBeds() {
    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/owner/properties');
    revalidatePath('/dashboard/staff/bookings');
    revalidatePath('/dashboard/admin/bookings');
    revalidatePath('/dashboard/student');
}

// ─────────────────────────────────────────────────────────────────────────────
// AGREEMENTS & DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purges agreement/document caches across ALL roles.
 */
export function revalidateGlobalAgreements() {
    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/staff/bookings');
    revalidatePath('/dashboard/admin');
    revalidatePath('/dashboard/owner');
    revalidatePath('/dashboard/student');
}

// ─────────────────────────────────────────────────────────────────────────────
// VACATING NOTICES
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purges vacating notice caches across ALL roles.
 */
export function revalidateGlobalVacatingNotices() {
    revalidatePath('/dashboard/owner/tenants');
    revalidatePath('/dashboard/owner/notices');
    revalidatePath('/dashboard/owner/settings');
    revalidatePath('/dashboard/staff/tenants');
    revalidatePath('/dashboard/admin/tenants');
    revalidatePath('/dashboard/student/notice');
    revalidatePath('/dashboard/student');
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purges verification/KYC caches across ALL roles.
 */
export function revalidateGlobalVerifications() {
    revalidatePath('/dashboard/owner/verifications');
    revalidatePath('/dashboard/staff/verifications');
    revalidatePath('/dashboard/admin/verifications');
}

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purges user profile/status caches across ALL roles.
 * @param userId - Optional: for targeted per-user route purge.
 */
export function revalidateGlobalUsers(userId?: string) {
    revalidatePath('/dashboard/admin/users');
    if (userId) {
        revalidatePath(`/dashboard/admin/users/${userId}`);
    }
    revalidatePath('/dashboard/owner');
    revalidatePath('/dashboard/staff');
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN DASHBOARD (Platform-wide)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purges the top-level Admin Dashboard.
 * Use for system-level changes that affect the overall admin view.
 */
export function revalidateAdminDashboard() {
    revalidatePath('/dashboard/admin');
    revalidatePath('/dashboard/admin/property-approval');
    revalidatePath('/dashboard/admin/properties');
}

// ─────────────────────────────────────────────────────────────────────────────
// OWNER AVAILABILITY
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purges owner availability and booking-related caches.
 * Call after check-in, check-out, or move-out to reflect current bed availability.
 */
export function revalidateGlobalAvailability() {
    revalidatePath('/dashboard/owner');
    revalidatePath('/dashboard/owner/availability');
    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/staff/bookings');
    revalidatePath('/dashboard/student');
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPUTES
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purges dispute caches across ALL roles.
 * Call after any dispute create/update/resolve action.
 */
export function revalidateGlobalDisputes() {
    revalidatePath('/dashboard/student');
    revalidatePath('/dashboard/owner');
    revalidatePath('/dashboard/owner/disputes');
    revalidatePath('/dashboard/staff/disputes');
    revalidatePath('/dashboard/admin/disputes');
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN EMPLOYEES
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purges admin employee management caches.
 * Call after any employee create/update/deactivate action.
 */
export function revalidateGlobalEmployees() {
    revalidatePath('/dashboard/admin/employees');
    revalidatePath('/dashboard/admin/team');
    revalidatePath('/dashboard/admin');
}

// ─────────────────────────────────────────────────────────────────────────────
// MAINTENANCE TICKETS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purges maintenance ticket caches across ALL roles.
 * Call after any maintenance request create/update/resolve action.
 */
export function revalidateGlobalMaintenance() {
    revalidatePath('/dashboard/student/maintenance');
    revalidatePath('/dashboard/owner/maintenance');
    revalidatePath('/dashboard/staff/maintenance');
    revalidatePath('/dashboard/admin/maintenance');
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOM CHANGES
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purges room change request caches across ALL roles.
 * Call after any room-change request create/approve/reject action.
 */
export function revalidateGlobalRoomChanges() {
    revalidatePath('/dashboard/student/room-change');
    revalidatePath('/dashboard/owner/room-changes');
    revalidatePath('/dashboard/staff/room-changes');
    revalidatePath('/dashboard/admin/room-changes');
}

// ─────────────────────────────────────────────────────────────────────────────
// OWNER SETTINGS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purges owner settings cache.
 * Call after any owner configuration change (notice period, rules, etc.)
 */
export function revalidateOwnerSettings() {
    revalidatePath('/dashboard/owner/settings');
    revalidatePath('/dashboard/owner');
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN DATA MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purges admin data management and deactivation caches.
 */
export function revalidateAdminDataManagement() {
    revalidatePath('/dashboard/admin/data-management');
    revalidatePath('/dashboard/admin/deactivation-requests');
    revalidatePath('/dashboard/admin/property-approval');
    revalidatePath('/dashboard/admin');
}

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING / VERIFIER STAFF
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purges onboarder queue and verifier review dashboards.
 * Call after any property onboarding step create/update action.
 */
export function revalidateGlobalOnboarding() {
    revalidatePath('/dashboard/onboarder/queue');
    revalidatePath('/dashboard/verifier/reviews');
    revalidatePath('/dashboard/admin/property-approval');
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPPORT / GOVERNANCE DISPUTES
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purges support/governance dispute caches.
 */
export function revalidateGlobalSupportDisputes() {
    revalidatePath('/dashboard/support/disputes');
    revalidatePath('/dashboard/admin/disputes');
}
