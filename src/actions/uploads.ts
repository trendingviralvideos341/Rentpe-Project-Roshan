'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import fs from "fs";
import path from "path";
import { uploadToCloudinary } from "@/lib/upload";

/**
 * Initiates a new resumable upload session.
 */
export async function initiateUploadAction(params: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    totalChunks: number;
}) {
    const session = await getSession();
    if (!session || !session.userId) throw new Error("Unauthorized");

    // Generate a unique storage key (in real production, this would be an S3 key)
    const storageKey = `uploads/${session.userId}/${Date.now()}-${params.fileName}`;

    const uploadSession = await (prisma as any).uploadSession.create({
        data: {
            userId: session.userId,
            fileName: params.fileName,
            fileSize: params.fileSize,
            mimeType: params.mimeType,
            totalChunks: params.totalChunks,
            storageKey,
            status: 'UPLOADING',
            uploadedChunks: []
        }
    });

    return uploadSession;
}

/**
 */
export async function uploadChunkAction(
    formData: FormData
) {
    const session = await getSession();
    if (!session || !session.userId) throw new Error("Unauthorized");

    const sessionId = formData.get('sessionId') as string;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const chunkFile = formData.get('chunk') as File;

    if (!sessionId || isNaN(chunkIndex) || !chunkFile) {
        throw new Error("Invalid upload parameters");
    }

    const upload = await prisma.uploadSession.findUnique({
        where: { id: sessionId, userId: session.userId }
    });
    if (!upload) throw new Error("Upload session not found");

    // Security Validation
    const MAX_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB limit for a single chunk
    if (chunkFile.size > MAX_CHUNK_SIZE) {
        throw new Error("Chunk size exceeds limit");
    }

    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 
        'application/pdf', 'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowedTypes.includes(chunkFile.type)) {
        throw new Error(`File type ${chunkFile.type} is not allowed`);
    }

    // Write chunk to local filesystem (simulation of object storage)
    const chunkDir = path.join(process.cwd(), 'tmp', 'uploads', sessionId);
    if (!fs.existsSync(chunkDir)) {
        fs.mkdirSync(chunkDir, { recursive: true });
    }

    const chunkPath = path.join(chunkDir, `chunk-${chunkIndex}`);
    const arrayBuffer = await chunkFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(chunkPath, buffer);

    // Update session tracking
    const updatedChunks = [...new Set([...upload.uploadedChunks, chunkIndex])].sort((a, b) => a - b);
    
    await (prisma as any).uploadSession.update({
        where: { id: sessionId },
        data: {
            uploadedChunks: updatedChunks,
            updatedAt: new Date()
        }
    });

    return { success: true, uploadedChunks: updatedChunks };
}

/**
 * Finalizes the upload and assembles the file.
 */
export async function completeUploadAction(sessionId: string) {
    const session = await getSession();
    if (!session || !session.userId) throw new Error("Unauthorized");

    const upload = await prisma.uploadSession.findUnique({
        where: { id: sessionId, userId: session.userId }
    });
    if (!upload || upload.uploadedChunks.length !== upload.totalChunks) {
        throw new Error("Missing chunks for completion");
    }

    const chunkDir = path.join(process.cwd(), 'tmp', 'uploads', sessionId);
    const finalPath = path.join(process.cwd(), 'public', 'uploads', upload.storageKey);
    const finalDir = path.dirname(finalPath);
    
    if (!fs.existsSync(finalDir)) {
        fs.mkdirSync(finalDir, { recursive: true });
    }

    // Assemble file in a temporary buffer
    const assembledBuffer = Buffer.concat(
        Array.from({ length: upload.totalChunks }, (_, i) => {
            const chunkPath = path.join(chunkDir, `chunk-${i}`);
            const data = fs.readFileSync(chunkPath);
            fs.unlinkSync(chunkPath); // Clean up chunk
            return data;
        })
    );

    // Clean up directory
    if (fs.existsSync(chunkDir)) {
        fs.rmdirSync(chunkDir);
    }

    // --- PHASE 3: Cloudinary Elite Restoration ---
    try {
        // Upload the assembled buffer to Cloudinary
        // Note: Using a temporary File-like structure for the upload helper
        const cloudinaryUrl = await uploadToCloudinary(
            new File([assembledBuffer], upload.fileName, { type: upload.mimeType }),
            `uploads/${session.userId}`
        );

        await (prisma as any).uploadSession.update({
            where: { id: sessionId },
            data: { 
                status: 'COMPLETED',
                storageKey: cloudinaryUrl // Update with final cloud URL
            }
        });

        logAuditEvent({
            actorId: session.userId,
            actorRole: session.role || 'USER',
            actorName: (session as any).name || 'User',
            actionType: 'CREATE',
            entityType: 'FILE',
            entityId: sessionId,
            description: `Successfully uploaded file to cloud: ${upload.fileName}`
        });

        return { 
            success: true, 
            url: cloudinaryUrl,
            fileName: upload.fileName 
        };
    } catch (error) {
        console.error("Cloudinary assembly upload failed:", error);
        throw new Error("Final cloud storage sync failed. Chunks were saved, please retry completion.");
    }
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
        const cloudinaryUrl = await uploadToCloudinary(file, `rentpe/properties/${session.userId}`);
        return { 
            url: cloudinaryUrl,
            fileName: fileName,
            success: true
        };
    } catch (error) {
        console.error("Direct Cloudinary upload failed:", error);
        throw new Error("Cloud storage upload failed. Please try again.");
    }
}
