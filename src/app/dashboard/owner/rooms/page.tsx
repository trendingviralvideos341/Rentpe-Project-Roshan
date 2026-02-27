"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Edit } from "lucide-react";
import { useEffect, useState } from "react";
import { getRoomsAction } from "@/actions/rooms";

export default function RoomsPage() {
    const [rooms, setRooms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRooms = async () => {
        setLoading(true);
        try {
            const data = await getRoomsAction();
            setRooms(data);
        } catch (error) {
            console.error("Failed to fetch rooms:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRooms();
    }, []);

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading rooms...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Manage Rooms</h1>
                    <p className="text-muted-foreground">Track room occupancy and pricing.</p>
                </div>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Add Room
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {rooms.map((room) => (
                    <Card key={room.id}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Room {room.roomNumber}</CardTitle>
                            <div className={`px-2 py-1 rounded text-xs font-bold ${room.availability > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {room.availability > 0 ? `Available (${room.availability})` : 'Full'}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{room.type}</div>
                            <p className="text-xs text-muted-foreground">₹{room.price.toLocaleString()}/month</p>

                            <div className="mt-4 pt-4 border-t">
                                <p className="text-sm font-medium">Property:</p>
                                <p className="text-sm text-muted-foreground">{room.property?.name}</p>
                            </div>

                            <div className="mt-4 flex space-x-2">
                                <Button variant="outline" size="sm" className="w-full">
                                    <Edit className="h-4 w-4 mr-2" /> Edit (TBD)
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {rooms.length === 0 && (
                    <div className="col-span-full p-8 text-center border-2 border-dashed rounded-xl text-muted-foreground">
                        No rooms listed yet. Add your first room!
                    </div>
                )}
            </div>
        </div>
    );
}
