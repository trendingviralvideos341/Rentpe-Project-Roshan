import { NextRequest, NextResponse } from 'next/server';
import { sendEmailOTP } from '@/lib/otp';

// Rate limit: 3 OTP requests per email per hour
const rateLimitStore: Map<string, number[]> = new Map();

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, name } = body;

        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
        }

        const key = email.toLowerCase().trim();

        // Rate limit: max 3 per email per hour
        const now = Date.now();
        const windowMs = 60 * 60 * 1000;
        const requests = rateLimitStore.get(key) || [];
        const recent = requests.filter(t => now - t < windowMs);

        if (recent.length >= 3) {
            return NextResponse.json(
                { error: 'Too many OTP requests. Please try again in 1 hour.' },
                { status: 429 }
            );
        }

        recent.push(now);
        rateLimitStore.set(key, recent);

        const result = await sendEmailOTP(email, name);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'OTP sent to your email' });
    } catch (err) {
        console.error('[send-otp]', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
