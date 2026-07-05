/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║         RENTPE FIELD-LEVEL ENCRYPTION UTILITY                       ║
 * ║         Algorithm : AES-256-GCM (authenticated encryption)          ║
 * ║         Key       : FIELD_ENCRYPTION_KEY env var (64 hex chars)     ║
 * ║                                                                      ║
 * ║  USAGE:                                                              ║
 * ║    encrypt(plaintext)  → "iv:tag:ciphertext" (all hex, DB-safe)     ║
 * ║    decrypt(ciphertext) → original plaintext                          ║
 * ║                                                                      ║
 * ║  FIELDS PROTECTED:                                                   ║
 * ║    · Property.bankAccountNo / bankIfsc                              ║
 * ║    · OwnerPayout.bankAccountNo / bankIfsc                           ║
 * ║    · User.twoFactorSecret                                            ║
 * ║    · Employee.aadhaarNumber (stored as last-4 only after masking)   ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import crypto from 'crypto';

const ALGORITHM  = 'aes-256-gcm';
const KEY_LENGTH = 32;  // 256 bits
const IV_LENGTH  = 12;  // 96-bit IV (GCM recommended)
const TAG_LENGTH = 16;  // 128-bit auth tag

// ─── Key Loading ──────────────────────────────────────────────────────────────
function getEncryptionKey(): Buffer {
    const keyHex = process.env.FIELD_ENCRYPTION_KEY;
    if (!keyHex || keyHex.trim() === '') {
        throw new Error(
            'CRITICAL: FIELD_ENCRYPTION_KEY is not set in environment variables. ' +
            'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        );
    }
    const key = Buffer.from(keyHex.trim(), 'hex');
    if (key.length !== KEY_LENGTH) {
        throw new Error(
            `CRITICAL: FIELD_ENCRYPTION_KEY must be exactly ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes). ` +
            `Got ${key.length} bytes (${keyHex.trim().length} hex chars).`
        );
    }
    return key;
}

// ─── Core Encrypt ─────────────────────────────────────────────────────────────
/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a single string: "iv:authTag:ciphertext" (all hex-encoded).
 * This format is self-contained and can be stored in any String DB column.
 *
 * @param plaintext  The sensitive value to encrypt (e.g. "1234567890123456")
 * @returns          Encrypted string e.g. "3a1f...:9c7b...:8e4d..."
 */
export function encrypt(plaintext: string): string {
    const key    = getEncryptionKey();
    const iv     = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag(); // 16-byte authentication tag

    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

// ─── Core Decrypt ─────────────────────────────────────────────────────────────
/**
 * Decrypts an encrypted string produced by encrypt().
 * Throws if the data has been tampered with (GCM auth tag verification).
 *
 * @param ciphertext  The "iv:tag:data" string from the database
 * @returns           Original plaintext
 */
export function decrypt(ciphertext: string): string {
    const key  = getEncryptionKey();
    const parts = ciphertext.split(':');

    if (parts.length !== 3) {
        throw new Error(
            `[CRYPTO] Invalid encrypted field format. Expected "iv:tag:data", got ${parts.length} parts. ` +
            'This field may contain plaintext — run the data migration script.'
        );
    }

    const [ivHex, tagHex, dataHex] = parts;
    const iv       = Buffer.from(ivHex,   'hex');
    const tag      = Buffer.from(tagHex,  'hex');
    const data     = Buffer.from(dataHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    try {
        return decipher.update(data).toString('utf8') + decipher.final('utf8');
    } catch {
        throw new Error('[CRYPTO] Decryption failed — data may be corrupted or tampered with.');
    }
}

// ─── Nullable Helpers ─────────────────────────────────────────────────────────
/**
 * Encrypts a value only if it's non-null and non-empty.
 * Returns null for null/undefined/empty string inputs.
 * Use this for optional fields (e.g. bankAccountNo?: String?)
 */
export function encryptIfPresent(value: string | null | undefined): string | null {
    if (!value || value.trim() === '') return null;
    return encrypt(value.trim());
}

/**
 * Decrypts a value only if it's non-null.
 * Returns null for null/undefined inputs.
 * Handles legacy plaintext gracefully: if decryption fails format check,
 * logs a warning and returns the raw value so reads don't crash during migration.
 */
export function decryptIfPresent(value: string | null | undefined): string | null {
    if (!value) return null;

    // Detect if this is already an encrypted string (iv:tag:data = 3 parts, all hex)
    const parts = value.split(':');
    if (parts.length !== 3) {
        // Legacy plaintext — return as-is during migration window
        // REMOVE THIS FALLBACK after running the data migration script
        console.warn('[CRYPTO] ⚠️  Detected un-encrypted field value. Run data migration to encrypt all existing records.');
        return value;
    }

    return decrypt(value);
}

// ─── Aadhaar Masking ──────────────────────────────────────────────────────────
/**
 * Masks an Aadhaar number, keeping only the last 4 digits.
 * Input: "123456789012" → Output: "XXXX XXXX 9012"
 * Complies with UIDAI masking guidelines.
 */
export function maskAadhaar(aadhaar: string): string {
    const clean = aadhaar.replace(/\s/g, '');
    if (clean.length !== 12) return 'XXXX XXXX ' + clean.slice(-4);
    return `XXXX XXXX ${clean.slice(-4)}`;
}

/**
 * Extracts the last 4 digits of an Aadhaar number for storage.
 * We store ONLY the last 4 — never the full number.
 */
export function extractAadhaarLast4(aadhaar: string): string {
    return aadhaar.replace(/\s/g, '').slice(-4);
}

// ─── Bank Account Display Masking ─────────────────────────────────────────────
/**
 * Masks a bank account number for display, showing only last 4 digits.
 * Input: "1234567890123456" → Output: "************3456"
 */
export function maskBankAccount(accountNo: string): string {
    if (accountNo.length <= 4) return accountNo;
    return '*'.repeat(accountNo.length - 4) + accountNo.slice(-4);
}
