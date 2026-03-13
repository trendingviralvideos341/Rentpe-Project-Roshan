'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import fs from "fs";
import path from "path";

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
 * Handles an individual chunk upload.
 * In this implementation, we simulate storage by writing to a local tmp directory.
 */
export async function uploadChunkAction(
    sessionId: string, 
    chunkIndex: number, 
    chunkData: string // Base64 or Blob as string? Let's use Base64 for ease in server actions if needed
) {
    const session = await getSession();
    if (!session || !session.userId) throw new Error("Unauthorized");

    const upload = await prisma.uploadSession.findUnique({
        where: { id: sessionId, userId: session.userId }
    });
    if (!upload) throw new Error("Upload session not found");

    // Write chunk to local filesystem (simulation of object storage)
    const chunkDir = path.join(process.cwd(), 'tmp', 'uploads', sessionId);
    if (!fs.existsSync(chunkDir)) {
        fs.mkdirSync(chunkDir, { recursive: true });
    }

    const chunkPath = path.join(chunkDir, `chunk-${chunkIndex}`);
    const buffer = Buffer.from(chunkData, 'base64');
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

    // Assemble file
    const writeStream = fs.createWriteStream(finalPath);
    for (let i = 0; i < upload.totalChunks; i++) {
        const chunkPath = path.join(chunkDir, `chunk-${i}`);
        const data = fs.readFileSync(chunkPath);
        writeStream.write(data);
        fs.unlinkSync(chunkPath); // Clean up chunk
    }
    writeStream.end();

    // Clean up directory
    fs.rmdirSync(chunkDir);

    await (prisma as any).uploadSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED' }
    });

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role || 'USER',
        actorName: (session as any).name || 'User',
        actionType: 'CREATE',
        entityType: 'FILE',
        entityId: sessionId,
        description: `Successfully uploaded file: ${upload.fileName}`
    });

    return { 
        success: true, 
        url: `/uploads/${upload.storageKey}`, // Relative URL for public access
        fileName: upload.fileName 
    };
}
