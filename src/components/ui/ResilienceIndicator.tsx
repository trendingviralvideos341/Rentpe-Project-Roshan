'use client';

import React from 'react';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type ResilienceStatus = 'IDLE' | 'SAVING' | 'SAVED' | 'ERROR' | 'OFFLINE' | 'UPLOADING' | 'SUCCESS' | 'PAUSED';

interface ResilienceIndicatorProps {
    status: ResilienceStatus;
    lastSaved?: Date | null;
    progress?: number;
    className?: string;
}

export const ResilienceIndicator: React.FC<ResilienceIndicatorProps> = ({
    status,
    lastSaved,
    progress,
    className = ""
}) => {
    const renderContent = () => {
        switch (status) {
            case 'SAVING':
                return (
                    <>
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                        <span className="text-xs font-medium text-blue-600">Saving Draft...</span>
                    </>
                );
            case 'SAVED':
                return (
                    <>
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-xs font-medium text-green-600">
                            Saved {lastSaved ? `at ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </span>
                    </>
                );
            case 'UPLOADING':
                return (
                    <>
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                        <span className="text-xs font-medium text-indigo-600">
                            Uploading... {progress !== undefined ? `${progress}%` : ''}
                        </span>
                    </>
                );
            case 'PAUSED':
                return (
                    <>
                        <RefreshCw className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-medium text-amber-600">Upload Paused</span>
                    </>
                );
            case 'SUCCESS':
                return (
                    <>
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-xs font-medium text-green-600">Upload Complete</span>
                    </>
                );
            case 'OFFLINE':
                return (
                    <>
                        <CloudOff className="w-4 h-4 text-red-500" />
                        <span className="text-xs font-medium text-red-600">Offline – Reconnecting...</span>
                    </>
                );
            case 'ERROR':
                return (
                    <>
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                        <span className="text-xs font-medium text-orange-600">Save Failed – Retrying</span>
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <AnimatePresence mode="wait">
            {status !== 'IDLE' && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-sm border border-gray-100 shadow-sm ${className}`}
                >
                    {renderContent()}
                </motion.div>
            )}
        </AnimatePresence>
    );
};
