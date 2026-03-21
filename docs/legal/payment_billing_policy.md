# PAYMENT AND BILLING POLICY

**Platform:** RentPe  
**Effective Date:** [DATE]  
**Last Updated:** [DATE]

---

## 1. OVERVIEW

This Policy governs how billing, payments, invoicing, credit notes, and related financial transactions are managed on the RentPe platform. It applies to all Tenants and Owners.

---

## 2. INVOICE SYSTEM

### 2.1 Monthly Invoice Generation

All Tenants with active bookings receive a **monthly consolidated invoice** that includes:
- **Rent Amount:** As agreed at the time of booking.
- **Food Amount:** Applicable food charges (INCLUDED or OPTIONAL plan where active).
- **Credits Applied:** Any active Credit Notes consumed in this billing cycle (FIFO order).
- **Final Amount Due:** = Rent + Food − Credits Applied.

### 2.2 Billing Month

Invoices are issued for a specific **Billing Month** in the format `YYYY-MM` (e.g., `2025-07`). Each booking produces exactly one invoice per billing month.

### 2.3 Invoice Immutability

Once an invoice is **generated and locked** (marked with a `lockedAt` timestamp):
- The underlying rent and food amounts cannot be changed.
- Any corrections can only be made through the **Credit Note system** as described in Section 6.
- This ensures financial auditability and prevents retroactive manipulation.

### 2.4 Invoice Access

Invoices are accessible at any time through:
- The **Tenant Dashboard.**
- The **Owner Dashboard** (for bookings under your property).
- The **Admin Dashboard.**

---

## 3. PAYMENT GATEWAY

3.1 Payments on the RentPe platform are processed by **Razorpay** (or an equivalent authorised payment gateway). All payment information is transmitted directly to the gateway over encrypted (TLS) connections.

3.2 RentPe does **not store** full card numbers, CVVs, or sensitive payment credentials. Tokenised references may be stored for recurring billing purposes in compliance with RBI tokenisation guidelines.

3.3 **Bank/Gateway Liability:** RentPe is not liable for any unauthorised transactions, payment delays, or failures arising from the Tenant’s bank or the Payment Gateway.

3.4 **RBI Compliance:** We do not store sensitive card data. All payments are processed via RBI-mandated secure tokenisation and encrypted channels.

---

## 4. PAYMENT DUE DATE AND GRACE PERIOD

4.1 Monthly invoices are due on the **billing anchor date** (typically the 1st of each month unless otherwise configured in your booking).

4.2 A **grace period of up to 3 (three) days** is afforded to Tenants after the due date before late fees are applied.

4.3 After the grace period, a **late fee** as specified at the time of booking is applied to the outstanding amount.

4.4 If payment is not received within **15 (fifteen) days** of the due date, the Platform may suspend Tenant dashboard access and notify the Owner.

---

## 5. PAYMENT ALLOCATION ORDER

Where a Tenant makes a partial payment that does not cover the full invoice amount, the payment is allocated in the following strict order:

1. **Outstanding Rent** (highest priority — shelter obligation).
2. **Outstanding Food Charges.**
3. **Late Fees and Penalties** (if any).

This allocation order ensures that the Tenant's primary housing obligation is always met first.

---

## 6. CREDIT NOTE SYSTEM

### 6.1 What is a Credit Note?

A Credit Note is a financial instrument issued by the Platform (typically by an Admin) that reduces the Tenant's outstanding invoice balance. It is the primary mechanism for:
- Corrections due to owner failing to provide food service.
- Goodwill adjustments or billing errors.
- Refunds converted to Platform credits.

### 6.2 FIFO Application

Credit Notes are applied in **FIFO (First In, First Out)** order — the oldest active Credit Note is consumed first against each new invoice.

### 6.3 Carry-Forward

If a Credit Note is larger than the current invoice balance, the **surplus carries forward** to the next invoice. Credit Notes do not expire as long as the booking is active.

### 6.4 Credit Note Types

| Type | Description |
|------|-------------|
| `FOOD_NOT_PROVIDED` | Food was invoiced but not delivered by Owner. |
| `REFUND` | Partial refund converted to a credit. |
| `ADMIN_OVERRIDE` | Manual adjustment by Platform Admin. |
| `CARRY_FORWARD` | Surplus from a previous credit note period. |

### 6.5 Non-Transferability

Credit Notes are specific to a booking and cannot be transferred to another booking or Tenant account.

---

## 7. LATE FEES

7.1 Late fees are calculated per day or as a flat penalty, as specified in the Tenant's booking agreement and displayed before booking confirmation.

7.2 Late fees are included on the next invoice as a separate line item.

7.3 Late fees are not subject to Credit Note offset — they must be paid separately.

---

## 8. PAYOUT TO OWNERS

8.1 Collected rent and food charges (net of Platform commission) are transferred to the Owner's registered bank account on the payout schedule specified in the Owner Agreement.

8.2 Payouts may be withheld or delayed if:
   - A dispute is active for the relevant booking.
   - Security Deposit refund calculations are pending.
   - The Owner has outstanding violations or penalties.

---

## 9. SECURITY DEPOSIT COLLECTION AND MANAGEMENT

9.1 The Security Deposit is collected from Tenants at the time of booking through the Platform's payment gateway.

9.2 The deposit is held securely and released only upon:
   - Move-out confirmation by the Owner.
   - Completion of the deduction review process.

---

## 10. TAX COMPLIANCE

10.1 **GST:** All service fees charged by RentPe are subject to GST at the prevailing rate (currently 18%). Residents/Tenants may be subject to GST on rent if the Owner is a registered taxable person.

10.2 **TDS (Section 194-I):** Where the annual rent exceeds the statutory threshold (currently ₹2.4 Lakhs), the Tenant is legally responsible for deducting and depositing TDS and providing the TDS certificate to the Owner. RentPe is not responsible for any TDS defaults.

---

## 11. DISPUTES ON BILLING

11.1 Tenants or Owners who disagree with a billing entry must raise a **Billing Dispute** through the Platform within **7 (seven) days** of invoice generation.

11.2 The Admin team will review the dispute and, if valid, issue a Credit Note or adjustment.

11.3 Disputes raised beyond the 7-day window will be treated as accepted amounts with no adjustment available.

---

## 12. CHANGES TO THIS POLICY

This Policy may be updated with **15 (fifteen) days' prior notice** through the Platform and registered email. Continued use after the notice period constitutes acceptance of the revised Policy.
