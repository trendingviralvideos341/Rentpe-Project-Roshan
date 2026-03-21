# LEGAL AUDIT & RISK SUMMARY (RENTPE)

**Date:** March 21, 2026  
**Auditor:** Senior Legal Counsel & Compliance Expert (AI)

---

## 1. COMPLIANCE OVERVIEW

The RentPe legal package has been hardened and aligned with the following Indian statutory frameworks:
- **IT Act, 2000 & Section 79 (Safe Harbor):** Protections for intermediaries strengthened.
- **DPDP Act, 2023 & SPDI Rules:** Data privacy and grievance redressal timelines updated.
- **Consumer Protection Act, 2019:** Clear definitions of "Deficiency of Service" vs "Intermediary Role".
- **RBI Guidelines:** Payment tokenisation and non-storage of card data mandate enforced.
- **Income Tax Act (Sec 194-I):** Tenant's TDS liability clearly demarcated.

---

## 2. SYSTEM LOGIC ALIGNMENT

The legal documents now perfectly reflect the technical implementation:
- **Invoice Immutability:** No retroactive changes allowed once `lockedAt`.
- **FIFO Credit Notes:** Standardized across all policies.
- **Audit Logs:** Mentioned as proof of record for financial disputes.
- **Food Billing:** Proration and Price Lock rules are legally enforceable.

---

## 3. TOP 10 LEGAL RISKS THAT CAN BREAK YOUR STARTUP

Below are the critical risks where the "shield" of these documents might still be breached:

1.  **Vicarious Liability for Food Poisoning:** Even with disclaimers, a massive food poisoning outbreak in a property can drag the platform into Consumer Courts. The Owner's FSSAI compliance is your biggest risk factor.
2.  **Wrongful Eviction Claims:** If an Owner evicts a Tenant without legal notice while using your platform tools, the Tenant may sue BOTH parties for "Conspiracy" or "Assistance in Illegal Act".
3.  **GST Section 9(5) Reclassification:** If the Govt reclassifies PG aggregators under Section 9(5) (like Zomato/Uber), RentPe will become liable to pay 12-18% GST on the **FULL RENT** of all properties, which would collapse your margins instantly.
4.  **RBI Escrow/Nodal Compliance:** Handling the Security Deposit for months. If RBI classifies this as "Payment Aggregation", you need a ₹15Cr net worth and a license. Currently, we treat it as a pass-through, but this is high-risk.
5.  **Police Verification Default:** If a crime is committed in a property and the Owner hasn't done Police Verification (despite the clause), the Platform will be interrogated for "Aiding and Abetting" an unknown resident.
6.  **Data Protection Law (DPDP Act) Fines:** The new law imposes fines up to **₹250 Crores** for "Failure to take reasonable security safeguards". A simple database leak of Aadhaar cards would be fatal.
7.  **Landlord-Tenant Act Overreach:** If a court decides that your "Service Fee" makes you a "De-facto Landlord", all Rent Control laws (which are very tenant-friendly in India) will apply to you.
8.  **TDS Compliance Shifting:** If the tax department decides the Platform is the "Payor" of rent (not just the facilitator), you become responsible for 5-10% TDS on every transaction.
9.  **Intermediary Safe Harbor Loss:** If Admin staff "curate" or "edit" property descriptions manually in a way that suggests you are verifying the facts, you lose Section 79 protection.
10. **Price Lock Disputes during Inflation:** If food prices spike by 30%, Owners will try to bypass the platform or stop service. Your "Price Lock" clause protects Tenants but might drive Owners to leave the platform in bulk.

---

## 4. FINAL RECOMMENDATION

- **Action:** Ensure a physical "Clickwrap" check (mandatory checkbox) is present on the onboarding and booking screens.
- **Next Step:** Obtain **FSSAI license** for the platform itself if you are even indirectly managing the menu.
- **Insurance:** Buy **Professional Indemnity (PI) Insurance** and **Cyber Liability Insurance** immediately.
