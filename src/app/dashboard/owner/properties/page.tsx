"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, Plus, MapPin, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getProperties } from "@/actions/properties";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { ImageCarousel } from "@/components/ImageCarousel";
import { PropertyStepper } from "@/components/property/PropertyStepper";

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
                                    ) : property.status === 'SUBMITTED' || property.status === 'PENDING_VERIFICATION' ? (
                                        <Badge className="bg-amber-400 text-amber-900 border-2 border-amber-600 hover:bg-amber-500 font-bold">Verification Pending</Badge>
                                    ) : property.status === 'APPROVED' ? (
                                        <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold border-2 border-indigo-800 animate-pulse">Payment Required</Badge>
                                    ) : (
                                        <Badge className="bg-red-600 hover:bg-red-700 text-white font-bold border-2 border-red-800">{property.status === 'INACTIVE' ? 'Inactive' : 'Rejected'}</Badge>
                                    )}
                                </div>
                                {(() => {
                                    const mergedImages: string[] = [];

                                    // 1. Gather Building Photos
                                    if (property.buildingPhotos) {
                                        try {
                                            const photos = JSON.parse(property.buildingPhotos);
                                            photos.forEach((p: any) => {
                                                if (p) mergedImages.push(typeof p === 'string' ? p : p.url);
                                            });
                                        } catch (e) { }
                                    }

                                    // 2. Gather Common Area Photos
                                    if (property.commonAreaPhotos) {
                                        try {
                                            const photos = JSON.parse(property.commonAreaPhotos);
                                            photos.forEach((p: any) => {
                                                if (p) mergedImages.push(typeof p === 'string' ? p : p.url);
                                            });
                                        } catch (e) { }
                                    }

                                    return <ImageCarousel images={mergedImages} alt={property.name} />;
                                })()}
                            </div>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col">
                                        <CardTitle className="text-xl">{property.name}</CardTitle>
                                        <div className="flex items-center text-xs text-muted-foreground mt-1">
                                            <MapPin className="h-3 w-3 mr-1" /> {property.city}
                                        </div>
                                    </div>
                                    {property.displayId && (
                                        <Badge variant="outline" className="text-[10px] bg-slate-50 font-mono font-bold text-slate-500 border-slate-200">
                                            {property.displayId}
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <PropertyStepper status={property.status} adminNotes={property.adminNotes} />

                                {(property.status === 'INACTIVE' || property.status === 'REJECTED' || (property.status === 'PENDING_VERIFICATION' && property.adminNotes?.includes('[REUPLOAD'))) && property.adminNotes && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                                        <p className="text-xs font-bold text-red-800 uppercase mb-2 flex items-center gap-1 border-b border-red-200 pb-1">
                                            <AlertCircle className="h-4 w-4" /> Admin Feedback / Action Required
                                        </p>
                                        <div className="text-sm text-red-700 space-y-1">
                                            {property.adminNotes.split('\n').map((line: string, i: number) => {
                                                if (line.includes('[REUPLOAD:')) {
                                                    // Parse readable category from the tag
                                                    const tagMatch = line.match(/\[REUPLOAD:([a-zA-Z0-9-]+)\]/);
                                                    let prefix = "Document Reupload";
                                                    if (tagMatch && tagMatch[1]) {
                                                        const rawKey = tagMatch[1].split('-')[0];
                                                        const mapping: Record<string, string> = {
                                                            buildingPhotos: "Building Photos",
                                                            commonAreaPhotos: "Common Area",
                                                            bathroomPhoto: "Bathroom",
                                                            parkingPhoto: "Parking",
                                                            aadhaarProof: "Aadhaar",
                                                            panProof: "PAN Card",
                                                            pgLicenceUrl: "PG Licence"
                                                        };
                                                        prefix = mapping[rawKey] || rawKey;
                                                    }
                                                    const cleanText = line.replace(/\[REUPLOAD:[a-zA-Z0-9-]+\]/g, '').trim();
                                                    if (!cleanText) return null;
                                                    return (
                                                        <div key={i} className="flex gap-2">
                                                            <span className="font-bold shrink-0">{prefix}:</span>
                                                            <span>{cleanText}</span>
                                                        </div>
                                                    );
                                                }
                                                return <div key={i}>{line}</div>;
                                            })}
                                        </div>
                                    </div>
                                )}
                                <p className="text-sm line-clamp-2 text-muted-foreground mb-4">
                                    {property.description}
                                </p>
                                <div className="flex justify-between items-center text-sm pt-2 border-t mt-4">
                                    <span className="font-bold flex items-center gap-1"><Building className="h-4 w-4 text-purple-600" /> {property.rooms?.length || 0} Rooms</span>
                                    <div className="flex items-center gap-2">
                                        {property.status === 'APPROVED' && (
                                            <Button variant="default" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase text-[10px] h-7 px-3" asChild>
                                                <Link href={`/dashboard/owner/pay-onboarding/${property.id}`}>Pay Onboarding Fee</Link>
                                            </Button>
                                        )}
                                        {(property.adminNotes?.includes('[REUPLOAD') && property.status !== 'LIVE' && property.status !== 'APPROVED') && (
                                            <Badge variant="outline" className="text-[10px] uppercase font-bold text-red-600 border-red-300 bg-red-100 animate-pulse shadow-sm px-2 py-0.5">
                                                Action Required
                                            </Badge>
                                        )}
                                        <span className="text-indigo-600 font-bold text-xs uppercase bg-indigo-50 px-3 py-1.5 rounded-md hover:bg-indigo-600 hover:text-white transition-all flex items-center shadow-sm">
                                            View Details &rarr;
                                        </span>
                                    </div>
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
        </div >
    );
}
