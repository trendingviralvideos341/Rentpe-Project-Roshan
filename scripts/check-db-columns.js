require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
    const propCols = await p.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='Property' AND column_name LIKE '%bank%' ORDER BY column_name`;
    console.log('Property bank columns:', JSON.stringify(propCols, null, 2));

    const payoutCols = await p.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='OwnerPayout' AND column_name LIKE '%bank%' ORDER BY column_name`;
    console.log('OwnerPayout bank columns:', JSON.stringify(payoutCols, null, 2));

    const userCols = await p.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='User' AND (column_name LIKE '%factor%' OR column_name LIKE '%reset%') ORDER BY column_name`;
    console.log('User 2FA/reset columns:', JSON.stringify(userCols, null, 2));
}

check().catch(console.error).finally(() => p.$disconnect());
