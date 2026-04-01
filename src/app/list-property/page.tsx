"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/actions/auth";

export default function ListPropertyPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        async function checkAndRedirect() {
            const user = await getCurrentUser();
            if (!user) {
                // Not logged in → send to login with callback to owner's add property page
                router.push("/login?callbackUrl=/dashboard/owner/properties/new&role=OWNER");
            } else {
                // Check if user has Owner privileges
                const role = (user as any).role;
                const roles = Array.isArray((user as any).roles) ? (user as any).roles : [];
                
                if (role === 'OWNER' || roles.includes('OWNER')) {
                    // They are an Owner → go straight to the owner dashboard's add property form
                    router.push("/dashboard/owner/properties/new");
                } else if (role === 'ADMIN' || roles.includes('ADMIN')) {
                     router.push("/dashboard/admin");
                } else {
                    // They are logged in as a student, but they don't have Owner rights
                    setErrorMsg("Your account is registered as a Student. To list a property, please contact RentPe support to upgrade your account to a Property Owner.");
                    setLoading(false);
                }
            }
        }
        checkAndRedirect();
    }, [router]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
            {loading ? (
                <>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                    <p className="text-slate-500 font-medium animate-pulse">Redirecting to Property Registration...</p>
                </>
            ) : (
                <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl text-center border border-slate-100">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-2xl">🔒</span>
                    </div>
                    <h1 className="text-xl font-black text-slate-900 mb-3">Upgrade Required</h1>
                    <p className="text-sm text-slate-600 mb-8 leading-relaxed">
                        {errorMsg}
                    </p>
                    <button 
                        onClick={() => router.push('/dashboard/student')}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all shadow-lg shadow-indigo-200"
                    >
                        Return to Dashboard
                    </button>
                    <p className="mt-4 text-xs text-slate-400">
                        Contact us at <a href="mailto:support@rentpe.in" className="text-indigo-600 font-bold hover:underline">support@rentpe.in</a>
                    </p>
                </div>
            )}
        </div>
    );
}
