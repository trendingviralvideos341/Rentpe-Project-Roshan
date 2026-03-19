import { verifyEmail } from "@/actions/auth";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";

export default async function VerifyEmailPage(props: { params: Promise<{ token: string }> }) {
    const params = await props.params;
    const result = await verifyEmail(params.token);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center flex-col items-center">
                    <div className="h-12 w-12 bg-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-purple-600/20">
                        <span className="text-white font-black text-xl">RP</span>
                    </div>
                </div>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-12 px-6 shadow-2xl shadow-slate-200/50 sm:rounded-3xl sm:px-10 border border-slate-100/60 text-center">
                    {result.success ? (
                        <>
                            <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 mx-auto">
                                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Verified successfully!</h3>
                            <p className="text-slate-500 mt-3 font-medium leading-relaxed">
                                Your email has been verified. You can now log in to the RentPe portal.
                            </p>
                            <Link href="/login" className="mt-8 block w-full bg-purple-700 hover:bg-purple-800 text-white font-black py-3 rounded-xl shadow-xl shadow-purple-700/20 transition-all hover:scale-[1.02] active:scale-95">
                                LOG IN NOW
                            </Link>
                        </>
                    ) : (
                        <>
                            <div className="h-20 w-20 bg-red-50 rounded-full flex items-center justify-center mb-6 mx-auto">
                                <XCircle className="w-10 h-10 text-red-500" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Verification Failed</h3>
                            <p className="text-slate-500 mt-3 font-medium leading-relaxed">
                                {result.error || "The verification link is invalid or has expired."}
                            </p>
                            <Link href="/signup" className="mt-8 block w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-3 rounded-xl transition-all">
                                TRY SIGNUP AGAIN
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
