import { getBookingById } from "@/actions/bookings";
import { BookingTimeline } from "@/components/ui/BookingTimeline";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronLeft, Building2, MapPin, User, Mail, Phone, Calendar, BedDouble, ShieldCheck, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";

interface BookingDetailPageProps {
    params: Promise<{ id: string }>;
}

export default async function BookingDetailPage({ params }: BookingDetailPageProps) {
    const { id } = await params;
    
    let booking;
    try {
        booking = await getBookingById(id);
    } catch (e) {
        return notFound();
    }

    if (!booking) return notFound();

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20">
            {/* Header / Navigation */}
            <div className="bg-white/70 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
                <div className="container mx-auto px-4 py-4 max-w-5xl flex items-center justify-between">
                    <Button variant="ghost" size="sm" asChild className="hover:bg-indigo-50 text-slate-600 font-bold gap-1">
                        <Link href="/dashboard/student">
                            <ChevronLeft className="w-4 h-4" /> Back to Dashboard
                        </Link>
                    </Button>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Booking Reference</span>
                        <span className="text-sm font-bold text-slate-900">{booking.displayId}</span>
                    </div>
                </div>
            </div>

            <main className="container mx-auto px-4 pt-8 max-w-5xl space-y-6">
                {/* Status Hero Card */}
                <Card className="border-none shadow-2xl shadow-indigo-500/5 bg-gradient-to-br from-indigo-600 to-purple-700 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl -ml-32 -mb-32" />
                    
                    <CardHeader className="relative z-10 text-white pb-0">
                        <div className="flex items-center gap-2 mb-2">
                            <ShieldCheck className="w-5 h-5 text-indigo-200" />
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-indigo-100">Live Journey Tracking</span>
                        </div>
                        <CardTitle className="text-2xl md:text-4xl font-black tracking-tight">
                            Booking at <span className="underline decoration-indigo-400 underline-offset-8 decoration-4">{booking.propertyName}</span>
                        </CardTitle>
                    </CardHeader>
                    
                    <CardContent className="relative z-10 p-0 md:p-4">
                        <div className="bg-white/5 backdrop-blur-md rounded-3xl mt-6">
                            <BookingTimeline booking={booking} />
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Property & Stay Details */}
                    <div className="md:col-span-2 space-y-6">
                        <Card className="border-slate-200/60 shadow-xl shadow-slate-200/40 rounded-3xl overflow-hidden">
                            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                                <CardTitle className="text-lg font-black flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-indigo-600" /> Property Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Address</span>
                                        <p className="text-sm font-bold text-slate-700 flex items-start gap-2">
                                            <MapPin className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                                            {(booking as any).property?.address}, {(booking as any).property?.city}
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Accommodation</span>
                                        <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            <BedDouble className="w-4 h-4 text-indigo-500" />
                                            {booking.occupancy} • Room {booking.roomAssigned || "Pending Assignment"}
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Move-in Date</span>
                                        <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-indigo-500" />
                                            {booking.moveInDate}
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</span>
                                        <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-black uppercase rounded-full border border-green-200 w-fit">
                                            {booking.status}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Guest Information */}
                        <Card className="border-slate-200/60 shadow-xl shadow-slate-200/40 rounded-3xl overflow-hidden">
                            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                                <CardTitle className="text-lg font-black flex items-center gap-2">
                                    <User className="w-5 h-5 text-indigo-600" /> Guest Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center font-black text-indigo-600 text-lg">
                                        {booking.guestName?.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-tight">Guest Name</p>
                                        <p className="text-sm font-black text-slate-800">{booking.guestName}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3 justify-center">
                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                                        <Mail className="w-4 h-4 text-slate-400" /> {booking.guestEmail || "No email provided"}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                                        <Phone className="w-4 h-4 text-slate-400" /> {booking.guestPhone || "No phone provided"}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Quick Info Sidebar */}
                    <div className="space-y-6">
                        <Card className="bg-slate-900 text-white rounded-3xl overflow-hidden border-none shadow-2xl">
                            <CardHeader>
                                <CardTitle className="text-lg font-black">Reservation Fees</CardTitle>
                                <CardDescription className="text-slate-400 text-xs font-bold leading-relaxed">
                                    Summary of your commitment for this stay.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between items-center py-2 border-b border-white/10">
                                    <span className="text-xs text-slate-400 font-bold">Monthly Rent</span>
                                    <span className="font-black text-white">₹{booking.amount}</span>
                                </div>
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-xs text-slate-400 font-bold">Token Amount Paid</span>
                                    <span className="font-black text-emerald-400">₹{booking.tokenAmount || 1000}</span>
                                </div>
                                
                                <div className="mt-4 p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Next Action</p>
                                    {booking.status === 'APPLIED' ? (
                                        <p className="text-xs font-bold text-slate-300">Awaiting owner approval. You will be notified once they review your request.</p>
                                    ) : booking.status === 'APPROVED' && !booking.agreementSigned ? (
                                        <div className="space-y-3">
                                            <p className="text-xs font-bold text-slate-300">Your application is approved! Please complete payment or sign the agreement to proceed.</p>
                                            <Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] rounded-xl h-10 group" asChild>
                                                <Link href="/dashboard/student">
                                                    Complete Dashboard Flow <ArrowRight className="w-3 h-3 ml-2 group-hover:translate-x-1 transition-transform" />
                                                </Link>
                                            </Button>
                                        </div>
                                    ) : (
                                        <p className="text-xs font-bold text-slate-300">Everything looks good! Follow the timeline for further steps.</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Help Card */}
                        <div className="p-6 rounded-3xl bg-indigo-50 border border-indigo-100 space-y-4">
                            <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest">Need Help?</h3>
                            <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                                Our support team is available 24/7 to help you with your booking.
                            </p>
                            <Button variant="outline" size="sm" className="w-full rounded-xl border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-100" asChild>
                                <Link href="/dashboard/student/tickets">Raise a Ticket</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
