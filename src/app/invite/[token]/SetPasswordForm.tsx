"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { activateStaffAccount } from "@/actions/employees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SetPasswordForm({ token, email }: { token: string; email: string }) {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }
        if (password !== confirm) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);
        try {
            await activateStaffAccount(token, password);
            toast.success("Account activated successfully!");
            router.push("/login?activated=true");
        } catch (err: any) {
            setError(err.message || "Failed to activate account");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {error && <p className="text-xs text-red-600 font-bold bg-red-50 border border-red-100 p-3 rounded-xl">{error}</p>}
            
            <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-slate-500 tracking-widest px-1">Email Address</label>
                <Input value={email} disabled className="bg-slate-50 text-slate-500 h-12 rounded-xl border-2 border-slate-100 font-medium" />
            </div>

            <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-slate-700 tracking-widest px-1">Set Password</label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="h-12 rounded-xl transition-colors focus:border-purple-500 focus:ring-purple-500/20 shadow-sm" placeholder="Minimum 8 characters" />
            </div>

            <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-slate-700 tracking-widest px-1">Confirm Password</label>
                <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required className="h-12 rounded-xl transition-colors focus:border-purple-500 focus:ring-purple-500/20 shadow-sm" placeholder="Retype password" />
            </div>

            <Button type="submit" className="w-full h-12 bg-purple-700 hover:bg-purple-800 text-white font-black tracking-wide rounded-xl mt-6 shadow-xl shadow-purple-700/20 transition-all hover:scale-[1.02] active:scale-95" disabled={loading}>
                {loading && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                ACTIVATE ACCOUNT
            </Button>
        </form>
    );
}
