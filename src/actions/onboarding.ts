'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidateGlobalProperty, revalidateGlobalVerifications, revalidateAdminDashboard, revalidateGlobalOnboarding } from "@/lib/cache";
import { uploadToCloudinary, batchUploadToCloudinary } from "@/lib/upload";

// ── helpers ──────────────────────────────────────────
function appendAudit(existing: string, entry: { status: string; actorId: string; actorName: string; note?: string }) {
    let arr: any[];
    try { arr = JSON.parse(existing || "[]"); } catch { arr = []; }
    arr.push({ ...entry, timestamp: new Date().toISOString() });
    return JSON.stringify(arr);
}

async function getActor() {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const user = await prisma.user.findUnique({ where: { id: (session as any).userId }, select: { id: true, name: true, displayId: true, role: true } });
    if (!user) throw new Error("User not found");
    return user;
}

function genDisplayId(prefix: string, count: number) {
    return `${prefix}-${String(count + 1).padStart(6, "0")}`;
}

// ── Owner Self-Submit ─────────────────────────────────
export async function selfSubmitOnboarding(data: {
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string;
    buildingName: string;
    address: string;
    city: string;
    pincode: string;
    country: string;
    pgLicenceNumber?: string;
    notes?: string;
}) {
    const actor = await getActor();

    const count = await prisma.ownerOnboarding.count();
    const displayId = genDisplayId("OOB", count);

    const auditTrail = appendAudit("[]", {
        status: "PENDING_ONBOARDING",
        actorId: actor.id,
        actorName: `${actor.name || actor.displayId} (OWNER)`,
        note: "Self-submitted by owner",
    });

    const record = await prisma.ownerOnboarding.create({
        data: {
            displayId,
            source: "SELF_SUBMITTED",
            status: "PENDING_ONBOARDING",
            submittedById: actor.id,
            auditTrail,
            ...data,
        },
    });

    revalidateGlobalOnboarding();
    return record;
}

// ── Onboarder: Team Field Visit Submit ───────────────
export async function teamSubmitOnboarding(data: {
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string;
    buildingName: string;
    address: string;
    city: string;
    pincode: string;
    country: string;
    pgLicenceNumber?: string;
    notes?: string;
    idProofData?: string;
    idProofName?: string;
    pgLicenceData?: string;
    pgLicenceName?: string;
    buildingImageData?: string;
    buildingImageName?: string;
    additionalPhotos?: string;
}) {
    const actor = await getActor();
    if (actor.role !== "ONBOARDER" && actor.role !== "ADMIN") throw new Error("Unauthorized");

    const count = await prisma.ownerOnboarding.count();
    const displayId = genDisplayId("OOB", count);

    const auditTrail = appendAudit("[]", {
        status: "PENDING_VERIFICATION",
        actorId: actor.id,
        actorName: `${actor.name || actor.displayId} (ONBOARDER)`,
        note: "Field visit — submitted directly to verification",
    });

    // 1. Upload documents and photos to Cloudinary
    const folder = `onboarding/${displayId}`;
    const uploadData: any = { ...data };

    if (data.idProofData) uploadData.idProofData = await uploadToCloudinary(data.idProofData, folder, true);
    if (data.pgLicenceData) uploadData.pgLicenceData = await uploadToCloudinary(data.pgLicenceData, folder, true);
    if (data.buildingImageData) uploadData.buildingImageData = await uploadToCloudinary(data.buildingImageData, folder);
    
    if (data.additionalPhotos) {
        try {
            const photos = JSON.parse(data.additionalPhotos);
            if (Array.isArray(photos) && photos.length > 0) {
                const urls = await batchUploadToCloudinary(photos, folder);
                uploadData.additionalPhotos = JSON.stringify(urls);
            }
        } catch (e) {}
    }

    const record = await prisma.ownerOnboarding.create({
        data: {
            displayId,
            source: "TEAM_VISIT",
            status: "PENDING_VERIFICATION",
            onboardedById: actor.id,
            onboardedAt: new Date(),
            auditTrail,
            ...uploadData,
        },
    });

    revalidateGlobalOnboarding();
    return record;
}

