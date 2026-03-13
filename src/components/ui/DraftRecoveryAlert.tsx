'use client';

import React from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { History, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DraftRecoveryAlertProps {
    onRestore: () => void;
    onDismiss: () => void;
    entityName: string;
}

export const DraftRecoveryAlert: React.FC<DraftRecoveryAlertProps> = ({
    onRestore,
    onDismiss,
    entityName
}) => {
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mb-6"
            >
                <Alert className="border-blue-200 bg-blue-50/50 flex items-start justify-between">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <History className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <AlertTitle className="text-blue-800 font-semibold">
                                Unfinished Draft Found
                            </AlertTitle>
                            <AlertDescription className="text-blue-700 mt-1">
                                We found a saved draft of your <strong>{entityName}</strong> from a previous session. 
                                Would you like to restore your progress and continue?
                            </AlertDescription>
                            <div className="mt-4 flex gap-3">
                                <Button 
                                    onClick={onRestore}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                    size="sm"
                                >
                                    Restore Progress
                                </Button>
                                <Button 
                                    variant="outline" 
                                    onClick={onDismiss}
                                    className="border-blue-300 text-blue-700 hover:bg-blue-100"
                                    size="sm"
                                >
                                    Start Fresh
                                </Button>
                            </div>
                        </div>
                    </div>
                </Alert>
            </motion.div>
        </AnimatePresence>
    );
};
