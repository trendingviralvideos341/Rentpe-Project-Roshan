import { getSystemHealth } from "@/actions/health";
import { CheckCircle2, AlertCircle, Clock, ShieldCheck, Activity } from "lucide-react";

export default async function StatusPage() {
    const health = await getSystemHealth();
    
    const getStatusColor = (status: string) => {
        switch(status) {
            case 'OPERATIONAL': return 'text-emerald-500 bg-emerald-50 border-emerald-100';
            case 'MAINTENANCE': return 'text-amber-500 bg-amber-50 border-amber-100';
            case 'ISSUES': 
            case 'DOWN': return 'text-rose-500 bg-rose-50 border-rose-100';
            case 'DEGRADED': return 'text-orange-500 bg-orange-50 border-orange-100';
            default: return 'text-slate-500 bg-slate-50 border-slate-100';
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-900">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                            <Activity className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-slate-800">RentPe Status</h1>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Real-time Health Monitoring</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-6 py-16">
                {/* Global Status Banner */}
                <div className={`p-10 rounded-3xl border-2 flex flex-col items-center text-center gap-6 shadow-xl shadow-slate-200/50 mb-12 ${health.status === 'OPERATIONAL' ? 'bg-white border-emerald-500/20' : 'bg-white border-amber-500/20'}`}>
                    {health.status === 'OPERATIONAL' ? (
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
                            <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                        </div>
                    ) : (
                        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-2">
                            <AlertCircle className="w-12 h-12 text-amber-600" />
                        </div>
                    )}
                    
                    <div className="space-y-3">
                        <h2 className="text-4xl font-black text-slate-800 tracking-tight">
                            {health.status === 'OPERATIONAL' ? 'All Systems Operational' : 'Partial System Issues'}
                        </h2>
                        <p className="text-lg text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
                            {health.status === 'OPERATIONAL' 
                                ? 'Everything is running smoothly. We are constantly monitoring our services to ensure the best experience.' 
                                : health.maintenanceMessage}
                        </p>
                    </div>

                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full text-slate-500 text-sm font-semibold">
                        <Clock className="w-4 h-4" />
                        Last checked: {new Date(health.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                </div>

                {/* Component List */}
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="px-8 py-6 bg-slate-50 border-b border-slate-200">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Platform Components</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {health.components.map((c, i) => (
                            <div key={i} className="px-8 py-6 flex items-center justify-between group hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`w-2 h-2 rounded-full ${c.status === 'OPERATIONAL' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                    <div>
                                        <p className="font-bold text-slate-700">{c.name}</p>
                                        <p className="text-xs text-slate-400 font-medium tracking-tight">Latency: <span className="text-slate-500 font-bold">{c.latency}</span></p>
                                    </div>
                                </div>
                                <div className={`px-3 py-1.5 rounded-lg border text-xs font-black tracking-widest uppercase ${getStatusColor(c.status)}`}>
                                    {c.status}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer Notes */}
                <div className="mt-16 text-center space-y-6">
                    <div className="flex items-center justify-center gap-6">
                        <div className="flex items-center gap-2 text-slate-400">
                            <ShieldCheck className="w-5 h-5" />
                            <span className="text-sm font-bold tracking-tight">Secure & Monitored</span>
                        </div>
                    </div>
                    <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed font-medium">
                        If you encounter any issues not reported here, please contact our support team immediately.
                    </p>
                    <div className="pt-8 border-t border-slate-200">
                        <p className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">&copy; 2026 RentPe Inc. All rights reserved.</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
