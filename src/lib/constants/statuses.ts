/**
 * RentPe — Centralized Status Constants
 *
 * SINGLE SOURCE OF TRUTH for all status values stored in the database.
 * Every backend action and frontend component MUST import from this file.
 * Never hardcode status strings anywhere else in the codebase.
 *
 * Current DB format: Title Case strings (e.g. "Active", "Checked Out")
 * for Tenant model. UPPERCASE for Booking, Payment, Invoice models.
 *
 * @module statuses
 */

// ─────────────────────────────────────────────
// TENANT STATUS
// Tenant.status column — Title Case (legacy DB format)
// ─────────────────────────────────────────────
export const TENANT_STATUS = {
  UPCOMING:    'Upcoming',
  ACTIVE:      'Active',
  CHECKED_OUT: 'Checked Out',
  BLOCKED:     'Blocked',
  CANCELLED:   'Cancelled',  // Admin soft-delete — tenant record preserved for audit
} as const;
export type TenantStatus = typeof TENANT_STATUS[keyof typeof TENANT_STATUS];

// ─────────────────────────────────────────────
// BOOKING STATUS
// Booking.status column — UPPERCASE
// ─────────────────────────────────────────────
export const BOOKING_STATUS = {
  APPLIED:                 'APPLIED',
  APPROVED:                'APPROVED',
  APPROVED_PENDING_TOKEN:  'APPROVED_PENDING_TOKEN',
  BOOKING_CONFIRMED:       'BOOKING_CONFIRMED',
  MOVE_IN_SCHEDULED:       'MOVE_IN_SCHEDULED',
  CHECKED_IN:              'CHECKED_IN',
  CHECKIN_CONFIRMED:       'CHECKIN_CONFIRMED',
  CHECKED_OUT:             'CHECKED_OUT',  // Post move-out — booking lifecycle complete
  ACTIVE:                  'ACTIVE',
  VACATING:                'VACATING',
  COMPLETED:               'COMPLETED',
  REJECTED:                'REJECTED',
  CANCELLED:               'CANCELLED',
  VACATED:                 'VACATED',
  WITHDRAWN:               'WITHDRAWN',
} as const;
export type BookingStatus = typeof BOOKING_STATUS[keyof typeof BOOKING_STATUS];

// ─────────────────────────────────────────────
// PAYMENT / INVOICE STATUS
// Payment.status, RentInvoice.status — UPPERCASE
// ─────────────────────────────────────────────
export const PAYMENT_STATUS = {
  PENDING:   'PENDING',
  SUCCESS:   'SUCCESS',
  FAILED:    'FAILED',
  REFUNDED:  'REFUNDED',
} as const;
export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];

export const INVOICE_STATUS = {
  PENDING:        'PENDING',
  PAID:           'PAID',
  OVERDUE:        'OVERDUE',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
} as const;
export type InvoiceStatus = typeof INVOICE_STATUS[keyof typeof INVOICE_STATUS];

export const TRANSFER_STATUS = {
  PENDING:  'PENDING',
  RELEASED: 'RELEASED',
  REFUNDED: 'REFUNDED',
} as const;
export type TransferStatus = typeof TRANSFER_STATUS[keyof typeof TRANSFER_STATUS];

// ─────────────────────────────────────────────
// SECURITY DEPOSIT STATUS
// SecurityDeposit.status — UPPERCASE
// ─────────────────────────────────────────────
export const DEPOSIT_STATUS = {
  PENDING:                  'PENDING',
  PAID:                     'PAID',
  REFUND_PENDING:           'REFUND_PENDING',
  REFUNDED:                 'REFUNDED',
  PARTIALLY_REFUNDED:       'PARTIALLY_REFUNDED',
  FORFEITED:                'FORFEITED',
  REFUND_OVERDUE:           'REFUND_OVERDUE',
  REFUNDED_VIA_WITHHOLDING: 'REFUNDED_VIA_WITHHOLDING',
} as const;
export type DepositStatus = typeof DEPOSIT_STATUS[keyof typeof DEPOSIT_STATUS];

