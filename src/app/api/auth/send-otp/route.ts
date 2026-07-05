import { NextRequest, NextResponse } from 'next/server';
import { sendEmailOTP } from '@/lib/otp';
import { validateEmail, validateName, validatePhone } from '@/lib/validators';
import { Redis } from '@upstash/redis';
import prisma from '@/lib/prisma';

// ── Redis-backed rate limiter ────────────────────────────────
// Falls back to in-memory if Redis is not configured (dev mode)
let redis: Redis | null = null;
try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
    }
} catch {
    console.warn('[send-otp] Redis not available, using in-memory rate limit fallback.');
}

// In-memory fallback (only used when Redis is unavailable)
const inMemoryStore: Map<string, number[]> = new Map();

async function checkRateLimit(key: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    const windowMs = 60 * 60 * 1000; // 1 hour
    const maxRequests = 3;

    if (redis) {
        try {
            const redisKey = `otp_rl:${key}`;
            const now = Date.now();
            // Use a sorted set to track timestamps within the window
            await redis.zremrangebyscore(redisKey, 0, now - windowMs);
            const count = await redis.zcard(redisKey);
            if (count >= maxRequests) {
                // Get the oldest entry to calculate retry-after
                const oldest = await redis.zrange(redisKey, 0, 0, { withScores: true });
                const oldestTs = Array.isArray(oldest) && oldest.length >= 2 ? Number(oldest[1]) : now;
                const retryAfter = Math.ceil((oldestTs + windowMs - now) / 1000);
                return { allowed: false, retryAfter: Math.max(retryAfter, 60) };
            }
            await redis.zadd(redisKey, { score: now, member: now.toString() });
            await redis.expire(redisKey, 3600);
            return { allowed: true };
        } catch (e) {
            console.warn('[send-otp] Redis rate limit check failed, falling back to in-memory.', e);
        }
    }

    // In-memory fallback
    const now = Date.now();
    const requests = (inMemoryStore.get(key) || []).filter(t => now - t < windowMs);
    if (requests.length >= maxRequests) {
        const retryAfter = Math.ceil((requests[0] + windowMs - now) / 1000);
        return { allowed: false, retryAfter: Math.max(retryAfter, 60) };
    }
    requests.push(now);
    inMemoryStore.set(key, requests);
    return { allowed: true };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, name, phone } = body;

        const emErr = validateEmail(email || "");
        if (emErr) {
            return NextResponse.json({ error: emErr }, { status: 400 });
        }

        const phErr = validatePhone(phone || "");
        if (phErr) {
            return NextResponse.json({ error: phErr }, { status: 400 });
        }

        const nameErr = validateName(name || "");
        if (nameErr) {
            return NextResponse.json({ error: nameErr }, { status: 400 });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // ── Early duplicate email & phone check ─────────────────────────
        // Inform the user immediately if email or phone is already registered
        // rather than making them wait through the whole OTP flow
        try {
            const existingUser = await prisma.user.findFirst({
                where: {
                    OR: [
                        { email: normalizedEmail },
                        phone ? { phone: phone } : {}
                    ]
                },
                select: { email: true, phone: true }
            });
            
            if (existingUser) {
                if (existingUser.email === normalizedEmail) {
                    return NextResponse.json(
                        { error: 'This email is already registered. Please login instead, or use "Forgot Password" if you need to reset your password.' },
                        { status: 409 }
                    );
                } else if (phone && existingUser.phone === phone) {
                    return NextResponse.json(
                        { error: 'This mobile number is already registered. Please login instead.' },
                        { status: 409 }
                    );
                }
            }
        } catch (dbErr) {
            // Non-blocking: if DB check fails, still allow OTP to be sent (signup will catch it)
            console.warn('[send-otp] DB duplicate check failed:', dbErr);
        }

        // ── Rate limit: max 3 OTP requests per email per hour ──
        const { allowed, retryAfter } = await checkRateLimit(normalizedEmail);
        if (!allowed) {
            return NextResponse.json(
                { error: `Too many OTP requests. Please try again in ${retryAfter ? Math.ceil(retryAfter / 60) + ' minute(s)' : '1 hour'}.` },
                { status: 429 }
            );
        }

        const result = await sendEmailOTP(normalizedEmail, name);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'OTP sent to your email' });
    } catch (err) {
        console.error('[send-otp]', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
