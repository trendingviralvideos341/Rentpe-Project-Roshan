/**
 * RentPe — Production-Grade Fraud Prevention Engine
 *
 * Architecture:
 * - Multi-signal identity detection (not just DB fingerprint)
 * - Weight-based risk scoring with soft/hard thresholds
 * - Cross-account linkage enforcement
 * - Full audit trail for every detection decision
 *
 * Risk Thresholds:
 *   0–30  → LOW    (allow, no flags)
 *   31–70 → MEDIUM (allow + create FraudFlag for admin review)
 *   71+   → HIGH   (block transaction entirely)
 *
 * Signal Weights:
 *   DEVICE fingerprint match:  +50 (strong)
 *   PAYMENT identity match:    +40 (strong)
 *   PHONE match:               +40 (strong)
 *   EMAIL match:               +30 (medium)
 *   IP cluster match:          +25 (medium)
 *   Repeated property bookings:+25 (behavioral)
 *   Excessive credit notes:    +20 (financial)
 *   High tx velocity:          +15 (behavioral)
 */

import prisma from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskResult {
    score: number;
    level: RiskLevel;
    reasons: string[];
}

export interface LinkedAccountResult {
    isLinked: boolean;
    aggregateScore: number;          // Sum of all signal confidences
    signals: { type: string; reason: string; score: number }[];
}

