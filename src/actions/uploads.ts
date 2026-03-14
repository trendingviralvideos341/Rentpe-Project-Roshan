'use server';

import { getSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { uploadToCloudinary } from "@/lib/upload";

/**
 * Initiates a new resumable upload session (DEPRECATED).
 */
export async function initiateUploadAction(params: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    totalChunks: number;
}) {
    throw new Error("initiateUploadAction is deprecated. Use quickUploadAction.");
}

/**
 */
export async function uploadChunkAction(
    formData: FormData
) {
    throw new Error("Chunked file system uploads are deprecated on Vercel. Please use quickUploadAction.");
}

/**
 * Finalizes the upload and assembles the file.
 */
export async function completeUploadAction(sessionId: string) {
    throw new Error("Chunked file system uploads are deprecated on Vercel. Please use quickUploadAction.");
}

/**
 * ZERO-LATENCY Direct Upload to Cloudinary.
 * NO database roundtrip. File goes straight to cloud storage.
 * Fastest possible path for all property photos and documents.
 */
export async function quickUploadAction(formData: FormData) {
    const session = await getSession();
    if (!session || !session.userId) throw new Error("Unauthorized");

    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string;
    const mimeType = formData.get('mimeType') as string;

    if (!file || !fileName || !mimeType) {
        throw new Error("Invalid upload parameters");
    }

    // Security Validation (no DB needed)
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB limit
    if (file.size > MAX_FILE_SIZE) {
        throw new Error("File too large for upload (max 25MB)");
    }

    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 
        'application/pdf', 'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowedTypes.includes(mimeType)) {
        throw new Error(`File type ${mimeType} is not allowed`);
    }

    // DIRECT TO CLOUDINARY — Zero DB overhead
    try {
        const cloudinaryUrl = await uploadToCloudinary(file, `properties/${session.userId}`);
        return { 
            url: cloudinaryUrl,
            fileName: fileName,
            success: true
        };
    } catch (error: any) {
        console.error("🔴 [Vercel Commit: " + (process.env.VERCEL_GIT_COMMIT_SHA || "LOCAL") + "] Cloudinary upload error details:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        throw new Error("Cloud storage upload failed. Please try again.");
    }
}
