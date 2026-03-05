// Ticket category routing configuration
// Property-level issues → routed to OWNER
export const OWNER_CATEGORIES = [
    'Maintenance', 'Food Quality', 'Cleanliness', 'Roommate Issue',
    'WiFi / Internet', 'Water / Electricity', 'Security', 'Noise Complaint',
    'Room Condition', 'Parking Issue'
];

// Platform-level issues → routed directly to ADMIN
export const ADMIN_CATEGORIES = [
    'Login / Account Issue', 'Payment Problem', 'Booking Dispute',
    'App / Website Bug', 'Refund Request', 'Safety Concern',
    'Fraud Report', 'Privacy Issue', 'Other'
];

// Owner-to-Admin ticket categories
export const OWNER_TO_ADMIN_CATEGORIES = [
    'Payment Settlement', 'Property Listing Issue', 'Dashboard Bug',
    'Account Issue', 'Tenant Dispute Escalation', 'Feature Request',
    'Onboarding Team Issue', 'Verification Delay', 'Other'
];

export function determineTargetTeam(category: string): string {
    if (OWNER_CATEGORIES.includes(category)) return 'OWNER';
    return 'ADMIN';
}
