import * as otplibNamespace from 'otplib';
import QRCode from 'qrcode';

// Support both standard ESM and CJS-wrapped default exports in Turbopack
const otplib: any = (otplibNamespace as any).default || otplibNamespace;
const authenticator = otplib.authenticator;

/**
 * Generate a new secret for a user
 */
export function generate2FASecret() {
    return authenticator.generateSecret();
}

/**
 * Generate a QR code for a user to scan
 * @param email User's email
 * @param secret User's 2FA secret
 */
export async function generate2FAQRCode(email: string, secret: string) {
    const otpauth = authenticator.keyuri(email, 'RentPe Admin', secret);
    try {
        return await QRCode.toDataURL(otpauth);
    } catch (err) {
        console.error('Failed to generate QR code:', err);
        throw new Error('QR code generation failed');
    }
}

/**
 * Verify a TOTP token against a secret
 */
export function verify2FAToken(secret: string, token: string) {
    try {
        return authenticator.verify({
            token,
            secret,
        });
    } catch (err) {
        return false;
    }
}
