"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, MapPin, Wifi, Droplets, Zap, Shield, Building } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createBooking } from "@/actions/bookings";
import { getPropertyById } from "@/actions/properties";
import { getReviewsForProperty } from "@/actions/reviews";
import { Input } from "@/components/ui/input";
import { validateEmail, validatePhone, validateName } from "@/lib/validators";
import { formatDistanceToNow } from "date-fns";
import { getCurrentUser } from "@/actions/auth";
import { ImageCarousel } from "@/components/ImageCarousel";

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
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [bookingLoading, setBookingLoading] = useState(false);

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [formData, setFormData] = useState({
        guestName: "",
        guestEmail: "",
        guestPhone: "",
        moveInDate: "",
        stayDuration: "6",
        occupants: "1",
        message: "",
        occupationType: "",
        occupationDetail: "",
    });
    const [foodSelected, setFoodSelected] = useState<boolean | null>(null); // null = not yet chosen (only for OPTIONAL)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchUser = async () => {
            const user = await getCurrentUser();
            setCurrentUser(user);
            if (user) {
                setFormData(prev => ({
                    ...prev,
                    guestName: user.name || "",
                    guestEmail: user.email || "",
                    guestPhone: (user.phone || "").replace("+91", ""),
                }));
            }
        };
        fetchUser();
    }, []);

    useEffect(() => {
        const fetchProperty = async () => {
            try {
                const data = await getPropertyById(id);
                if (data) {
                    const allImages: string[] = [];
                    const categories = [
                        'buildingPhotos',
                        'commonAreaPhotos',
                        'roomsAndBathroomPhotos',
                        'parkingPhotos',
                        'amenitiesPhotos'
                    ];

                    (categories as (keyof typeof data)[]).forEach(catKey => {
                        const val = data[catKey];
                        if (val && typeof val === 'string') {
                            try {
                                const parsed = JSON.parse(val);
                                if (Array.isArray(parsed)) {
                                    parsed.forEach((p: any) => { 
                                        if (p) allImages.push(typeof p === 'string' ? p : p.url); 
                                    });
                                } else if (typeof parsed === 'string') {
                                    allImages.push(parsed);
                                }
                            } catch (e) { }
                        }
                    });

                    setProperty({
                        ...data,
                        amenities: JSON.parse(data.amenities || "[]"),
                        images: allImages
                    });

                    // Fetch associated reviews
                    const reviewData = await getReviewsForProperty(id);
                    setReviews(reviewData || []);
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
        const errs: Record<string, string> = {};
        if (!formData.moveInDate) errs.moveInDate = "Move-in date is required";
        if (!formData.occupationType) errs.occupationType = "Occupation type is required";
        if (!formData.occupationDetail.trim()) errs.occupationDetail = "Occupation detail is required";

        if (Object.keys(errs).length > 0) {
            setFieldErrors(errs);
            return;
        }
        setFieldErrors({});

        setBookingLoading(true);
        try {
            const selectEl = document.querySelector("select") as HTMLSelectElement;
            const occupancyFull = selectEl?.value || "Triple Sharing - ₹12,000";
            const occupancy = occupancyFull.split(" - ")[0];
            const baseAmount = Number(occupancyFull.split(" - ")[1]?.replace(/[^0-9.]/g, '') || "0");
            
            await createBooking({
                propertyName: property.name,
                propertyId: property.id,
                guestName: formData.guestName,
                occupancy,
                moveInDate: formData.moveInDate,
                stayDuration: 6,
                occupants: 1,
                message: formData.message,
                amount: baseAmount,
                guestEmail: formData.guestEmail,
                guestPhone: `+91${formData.guestPhone}`,
                occupationType: formData.occupationType,
                occupationDetail: formData.occupationDetail,
            } as any);

            router.push("/booking/requested");
        } catch (e: any) {
            if (e.message.includes("logged in")) {
                router.push("/login?redirect=" + encodeURIComponent(window.location.pathname));
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
            {/* Image Gallery Header */}
            <div className="h-[400px] md:h-[500px] mb-8 rounded-xl overflow-hidden bg-muted shadow-lg border">
                <ImageCarousel images={property.images} alt={property.name} />
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
                                    <Star className="h-4 w-4 mr-1 fill-green-800" /> {property.averageRating > 0 ? property.averageRating : "New"}
                                </div>
                                <span className="text-sm text-muted-foreground mt-1 text-right">
                                    {property.reviewCount > 0 ? `(${property.reviewCount} Verified Reviews)` : "No reviews yet"}<br />
                                    Managed by {property.owner?.name || "Verified Owner"}
                                </span>
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

                    {/* Categorized Photo Gallery */}
                    <div>
                        <h2 className="text-xl font-bold mb-4">Property Gallery</h2>
                        <div className="space-y-6">
                            {(() => {
                                const renderCategoryGrid = (title: string, dataString: string | null) => {
                                    if (!dataString) return null;
                                    let photos: string[] = [];
                                    try {
                                        const parsed = JSON.parse(dataString);
                                        photos = (Array.isArray(parsed) ? parsed : [parsed])
                                            .map((p: any) => typeof p === 'string' ? p : p.url)
                                            .filter(Boolean);
                                    } catch (e) {
                                        // Handle plain string URLs
                                        photos = [dataString].filter(Boolean);
                                    }

                                    if (photos.length === 0) return null;
                                    return (
                                        <div>
                                            <h3 className="text-md font-semibold mb-3 text-muted-foreground flex items-center gap-2">
                                                <div className="h-1 flex-1 bg-muted rounded"></div>
                                                <span>{title} ({photos.length})</span>
                                                <div className="h-1 flex-1 bg-muted rounded"></div>
                                            </h3>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                                {photos.map((url: string, idx: number) => (
                                                    <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-muted border hover:shadow-md transition-shadow">
                                                        <a href={url} target="_blank" rel="noopener noreferrer">
                                                            <img src={url} alt={`${title} ${idx + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                                                        </a>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                };

                                return (
                                    <>
                                        {renderCategoryGrid("Building Photos", property.buildingPhotos)}
                                        {renderCategoryGrid("Common Area", property.commonAreaPhotos)}
                                        {renderCategoryGrid("Rooms & Bathroom", property.roomsAndBathroomPhotos)}
                                        {renderCategoryGrid("Parking Area", property.parkingPhotos)}
                                        {renderCategoryGrid("Other Amenities", property.amenitiesPhotos)}

                                        {!property.buildingPhotos && !property.commonAreaPhotos && !property.roomsAndBathroomPhotos && !property.parkingPhotos && !property.amenitiesPhotos && (
                                            <p className="text-sm text-muted-foreground">No additional gallery photos available.</p>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Food Menu — Hidden per user request */}
                    {/* <div>
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
                    </div> */}

                    {/* Verified Reviews Section */}
                    <div className="mt-8 pt-8 border-t">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold flex items-center">
                                <Star className="h-6 w-6 mr-2 fill-yellow-400 text-yellow-500" />
                                {property.averageRating > 0 ? property.averageRating : "0.0"} <span className="text-lg text-muted-foreground font-normal ml-2">({property.reviewCount} Reviews)</span>
                            </h2>
                        </div>

                        <div className="space-y-6">
                            {reviews.length === 0 ? (
                                <p className="text-muted-foreground text-center py-6 bg-slate-50 rounded-xl">No reviews yet. Be the first to book and rate your experience!</p>
                            ) : (
                                reviews.map((review) => (
                                    <div key={review.id} className="bg-white p-5 rounded-xl border shadow-sm">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="font-bold text-gray-900">{review.tenant.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    Stayed in {review.tenant.roomType} • {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                                                </div>
                                            </div>
                                            <div className="flex">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        className={`h-4 w-4 ${i < review.rating ? "fill-yellow-400 text-yellow-500" : "fill-transparent text-gray-300"}`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        {review.comment && (
                                            <p className="text-gray-700 leading-relaxed text-sm">{review.comment}</p>
                                        )}
                                        <div className="mt-3 flex gap-2">
                                            <span className="text-[10px] font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-full flex items-center">
                                                <Shield className="h-3 w-3 mr-1" /> Verified Tenant
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
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
                                    <div key={room.type} className="flex justify-between items-center mb-2 border-b pb-2 last:border-0 last:pb-0">
                                        <span className="font-medium text-sm text-muted-foreground">{room.type}</span>
                                        <span className="font-bold text-lg text-primary">₹{room.price.toLocaleString()}<span className="text-xs font-normal text-muted-foreground">/mo</span></span>
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

                            {/* Guest Name — Read Only */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Guest Name <span className="text-red-500">*</span></label>
                                <Input 
                                    value={formData.guestName} 
                                    readOnly={true} 
                                    placeholder={!currentUser ? "Sign in to fill" : ""}
                                    className="bg-gray-50 cursor-not-allowed" 
                                />
                                {!currentUser && (
                                    <p className="text-[11px] text-red-600 font-bold italic mt-1">
                                        ⚠️ Sign in first to proceed with the request booking
                                    </p>
                                )}
                            </div>

                            {/* Email & Phone — Read Only */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Contact Details <span className="text-red-500">*</span></label>
                                <Input 
                                    value={formData.guestEmail} 
                                    readOnly={true} 
                                    placeholder={!currentUser ? "Sign in to fill" : ""}
                                    className="bg-gray-50 cursor-not-allowed" 
                                />
                                <div className="flex">
                                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 bg-muted text-sm font-semibold text-muted-foreground">
                                        +91
                                    </span>
                                    <Input 
                                        value={formData.guestPhone} 
                                        readOnly={true} 
                                        placeholder={!currentUser ? "Sign in to fill" : ""}
                                        className="rounded-l-none bg-gray-50 cursor-not-allowed" 
                                    />
                                </div>
                                {!currentUser && (
                                    <p className="text-[11px] text-red-600 font-bold italic mt-1">
                                        ⚠️ Sign in first to proceed with the request booking
                                    </p>
                                )}
                            </div>

                            {/* Section 3 & 4 — Food Service Banner */}
                            {property.foodType === 'NOT_AVAILABLE' && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200">
                                    <span className="text-base">🚫</span>
                                    <div>
                                        <p className="text-xs font-black text-slate-500 uppercase">No Food Service</p>
                                        <p className="text-[10px] text-slate-400">This property does not provide meals.</p>
                                    </div>
                                </div>
                            )}
                            {property.foodType === 'INCLUDED' && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 border-2 border-green-200">
                                    <span className="text-base">🍱</span>
                                    <div>
                                        <p className="text-xs font-black text-green-700 uppercase">Meals Included in Rent</p>
                                        <p className="text-[10px] text-green-600">Breakfast, Lunch & Dinner included. No extra charge.</p>
                                    </div>
                                </div>
                            )}
                            {property.foodType === 'OPTIONAL' && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50 border-2 border-orange-200">
                                        <span className="text-base">🍴</span>
                                        <div className="flex-1">
                                            <p className="text-xs font-black text-orange-700 uppercase">Food Available (Optional)</p>
                                            <p className="text-[10px] text-orange-600 font-bold">₹{property.foodPricePerMonth?.toLocaleString()}/month — Choose below</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">Food Service Preference <span className="text-red-500">*</span></label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setFoodSelected(true)}
                                                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-2 ${
                                                    foodSelected === true
                                                        ? "bg-green-600 text-white border-green-600 shadow-md"
                                                        : "border-gray-200 text-gray-600 hover:border-green-400 hover:bg-green-50"
                                                }`}
                                            >
                                                🍽 Yes, Include Food <span className="font-normal opacity-80">(+₹{property.foodPricePerMonth?.toLocaleString()}/mo)</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFoodSelected(false)}
                                                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-2 ${
                                                    foodSelected === false
                                                        ? "bg-slate-700 text-white border-slate-700 shadow-md"
                                                        : "border-gray-200 text-gray-600 hover:border-slate-400 hover:bg-slate-50"
                                                }`}
                                            >
                                                🚫 No Thanks
                                            </button>
                                        </div>
                                        {foodSelected !== null && (
                                            <p className="text-[10px] text-muted-foreground italic text-center">
                                                {foodSelected ? `Food will be activated when owner approves. (+₹${property.foodPricePerMonth?.toLocaleString()}/mo)` : 'No food charges will apply.'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Occupation */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Occupation <span className="text-red-500">*</span></label>
                                <div className="flex gap-2 flex-wrap">
                                    {OCCUPATION_TYPES.map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => {
                                                setFormData(p => ({ ...p, occupationType: type, occupationDetail: "" }));
                                                if (fieldErrors.occupationType) setFieldErrors(p => { const n = { ...p }; delete n.occupationType; return n; });
                                            }}
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${formData.occupationType === type
                                                ? "bg-blue-600 text-white border-blue-600"
                                                : fieldErrors.occupationType ? "border-red-300 text-red-600 hover:border-red-400" : "border-gray-300 text-gray-600 hover:border-blue-400"}`}
                                        >
                                            {type === "Student" ? "🎓 Student" : type === "Working Professional" ? "💼 Working Pro" : "👤 Other"}
                                        </button>
                                    ))}
                                </div>
                                {fieldErrors.occupationType && <p className="text-[10px] text-red-600 font-bold mt-1">{fieldErrors.occupationType}</p>}
                                {formData.occupationType && (
                                    <Input
                                        placeholder={
                                            formData.occupationType === "Student" ? "College / University name" :
                                                formData.occupationType === "Working Professional" ? "Company name" :
                                                    "Specify your occupation"
                                        }
                                        className={fieldErrors.occupationDetail ? "border-red-500 ring-1 ring-red-200" : ""}
                                        value={formData.occupationDetail}
                                        onChange={e => {
                                            setFormData(p => ({ ...p, occupationDetail: e.target.value }));
                                            if (fieldErrors.occupationDetail) setFieldErrors(p => { const n = { ...p }; delete n.occupationDetail; return n; });
                                        }}
                                    />
                                )}
                                {fieldErrors.occupationDetail && <p className="text-[10px] text-red-600 font-bold mt-1">{fieldErrors.occupationDetail}</p>}
                            </div>

                            {/* Move-in date */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Preferred Move-in Date <span className="text-red-500">*</span></label>
                                <Input type="date" required value={formData.moveInDate}
                                    min={new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000)).toISOString().split('T')[0]}
                                    className={fieldErrors.moveInDate ? "border-red-500 ring-1 ring-red-200" : ""}
                                    onChange={e => {
                                        setFormData(p => ({ ...p, moveInDate: e.target.value }));
                                        if (fieldErrors.moveInDate) setFieldErrors(p => { const n = { ...p }; delete n.moveInDate; return n; });
                                    }} />
                                {fieldErrors.moveInDate && <p className="text-[10px] text-red-600 font-bold mt-1">{fieldErrors.moveInDate}</p>}
                            </div>

                            {/* Optional Message */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Any Message for Owner? (Optional)</label>
                                <textarea 
                                    className="w-full border rounded-md p-2 bg-background text-sm min-h-[60px]"
                                    placeholder="e.g. I need early check-in, tell me about security..."
                                    value={formData.message}
                                    onChange={e => setFormData(p => ({ ...p, message: e.target.value }))}
                                />
                            </div>

                            <div className="bg-yellow-50 p-3 rounded text-xs text-yellow-800 border border-yellow-200">
                                <strong>No Payment Required Now.</strong>
                                <p className="mt-1">You only pay after the owner approves your request and allocates a room. Secure your spot today for free!</p>
                            </div>

                            <Button
                                className="w-full text-lg h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold shadow-lg"
                                onClick={!currentUser ? () => router.push("/login?redirect=" + encodeURIComponent(window.location.pathname)) : handleBooking}
                                disabled={bookingLoading || property.rooms.length === 0}
                            >
                                {!currentUser ? "🔒 Sign in to Book" : bookingLoading ? "Processing..." : "🚀 Request Booking"}
                            </Button>
                            <p className="text-xs text-center text-muted-foreground">Fastest booking experience. No hidden charges.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
