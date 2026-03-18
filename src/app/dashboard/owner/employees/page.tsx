"use client";

import { useEffect, useState } from "react";
import { 
    getOwnerEmployees, 
    createOwnerEmployee, 
    updateOwnerEmployee, 
    assignEmployeeToProperty, 
    removeEmployeeFromProperty 
} from "@/actions/employees";
import { getProperties } from "@/actions/properties";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
    Plus, 
    User, 
    Mail, 
    Phone, 
    Shield, 
    Building, 
    CheckCircle2, 
    XCircle,
    Trash2,
    Link as LinkIcon,
    Unlink,
    UserCircle,
    Search,
    Loader2
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function OwnerEmployeesPage() {
    const [employees, setEmployees] = useState<any[]>([]);
    const [properties, setProperties] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newEmp, setNewEmp] = useState({ 
        name: "", 
        email: "", 
        phone: "", 
        role: "Staff",
        pincode: "",
        city: "",
        state: "",
        postOffice: "",
        address: ""
    });
    const [pincodeLoading, setPincodeLoading] = useState(false);
    
    const [selectedEmp, setSelectedEmp] = useState<any>(null);
    const [isAssignOpen, setIsAssignOpen] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const handlePincodeChange = async (pin: string) => {
        setNewEmp(prev => ({ ...prev, pincode: pin }));
        if (pin.length === 6 && /^\d{6}$/.test(pin)) {
            setPincodeLoading(true);
            try {
                const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
                const data = await res.json();
                if (data && data[0] && data[0].Status === "Success") {
                    const first = data[0].PostOffice[0];
                    setNewEmp(prev => ({
                        ...prev,
                        city: first.District,
                        state: first.State,
                        postOffice: first.Name,
                        address: prev.address || first.Name,
                    }));
                }
            } catch (error) {
                console.error("Pincode fetch error:", error);
            } finally {
                setPincodeLoading(false);
            }
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [empData, propData] = await Promise.all([
                getOwnerEmployees(),
                getProperties()
            ]);
            setEmployees(empData);
            setProperties(propData);
        } catch (error) {
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newEmp.name || !newEmp.email || !newEmp.phone || !newEmp.pincode || !newEmp.address) {
            toast.error("Please fill all fields, including address and pincode");
            return;
        }
        try {
            await createOwnerEmployee(newEmp);
            toast.success("Employee added successfully");
            setIsAddOpen(false);
            setNewEmp({ 
                name: "", 
                email: "", 
                phone: "", 
                role: "Staff",
                pincode: "",
                city: "",
                state: "",
                postOffice: "",
                address: ""
            });
            fetchData();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const toggleStatus = async (employee: any) => {
        const newStatus = employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
        try {
            await updateOwnerEmployee(employee.id, { status: newStatus });
            toast.success(`Employee ${newStatus.toLowerCase()}d`);
            fetchData();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleAssignment = async (propertyId: string, isAssigned: boolean) => {
        try {
            if (isAssigned) {
                await removeEmployeeFromProperty(selectedEmp.id, propertyId);
                toast.success("Property unassigned");
            } else {
                await assignEmployeeToProperty(selectedEmp.id, propertyId);
                toast.success("Property assigned");
            }
            fetchData();
            // Refresh local selectedEmp too
            const updated = await getOwnerEmployees();
            const reSelected = updated.find((e: any) => e.id === selectedEmp.id);
            if (reSelected) {
                setSelectedEmp(reSelected);
            }
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const filteredEmployees = employees.filter(e => 
        e.name.toLowerCase().includes(search.toLowerCase()) || 
        e.email.toLowerCase().includes(search.toLowerCase()) ||
        e.displayId.toLowerCase().includes(search.toLowerCase())
    );

    if (loading && employees.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse font-medium">Loading your team...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent">
                        Staff Members
                    </h1>
                    <p className="text-muted-foreground mt-1 font-medium italic">
                        Manage your property staff and their access restrictions.
                    </p>
                </div>
                
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 h-12 px-6 rounded-xl font-bold gap-2">
                            <Plus className="h-5 w-5" /> Add New Staff
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px] rounded-3xl border-2 border-primary/10 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black">Register New Employee</DialogTitle>
                            <DialogDescription className="font-medium italic">
                                Fill in details to create a unique OWN-EMP ID.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-6 py-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground px-1">Full Name</label>
                                <div className="relative group">
                                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input 
                                        className="pl-10 h-12 rounded-xl focus:ring-primary" 
                                        placeholder="Ramesh Kumar" 
                                        value={newEmp.name}
                                        onChange={e => setNewEmp({...newEmp, name: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground px-1">Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input 
                                        type="email"
                                        className="pl-10 h-12 rounded-xl focus:ring-primary" 
                                        placeholder="ramesh@example.com" 
                                        value={newEmp.email}
                                        onChange={e => setNewEmp({...newEmp, email: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground px-1">Phone Number</label>
                                    <div className="relative group">
                                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <Input 
                                            className="pl-10 h-12 rounded-xl focus:ring-primary" 
                                            placeholder="9123456789" 
                                            value={newEmp.phone}
                                            onChange={e => setNewEmp({...newEmp, phone: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground px-1">Designated Role</label>
                                    <div className="relative group">
                                        <Shield className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <Input 
                                            className="pl-10 h-12 rounded-xl focus:ring-primary" 
                                            placeholder="Manager" 
                                            value={newEmp.role}
                                            onChange={e => setNewEmp({...newEmp, role: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-2">
                                        Pincode
                                        {pincodeLoading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                                    </label>
                                    <Input 
                                        className="h-12 rounded-xl focus:ring-primary font-mono tracking-wider" 
                                        placeholder="6 digits" 
                                        value={newEmp.pincode}
                                        maxLength={6}
                                        onChange={e => handlePincodeChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    />
                                    {newEmp.city && newEmp.state && (
                                        <p className="text-[10px] text-green-600 font-bold px-1 animate-in fade-in">
                                            ✅ {newEmp.postOffice}, {newEmp.city}, {newEmp.state}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground px-1">Staff Address</label>
                                    <Input 
                                        className="h-12 rounded-xl focus:ring-primary" 
                                        placeholder="House No, Street, Landmark" 
                                        value={newEmp.address}
                                        onChange={e => setNewEmp({...newEmp, address: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="pt-4">
                            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl h-11">Cancel</Button>
                            <Button onClick={handleAdd} className="rounded-xl h-11 px-8 font-bold">Register Staff</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="md:col-span-1 bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/20 border-2 rounded-2xl shadow-xl h-fit">
                    <CardHeader>
                        <CardTitle className="text-xl font-black flex items-center gap-2">
                            <Search className="h-5 w-5 text-primary" /> Filter Team
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative">
                            <Input 
                                placeholder="Search by name, ID..." 
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="bg-white/50 backdrop-blur-md rounded-xl pl-10"
                            />
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="pt-4 space-y-2">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">
                                <span>Total Staff</span>
                                <span>{employees.length}</span>
                            </div>
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-primary transition-all duration-500" 
                                    style={{ width: `${(employees.filter(e => e.status === 'ACTIVE').length / (employees.length || 1)) * 100}%` }} 
                                />
                            </div>
                            <div className="flex justify-between text-[10px] font-black italic px-2">
                                <span className="text-green-600 uppercase tracking-tighter">{employees.filter(e => e.status === 'ACTIVE').length} Active</span>
                                <span className="text-red-600 uppercase tracking-tighter">{employees.filter(e => e.status === 'INACTIVE').length} Inactive</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="md:col-span-3 space-y-4">
                    {filteredEmployees.length === 0 ? (
                        <div className="bg-muted/30 border-2 border-dashed rounded-3xl p-12 text-center">
                            <div className="bg-muted inline-flex p-6 rounded-full mb-4">
                                <UserCircle className="h-12 w-12 text-muted-foreground" />
                            </div>
                            <h3 className="text-xl font-black">No team members found</h3>
                            <p className="text-muted-foreground italic font-medium mt-1">Try a different search or add a new staff member.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {filteredEmployees.map((emp) => (
                                <Card key={emp.id} className="group overflow-hidden rounded-2xl border-2 border-muted hover:border-primary/30 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5">
                                    <div className="flex flex-col md:flex-row p-6 items-start md:items-center gap-6">
                                        <div className="bg-gradient-to-tr from-primary/10 to-purple-500/10 h-16 w-16 rounded-2xl flex items-center justify-center font-black text-2xl text-primary border-2 border-primary/5 group-hover:rotate-6 transition-transform">
                                            {emp.name.charAt(0)}
                                        </div>
                                        
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-xl font-black tracking-tight">{emp.name}</h3>
                                                <Badge className={emp.status === 'ACTIVE' ? "bg-green-100 text-green-700 hover:bg-green-100 border-green-200" : "bg-red-50 text-red-600 border-red-100"}>
                                                    {emp.status}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-medium italic text-muted-foreground">
                                                <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> {emp.role}</span>
                                                <span className="flex items-center gap-1.5 font-mono text-primary font-black not-italic tracking-wider uppercase drop-shadow-[0_1px_1px_rgba(0,0,0,0.05)]">🆔 {emp.displayId}</span>
                                                <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {emp.phone}</span>
                                                <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-xs truncate max-w-[150px]" /> {emp.email}</span>
                                                {(emp.address || emp.pincode) && (
                                                    <span className="flex items-center gap-1.5 text-xs font-bold text-primary/80">
                                                        📍 {emp.address} {emp.pincode ? `(${emp.pincode})` : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto mt-4 md:mt-0">
                                            <Dialog open={isAssignOpen && selectedEmp?.id === emp.id} onOpenChange={(open) => {
                                                setIsAssignOpen(open);
                                                if(open) setSelectedEmp(emp);
                                            }}>
                                                <DialogTrigger asChild>
                                                    <Button variant="outline" className="flex-1 md:flex-none h-11 font-black italic tracking-tight rounded-xl gap-2 border-primary/20 hover:bg-primary/5">
                                                        <Building className="h-4 w-4 text-primary" /> 
                                                        Assignments ({emp.assignments?.length || 0})
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="sm:max-w-[500px] rounded-3xl border-2 border-primary/10 shadow-2xl">
                                                    <DialogHeader>
                                                        <DialogTitle className="text-2xl font-black">Property Permissions</DialogTitle>
                                                        <DialogDescription className="font-medium italic text-muted-foreground">
                                                            Control which properties <span className="text-primary font-black not-italic">{emp.name}</span> can access.
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="py-4 space-y-4 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                                                        {properties.length === 0 ? (
                                                            <div className="bg-muted/30 p-8 text-center rounded-2xl italic font-medium text-muted-foreground">
                                                                No properties found. Add properties first!
                                                            </div>
                                                        ) : (
                                                            properties.map(prop => {
                                                                const isAssigned = emp.assignments?.some((a: any) => a.propertyId === prop.id);
                                                                return (
                                                                    <div key={prop.id} className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-300 ${isAssigned ? 'border-primary/40 bg-primary/5 shadow-inner' : 'border-muted hover:border-muted-foreground/30'}`}>
                                                                        <div className="flex items-center gap-4">
                                                                            <div className={`p-2 rounded-lg shadow-sm transition-colors ${isAssigned ? 'bg-primary text-white' : 'bg-white text-muted-foreground'}`}>
                                                                                <Building className="h-5 w-5" />
                                                                            </div>
                                                                            <div>
                                                                                <p className="font-black text-sm">{prop.name}</p>
                                                                                <p className="text-[10px] italic font-medium text-muted-foreground flex items-center gap-1"><span className="not-italic text-[8px]">📍</span> {prop.city}</p>
                                                                            </div>
                                                                        </div>
                                                                        <Button 
                                                                            size="sm" 
                                                                            variant={isAssigned ? "destructive" : "default"} 
                                                                            className="rounded-lg h-9 px-4 font-bold gap-2 transition-all active:scale-95"
                                                                            onClick={() => handleAssignment(prop.id, isAssigned)}
                                                                        >
                                                                            {isAssigned ? <><Unlink className="h-3.5 w-3.5" /> Revoke</> : <><LinkIcon className="h-3.5 w-3.5" /> Grant</>}
                                                                        </Button>
                                                                    </div>
                                                                )
                                                            })
                                                        )}
                                                    </div>
                                                </DialogContent>
                                            </Dialog>

                                            <Button 
                                                variant="outline" 
                                                className={`flex-1 md:flex-none h-11 font-black italic tracking-tight rounded-xl gap-2 transition-all active:scale-95 ${emp.status === 'ACTIVE' ? 'border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300' : 'border-green-200 text-green-600 hover:bg-green-50 hover:border-green-300'}`}
                                                onClick={() => toggleStatus(emp)}
                                            >
                                                {emp.status === 'ACTIVE' ? <><XCircle className="h-4 w-4" /> Deactivate</> : <><CheckCircle2 className="h-4 w-4" /> Activate</>}
                                            </Button>
                                        </div>
                                    </div>
                                    
                                    {emp.assignments?.length > 0 && (
                                        <div className="bg-muted/10 px-6 py-3 flex items-center gap-3 overflow-x-auto no-scrollbar border-t border-muted-foreground/5">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0 border-r border-muted-foreground/20 pr-3 italic">Authorized In</span>
                                            <div className="flex gap-2 anime-in slide-in-from-left duration-300">
                                                {emp.assignments.map((a: any) => (
                                                    <Badge key={a.id} variant="secondary" className="bg-white/90 border-2 border-primary/5 text-[9px] font-bold shrink-0 rounded-lg px-2 shadow-sm whitespace-nowrap">
                                                        🏢 {a.property.name}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
