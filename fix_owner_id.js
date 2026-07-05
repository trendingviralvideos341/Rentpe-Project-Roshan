const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function generateOwnerId() {
    const CHARSET = '0123456789';
    const length = 10;
    for (let attempt = 0; attempt < 10; attempt++) {
        const bytes = crypto.randomBytes(length * 2);
        let result = '';
        let i = 0;
        const limit = CHARSET.length * Math.floor(256 / CHARSET.length);
        while (result.length < length && i < bytes.length) {
            if (bytes[i] < limit) result += CHARSET[bytes[i] % CHARSET.length];
            i++;
        }
        while (result.length < length) {
            const b = crypto.randomBytes(1)[0];
            if (b < limit) result += CHARSET[b % CHARSET.length];
        }
        const displayId = `RP-O-${result}`;
        const existing = await prisma.user.findFirst({ where: { displayId }, select: { id: true } });
        if (!existing) return displayId;
    }
    throw new Error('Could not generate unique RP-O ID');
}

async function main() {
    // Check current state
    const owner = await prisma.user.findUnique({
        where: { email: 'owner.dummy@rentpe.in' },
        select: { id: true, displayId: true, role: true, isOwner: true }
    });
    console.log('Current owner:', JSON.stringify(owner, null, 2));

    if (!owner) { console.log('Owner not found!'); return; }

    if (owner.displayId && owner.displayId.startsWith('RP-O-')) {
        console.log('Owner ID already correct:', owner.displayId);
        return;
    }

    // Generate new RP-O ID
    const newDisplayId = await generateOwnerId();
    console.log('Generated new ID:', newDisplayId);

    // Update user
    const updated = await prisma.user.update({
        where: { id: owner.id },
        data: { displayId: newDisplayId, applicationId: newDisplayId },
        select: { id: true, displayId: true }
    });
    console.log('Updated owner:', JSON.stringify(updated, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
