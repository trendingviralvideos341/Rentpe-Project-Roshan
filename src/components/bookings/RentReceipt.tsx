"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, Download, CheckCircle, ShieldCheck } from "lucide-react";

interface ReceiptProps {
    booking: {
        displayId: string;
        propertyName: string;
        amount: string;
        guestName: string;
        moveInDate: string;
        createdAt: string;
    };
    onClose: () => void;
}

export default function RentReceipt({ booking, onClose }: ReceiptProps) {
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <Card className="w-full max-w-2xl bg-white text-black shadow-2xl print:shadow-none print:m-0 print:border-0 relative">
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-4 print:hidden"
                    onClick={onClose}
                >
                    ✕
                </Button>

                <CardHeader className="border-b pb-4 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent print:text-black">
                            RentPe Receipt
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">Digital Payment Confirmation</p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 mb-1">
                            <CheckCircle className="h-3 w-3" /> VERIFIED
                        </div>
                        <p className="text-xs font-mono">{booking.displayId}</p>
                    </div>
                </CardHeader>

                <CardContent className="p-8 space-y-8">
                    {/* Header Details */}
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <h4 className="text-xs font-bold uppercase text-muted-foreground mb-1">Billed To</h4>
                            <p className="font-bold text-lg">{booking.guestName}</p>
                            <p className="text-sm">Verified Resident</p>
                        </div>
                        <div className="text-right">
                            <h4 className="text-xs font-bold uppercase text-muted-foreground mb-1">Property</h4>
                            <p className="font-bold text-lg">{booking.propertyName}</p>
                        </div>
                    </div>

                    <div className="border-y py-6 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Description</span>
                            <span className="font-medium">Amount</span>
                        </div>
                        <div className="flex justify-between items-center text-lg">
                            <div>
                                <p className="font-bold">Booking Deposit / First Month Rent</p>
                                <p className="text-xs text-muted-foreground">Move-in Date: {booking.moveInDate}</p>
                            </div>
                            <p className="font-bold">{booking.amount}</p>
                        </div>
                    </div>

                    <div className="flex justify-between items-start pt-4">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 p-3 rounded-lg border border-green-100">
                                <ShieldCheck className="h-5 w-5" />
                                <div>
                                    <p className="font-bold uppercase">Transaction Secured</p>
                                    <p>Verified via Razorpay Gateway</p>
                                </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground max-w-[250px]">
                                This is a computer-generated receipt and does not require a physical signature. Issued on {new Date().toLocaleString()}.
                            </p>
                        </div>
                        <div className="text-right space-y-2">
                            <div className="flex justify-between gap-8">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span>{booking.amount}</span>
                            </div>
                            <div className="flex justify-between gap-8 border-t pt-2">
                                <span className="font-bold text-xl uppercase">Total Paid</span>
                                <span className="font-bold text-2xl text-primary print:text-black">{booking.amount}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-center gap-4 pt-8 print:hidden">
                        <Button variant="outline" onClick={handlePrint}>
                            <Printer className="h-4 w-4 mr-2" /> Print Receipt
                        </Button>
                        <Button onClick={handlePrint}>
                            <Download className="h-4 w-4 mr-2" /> Download PDF
                        </Button>
                    </div>
                </CardContent>

                <div className="p-4 bg-muted/30 text-[10px] text-center text-muted-foreground border-t">
                    RentPe Ecosystem • Prop-Tech OS for Modern Living • support@rentpe.in
                </div>
            </Card>
        </div>
    );
}
