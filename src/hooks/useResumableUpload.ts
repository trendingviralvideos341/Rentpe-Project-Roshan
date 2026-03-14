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
            // DIRECT PATH: Always use quickUploadAction to avoid Vercel filesystem issues
            const formData = new FormData();
            formData.append('file', file);
            formData.append('fileName', file.name);
            formData.append('mimeType', file.type);

            const result = await quickUploadAction(formData);
            setProgress({ percent: 100, uploadedChunks: 1, totalChunks: 1 });
            setStatus('SUCCESS');
            return result;
        } catch (err: any) {
            console.error("Direct upload failed", err);
            setStatus('ERROR');
            setError(err.message || 'Upload failed');
            throw err;
        }
    }, [quickUploadAction]);

    return {
        status,
        progress,
        error,
        uploadFile
    };
}