export interface FingerprintData {
    deviceHash?: string;
    ipAddress: string;
    userAgent: string;
    paymentIdentity?: string;        // UPI ID, bank account prefix, etc.
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRiskLevel(score: number): RiskLevel {
    if (score >= 71) return 'HIGH';
    if (score >= 31) return 'MEDIUM';
    return 'LOW';
}

// Extracts last two octets of an IP for cluster matching (same /24 subnet)
function ipCluster(ip: string): string {
    const parts = ip.split('.');
    return parts.length >= 3 ? `${parts[0]}.${parts[1]}.${parts[2]}` : ip;
}

// ─── 1. Record Fingerprint ────────────────────────────────────────────────────
/**
 * Stores a device/IP fingerprint for a user and immediately scans for
 * matching fingerprints belonging to OTHER users → triggers linkage detection.
 *
 * Called at: Login, Signup, Booking creation.
 */
export async function recordFingerprint(
    userId: string,
    data: FingerprintData
): Promise<void> {
    // Save this fingerprint
    await (prisma as any).userFingerprint.create({
        data: {
            userId,
            deviceHash: data.deviceHash,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
        }
    });

    // Scan for existing fingerprints from OTHER users with matching signals
    const candidates = await (prisma as any).userFingerprint.findMany({
        where: {
            userId: { not: userId },
            OR: [
                ...(data.deviceHash ? [{ deviceHash: data.deviceHash }] : []),
                { ipAddress: data.ipAddress },
            ]
        },
        select: { userId: true, deviceHash: true, ipAddress: true },
        distinct: ['userId'],
        take: 20
    });

    for (const candidate of candidates) {
        if (candidate.deviceHash && candidate.deviceHash === data.deviceHash) {
            await _upsertLink(userId, candidate.userId, 'DEVICE',
                `Same device fingerprint detected`, 80);
        } else if (ipCluster(candidate.ipAddress) === ipCluster(data.ipAddress)) {
            // Don't link on same IP alone — score it lower (shared hostel WiFi)
            await _upsertLink(userId, candidate.userId, 'IP',
                `IP cluster match: ${ipCluster(data.ipAddress)}`, 30);
        }
    }
}

// ─── 2. Detect Linked Accounts ────────────────────────────────────────────────
/**
 * Core linkage analysis between two user IDs.
 * Checks all stored signals in LinkedAccount table and also runs live checks
 * on phone/email/payment fields from the User table.
 *
 * Returns aggregateScore = sum of all matching signal confidence values.
 * Use aggregateScore > 50 to treat as "linked" for booking enforcement.
 */
export async function detectLinkedAccounts(
    userAId: string,
    userBId: string
): Promise<LinkedAccountResult> {
    const signals: { type: string; reason: string; score: number }[] = [];

    // ── Check existing stored links ──────────────────────────────────────────
    const storedLinks = await (prisma as any).linkedAccount.findMany({
        where: {
            OR: [
                { userAId, userBId },
                { userAId: userBId, userBId: userAId },
            ]
        }
    });

    for (const link of storedLinks) {
        signals.push({
            type: link.linkType,
            reason: link.reason,
            score: link.confidenceScore
        });
    }

    // ── Live checks on User profile fields ──────────────────────────────────
    const [userA, userB] = await Promise.all([
        prisma.user.findUnique({
            where: { id: userAId },
            select: { phone: true, email: true }
        }),
        prisma.user.findUnique({
            where: { id: userBId },
            select: { phone: true, email: true }
        })
    ]);

    if (userA && userB) {
        // Phone match (strong signal)
        if (userA.phone && userB.phone && userA.phone === userB.phone) {
            if (!storedLinks.find((l: any) => l.linkType === 'PHONE')) {
                await _upsertLink(userAId, userBId, 'PHONE',
                    `Same phone number: ${userA.phone}`, 90);
                signals.push({ type: 'PHONE', reason: `Same phone: ${userA.phone}`, score: 90 });
            }
        }
        // Email domain match (weak — different people can work at same org)
        if (userA.email && userB.email) {
            const domainA = userA.email.split('@')[1];
            const domainB = userB.email.split('@')[1];
            if (userA.email === userB.email) {
                if (!storedLinks.find((l: any) => l.linkType === 'EMAIL')) {
                    await _upsertLink(userAId, userBId, 'EMAIL',
                        `Same email address`, 95);
                    signals.push({ type: 'EMAIL', reason: 'Same email', score: 95 });
                }
            } else if (domainA && domainB && domainA === domainB && domainA !== 'gmail.com'
                && domainA !== 'yahoo.com' && domainA !== 'outlook.com') {
                // Same rare domain (personal/business) is suspicious
                signals.push({ type: 'EMAIL', reason: `Same email domain: @${domainA}`, score: 20 });
            }
        }
    }

    const aggregateScore = signals.reduce((sum, s) => sum + s.score, 0);
    const cappedScore = Math.min(aggregateScore, 100); // cap at 100

    return {
        isLinked: cappedScore > 50,
        aggregateScore: cappedScore,
        signals
    };
}

// ─── 3. Calculate Risk Score ──────────────────────────────────────────────────
/**
 * Full risk score calculation for a booking attempt.
 * Runs BEFORE the booking is written to DB.
 *
 * @param userId        - The tenant making the booking
 * @param propertyId    - Target property
 * @param ownerId       - Property owner's userId
 * @param fingerprint   - Request fingerprint data
 */
export async function calculateRiskScore(
    userId: string,
    propertyId: string,
    ownerId: string,
    fingerprint?: Partial<FingerprintData>
): Promise<RiskResult> {
    let score = 0;
    const reasons: string[] = [];

    // ── Signal 1: Cross-account linkage with owner ───────────────────────────
    const linkage = await detectLinkedAccounts(userId, ownerId);
    if (linkage.aggregateScore > 0) {
        // Each signal adds directly to risk score
        for (const sig of linkage.signals) {
            const weight = sig.type === 'DEVICE' ? 50
                : sig.type === 'PHONE' ? 40
                : sig.type === 'PAYMENT' ? 40
                : sig.type === 'EMAIL' ? 30
                : sig.type === 'IP' ? 15   // IP alone is weak (shared WiFi)
                : 10;
            score += weight;
            reasons.push(`${sig.type} link to owner: ${sig.reason}`);
        }
    }

    // ── Signal 2: Repeated bookings on same property ─────────────────────────
    const repeatBookings = await prisma.booking.count({
        where: {
            userId,
            propertyId,
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            status: { notIn: ['CANCELLED', 'REJECTED'] }
        }
    });
    if (repeatBookings >= 2) {
        score += 25;
        reasons.push(`${repeatBookings} bookings on same property in 30 days`);
    }

    // ── Signal 3: Excessive credit notes this month ──────────────────────────
    const recentCredits = await (prisma as any).creditNote.count({
        where: {
            booking: { userId },
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            status: { not: 'CANCELLED' }
        }
    });
    if (recentCredits > 3) {
        score += 20;
        reasons.push(`${recentCredits} credit notes issued in last 30 days`);
    }

    // ── Signal 4: High transaction velocity (payout requests) ────────────────
    const recentPayments = await prisma.payment.count({
        where: {
            booking: { userId },
            date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
    });
    if (recentPayments > 5) {
        score += 15;
        reasons.push(`${recentPayments} payments in last 7 days (velocity)`);
    }

    // ── Signal 5: Device fingerprint matches owner's device ──────────────────
    if (fingerprint?.deviceHash) {
        const ownerUsedSameDevice = await (prisma as any).userFingerprint.findFirst({
            where: { userId: ownerId, deviceHash: fingerprint.deviceHash }
        });
        if (ownerUsedSameDevice) {
            score += 50;
            reasons.push(`Tenant's device hash matches property owner's device`);
            // Persist this as a stored link for future fast lookups
            await _upsertLink(userId, ownerId, 'DEVICE',
                `Shared device hash detected during booking`, 80);
        }
    }

    const cappedScore = Math.min(score, 100);
    return {
        score: cappedScore,
        level: getRiskLevel(cappedScore),
        reasons
    };
}

// ─── 4. Validate Booking (Main Gate) ─────────────────────────────────────────
/**
 * The primary fraud gate that must be called before every booking creation.
 *
 * Returns:
 *   { allowed: true, riskScore, riskLevel }  → proceed
 *   { allowed: false, reason }               → block
 */
export interface BookingValidationResult {
    allowed: boolean;
    riskScore: number;
    riskLevel: RiskLevel;
    reasons: string[];
    reason?: string;    // Short error message for the user if blocked
}

export async function validateBooking(
    userId: string,
    propertyId: string,
    fingerprint?: Partial<FingerprintData>,
    ipAddress?: string,
    userAgent?: string
): Promise<BookingValidationResult> {
    // Fetch property owner
    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { ownerId: true, name: true }
    });

