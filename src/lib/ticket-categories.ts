// Ticket category routing configuration
// Property-level issues → routed to OWNER
export const OWNER_CATEGORIES = [
    'Maintenance',
    'Food Quality',
    'Cleanliness',
    'Roommate Issue',
    'WiFi / Internet',
    'Water / Electricity',
    'Security',
    'Noise Complaint',
    'Room Condition',
    'Room Issue',
    'Parking Issue',
    'Booking Issue',
];

// Platform-level issues → routed directly to ADMIN
export const ADMIN_CATEGORIES = [
    'Billing',
    'Refund Request',
    'Platform Issue',
    'KYC',
    'Login / Account Issue',
    'Payment Problem',
    'App / Website Bug',
    'Fraud Report',
    'Privacy Issue',
    'Other',
];

// Owner-to-Admin ticket categories
export const OWNER_TO_ADMIN_CATEGORIES = [
    'Payment Settlement',
    'Property Listing Issue',
    'Dashboard Bug',
    'Account Issue',
    'Tenant Dispute Escalation',
    'Feature Request',
    'Onboarding Team Issue',
    'Verification Delay',
    'Other'
];

/**
 * Determines which team a ticket should be routed to based on category.
 *
 * Routing rules:
 *   MAINTENANCE     → OWNER
 *   BOOKING         → OWNER
 *   BILLING         → ADMIN
 *   REFUND          → ADMIN
 *   PLATFORM        → ADMIN
 *   KYC             → ADMIN
 */
export function determineTargetTeam(category: string): 'OWNER' | 'ADMIN' {
    if (OWNER_CATEGORIES.includes(category)) return 'OWNER';
    return 'ADMIN';
}

/**
 * Helper: given a category, return the assignedTo value for display/routing.
 */
export function getAssignedTo(category: string): 'OWNER' | 'ADMIN' {
    return determineTargetTeam(category);
}
