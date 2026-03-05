'use client';

import { useEffect } from 'react';

// This is a lightweight beacon that runs on every page load.
// It writes the current user's ID + role to localStorage so other 
// tabs can instantly detect when a different user logs in.
export default function SessionSync({ userId, role }: { userId: string | null, role: string | null }) {
    useEffect(() => {
        const key = 'rentpe_active_session';

        if (userId) {
            const current = JSON.stringify({ userId, role, ts: Date.now() });
            // Writing to localStorage fires the 'storage' event in ALL other open tabs
            localStorage.setItem(key, current);
        } else {
            // User logged out — clear the key
            localStorage.removeItem(key);
        }
    }, [userId, role]);

    return null; // pure side-effect component, renders nothing
}
