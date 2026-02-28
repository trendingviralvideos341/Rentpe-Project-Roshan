"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPropertyById } from "@/actions/properties";
import { ArrowLeft, Building2, MapPin, BedDouble, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PropertyManagePage() {
    const params = useParams();
    const router = useRouter();
    const propertyId = params.id as string;

    const [property, setProperty] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProperty = async () => {
            try {
                const data = await getPropertyById(propertyId);
                if (!data) {
                    router.push("/dashboard/owner/properties");
                    return;
                }
                setProperty(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchProperty();
    }, [propertyId, router]);

    if (loading) return <div className="p-20 text-center animate-pulse text-muted-foreground">Loading property details...</div>;
    if (!property) return null;

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard/owner/properties"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        {property.name}
                        <Badge variant="secondary" className={`
                            ${property.status === 'LIVE' ? 'bg-green-100 text-green-700' : ''}
                            ${property.status === 'REJECTED' ? 'bg-red-100 text-red-700' : ''}
                            ${property.status === 'PENDING_APPROVAL' ? 'bg-amber-100 text-amber-700' : ''}
                        `}>
                            {property.status.replace('_', ' ')}
                        </Badge>
                    </h1>
                    <p className="text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-4 w-4" /> {property.city}, {property.address}
                    </p>
                </div>
            </div>

            {property.status === 'REJECTED' && property.adminNotes && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg shadow-sm">
                    <h3 className="text-red-800 font-bold mb-2 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" /> Admin Feedback / Corrections Needed
                    </h3>
                    <p className="text-red-700">{property.adminNotes}</p>
                    <div className="mt-4">
                        <Button variant="destructive" size="sm">Edit Property to Resolve Issues</Button>
                    </div>
                </div>
            )}

            <Tabs defaultValue="details">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="details">Property Details</TabsTrigger>
                    <TabsTrigger value="rooms">Rooms ({property.rooms?.length || 0})</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="pt-4 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Description</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="whitespace-pre-wrap">{property.description}</p>

                            <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-4">
                                <div>
                                    <p className="text-sm text-muted-foreground font-semibold uppercase">Amenities</p>
                                    <p className="mt-1">{property.amenities.split(',').join(', ')}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground font-semibold uppercase">Rules</p>
                                    <p className="mt-1">{property.rules}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Photos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {property.images && JSON.parse(property.images).map((img: string, i: number) => (
                                    <div key={i} className="aspect-video bg-muted rounded-md overflow-hidden relative">
                                        <img src={img} alt={`Property image ${i + 1}`} className="object-cover w-full h-full" />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="rooms" className="pt-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Rooms List</CardTitle>
                                <CardDescription>Manage the rooms available in this property.</CardDescription>
                            </div>
                            <Button size="sm"><Building2 className="mr-2 h-4 w-4" /> Add Room</Button>
                        </CardHeader>
                        <CardContent>
                            {property.rooms?.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-lg">
                                    No rooms added yet.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {property.rooms?.map((room: any) => (
                                        <div key={room.id} className="border rounded-md p-4 flex flex-col justify-between">
                                            <div className="flex justify-between items-center mb-4 border-b pb-2">
                                                <span className="font-bold text-lg">Room {room.roomNumber}</span>
                                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{room.type}</Badge>
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <span className="flex items-center gap-1 text-sm font-medium"><BedDouble className="h-4 w-4 text-indigo-500" /> {room.availability} Beds Left</span>
                                                <span className="font-bold text-green-700 text-xl flex items-center gap-1">
                                                    <span className="text-xs text-muted-foreground font-normal">Rent:</span> ₹{room.price}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
