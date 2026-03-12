"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/actions/auth";

export default function ListPropertyPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function checkAndRedirect() {
            const user = await getCurrentUser();
            if (!user) {
                // Not logged in → send to login with callback to owner's add property page
                router.push("/login?callbackUrl=/dashboard/owner/properties/new&role=OWNER");
            } else {
                // Already logged in → go straight to the owner dashboard's add property form
                router.push("/dashboard/owner/properties/new");
            }
        }
        checkAndRedirect();
    }, [router]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mb-4"></div>
            <p className="text-muted-foreground font-medium animate-pulse">Redirecting to Property Registration...</p>
        </div>
    );
}
