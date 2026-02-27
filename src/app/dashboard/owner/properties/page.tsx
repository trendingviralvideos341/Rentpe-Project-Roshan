"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, Plus, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getProperties } from "@/actions/properties";
import { getSession } from "@/lib/auth";

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
                    <Card key={property.id} className="overflow-hidden">
                        <div className="h-48 bg-muted relative">
                            {property.images ? (
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
                            <p className="text-sm line-clamp-2 text-muted-foreground mb-4">
                                {property.description}
                            </p>
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-bold">{property.rooms?.length || 0} Rooms</span>
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={`/dashboard/owner/properties/${property.id}`}>Manage</Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
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
