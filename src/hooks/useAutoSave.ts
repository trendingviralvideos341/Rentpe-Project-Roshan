'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { upsertDraft, getDraftAction } from '@/actions/drafts';
import { debounce } from 'lodash';

type AutoSaveOptions = {
    entityType: string;
    entityId?: string;
    interval?: number; // ms
    onSaved?: (data: any) => void;
    paused?: boolean; // New option
};

export function useAutoSave({
    entityType,
    entityId,
    interval = 5000,
    onSaved,
    paused = false
}: AutoSaveOptions) {
    const [status, setStatus] = useState<'IDLE' | 'SAVING' | 'SAVED' | 'ERROR' | 'OFFLINE'>('IDLE');
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [restoredData, setRestoredData] = useState<any>(null);
    
    // Refs for stability
    const dataRef = useRef<any>(null);
    const pausedRef = useRef(paused);
    
    // Sync paused prop to ref without triggering re-renders
    useEffect(() => {
        pausedRef.current = paused;
    }, [paused]);

    // Initial Restoration Logic
    useEffect(() => {
        async function restore() {
            const localKey = `rentpe-draft-${entityType}-${entityId || 'new'}`;
            const localData = localStorage.getItem(localKey);
            
            if (localData) {
                try {
                    const parsed = JSON.parse(localData);
                    setRestoredData(parsed);
                } catch (e) {
                    console.error("Local recovery failed", e);
                }
            }

            try {
                const backendDraft = await getDraftAction(entityType, entityId);
                if (backendDraft) {
                    setRestoredData((prev: any) => ({
                        ...prev,
                        ...backendDraft.data,
                        _from: 'backend'
                    }));
                }
            } catch (e) {
                console.error("Backend recovery failed", e);
            }
        }
        restore();
    }, [entityType, entityId]);

    // Handle offline status
    useEffect(() => {
        const handleOnline = () => setStatus('IDLE');
        const handleOffline = () => setStatus('OFFLINE');

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Stable logic function
    const handleSave = useCallback(async (payload: { entityType: string, entityId?: string, onSaved?: (d: any) => void }) => {
        if (pausedRef.current) return;
        
        if (!navigator.onLine) {
            setStatus('OFFLINE');
            return;
        }

        // Get latest data from ref
        const currentData = dataRef.current;
        if (!currentData) return;

        // Sanitize data
        let sanitizedData;
        try {
            sanitizedData = JSON.parse(JSON.stringify(currentData, (key, value) => {
                if (value && typeof value === 'object') {
                    const name = value.constructor?.name;
                    if (name === 'File' || name === 'Blob' || value instanceof File) {
                        return undefined;
                    }
                }
                return value;
            }));
        } catch (e) {
            console.error("Data serialization failed", e);
            return;
        }

        setStatus('SAVING');
        try {
            await upsertDraft({
                userId: '', 
                entityType: payload.entityType,
                entityId: payload.entityId,
                data: sanitizedData
            });
            setStatus('SAVED');
            setLastSaved(new Date());
            if (payload.onSaved) payload.onSaved(currentData);
        } catch (error) {
            console.error("Auto-save failed", error);
            setStatus('ERROR');
        }
    }, []); // Keep dependencies minimal

    // Stable debounced function ref
    const debouncedSaveRef = useRef<ReturnType<typeof debounce> | null>(null);

    useEffect(() => {
        debouncedSaveRef.current = debounce(handleSave, interval);
        return () => {
            debouncedSaveRef.current?.cancel();
        };
    }, [handleSave, interval]);

    const debouncedSave = useCallback((...args: Parameters<ReturnType<typeof debounce>>) => {
        debouncedSaveRef.current?.(...args);
    }, []);

    // Cleanup pending debounced calls handled by useEffect above

    const updateData = (data: any) => {
        dataRef.current = data;
        
        // 1. Instant Local Save
        const localKey = `rentpe-draft-${entityType}-${entityId || 'new'}`;
        localStorage.setItem(localKey, JSON.stringify(data));
        
        // 2. Queue Backend Save
        if (!pausedRef.current) {
            debouncedSave({ entityType, entityId, onSaved });
        }
    };

    const clearDraft = () => {
        debouncedSaveRef.current?.cancel();
        const localKey = `rentpe-draft-${entityType}-${entityId || 'new'}`;
        localStorage.removeItem(localKey);
    };

    return {
        status,
        lastSaved,
        restoredData,
        updateData,
        clearDraft
    };
}
