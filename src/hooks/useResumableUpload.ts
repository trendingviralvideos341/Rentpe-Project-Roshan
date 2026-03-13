'use client';

import { useState, useCallback } from 'react';
import { initiateUploadAction, uploadChunkAction, completeUploadAction } from '@/actions/uploads';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

type UploadProgress = {
    percent: number;
    uploadedChunks: number;
    totalChunks: number;
};

export function useResumableUpload() {
    const [status, setStatus] = useState<'IDLE' | 'UPLOADING' | 'PAUSED' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [progress, setProgress] = useState<UploadProgress>({ percent: 0, uploadedChunks: 0, totalChunks: 0 });
    const [error, setError] = useState<string | null>(null);

    const uploadFile = useCallback(async (file: File) => {
        setStatus('UPLOADING');
        setError(null);

        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        
        try {
            // 1. Initiate Session
            const session = await initiateUploadAction({
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                totalChunks
            });

            const sessionId = session.id;
            let uploadedChunks = session.uploadedChunks;

            // 2. Upload Chunks
            for (let i = 0; i < totalChunks; i++) {
                // Skip if already uploaded (resumption logic)
                if (uploadedChunks.includes(i)) continue;

                const start = i * CHUNK_SIZE;
                const end = Math.min(file.size, start + CHUNK_SIZE);
                const chunk = file.slice(start, end);

                // Convert to Base64 (simplest for Server Actions)
                const reader = new FileReader();
                const base64ChunkPromise = new Promise<string>((resolve) => {
                    reader.onload = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        resolve(base64);
                    };
                    reader.readAsDataURL(chunk);
                });

                const base64Chunk = await base64ChunkPromise;

                // Upload chunk
                const result = await uploadChunkAction(sessionId, i, base64Chunk);
                uploadedChunks = result.uploadedChunks;

                // Update Progress
                const percent = Math.round((uploadedChunks.length / totalChunks) * 100);
                setProgress({
                    percent,
                    uploadedChunks: uploadedChunks.length,
                    totalChunks
                });
            }

            // 3. Complete Upload
            const finalResult = await completeUploadAction(sessionId);
            setStatus('SUCCESS');
            return finalResult;

        } catch (err: any) {
            console.error("Resumable upload failed", err);
            setStatus('ERROR');
            setError(err.message || 'Upload failed');
            throw err;
        }
    }, []);

    return {
        status,
        progress,
        error,
        uploadFile
    };
}
