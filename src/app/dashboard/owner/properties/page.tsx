"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, Plus, MapPin, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getProperties } from "@/actions/properties";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

export default function OwnerPropertiesPage() {
    const [properties, setProperties] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchProperties = async () => {
        setLoading(true);
        try {
            const data = await getProperties();
            setProperties(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProperties();
    }, []);

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading properties...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">My Properties</h1>
                    <p className="text-muted-foreground">Manage your PG listings and details.</p>
                </div>
                <Link href="/dashboard/owner/properties/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Add Property
                    </Button>
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {properties.map((property) => (
                    <Link href={`/dashboard/owner/properties/${property.id}`} key={property.id} className="group block focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-xl transition-all hover:scale-[1.02]">
                        <Card className="overflow-hidden h-full border-2 hover:border-purple-300 transition-colors shadow-sm hover:shadow-md cursor-pointer">
                            <div className="h-48 bg-muted relative">
                                <div className="absolute top-2 right-2 z-10 shadow-md">
                                    {property.status === 'LIVE' ? (
                                        <Badge className="bg-green-600 hover:bg-green-700 text-white font-bold border-2 border-green-800">Live</Badge>
                                    ) : property.status === 'PENDING_APPROVAL' ? (
                                        <Badge className="bg-amber-400 text-amber-900 border-2 border-amber-600 hover:bg-amber-500 font-bold">Pending Approval</Badge>
                                    ) : (
                                        <Badge className="bg-red-600 hover:bg-red-700 text-white font-bold border-2 border-red-800">Rejected</Badge>
                                    )}
                                </div>
                                {property.images && JSON.parse(property.images).length > 0 ? (
                                    <img
                                        src={JSON.parse(property.images)[0]}
                                        alt={property.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Building className="h-12 w-12 text-muted-foreground" />
                                    </div>
                                )}
                            </div>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xl">{property.name}</CardTitle>
                                <div className="flex items-center text-sm text-muted-foreground">
                                    <MapPin className="h-3 w-3 mr-1" /> {property.city}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {property.status === 'REJECTED' && property.adminNotes && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                                        <p className="text-xs font-bold text-red-800 uppercase mb-1 flex items-center gap-1">
                                            <AlertCircle className="h-4 w-4" /> Admin Feedback / Action Required
                                        </p>
                                        <p className="text-sm text-red-700">{property.adminNotes}</p>
                                    </div>
                                )}
                                <p className="text-sm line-clamp-2 text-muted-foreground mb-4">
                                    {property.description}
                                </p>
                                <div className="flex justify-between items-center text-sm pt-2 border-t mt-4">
                                    <span className="font-bold flex items-center gap-1"><Building className="h-4 w-4 text-purple-600" /> {property.rooms?.length || 0} Rooms</span>
                                    <span className="text-purple-600 font-semibold text-xs uppercase hover:underline flex items-center">View Details &rarr;</span>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
                {properties.length === 0 && (
                    <div className="col-span-full p-12 text-center border-2 border-dashed rounded-xl text-muted-foreground">
                        No properties listed yet. Start by adding your first one!
                    </div>
                )}
            </div>
        </div>
    );
}
