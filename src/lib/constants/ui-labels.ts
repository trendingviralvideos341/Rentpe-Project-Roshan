/**
 * RentPe — UI Label Dictionary
 *
 * Maps raw database status codes to beautiful, human-readable UI labels with colors.
 * Use this in every component that renders a status badge.
 * Never hardcode badge colors or text in components directly.
 *
 * @module ui-labels
 */

import { TENANT_STATUS, BOOKING_STATUS, INVOICE_STATUS, DEPOSIT_STATUS, PROPERTY_STATUS, DOCUMENT_STATUS, MAINTENANCE_STATUS, TICKET_STATUS } from './statuses';

// ─────────────────────────────────────────────
// TENANT STATUS UI
// ─────────────────────────────────────────────
export const TENANT_STATUS_UI: Record<string, { label: string; color: string; dot: string }> = {
  [TENANT_STATUS.UPCOMING]:    { label: '⏳ Upcoming',    color: 'bg-blue-100 text-blue-700 border border-blue-200',    dot: 'bg-blue-500'  },
  [TENANT_STATUS.ACTIVE]:      { label: '✅ Active',       color: 'bg-green-100 text-green-700 border border-green-200', dot: 'bg-green-500' },
  [TENANT_STATUS.CHECKED_OUT]: { label: '🏠 Checked Out', color: 'bg-slate-100 text-slate-600 border border-slate-200', dot: 'bg-slate-400' },
  [TENANT_STATUS.BLOCKED]:     { label: '🚫 Blocked',     color: 'bg-red-100 text-red-700 border border-red-200',       dot: 'bg-red-500'   },
};