// ── Onboarder: Accept a self-submitted request ────────
export async function acceptOnboarding(id: string, updates: {
    idProofData?: string;
    idProofName?: string;
    pgLicenceData?: string;
    pgLicenceName?: string;
    buildingImageData?: string;
    buildingImageName?: string;
    additionalPhotos?: string;
    notes?: string;
}) {
    const actor = await getActor();
    if (actor.role !== "ONBOARDER" && actor.role !== "ADMIN") throw new Error("Unauthorized");

    const record = await prisma.ownerOnboarding.findUnique({ where: { id } });
    if (!record) throw new Error("Record not found");

    const auditTrail = appendAudit(record.auditTrail, {
        status: "PENDING_VERIFICATION",
        actorId: actor.id,
        actorName: `${actor.name || actor.displayId} (${actor.displayId || "ONBOARDER"})`,
        note: "Accepted and completed by Onboarding Team — forwarded to Verification",
    });

    // 1. Upload new documents and photos to Cloudinary
    const folder = `onboarding/${record.displayId}`;
    const uploadData: any = { ...updates };

    if (updates.idProofData) uploadData.idProofData = await uploadToCloudinary(updates.idProofData, folder, true);
    if (updates.pgLicenceData) uploadData.pgLicenceData = await uploadToCloudinary(updates.pgLicenceData, folder, true);
    if (updates.buildingImageData) uploadData.buildingImageData = await uploadToCloudinary(updates.buildingImageData, folder);
    
    if (updates.additionalPhotos) {
        try {
            const photos = JSON.parse(updates.additionalPhotos);
            const toUpload = photos.filter((p: string) => p.startsWith('data:'));
            const urls = await batchUploadToCloudinary(toUpload, folder);
            const finalPhotos = photos.map((p: string) => p.startsWith('data:') ? urls.shift() : p);
            uploadData.additionalPhotos = JSON.stringify(finalPhotos);
        } catch (e) {}
    }

    const updated = await prisma.ownerOnboarding.update({
        where: { id },
        data: {
            status: "PENDING_VERIFICATION",
            onboardedById: actor.id,
            onboardedAt: new Date(),
            auditTrail,
            ...uploadData,
        },
    });

    revalidateGlobalOnboarding();
    return updated;
}

// ── Onboarder: Reject a self-submitted request ────────
export async function rejectByOnboarder(id: string, reason: string) {
    const actor = await getActor();
    if (actor.role !== "ONBOARDER" && actor.role !== "ADMIN") throw new Error("Unauthorized");

    const record = await prisma.ownerOnboarding.findUnique({ where: { id } });
    if (!record) throw new Error("Not found");

    const auditTrail = appendAudit(record.auditTrail, {
        status: "REJECTED",
        actorId: actor.id,
        actorName: `${actor.name || actor.displayId} (ONBOARDER)`,
        note: `Rejected: ${reason}`,
    });

    const updated = await prisma.ownerOnboarding.update({
        where: { id },
        data: { status: "REJECTED", rejectedReason: reason, auditTrail },
    });

    revalidateGlobalOnboarding();
    return updated;
}

// ── Getters for Onboarder ─────────────────────────────
export async function getPendingOnboardingQueue() {
    const actor = await getActor();
    if (actor.role !== "ONBOARDER" && actor.role !== "ADMIN") throw new Error("Unauthorized");
    return prisma.ownerOnboarding.findMany({
        where: { status: "PENDING_ONBOARDING" },
        orderBy: { createdAt: "asc" },
    });
}

export async function getMyOnboardings() {
    const actor = await getActor();
    return prisma.ownerOnboarding.findMany({
        where: { onboardedById: actor.id },
        orderBy: { createdAt: "desc" },
    });
}