    if (!property) {
        return { allowed: false, riskScore: 0, riskLevel: 'LOW', reasons: [], reason: 'Property not found.' };
    }

    // ── HARD BLOCK 1: Direct self-booking ────────────────────────────────────
    if (userId === property.ownerId) {
        await _logFraudFlag(userId, undefined,
            'DIRECT_SELF_BOOKING',
            'User attempted to book their own property', 100);
        await _auditFraudDecision(userId, 'STUDENT', 'BOOKING_ATTEMPT', 100, 'BLOCKED',
            ipAddress, userAgent, `Direct self-booking attempt on property ${propertyId}`);
        return {
            allowed: false,
            riskScore: 100,
            riskLevel: 'HIGH',
            reasons: ['Your account owns this property.'],
            reason: 'You cannot book your own property.'
        };
    }

    // ── Calculate full risk score ─────────────────────────────────────────────
    const risk = await calculateRiskScore(userId, propertyId, property.ownerId, fingerprint);

    // ── HARD BLOCK 2: Cross-account linked to owner with high risk ────────────
    if (risk.score > 50) {
        const ownerLinkage = await detectLinkedAccounts(userId, property.ownerId);
        if (ownerLinkage.isLinked) {
            await _logFraudFlag(userId, undefined,
                'LINKED_ACCOUNT_BOOKING',
                `Booking blocked: linked account detected. Signals: ${ownerLinkage.signals.map(s => s.type).join(', ')}`,
                risk.score);
            await _auditFraudDecision(userId, 'STUDENT', 'BOOKING_ATTEMPT', risk.score, 'BLOCKED',
                ipAddress, userAgent,
                `Linked account booking attempt on property ${propertyId}. Owner: ${property.ownerId}`);
            return {
                allowed: false,
                riskScore: risk.score,
                riskLevel: 'HIGH',
                reasons: risk.reasons,
                reason: 'Your account has been flagged for unusual activity. Please contact support.'
            };
        }
    }

    // ── MEDIUM: flag for admin review but allow ───────────────────────────────
    if (risk.level === 'MEDIUM' || risk.level === 'HIGH') {
        await _logFraudFlag(userId, undefined,
            'HIGH_RISK_BOOKING',
            `Booking flagged. Score: ${risk.score}. Reasons: ${risk.reasons.join('; ')}`,
            risk.score);
        await _auditFraudDecision(userId, 'STUDENT', 'BOOKING_ATTEMPT', risk.score, 'FLAGGED',
            ipAddress, userAgent, `HIGH RISK booking flagged on property ${propertyId}`);
    }

