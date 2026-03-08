import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalizePhone(raw: string): string {
    if (!raw) return raw;
    let v = raw.trim().replace(/\s+/g, ""); // Remove spaces

    // If it's already in the correct format, don't touch it
    if (/^\+91[6-9]\d{9}$/.test(v)) {
        return v;
    }

    // If it's exactly 10 digits starting with 6-9, prepend +91
    if (/^[6-9]\d{9}$/.test(v)) {
        return "+91" + v;
    }

    // If it starts with 91 (no +) and followed by 10 digits starting with 6-9
    if (/^91[6-9]\d{9}$/.test(v)) {
        return "+" + v;
    }

    // Aggressive fallback: take last 10 digits and prepend +91 if they start with 6-9
    const digits = v.replace(/\D/g, "");
    if (digits.length >= 10) {
        const last10 = digits.slice(-10);
        if (/^[6-9]/.test(last10)) {
            return "+91" + last10;
        }
    }

    return v;
}

async function main() {
    const models = [
        { name: 'user', field: 'phone' },
        { name: 'booking', field: 'guestPhone' },
        { name: 'waitlist', field: 'guestPhone' },
        { name: 'tenant', field: 'phone' },
        { name: 'teamMember', field: 'phone' },
        { name: 'ownerStaff', field: 'phone' },
        { name: 'ownerOnboarding', field: 'ownerPhone' },
        { name: 'employee', field: 'phone' },
    ];

    console.log("Starting phone number normalization...");

    for (const model of models) {
        try {
            const records = await (prisma as any)[model.name].findMany({
                where: { [model.field]: { not: null } },
            });

            console.log(`Checking ${records.length} records in model '${model.name}'...`);

            for (const record of records) {
                const oldVal = record[model.field];
                if (!oldVal) continue;

                const newVal = normalizePhone(oldVal);
                if (oldVal !== newVal) {
                    await (prisma as any)[model.name].update({
                        where: { id: record.id },
                        data: { [model.field]: newVal },
                    });
                    console.log(`  [MATCH] ${model.name} (${record.id}): '${oldVal}' -> '${newVal}'`);
                }
            }
        } catch (e) {
            console.warn(`  [SKIP] Model '${model.name}' might not exist or field '${model.field}' is missing.`);
        }
    }

    console.log("Normalization complete.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