export async function getAllOnboardings() {
    const actor = await getActor();
    if (actor.role !== "ONBOARDER" && actor.role !== "ADMIN") throw new Error("Unauthorized");
    return prisma.ownerOnboarding.findMany({ orderBy: { createdAt: "desc" } });
}

// ── Verifier: Get Pending Verification ────────────────
export async function getPendingVerifications() {
    const actor = await getActor();
    if (actor.role !== "VERIFIER" && actor.role !== "ADMIN") throw new Error("Unauthorized");
    return prisma.ownerOnboarding.findMany({
        where: { status: "PENDING_VERIFICATION" },
        orderBy: { createdAt: "asc" },
    });
}

export async function getAllVerifications() {
    const actor = await getActor();
    if (actor.role !== "VERIFIER" && actor.role !== "ADMIN") throw new Error("Unauthorized");
    return prisma.ownerOnboarding.findMany({ orderBy: { createdAt: "desc" } });
}

// ── Verifier: Verify ──────────────────────────────────
export async function verifyOnboarding(id: string, edits?: Partial<{
    ownerName: string; ownerEmail: string; ownerPhone: string;
    buildingName: string; address: string; city: string;
    pincode: string; country: string; pgLicenceNumber: string; notes: string;
}>) {
    const actor = await getActor();
    if (actor.role !== "VERIFIER" && actor.role !== "ADMIN") throw new Error("Unauthorized");

    const record = await prisma.ownerOnboarding.findUnique({ where: { id } });
    if (!record) throw new Error("Not found");

    const auditTrail = appendAudit(record.auditTrail, {
        status: "VERIFIED",
        actorId: actor.id,
        actorName: `${actor.name || actor.displayId} (${actor.displayId || "VERIFIER"})`,
        note: edits && Object.keys(edits).length > 0
            ? `Verified with corrections: ${Object.keys(edits).join(", ")}`
            : "Verified — all documents accepted",
    });

    const updated = await prisma.ownerOnboarding.update({
        where: { id },
        data: {
            status: "VERIFIED",
            verifiedById: actor.id,
            verifiedAt: new Date(),
            auditTrail,
            ...(edits || {}),
        },
    });

     revalidateAdminDashboard();
    return updated;
}

// ── Verifier: Reject ──────────────────────────────────
export async function rejectByVerifier(id: string, reason: string) {
    const actor = await getActor();
    if (actor.role !== "VERIFIER" && actor.role !== "ADMIN") throw new Error("Unauthorized");

    const record = await prisma.ownerOnboarding.findUnique({ where: { id } });
    if (!record) throw new Error("Not found");

    const auditTrail = appendAudit(record.auditTrail, {
        status: "REJECTED",
        actorId: actor.id,
        actorName: `${actor.name || actor.displayId} (VERIFIER)`,
        note: `Rejected by Verification Team: ${reason}`,
    });

    const updated = await prisma.ownerOnboarding.update({
        where: { id },
        data: { status: "REJECTED", rejectedReason: reason, auditTrail },
    });

    revalidateGlobalOnboarding();
    return updated;
}

// ── Onboarding Stats for Admin ─────────────────────────
export async function getOnboardingStats() {
    const actor = await getActor();
    if (actor.role !== "ADMIN") throw new Error("Unauthorized");

    const [pending, inVerification, verified, rejected, total] = await Promise.all([
        prisma.ownerOnboarding.count({ where: { status: "PENDING_ONBOARDING" } }),
        prisma.ownerOnboarding.count({ where: { status: "PENDING_VERIFICATION" } }),
        prisma.ownerOnboarding.count({ where: { status: "VERIFIED" } }),
        prisma.ownerOnboarding.count({ where: { status: "REJECTED" } }),
        prisma.ownerOnboarding.count(),
    ]);

    return { pending, inVerification, verified, rejected, total };
}