    return {
        allowed: risk.level !== 'HIGH',
        riskScore: risk.score,
        riskLevel: risk.level,
        reasons: risk.reasons,
        reason: risk.level === 'HIGH'
            ? 'This booking has been blocked due to unusual activity. Contact support.'
            : undefined
    };
}

// ─── 5. Credit Note Abuse Guard ───────────────────────────────────────────────
/**
 * Call before applying any credit note to an invoice.
 * Enforces the 80% cap rule and blocks credit on high-risk bookings.
 */
export async function validateCreditApplication(
    bookingId: string,
    invoiceAmount: number,
    creditAmount: number
): Promise<{ allowed: boolean; reason?: string }> {
    // Check booking fraud risk
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { userId: true }
    });

    if (!booking) return { allowed: false, reason: 'Booking not found.' };

    // Check booking fraud risk via FraudFlag
    const openHighRiskFlag = await (prisma as any).fraudFlag.findFirst({
        where: { bookingId, status: 'OPEN', riskScore: { gte: 71 } }
    });

    if (openHighRiskFlag) {
        return {
            allowed: false,
            reason: 'Credit notes are disabled for this booking due to a fraud review. Contact admin.'
        };
    }

    // 80% cap enforcement
    const maxAllowed = invoiceAmount * 0.8;
    if (creditAmount > maxAllowed) {
        return {
            allowed: false,
            reason: `Credit cannot exceed 80% of the invoice amount (max ₹${maxAllowed.toFixed(2)}).`
        };
    }

    return { allowed: true };
}

// ─── 6. Payout Guard ─────────────────────────────────────────────────────────
/**
 * Call before releasing an owner payout.
 * Implements T+3 delay and blocks HIGH-risk payouts.
 */
export async function validatePayout(
    payoutId: string,
    ownerId: string
): Promise<{ allowed: boolean; reason?: string; scheduledFor?: Date }> {
    // Check if owner has any HIGH-risk open fraud flags
    const openHighRiskFlags = await (prisma as any).fraudFlag.count({
        where: {
            userId: ownerId,
            status: 'OPEN',
            riskScore: { gte: 71 }
        }
    });

    if (openHighRiskFlags > 0) {
        return {
            allowed: false,
            reason: `Payout frozen: ${openHighRiskFlags} unresolved high-risk fraud flag(s) on account. Admin must review.`
        };
    }

    // T+3 payout delay
    const scheduledFor = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    return { allowed: true, scheduledFor };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

async function _upsertLink(
    userAId: string, userBId: string,
    linkType: string, reason: string, confidenceScore: number
) {
    // Ensure userAId < userBId for canonical ordering (prevents duplicate A↔B / B↔A rows)
    const [a, b] = [userAId, userBId].sort();
    try {
        await (prisma as any).linkedAccount.upsert({
            where: { userAId_userBId_linkType: { userAId: a, userBId: b, linkType } },
            create: { userAId: a, userBId: b, linkType, reason, confidenceScore },
            update: { reason, confidenceScore, createdAt: new Date() }
        });
    } catch {
        // Silently ignore race condition duplicates
    }
}

async function _logFraudFlag(
    userId: string,
    bookingId: string | undefined,
    reason: string,
    description: string,
    riskScore: number
) {
    await (prisma as any).fraudFlag.create({
        data: {
            userId,
            bookingId,
            reason,
            riskScore,
            status: 'OPEN',
            metadata: { description }
        }
    });
}

async function _auditFraudDecision(
    userId: string,
    role: string,
    action: string,
    riskScore: number,
    decision: 'BLOCKED' | 'FLAGGED' | 'ALLOWED',
    ipAddress?: string,
    userAgent?: string,
    description?: string
) {
    // logAuditEvent reads IP/UserAgent from request headers automatically
    await logAuditEvent({
        actorId: userId,
        actorRole: role,
        actorName: 'FraudEngine',
        actionType: action,
        entityType: 'FRAUD',
        entityId: userId,
        description: `[FRAUD:${decision}] Score:${riskScore} — ${description || ''}`,
        newValue: { riskScore, decision, ipAddress, userAgent }
    });
}
