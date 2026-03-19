import { getCurrentUser } from "@/actions/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Calendar, Wrench, Building2, MapPin, Building } from "lucide-react";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { getStaffDashboardData } from "@/actions/employees";

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
                            <Calendar className="w-4 h-4" /> Today's Arrivals
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Property List */}
                <div className="space-y-4">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight px-1 flex items-center gap-2">
                        <Building className="w-5 h-5 text-slate-400" /> Assigned Buildings
                    </h3>
                    {data.properties.length === 0 ? (
                        <div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
                            <p className="text-slate-400 font-bold italic tracking-tight">No properties assigned yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {data.properties.map(prop => (
                                <div key={prop.id} className="bg-white border-2 border-slate-100 rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow group">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-purple-50 transition-colors">
                                            <Building2 className="w-6 h-6 text-slate-400 group-hover:text-purple-600 transition-colors" />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-900 tracking-tight">{prop.name}</h4>
                                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
                                                <MapPin className="w-3 h-3" /> {prop.city}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Property ID</p>
                                        <p className="text-xs font-black text-slate-900">{prop.displayId || 'N/A'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Quick Info/Help */}
                <div className="space-y-4">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight px-1 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-slate-400" /> Operation Status
                    </h3>
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
            </div>
        </div>
    );
}
