"use client";

import { useEffect, useState } from "react";
import { getAdminStaffMembers } from "@/actions/employees";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Search, 
    Mail, 
    Phone, 
    Building, 
    Shield, 
    UserCheck,
    Loader2,
    ArrowUpRight,
    SearchX
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function AdminEmployeesPage() {
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const data = await getAdminStaffMembers();
            setEmployees(data);
        } catch (error) {
            toast.error("Failed to load global employee data");
        } finally {
            setLoading(false);
        }
    };

    const filteredEmployees = employees.filter(e => 
        e.name.toLowerCase().includes(search.toLowerCase()) || 
        e.email.toLowerCase().includes(search.toLowerCase()) ||
        e.displayId.toLowerCase().includes(search.toLowerCase()) ||
        e.owner?.name?.toLowerCase().includes(search.toLowerCase()) ||
        e.owner?.email?.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse font-medium">Scanning platform staff...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-4xl font-black bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent">
                    Employee Hub
                </h1>
                <p className="text-muted-foreground mt-1 font-medium italic">
                    Platform-wide visibility of all owner-managed staff members.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="md:col-span-1 bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/20 border-2 rounded-2xl shadow-xl h-fit sticky top-20">
                    <CardHeader>
                        <CardTitle className="text-xl font-black flex items-center gap-2">
                            <Search className="h-5 w-5 text-primary" /> Search Hub
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative">
                            <Input 
                                placeholder="Search everything..." 
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="bg-white/50 backdrop-blur-md rounded-xl pl-10 h-12 border-2 focus-visible:ring-primary"
                            />
                            <Search className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="pt-4 space-y-3">
                            <div className="flex justify-between items-center bg-white/40 p-4 rounded-xl border border-primary/10 shadow-sm">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Staff</span>
                                <span className="text-2xl font-black text-primary">{employees.length}</span>
                            </div>
                            <div className="flex justify-between items-center bg-white/40 p-4 rounded-xl border border-primary/10 shadow-sm">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Hubs</span>
                                <span className="text-2xl font-black text-purple-600">{new Set(employees.map(e => e.ownerId)).size}</span>
                            </div>
                        </div>
                        <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                            <p className="text-[10px] font-bold text-muted-foreground italic leading-relaxed">
                                Note: Admin can only view employee records. Management actions are restricted to the respective owners.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <div className="md:col-span-3 space-y-4">
                    {filteredEmployees.length === 0 ? (
                        <div className="bg-muted/20 border-2 border-dashed rounded-3xl p-16 text-center">
                            <div className="bg-muted inline-flex p-6 rounded-full mb-4">
                                <SearchX className="h-12 w-12 text-muted-foreground" />
                            </div>
                            <h3 className="text-2xl font-black">No global staff records found</h3>
                            <p className="text-muted-foreground italic font-medium mt-1">Try searching for a name, email, or a specific OWN-EMP ID.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {filteredEmployees.map((emp) => (
                                <Card key={emp.id} className="group overflow-hidden rounded-3xl border-2 border-muted hover:border-primary/40 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 bg-white/80 backdrop-blur-sm">
                                    <div className="flex flex-col md:flex-row p-6 items-start gap-8">
                                        <div className="relative shrink-0">
                                            <div className="bg-gradient-to-tr from-primary/10 to-purple-500/10 h-20 w-20 rounded-3xl flex items-center justify-center font-black text-3xl text-primary border-2 border-primary/5 group-hover:scale-105 transition-transform">
                                                {emp.name.charAt(0)}
                                            </div>
                                            <div className={`absolute -bottom-1 -right-1 h-7 w-7 rounded-full border-4 border-white flex items-center justify-center shadow-md ${emp.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'}`}>
                                                {emp.status === 'ACTIVE' ? <UserCheck className="h-3.5 w-3.5 text-white" /> : <Shield className="h-3.5 w-3.5 text-white" />}
                                            </div>
                                        </div>
                                        
                                        <div className="flex-1 space-y-4">
                                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                                <div>
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <h3 className="text-2xl font-black tracking-tight">{emp.name}</h3>
                                                        <span className="font-mono text-[11px] bg-primary/10 text-primary px-3 py-1 rounded-lg border-2 border-primary/10 font-black tracking-widest uppercase shadow-sm">ID: {emp.displayId}</span>
                                                        <Badge variant={emp.status === 'ACTIVE' ? 'default' : 'destructive'} className="font-black h-6 px-3 rounded-full text-[10px] uppercase">
                                                            {emp.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm font-bold text-purple-600 italic mt-1">
                                                        <Shield className="h-4 w-4" /> {emp.role}
                                                    </div>
                                                </div>
                                                <div className="bg-muted/50 p-3 rounded-2xl border flex flex-col items-center min-w-[150px]">
                                                    <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest mb-1">Affiliated Owner</p>
                                                    <p className="font-black text-sm">{emp.owner?.name || 'Unknown'}</p>
                                                    <p className="text-[10px] italic font-medium text-muted-foreground">{emp.owner?.email}</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4 border-t border-muted/50">
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest flex items-center gap-2">
                                                        <Mail className="h-3 w-3" /> Contact Details
                                                    </p>
                                                    <div className="text-sm font-bold space-y-1">
                                                        <p className="text-muted-foreground hover:text-foreground transition-colors truncate">{emp.email}</p>
                                                        <p className="text-muted-foreground hover:text-foreground transition-colors">{emp.phone}</p>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest flex items-center gap-2">
                                                        <Building className="h-3 w-3" /> Property Access ({emp.assignments?.length || 0})
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {emp.assignments?.length > 0 ? (
                                                            emp.assignments.map((a: any) => (
                                                                <Badge key={a.id} variant="secondary" className="bg-white border-2 border-muted text-[10px] font-black rounded-lg px-2 py-0.5 shadow-sm">
                                                                    🏢 {a.property.name}
                                                                </Badge>
                                                            ))
                                                        ) : (
                                                            <span className="text-xs italic font-medium text-muted-foreground/60">No properties assigned to this member</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 w-full md:w-auto self-stretch justify-center">
                                            <Link href={`/dashboard/admin/users?search=${emp.owner?.email}`} className="group/btn">
                                                <Button variant="outline" className="w-full text-[10px] font-black uppercase tracking-widest gap-2 hover:bg-primary/5 hover:text-primary rounded-2xl h-12 border-2 px-6">
                                                    Manage Owner <ArrowUpRight className="h-4 w-4 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
