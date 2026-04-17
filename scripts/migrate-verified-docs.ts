/**
 * One-time migration: convert old verifiedDocs key format → new format
 *
 * Old keys (admin used):   AADHAAR-0, AADHAAR-1, PAN-0, PAN-1, PG_LICENCE-0, PG_LICENCE-1, LIVE_PHOTO-0
 * New keys (owner reads):  aadhaarProof-0, aadhaarProof-1, panProof-0, panProof-1, pgLicenceUrl-0, pgLicenceUrl-1, livePhotoUrl-0
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const KEY_MAP: Record<string, string> = {
    // Legal docs — old admin format → correct owner format
    "AADHAAR-0":    "aadhaarProof-0",
    "AADHAAR-1":    "aadhaarProof-1",
    "PAN-0":        "panProof-0",
    "PAN-1":        "panProof-1",
    "PG_LICENCE-0": "pgLicenceUrl-0",
    "PG_LICENCE-1": "pgLicenceUrl-1",
    "LIVE_PHOTO-0": "livePhotoUrl",   // owner uses isArray:false → no index
    // Without-index variants (old KYC queue format)
    "AADHAAR":      "aadhaarProof-0",
    "PAN":          "panProof-0",
    "PG_LICENCE":   "pgLicenceUrl-0",
    "LIVE_PHOTO":   "livePhotoUrl",
    // livePhotoUrl with index → without index (owner reads without index)
    "livePhotoUrl-0": "livePhotoUrl",
    // Rooms category mismatch
    "roomsPhotos-0": "roomsAndBathroomPhotos-0",
    "roomsPhotos-1": "roomsAndBathroomPhotos-1",
    "roomsPhotos-2": "roomsAndBathroomPhotos-2",
    "roomsPhotos-3": "roomsAndBathroomPhotos-3",
};

async function migrate() {
    const properties = await prisma.property.findMany({
        select: { id: true, name: true, verifiedDocs: true },
    });

    let updated = 0;
    let skipped = 0;

    for (const property of properties) {
        let docs: string[] = [];
        try {
            docs = JSON.parse(property.verifiedDocs || "[]");
        } catch {
            continue;
        }

        if (!Array.isArray(docs) || docs.length === 0) { skipped++; continue; }

        const migrated = [...new Set(
            docs.map(key => KEY_MAP[key] ?? key) // migrate if key in map, else keep as-is
        )];

        const changed = JSON.stringify(migrated) !== JSON.stringify(docs);
        if (!changed) { skipped++; continue; }

        await prisma.property.update({
            where: { id: property.id },
            data: { verifiedDocs: JSON.stringify(migrated) },
        });

        console.log(`✅ Updated "${property.name}": ${JSON.stringify(docs)} → ${JSON.stringify(migrated)}`);
        updated++;
    }

    console.log(`\nDone. ${updated} properties migrated, ${skipped} skipped (already correct or empty).`);
    await prisma.$disconnect();
}

migrate().catch(e => { console.error(e); process.exit(1); });
