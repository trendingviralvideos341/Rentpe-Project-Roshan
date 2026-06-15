"use client";

import { OwnerPropertyPanel } from "@/components/dashboard/OwnerPropertyPanel";

/**
 * Client-side wrapper for the staff property panel.
 * The staff page.tsx is a server component, so we use this
 * thin client wrapper to mount the interactive panel.
 */
export function StaffPropertySection() {
    return <OwnerPropertyPanel userRole="STAFF" />;
}
