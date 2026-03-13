'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { upsertDraft, getDraftAction } from '@/actions/drafts';
import { debounce } from 'lodash';

type AutoSaveOptions = {
    entityType: string;
    entityId?: string;
    interval?: number; // ms
    onSaved?: (data: any) => void;
};

export function useAutoSave({
    entityType,
    entityId,
    interval = 5000,
    onSaved
}: AutoSaveOptions) {
    const [status, setStatus] = useState<'IDLE' | 'SAVING' | 'SAVED' | 'ERROR' | 'OFFLINE'>('IDLE');
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [restoredData, setRestoredData] = useState<any>(null);
    
    // Ref to track latest data for the debounced function
    const dataRef = useRef<any>(null);

    // Initial Restoration Logic
    useEffect(() => {
        async function restore() {
            // 1. Try Local Storage first (fastest)
            const localKey = `rentpe-draft-${entityType}-${entityId || 'new'}`;
            const localData = localStorage.getItem(localKey);
            
            if (localData) {
                try {
                    const parsed = JSON.parse(localData);
                    setRestoredData(parsed);
                    console.log(`Restored ${entityType} draft from local storage`);
                } catch (e) {
                    console.error("Local recovery failed", e);
                }
            }

            // 2. Try Backend (cross-device)
            try {
                const backendDraft = await getDraftAction(entityType, entityId);
                if (backendDraft) {
                    // If backend is newer than local, prefer backend? 
                    // For now, let's just merge or provide both. 
                    // Most often, local is the latest WIP.
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

    const saveToBackend = useCallback(
        debounce(async (data: any) => {
            if (!navigator.onLine) {
                setStatus('OFFLINE');
                return;
            }

            setStatus('SAVING');
            try {
                await upsertDraft({
                    userId: '', // Server action gets it from session
                    entityType,
                    entityId,
                    data
                });
                setStatus('SAVED');
                setLastSaved(new Date());
                if (onSaved) onSaved(data);
            } catch (error) {
                console.error("Auto-save failed", error);
                setStatus('ERROR');
            }
        }, interval),
        [entityType, entityId, interval, onSaved]
    );

    const updateData = (data: any) => {
        dataRef.current = data;
        
        // 1. Instant Local Save
        const localKey = `rentpe-draft-${entityType}-${entityId || 'new'}`;
        localStorage.setItem(localKey, JSON.stringify(data));
        
        // 2. Debounced Backend Save
        saveToBackend(data);
    };

    const clearDraft = () => {
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
