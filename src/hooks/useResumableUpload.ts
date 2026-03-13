'use client';

import { useState, useCallback } from 'react';
import { initiateUploadAction, uploadChunkAction, completeUploadAction, quickUploadAction } from '@/actions/uploads';

const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
const FAST_PATH_THRESHOLD = 25 * 1024 * 1024; // ALL photos (up to 25MB) use the direct zero-DB path
const CONCURRENCY_LIMIT = 3;

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
        setProgress({ percent: 0, uploadedChunks: 0, totalChunks: 1 });

        try {
            // --- FAST PATH for Small Files ---
            if (file.size < FAST_PATH_THRESHOLD) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('fileName', file.name);
                formData.append('mimeType', file.type);

                const result = await quickUploadAction(formData);
                setProgress({ percent: 100, uploadedChunks: 1, totalChunks: 1 });
                setStatus('SUCCESS');
                return result;
            }

            // --- CHUNKED PATH for Large Files ---
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
            
            // 1. Initiate Session
            const session = await initiateUploadAction({
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                totalChunks
            });

            const sessionId = session.id;
            let uploadedChunkIndices = (session as any).uploadedChunks || [];

            // 2. Prepare Chunks
            const chunkIndices = Array.from({ length: totalChunks }, (_, i) => i)
                .filter(i => !uploadedChunkIndices.includes(i));

            // Function to upload a single chunk
            const uploadSingleChunk = async (index: number) => {
                const start = index * CHUNK_SIZE;
                const end = Math.min(file.size, start + CHUNK_SIZE);
                const chunk = file.slice(start, end);

                const formData = new FormData();
                formData.append('sessionId', sessionId);
                formData.append('chunkIndex', index.toString());
                formData.append('chunk', chunk, `chunk-${index}`);

                const result = await uploadChunkAction(formData);
                return result.uploadedChunks;
            };

            // 3. Upload Chunks with Concurrency Limit
            for (let i = 0; i < chunkIndices.length; i += CONCURRENCY_LIMIT) {
                const batch = chunkIndices.slice(i, i + CONCURRENCY_LIMIT);
                const results = await Promise.all(batch.map(index => uploadSingleChunk(index)));
                
                // Use the latest uploadedChunks from any of the results in the batch
                const latestUploaded = results[results.length - 1];
                const percent = Math.round((latestUploaded.length / totalChunks) * 100);
                setProgress({
                    percent,
                    uploadedChunks: latestUploaded.length,
                    totalChunks
                });
            }

            // 4. Complete Upload
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