// ─────────────────────────────────────────────
// PROPERTY STATUS
// Property.status — UPPERCASE
// ─────────────────────────────────────────────
export const PROPERTY_STATUS = {
  PENDING_VERIFICATION:    'PENDING_VERIFICATION',
  APPROVED:                'APPROVED',
  LIVE:                    'LIVE',
  REJECTED:                'REJECTED',
  DEACTIVATION_REQUESTED:  'DEACTIVATION_REQUESTED',
  DEACTIVATED:             'DEACTIVATED',
} as const;
export type PropertyStatus = typeof PROPERTY_STATUS[keyof typeof PROPERTY_STATUS];

// ─────────────────────────────────────────────
// USER STATUS
// User.status — UPPERCASE
// ─────────────────────────────────────────────
export const USER_STATUS = {
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  ACTIVE:               'ACTIVE',
  BANNED:               'BANNED',
  SUSPENDED:            'SUSPENDED',
  DEACTIVATED:          'DEACTIVATED',
} as const;
export type UserStatus = typeof USER_STATUS[keyof typeof USER_STATUS];

// ─────────────────────────────────────────────
// ROOM / BED STATUS
// Room.status, Bed.status — UPPERCASE
// ─────────────────────────────────────────────
export const ROOM_STATUS = {
  AVAILABLE:   'AVAILABLE',
  OCCUPIED:    'OCCUPIED',
  MAINTENANCE: 'MAINTENANCE',
} as const;
export type RoomStatus = typeof ROOM_STATUS[keyof typeof ROOM_STATUS];

export const BED_STATUS = {
  AVAILABLE:   'AVAILABLE',
  OCCUPIED:    'OCCUPIED',
  LOCKED:      'LOCKED',
  MAINTENANCE: 'MAINTENANCE',
} as const;
export type BedStatus = typeof BED_STATUS[keyof typeof BED_STATUS];

// ─────────────────────────────────────────────
// VACATING NOTICE STATUS
// VacatingNotice.status — UPPERCASE
// ─────────────────────────────────────────────
export const VACATING_NOTICE_STATUS = {
  SUBMITTED:    'SUBMITTED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  APPROVED:     'APPROVED',
  DISPUTED:     'DISPUTED',
  WITHDRAWN:    'WITHDRAWN',
} as const;
export type VacatingNoticeStatus = typeof VACATING_NOTICE_STATUS[keyof typeof VACATING_NOTICE_STATUS];

// ─────────────────────────────────────────────
// TICKET / SUPPORT STATUS
// Ticket.status — UPPERCASE
// ─────────────────────────────────────────────
export const TICKET_STATUS = {
  OPEN:          'OPEN',
  IN_PROGRESS:   'IN_PROGRESS',
  RESOLVED:      'RESOLVED',
  CLOSED:        'CLOSED',
} as const;
export type TicketStatus = typeof TICKET_STATUS[keyof typeof TICKET_STATUS];

// ─────────────────────────────────────────────
// DOCUMENT / KYC STATUS
// TenantDocument.status — UPPERCASE
// ─────────────────────────────────────────────
export const DOCUMENT_STATUS = {
  PENDING:  'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;
export type DocumentStatus = typeof DOCUMENT_STATUS[keyof typeof DOCUMENT_STATUS];

// ─────────────────────────────────────────────
// MAINTENANCE REQUEST STATUS
// MaintenanceRequest.status — UPPERCASE
// ─────────────────────────────────────────────
export const MAINTENANCE_STATUS = {
  OPEN:          'OPEN',
  ACKNOWLEDGED:  'ACKNOWLEDGED',
  IN_PROGRESS:   'IN_PROGRESS',
  RESOLVED:      'RESOLVED',
  CLOSED:        'CLOSED',
} as const;
export type MaintenanceStatus = typeof MAINTENANCE_STATUS[keyof typeof MAINTENANCE_STATUS];
