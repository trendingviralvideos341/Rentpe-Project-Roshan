"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, MapPin, Wifi, Droplets, Zap, Shield, Building } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createBooking } from "@/actions/bookings";
import { getPropertyById } from "@/actions/properties";
import { Input } from "@/components/ui/input";

const OCCUPATION_TYPES = ["Student", "Working Professional", "Other"];

// ── Input helpers ──
const onlyLetters = (v: string) => v.replace(/[^a-zA-Z\s]/g, "");
const onlyDigits = (v: string) => v.replace(/[^0-9]/g, "");
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default function PropertyDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();
    const [property, setProperty] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [bookingLoading, setBookingLoading] = useState(false);

    const [formData, setFormData] = useState({
        firstName: "",
        middleName: "",
        lastName: "",
        moveInDate: "",
        email: "",
        phone: "",
        occupationType: "",
        occupationDetail: "",
    });

    useEffect(() => {
        const fetchProperty = async () => {
            try {
                const data = await getPropertyById(id);
                if (data) {
                    setProperty({
                        ...data,
                        amenities: JSON.parse(data.amenities || "[]"),
                        images: JSON.parse(data.images || "[]")
                    });
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchProperty();
    }, [id]);

    const handleBooking = async () => {
        if (!formData.firstName || !formData.lastName || !formData.moveInDate) {
            alert("Please fill in First Name, Last Name and Move-in Date.");
            return;
        }
        if (!formData.email || !isValidEmail(formData.email)) {
            alert("Please enter a valid Email address (e.g. name@example.com).");
            return;
        }
        if (!formData.phone || formData.phone.length !== 10) {
            alert("Please enter a valid 10-digit Phone Number.");
            return;
        }
        if (!formData.occupationType) {
            alert("Please select your Occupation Type (Student / Working Professional / Other).");
            return;
        }
        if (!formData.occupationDetail.trim()) {
            alert(
                formData.occupationType === "Student"
                    ? "Please enter your College / University name."
                    : formData.occupationType === "Working Professional"
                        ? "Please enter your Company name."
                        : "Please specify your occupation."
            );
            return;
        }

        setBookingLoading(true);
        try {
            const selectEl = document.querySelector("select") as HTMLSelectElement;
            const occupancyFull = selectEl?.value || "Triple Sharing - ₹12,000";
            const occupancy = occupancyFull.split(" - ")[0];
            const amount = occupancyFull.split(" - ")[1] || "₹0";

            await createBooking({
                propertyName: property.name,
                guestName: `${formData.firstName} ${formData.middleName} ${formData.lastName}`.replace(/\s+/g, ' ').trim(),
                occupancy,
                moveInDate: formData.moveInDate,
                amount,
                guestEmail: formData.email,
                guestPhone: `+91${formData.phone}`,
                occupationType: formData.occupationType,
                occupationDetail: formData.occupationDetail,
            });

            router.push("/booking/requested");
        } catch (e: any) {
            if (e.message.includes("logged in")) {
                router.push("/login");
            } else {
                alert("Booking failed. Please try again.");
            }
        } finally {
            setBookingLoading(false);
        }
    };

    if (loading) return <div className="p-20 text-center animate-pulse">Loading property details...</div>;
    if (!property) return <div className="p-20 text-center">Property not found.</div>;

    const mainImage = property.images[0] || "";
    const otherImages = property.images.slice(1, 4);

    return (
        <div className="container mx-auto max-w-6xl py-8 px-4">
            {/* Image Gallery */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[400px] mb-8 rounded-xl overflow-hidden bg-muted">
                {mainImage ? (
                    <img src={mainImage} className="w-full h-full object-cover" alt={property.name} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Building className="h-20 w-20 text-muted-foreground/30" />
                    </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                    {otherImages.map((img: string, i: number) => (
                        <img key={i} src={img} className="w-full h-full object-cover" alt={`${property.name} ${i + 2}`} />
                    ))}
                    {property.images.length > 4 && (
                        <div className="relative">
                            <img src={property.images[4]} className="w-full h-full object-cover" alt="More" />
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-xl cursor-pointer hover:bg-black/40">
                                +{property.images.length - 4} More
                            </div>
                        </div>
                    )}
                    {property.images.length < 4 && [1, 2, 3].slice(0, 4 - property.images.length).map(i => (
                        <div key={i} className="bg-muted-foreground/10 flex items-center justify-center">
                            <Building className="h-8 w-8 text-muted-foreground/20" />
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Content */}
                <div className="md:col-span-2 space-y-8">
                    <div>
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-3xl font-bold">{property.name}</h1>
                                <div className="flex items-center text-muted-foreground mt-2">
                                    <MapPin className="h-4 w-4 mr-1" /> {property.city}, {property.address}
                                </div>
                                <p className="mt-4 text-muted-foreground leading-relaxed">
                                    {property.description || "No description provided for this property."}
                                </p>
                            </div>
                            <div className="flex flex-col items-end">
                                <div className="flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full font-bold">
                                    <Star className="h-4 w-4 mr-1 fill-green-800" /> 4.5
                                </div>
                                <span className="text-sm text-muted-foreground mt-1">Managed by {property.owner?.name || "Verified Owner"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Amenities */}
                    <div>
                        <h2 className="text-xl font-bold mb-4">Amenities</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {property.amenities.map((name: string) => (
                                <div key={name} className="flex items-center space-x-2 border p-3 rounded-lg">
                                    <div className="bg-primary/10 p-1.5 rounded text-primary">
                                        {name.toLowerCase().includes('wifi') ? <Wifi className="h-4 w-4" /> :
                                            name.toLowerCase().includes('water') ? <Droplets className="h-4 w-4" /> :
                                                name.toLowerCase().includes('power') ? <Zap className="h-4 w-4" /> :
                                                    <Shield className="h-4 w-4" />}
                                    </div>
                                    <span className="text-sm font-medium">{name}</span>
                                </div>
                            ))}
                            {property.amenities.length === 0 && (
                                <p className="text-sm text-muted-foreground col-span-full">Information about amenities will be provided during visit.</p>
                            )}
                        </div>
                    </div>

                    {/* Food Menu */}
                    <div>
                        <h2 className="text-xl font-bold mb-4">Weekly Food Menu</h2>
                        <Card>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted">
                                            <tr>
                                                <th className="p-3 text-left">Day</th>
                                                <th className="p-3 text-left">Breakfast</th>
                                                <th className="p-3 text-left">Lunch</th>
                                                <th className="p-3 text-left">Dinner</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                                                const dayMenu = property.foodMenu.filter((m: any) => m.dayOfWeek === day);
                                                return (
                                                    <tr key={day} className="border-b">
                                                        <td className="p-3 font-medium">{day}</td>
                                                        <td className="p-3">{dayMenu.find((m: any) => m.mealType === 'Breakfast')?.items || "-"}</td>
                                                        <td className="p-3">{dayMenu.find((m: any) => m.mealType === 'Lunch')?.items || "-"}</td>
                                                        <td className="p-3">{dayMenu.find((m: any) => m.mealType === 'Dinner')?.items || "-"}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Right Booking Card */}
                <div className="md:col-span-1">
                    <Card className="sticky top-24">
                        <CardHeader>
                            <CardTitle>Book your stay</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {/* Room prices */}
                            <div>
                                {Object.values(
                                    property.rooms.reduce((acc: any, room: any) => {
                                        if (!acc[room.type]) acc[room.type] = room;
                                        return acc;
                                    }, {})
                                ).map((room: any) => (
                                    <div key={room.type} className="flex justify-between items-center mb-2">
                                        <span className="font-medium">{room.type} Room</span>
                                        <span className="font-bold text-lg">₹{room.price.toLocaleString()}/mo</span>
                                    </div>
                                ))}
                                {property.rooms.length === 0 && (
                                    <p className="text-sm text-muted-foreground">No rooms listed yet.</p>
                                )}
                            </div>

                            {/* Occupancy select */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Select Occupancy</label>
                                <select className="w-full border rounded-md p-2 bg-background">
                                    {Object.values(
                                        property.rooms.reduce((acc: any, room: any) => {
                                            if (!acc[room.type]) acc[room.type] = room;
                                            return acc;
                                        }, {})
                                    ).map((room: any) => (
                                        <option key={room.type} value={`${room.type} - ₹${room.price.toLocaleString()}`}>
                                            {room.type} - ₹{room.price.toLocaleString()}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Guest Name — letters only */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Full Name (As per ID) <span className="text-red-500">*</span></label>
                                <div className="grid grid-cols-3 gap-2">
                                    <Input placeholder="First" required value={formData.firstName}
                                        onChange={e => setFormData(p => ({ ...p, firstName: onlyLetters(e.target.value) }))} />
                                    <Input placeholder="Middle" value={formData.middleName}
                                        onChange={e => setFormData(p => ({ ...p, middleName: onlyLetters(e.target.value) }))} />
                                    <Input placeholder="Last" required value={formData.lastName}
                                        onChange={e => setFormData(p => ({ ...p, lastName: onlyLetters(e.target.value) }))} />
                                </div>
                            </div>

                            {/* Email & Phone with +91 */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Contact Details <span className="text-red-500">*</span></label>
                                <Input type="email" placeholder="📧 Email for communication" value={formData.email}
                                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
                                <div className="flex">
                                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 bg-muted text-sm font-semibold text-muted-foreground select-none">
                                        🇮🇳 +91
                                    </span>
                                    <Input
                                        type="tel"
                                        placeholder="10-digit mobile number"
                                        className="rounded-l-none"
                                        maxLength={10}
                                        value={formData.phone}
                                        onChange={e => setFormData(p => ({ ...p, phone: onlyDigits(e.target.value).slice(0, 10) }))}
                                    />
                                </div>
                                {formData.phone.length > 0 && formData.phone.length < 10 && (
                                    <p className="text-[11px] text-red-500">Enter a valid 10-digit number ({10 - formData.phone.length} more digits needed)</p>
                                )}
                            </div>

                            {/* Occupation */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Occupation <span className="text-red-500">*</span></label>
                                <div className="flex gap-2 flex-wrap">
                                    {OCCUPATION_TYPES.map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setFormData(p => ({ ...p, occupationType: type, occupationDetail: "" }))}
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${formData.occupationType === type
                                                ? "bg-blue-600 text-white border-blue-600"
                                                : "border-gray-300 text-gray-600 hover:border-blue-400"}`}
                                        >
                                            {type === "Student" ? "🎓 Student" : type === "Working Professional" ? "💼 Working Pro" : "👤 Other"}
                                        </button>
                                    ))}
                                </div>
                                {formData.occupationType && (
                                    <Input
                                        placeholder={
                                            formData.occupationType === "Student" ? "College / University name" :
                                                formData.occupationType === "Working Professional" ? "Company name" :
                                                    "Specify your occupation"
                                        }
                                        value={formData.occupationDetail}
                                        onChange={e => setFormData(p => ({ ...p, occupationDetail: e.target.value }))}
                                    />
                                )}
                            </div>

                            {/* Move-in date */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Preferred Move-in Date <span className="text-red-500">*</span></label>
                                <Input type="date" required value={formData.moveInDate} onChange={e => setFormData(p => ({ ...p, moveInDate: e.target.value }))} />
                            </div>

                            <div className="bg-yellow-50 p-3 rounded text-xs text-yellow-800 border border-yellow-200">
                                <strong>No Payment Required Now.</strong>
                                <p className="mt-1">You only pay after the owner approves your request and allocates a room. Secure your spot today for free!</p>
                            </div>

                            <Button
                                className="w-full text-lg h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold shadow-lg"
                                onClick={handleBooking}
                                disabled={bookingLoading || property.rooms.length === 0}
                            >
                                {bookingLoading ? "Processing..." : "🚀 Request Booking"}
                            </Button>
                            <p className="text-xs text-center text-muted-foreground">Fastest booking experience. No hidden charges.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
