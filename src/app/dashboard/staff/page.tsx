import { getCurrentUser } from "@/actions/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Calendar, Wrench, Building2, MapPin, Building } from "lucide-react";
import { getStaffDashboardData } from "@/actions/employees";
import { StaffPropertySection } from "./StaffPropertySection";

export default async function StaffDashboard() {
    const user = await getCurrentUser();
    
    if (!user || user.role !== 'STAFF') {
        redirect("/login");
    }

    const data = await getStaffDashboardData();

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Welcome back, {user.name?.split(' ')[0]}</h2>
                    <p className="text-slate-500 font-medium mt-1 text-sm italic">
                        {data.propertyCount > 0 
                            ? `You are currently authorized to manage ${data.propertyCount} properties.` 
                            : "Awaiting property assignments from your owner."}
                    </p>
                </div>
                <div className="bg-white px-4 py-2 rounded-xl border-2 border-slate-100 shadow-sm flex items-center gap-3">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">System Live</span>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <Card className="border-2 border-slate-100 shadow-sm hover:border-purple-200 transition-all hover:shadow-xl hover:shadow-purple-500/5 rounded-3xl overflow-hidden group">
                    <CardHeader className="pb-2 bg-purple-50/30 group-hover:bg-purple-50 transition-colors">
                        <CardTitle className="text-xs font-black text-purple-800 uppercase tracking-widest flex items-center gap-2">
                            <Building2 className="w-4 h-4" /> My Properties
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <p className="text-5xl font-black text-purple-700 tracking-tighter">{data.propertyCount}</p>
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-1">Authorized locations</p>
                    </CardContent>
                </Card>

                <Card className="border-2 border-slate-100 shadow-sm hover:border-blue-200 transition-all hover:shadow-xl hover:shadow-blue-500/5 rounded-3xl overflow-hidden group">
                    <CardHeader className="pb-2 bg-blue-50/30 group-hover:bg-blue-50 transition-colors">
                        <CardTitle className="text-xs font-black text-blue-800 uppercase tracking-widest flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Today&apos;s Arrivals
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <p className="text-5xl font-black text-blue-700 tracking-tighter">{data.todayCheckins}</p>
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-1">Pending move-ins</p>
                    </CardContent>
                </Card>

                <Card className="border-2 border-slate-100 shadow-sm hover:border-orange-200 transition-all hover:shadow-xl hover:shadow-orange-500/5 rounded-3xl overflow-hidden group">
                    <CardHeader className="pb-2 bg-orange-50/30 group-hover:bg-orange-50 transition-colors">
                        <CardTitle className="text-xs font-black text-orange-800 uppercase tracking-widest flex items-center gap-2">
                            <Wrench className="w-4 h-4" /> Property Issues
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <p className="text-5xl font-black text-orange-700 tracking-tighter">{data.openTickets}</p>
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-1">Open maintenance tickets</p>
                    </CardContent>
                </Card>
            </div>

            {/* Rich Property Panel — shows only assigned properties with bed/tenant/revenue details */}
            <div className="mb-10">
                <StaffPropertySection />
            </div>

            {/* Operation Status */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <ShieldCheck className="w-32 h-32 rotate-12" />
                </div>
                <h4 className="text-xl font-black tracking-tight mb-2">Secure Access Active</h4>
                <p className="text-slate-400 font-medium text-sm leading-relaxed mb-6">
                    You are signed in with the <b>{user.role}</b> role. All actions performed on this dashboard are logged for security. Please ensure you represent the property accurately during check-ins.
                </p>
                <div className="flex gap-3">
                    <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">
                        Encrypted Session
                    </div>
                    <div className="bg-purple-500/20 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-purple-300 border border-purple-500/30">
                        Enterprise Mode
                    </div>
                </div>
            </div>
        </div>
    );
}