export function getTenantStatusUI(status: string | undefined | null) {
  if (!status) return { label: '—', color: 'bg-slate-100 text-slate-400', dot: 'bg-slate-300' };
  return TENANT_STATUS_UI[status] ?? { label: status, color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300' };
}

// ─────────────────────────────────────────────
// BOOKING STATUS UI
// ─────────────────────────────────────────────
export const BOOKING_STATUS_UI: Record<string, { label: string; color: string }> = {
  [BOOKING_STATUS.APPLIED]:                { label: '📋 Applied',           color: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  [BOOKING_STATUS.APPROVED]:               { label: '✅ Approved',           color: 'bg-green-100 text-green-700 border border-green-200'   },
  [BOOKING_STATUS.APPROVED_PENDING_TOKEN]: { label: '⏳ Pending Token',      color: 'bg-amber-100 text-amber-700 border border-amber-200'   },
  [BOOKING_STATUS.BOOKING_CONFIRMED]:      { label: '🔒 Confirmed',          color: 'bg-indigo-100 text-indigo-700 border border-indigo-200' },
  [BOOKING_STATUS.MOVE_IN_SCHEDULED]:      { label: '📅 Move-in Scheduled',  color: 'bg-blue-100 text-blue-700 border border-blue-200'      },
  [BOOKING_STATUS.ACTIVE]:                 { label: '✅ Active',             color: 'bg-green-100 text-green-700 border border-green-200'   },
  [BOOKING_STATUS.CHECKIN_CONFIRMED]:      { label: '✅ Check-in Confirmed', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  [BOOKING_STATUS.VACATING]:               { label: '🚶 Vacating',           color: 'bg-orange-100 text-orange-700 border border-orange-200' },
  [BOOKING_STATUS.COMPLETED]:              { label: '🏁 Completed',          color: 'bg-slate-100 text-slate-600 border border-slate-200'   },
  [BOOKING_STATUS.REJECTED]:               { label: '❌ Rejected',           color: 'bg-red-100 text-red-700 border border-red-200'         },
  [BOOKING_STATUS.CANCELLED]:              { label: '🚫 Cancelled',          color: 'bg-red-100 text-red-700 border border-red-200'         },
};

export function getBookingStatusUI(status: string | undefined | null) {
  if (!status) return { label: '—', color: 'bg-slate-100 text-slate-400' };
  return BOOKING_STATUS_UI[status] ?? { label: status, color: 'bg-slate-100 text-slate-500' };
}

// ─────────────────────────────────────────────
// INVOICE STATUS UI
// ─────────────────────────────────────────────
export const INVOICE_STATUS_UI: Record<string, { label: string; color: string }> = {
  [INVOICE_STATUS.PENDING]:        { label: '⚠️ Pending',        color: 'bg-amber-50 text-amber-700 border border-amber-200'  },
  [INVOICE_STATUS.PAID]:           { label: '✅ Paid',            color: 'bg-green-50 text-green-700 border border-green-200' },
  [INVOICE_STATUS.OVERDUE]:        { label: '🔴 Overdue',         color: 'bg-red-50 text-red-700 border border-red-200'       },
  [INVOICE_STATUS.PARTIALLY_PAID]: { label: '🔶 Partially Paid',  color: 'bg-orange-50 text-orange-700 border border-orange-200' },
};

export function getInvoiceStatusUI(status: string | undefined | null) {
  if (!status) return { label: '—', color: 'bg-slate-100 text-slate-400' };
  return INVOICE_STATUS_UI[status] ?? { label: status, color: 'bg-slate-100 text-slate-500' };
}

// ─────────────────────────────────────────────
// PROPERTY STATUS UI
// ─────────────────────────────────────────────
export const PROPERTY_STATUS_UI: Record<string, { label: string; color: string }> = {
  [PROPERTY_STATUS.PENDING_VERIFICATION]:   { label: '⏳ Pending Review',   color: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  [PROPERTY_STATUS.APPROVED]:               { label: '✅ Approved',          color: 'bg-blue-100 text-blue-700 border border-blue-200'      },
  [PROPERTY_STATUS.LIVE]:                   { label: '🟢 Live',              color: 'bg-green-100 text-green-700 border border-green-200'   },
  [PROPERTY_STATUS.REJECTED]:               { label: '❌ Rejected',          color: 'bg-red-100 text-red-700 border border-red-200'         },
  [PROPERTY_STATUS.DEACTIVATION_REQUESTED]: { label: '⚠️ Deactivation Req', color: 'bg-orange-100 text-orange-700 border border-orange-200'},
  [PROPERTY_STATUS.DEACTIVATED]:            { label: '⛔ Deactivated',       color: 'bg-slate-100 text-slate-600 border border-slate-200'   },
};

export function getPropertyStatusUI(status: string | undefined | null) {
  if (!status) return { label: '—', color: 'bg-slate-100 text-slate-400' };
  return PROPERTY_STATUS_UI[status] ?? { label: status, color: 'bg-slate-100 text-slate-500' };
}

// ─────────────────────────────────────────────
// DOCUMENT / KYC STATUS UI
// ─────────────────────────────────────────────
export const DOCUMENT_STATUS_UI: Record<string, { label: string; color: string }> = {
  [DOCUMENT_STATUS.PENDING]:  { label: '⏳ Pending',  color: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  [DOCUMENT_STATUS.VERIFIED]: { label: '✅ Verified', color: 'bg-green-100 text-green-700 border border-green-200'   },
  [DOCUMENT_STATUS.REJECTED]: { label: '❌ Rejected', color: 'bg-red-100 text-red-700 border border-red-200'         },
};

export function getDocumentStatusUI(status: string | undefined | null) {
  if (!status) return { label: '—', color: 'bg-slate-100 text-slate-400' };
  return DOCUMENT_STATUS_UI[status] ?? { label: status, color: 'bg-slate-100 text-slate-500' };
}

// ─────────────────────────────────────────────
// DEPOSIT STATUS UI
// ─────────────────────────────────────────────
export const DEPOSIT_STATUS_UI: Record<string, { label: string; color: string }> = {
  [DEPOSIT_STATUS.PENDING]:                  { label: '⏳ Pending',              color: 'bg-yellow-100 text-yellow-700 border border-yellow-200'  },
  [DEPOSIT_STATUS.PAID]:                     { label: '✅ Paid',                 color: 'bg-green-100 text-green-700 border border-green-200'    },
  [DEPOSIT_STATUS.REFUND_PENDING]:           { label: '🔄 Refund Pending',       color: 'bg-blue-100 text-blue-700 border border-blue-200'       },
  [DEPOSIT_STATUS.REFUNDED]:                 { label: '✅ Refunded',             color: 'bg-emerald-100 text-emerald-700 border border-emerald-200'},
  [DEPOSIT_STATUS.PARTIALLY_REFUNDED]:       { label: '🔶 Partially Refunded',   color: 'bg-orange-100 text-orange-700 border border-orange-200' },
  [DEPOSIT_STATUS.FORFEITED]:                { label: '⛔ Forfeited',            color: 'bg-red-100 text-red-700 border border-red-200'          },
  [DEPOSIT_STATUS.REFUND_OVERDUE]:           { label: '🔴 Refund Overdue',       color: 'bg-red-100 text-red-700 border border-red-200'          },
  [DEPOSIT_STATUS.REFUNDED_VIA_WITHHOLDING]: { label: '🔁 Via Withholding',      color: 'bg-purple-100 text-purple-700 border border-purple-200' },
};

export function getDepositStatusUI(status: string | undefined | null) {
  if (!status) return { label: '—', color: 'bg-slate-100 text-slate-400' };
  return DEPOSIT_STATUS_UI[status] ?? { label: status, color: 'bg-slate-100 text-slate-500' };
}

// ─────────────────────────────────────────────
// MAINTENANCE STATUS UI
// ─────────────────────────────────────────────
export const MAINTENANCE_STATUS_UI: Record<string, { label: string; color: string }> = {
  [MAINTENANCE_STATUS.OPEN]:         { label: '🔓 Open',         color: 'bg-red-100 text-red-700 border border-red-200'         },
  [MAINTENANCE_STATUS.ACKNOWLEDGED]: { label: '👀 Acknowledged', color: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  [MAINTENANCE_STATUS.IN_PROGRESS]:  { label: '🔧 In Progress',  color: 'bg-blue-100 text-blue-700 border border-blue-200'      },
  [MAINTENANCE_STATUS.RESOLVED]:     { label: '✅ Resolved',     color: 'bg-green-100 text-green-700 border border-green-200'   },
  [MAINTENANCE_STATUS.CLOSED]:       { label: '✔️ Closed',       color: 'bg-slate-100 text-slate-600 border border-slate-200'   },
};

export function getMaintenanceStatusUI(status: string | undefined | null) {
  if (!status) return { label: '—', color: 'bg-slate-100 text-slate-400' };
  return MAINTENANCE_STATUS_UI[status] ?? { label: status, color: 'bg-slate-100 text-slate-500' };
}

// ─────────────────────────────────────────────
// TICKET STATUS UI
// ─────────────────────────────────────────────
export const TICKET_STATUS_UI: Record<string, { label: string; color: string }> = {
  [TICKET_STATUS.OPEN]:        { label: '🔓 Open',        color: 'bg-red-100 text-red-700 border border-red-200'         },
  [TICKET_STATUS.IN_PROGRESS]: { label: '🔧 In Progress', color: 'bg-blue-100 text-blue-700 border border-blue-200'      },
  [TICKET_STATUS.RESOLVED]:    { label: '✅ Resolved',    color: 'bg-green-100 text-green-700 border border-green-200'   },
  [TICKET_STATUS.CLOSED]:      { label: '✔️ Closed',      color: 'bg-slate-100 text-slate-600 border border-slate-200'   },
};

export function getTicketStatusUI(status: string | undefined | null) {
  if (!status) return { label: '—', color: 'bg-slate-100 text-slate-400' };
  return TICKET_STATUS_UI[status] ?? { label: status, color: 'bg-slate-100 text-slate-500' };
}
