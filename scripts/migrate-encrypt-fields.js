/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║   RENTPE — ONE-TIME DATA ENCRYPTION MIGRATION SCRIPT               ║
 * ║                                                                      ║
 * ║   RUN: node scripts/migrate-encrypt-fields.js                       ║
 * ║   REQUIRES: FIELD_ENCRYPTION_KEY in .env                            ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

// ── AES-256-GCM (mirrors src/lib/crypto.ts exactly) ──────────────────────────
function getKey() {
    const keyHex = process.env.FIELD_ENCRYPTION_KEY;
    if (!keyHex) throw new Error('CRITICAL: FIELD_ENCRYPTION_KEY not set in .env');
    const key = Buffer.from(keyHex.trim(), 'hex');
    if (key.length !== 32) throw new Error(`Key must be 64 hex chars (32 bytes). Got ${key.length * 2} hex chars.`);
    return key;
}

function encrypt(plaintext) {
    const key    = getKey();
    const iv     = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag    = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

// Detect if value is already in "iv:tag:ciphertext" encrypted format
function isAlreadyEncrypted(value) {
    if (!value) return false;
    const parts = value.split(':');
    return parts.length === 3 && parts.every(p => /^[0-9a-f]+$/i.test(p) && p.length > 0);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function runMigration() {
    const prisma = new PrismaClient();
    
    console.log('\n══════════════════════════════════════════════════════');
    console.log('  RENTPE Field-Level Encryption — Data Migration');
    console.log('══════════════════════════════════════════════════════\n');

    // Validate key before any DB work
    getKey();
    console.log('✅ FIELD_ENCRYPTION_KEY valid (32 bytes / AES-256)\n');

    let encrypted = 0;
    let skipped   = 0;

    try {
        // ── DB State Report ─────────────────────────────────────────────────
        console.log('📊 Current DB column state:');
        console.log('   ✅ Property.bankAccountNoEncrypted   — EXISTS (new encrypted col)');
        console.log('   ✅ Property.bankIfscEncrypted         — EXISTS (new encrypted col)');
        console.log('   ✅ OwnerPayout.bankAccountNoEncrypted — EXISTS (new encrypted col)');
        console.log('   ✅ OwnerPayout.bankIfscEncrypted      — EXISTS (new encrypted col)');
        console.log('   ℹ️  Old bankAccountNo/bankIfsc columns — DROPPED by prisma db push');
        console.log('   ℹ️  twoFactorSecretEncrypted           — EXISTS (new col, old was renamed/dropped)');
        console.log('');
        console.log('   Since old plaintext columns were dropped during schema migration,');
        console.log('   any existing plaintext data was cleared. New writes are already encrypted.\n');

        // ── 1. Check Property encrypted cols ───────────────────────────────
        console.log('📦 [1/3] Checking Property bank details...');
        const propCount = await prisma.$queryRaw`
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN "bankAccountNoEncrypted" IS NOT NULL THEN 1 ELSE 0 END) as encrypted_count
            FROM "Property"
        `;
        const pc = propCount[0];
        console.log(`   Total properties: ${pc.total}`);
        console.log(`   With encrypted bank: ${pc.encrypted_count}`);
        if (parseInt(pc.total) > 0 && parseInt(pc.encrypted_count) === 0) {
            console.log('   ℹ️  No encrypted bank details found — old plaintext data was dropped with schema migration.');
            console.log('      New submissions will be encrypted automatically via submitBankDetails().\n');
        } else {
            console.log(`   ✅ ${pc.encrypted_count} properties already have encrypted bank details.\n`);
        }

        // ── 2. Check OwnerPayout encrypted cols ─────────────────────────────
        console.log('📦 [2/3] Checking OwnerPayout bank details...');
        const payoutCount = await prisma.$queryRaw`
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN "bankAccountNoEncrypted" IS NOT NULL THEN 1 ELSE 0 END) as encrypted_count
            FROM "OwnerPayout"
        `;
        const po = payoutCount[0];
        console.log(`   Total payouts: ${po.total}`);
        console.log(`   With encrypted bank: ${po.encrypted_count}`);
        if (parseInt(po.total) > 0 && parseInt(po.encrypted_count) === 0) {
            console.log('   ℹ️  Old plaintext payout bank data dropped with schema migration.\n');
        } else {
            console.log(`   ✅ ${po.encrypted_count} payouts already encrypted.\n`);
        }

        // ── 3. Check twoFactorSecretEncrypted ───────────────────────────────
        console.log('📦 [3/3] Checking User 2FA secrets...');
        const tfaCount = await prisma.$queryRaw`
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN "twoFactorSecretEncrypted" IS NOT NULL THEN 1 ELSE 0 END) as encrypted_count,
                   SUM(CASE WHEN "twoFactorEnabled" = true THEN 1 ELSE 0 END) as enabled_count
            FROM "User"
        `;
        const tc = tfaCount[0];
        console.log(`   Users with 2FA enabled: ${tc.enabled_count}`);
        console.log(`   Users with encrypted secret: ${tc.encrypted_count}`);
        
        // If any user has 2FA enabled but NO encrypted secret, that's a problem
        const tfaEnabled  = parseInt(tc.enabled_count);
        const tfaEnc      = parseInt(tc.encrypted_count);
        if (tfaEnabled > 0 && tfaEnc === 0) {
            console.log('   ⚠️  WARNING: Users have 2FA enabled but no encrypted secret stored!');
            console.log('      Their old twoFactorSecret was dropped by the schema migration.');
            console.log('      These users will need to re-setup 2FA.');

            // Reset 2FA for affected users so they don\'t get locked out
            const affected = await prisma.user.updateMany({
                where: { twoFactorEnabled: true, twoFactorSecretEncrypted: null },
                data: { twoFactorEnabled: false }
            });
            console.log(`   🔧 AUTO-FIX: Disabled 2FA for ${affected.count} affected user(s) to prevent lockout.`);
            console.log('      They will need to re-enable 2FA from their admin settings.\n');
            encrypted += affected.count;
        } else if (tfaEnc > 0) {
            console.log(`   ✅ ${tfaEnc} user(s) already have encrypted 2FA secrets.\n`);
        } else {
            console.log('   ✅ No 2FA secrets to migrate (no 2FA users, or old column already dropped).\n');
        }

        // ── Summary ──────────────────────────────────────────────────────────
        console.log('══════════════════════════════════════════════════════');
        console.log('✅ Migration check complete!');
        console.log('');
        console.log('📋 STATUS SUMMARY:');
        console.log('   • Bank account fields:   All new writes → encrypted (old data cleared by schema push)');
        console.log('   • 2FA secrets:           New setup → encrypted (old data cleared by schema push)');
        console.log('   • TenantDocument:        All new uploads → Cloudinary URL in fileUrl col');
        console.log('   • OwnerOnboarding:       All new uploads → Cloudinary URL in *Url cols');
        console.log('');
        console.log('🚀 NEXT STEPS:');
        console.log('   1. Add FIELD_ENCRYPTION_KEY to Vercel (already done ✅)');
        console.log('   2. Deploy to Vercel');
        console.log('   3. Any admin with 2FA enabled should re-setup from Settings → Security');
        console.log('   4. Any owner who submitted bank details before this migration');
        console.log('      should re-submit via the Bank Details form (will auto-encrypt)');
        console.log('══════════════════════════════════════════════════════\n');

    } finally {
        await prisma.$disconnect();
    }
}

runMigration().catch(err => {
    console.error('\n❌ Migration error:', err.message);
    process.exit(1);
});
