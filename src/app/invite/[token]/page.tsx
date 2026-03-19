import { validateStaffInvite } from "@/actions/employees";
import SetPasswordForm from "./SetPasswordForm";
import { AlertCircle, ShieldCheck } from "lucide-react";

export default async function InvitePage(props: { params: Promise<{ token: string }> }) {
    const params = await props.params;
    try {
        const employee = await validateStaffInvite(params.token);
        
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="flex justify-center flex-col items-center">
                        <div className="h-12 w-12 bg-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-purple-600/20">
                            <span className="text-white font-black text-xl">RP</span>
                        </div>
                        <h2 className="text-center text-3xl font-black text-slate-900 tracking-tight">
                            Welcome to RentPe
                        </h2>
                    </div>
                    <p className="mt-3 text-center text-sm text-slate-600 font-medium">
                        You've been invited by <span className="font-bold text-slate-900">{employee.owner.businessName || employee.owner.name}</span>
                    </p>
                </div>

                <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                    <div className="bg-white py-8 px-6 shadow-2xl shadow-slate-200/50 sm:rounded-3xl sm:px-10 border border-slate-100/60">
                        <div className="mb-8 bg-purple-50/50 border border-purple-100/50 p-4 rounded-2xl flex items-start gap-3">
                            <div className="bg-purple-100 p-2 rounded-lg">
                                <ShieldCheck className="w-5 h-5 text-purple-700" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-purple-900 tracking-tight">Secure Onboarding</h3>
                                <p className="text-xs text-purple-700/80 mt-1 font-medium leading-relaxed">
                                    Set your password to activate your account. Your login email is <span className="font-bold text-purple-900">{employee.email}</span>.
                                </p>
                            </div>
                        </div>

                        <SetPasswordForm token={params.token} email={employee.email} />
                    </div>
                </div>
            </div>
        );
    } catch (e: any) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
                <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="bg-white py-12 px-6 shadow-2xl sm:rounded-3xl border border-red-100 text-center flex flex-col items-center">
                        <div className="h-20 w-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
                            <AlertCircle className="w-10 h-10 text-red-500" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Invalid Link</h3>
                        <p className="text-slate-500 mt-3 font-medium">{e.message}</p>
                    </div>
                </div>
            </div>
        );
    }
}
