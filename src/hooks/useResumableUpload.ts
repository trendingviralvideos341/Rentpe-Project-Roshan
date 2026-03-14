'use client';

import { useState, useCallback } from 'react';
import { getCloudinarySignature } from '@/actions/uploads';

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
            // 1. Get Secure Signature from Server (High Performance - No file data sent)
            const timestamp = Math.floor(Date.now() / 1000);
            const { signature, apiKey, cloudName, folder } = await getCloudinarySignature({
                folder: `rentpe/properties/temp`, // Will be auto-corrected to user-specific folder in action
                timestamp
            });

            // 2. Direct Upload to Cloudinary (Bypasses Vercel Proxy)
            const formData = new FormData();
            formData.append('file', file);
            formData.append('api_key', apiKey);
            formData.append('timestamp', timestamp.toString());
            formData.append('signature', signature);
            formData.append('folder', folder);

            const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || 'Cloudinary upload failed');
            }

            const result = await response.json();
            
            setProgress({ percent: 100, uploadedChunks: 1, totalChunks: 1 });
            setStatus('SUCCESS');
            
            return {
                url: result.secure_url,
                public_id: result.public_id,
                success: true
            };
        } catch (err: any) {
            console.error("Direct high-speed upload failed", err);
            setStatus('ERROR');
            setError(err.message || 'Upload failed');
            throw err;
        }
    }, [getCloudinarySignature]);

    return {
        status,
        progress,
        error,
        uploadFile
    };
}
