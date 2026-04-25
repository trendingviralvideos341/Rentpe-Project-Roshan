"use client";

import { useState, useEffect } from "react";
import { BedDouble, ChevronDown, CheckCircle, Loader2, Home, Users, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRoomsForAllocation, getBedsForRoom } from "@/actions/rooms";

interface RoomAllocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAllocate: (data: {
        roomId: string;
        bedId: string;
        roomAssigned: string;
        bedNumber: string;
        amount: number;
        depositAmount: number;
        depositMonths: number;
        foodSelected: boolean;
        roomType: string;
    }) => Promise<void>;
    booking: {
        id: string;
        propertyId: string;
        occupancy: string;
        guestName: string;
    };
    property: {
        id: string;
        depositMonths?: number;
        foodAvailable?: boolean;
        foodCharge?: number;
        rentPremium?: number;
    };
}

const ROOM_TYPE_OPTIONS = [
    "Single Sharing",
    "Double Sharing",
    "Three Sharing",
    "Four Sharing",
    "Studio",
];

export function RoomAllocationModal({
    isOpen, onClose, onAllocate, booking, property
}: RoomAllocationModalProps) {
    const [rooms, setRooms] = useState<any[]>([]);
    const [beds, setBeds] = useState<any[]>([]);
    const [selectedRoomType, setSelectedRoomType] = useState(booking.occupancy || "Double Sharing");
    const [selectedRoom, setSelectedRoom] = useState<any>(null);
    const [selectedBed, setSelectedBed] = useState<any>(null);
    const [foodSelected, setFoodSelected] = useState(false);
    const [loading, setLoading] = useState(false);
    const [bedsLoading, setBedsLoading] = useState(false);
    const [allocating, setAllocating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const depositMonths = property.depositMonths || 2;
    const rent = selectedRoom ? Number(selectedRoom.price) : 0;
    const foodCharge = (foodSelected && property.foodCharge) ? Number(property.foodCharge) : 0;
    const rentTotal = rent + foodCharge;
    const depositAmount = rent * depositMonths;

    useEffect(() => {
        if (isOpen) {
            setSelectedRoom(null);
            setSelectedBed(null);
            setBeds([]);
            fetchRooms(selectedRoomType);
        }
    }, [isOpen]);

    const fetchRooms = async (roomType: string) => {
        setLoading(true);
        setError(null);
        setSelectedRoom(null);
        setSelectedBed(null);
        setBeds([]);
        try {
            const data = await getRoomsForAllocation(booking.propertyId, roomType);
            setRooms(data);
        } catch (e: any) {
            setError(e.message || "Failed to load rooms.");
        } finally {
            setLoading(false);
        }
    };

    const handleRoomTypeChange = (type: string) => {
        setSelectedRoomType(type);
        fetchRooms(type);
    };

    const handleSelectRoom = async (room: any) => {
        setSelectedRoom(room);
        setSelectedBed(null);
        setBedsLoading(true);
        try {
            const bedData = await getBedsForRoom(room.id);
            setBeds(bedData);
        } catch {
            setBeds([]);
        } finally {
            setBedsLoading(false);
        }
    };

    const handleAllocate = async () => {
        if (!selectedRoom || !selectedBed) return;
        setAllocating(true);
        try {
            await onAllocate({
                roomId: selectedRoom.id,
                bedId: selectedBed.id,
                roomAssigned: selectedRoom.roomNumber,
                bedNumber: selectedBed.bedNumber,
                amount: rentTotal,
                depositAmount,
                depositMonths,
                foodSelected,
                roomType: selectedRoomType,
            });
            onClose();
        } catch (e: any) {
            setError(e.message || "Allocation failed. Please try again.");
        } finally {
            setAllocating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-5 text-white shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-white/20 rounded-xl">
                                <BedDouble className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-base font-black tracking-tight">Room Allocation</h2>
                                <p className="text-white/70 text-xs mt-0.5">Booking for <strong className="text-white">{booking.guestName}</strong></p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-white/60 hover:text-white text-xl font-bold">✕</button>
                    </div>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Room Type Selector */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-2 block">Room Type Requested</label>
                        <div className="relative">
                            <select
                                value={selectedRoomType}
                                onChange={e => handleRoomTypeChange(e.target.value)}
                                className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 appearance-none bg-slate-50 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            >
                                {ROOM_TYPE_OPTIONS.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Requested: <strong>{booking.occupancy}</strong></p>
                    </div>

                    {/* Rooms List */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-2 block">
                            Available Rooms ({rooms.length})
                        </label>

                        {loading ? (
                            <div className="flex items-center justify-center py-10 gap-2 text-indigo-600">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="text-sm font-bold">Loading rooms...</span>
                            </div>
                        ) : error ? (
                            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-bold">
                                <AlertCircle className="w-4 h-4" /> {error}
                            </div>
                        ) : rooms.length === 0 ? (
                            <div className="py-8 text-center text-slate-400 text-sm font-bold bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                No available rooms for this type
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {rooms.map(room => (
                                    <button
                                        key={room.id}
                                        onClick={() => handleSelectRoom(room)}
                                        className={`text-left p-4 rounded-2xl border-2 transition-all duration-200 hover:shadow-md ${
                                            selectedRoom?.id === room.id
                                                ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                                                : "border-slate-200 bg-white hover:border-indigo-300"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Home className="w-4 h-4 text-indigo-600" />
                                                <span className="font-black text-slate-900 text-sm">Room {room.roomNumber}</span>
                                            </div>
                                            {selectedRoom?.id === room.id && (
                                                <CheckCircle className="w-4 h-4 text-indigo-600" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
                                            <Users className="w-3 h-3" /> {room.type}
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-lg font-black text-indigo-700">₹{Number(room.price).toLocaleString('en-IN')}<span className="text-xs font-bold text-slate-400">/mo</span></span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                                room.availableBeds > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                            }`}>
                                                {room.availableBeds} bed{room.availableBeds !== 1 ? 's' : ''} free
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Beds */}
                    {selectedRoom && (
                        <div>
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-2 block">
                                Select Bed in Room {selectedRoom.roomNumber}
                            </label>
                            {bedsLoading ? (
                                <div className="flex items-center gap-2 text-indigo-600 py-4">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Loading beds...
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {beds.map(bed => {
                                        const isAvailable = bed.status === 'AVAILABLE';
                                        const isLocked = bed.status === 'LOCKED' || bed.status === 'RESERVED';
                                        const isSelected = selectedBed?.id === bed.id;
                                        return (
                                            <button
                                                key={bed.id}
                                                onClick={() => isAvailable && setSelectedBed(bed)}
                                                disabled={!isAvailable}
                                                className={`py-3 rounded-xl border-2 text-center transition-all text-xs font-bold ${
                                                    isSelected
                                                        ? "bg-indigo-600 border-indigo-600 text-white shadow-lg"
                                                        : isAvailable
                                                        ? "border-green-300 bg-green-50 text-green-800 hover:border-indigo-400 hover:bg-indigo-50"
                                                        : isLocked
                                                        ? "border-amber-300 bg-amber-50 text-amber-700 cursor-not-allowed opacity-80"
                                                        : "border-red-200 bg-red-50 text-red-400 cursor-not-allowed opacity-60"
                                                }`}
                                            >
                                                <BedDouble className="w-3.5 h-3.5 mx-auto mb-1" />
                                                {bed.bedNumber}
                                                <div className="text-[8px] mt-0.5 opacity-80">
                                                    {isAvailable ? 'Free' : isLocked ? 'Reserved' : 'Occupied'}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Food Option */}
                    {property.foodAvailable && selectedRoom && (
                        <div
                            onClick={() => setFoodSelected(f => !f)}
                            className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                                foodSelected ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200"
                            }`}
                        >
                            <div>
                                <p className="font-bold text-slate-800 text-sm">🍽️ Food Included</p>
                                <p className="text-xs text-slate-500">
                                    {property.foodCharge ? `+₹${Number(property.foodCharge).toLocaleString('en-IN')}/month` : 'Pricing set by owner'}
                                </p>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                foodSelected ? "border-emerald-500 bg-emerald-500" : "border-slate-300"
                            }`}>
                                {foodSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                            </div>
                        </div>
                    )}

                    {/* Payment Summary */}
                    {selectedRoom && (
                        <div className="bg-slate-950 rounded-2xl p-4 text-white space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Payment Summary</p>
                            <div className="flex justify-between text-sm">
                                <span>Monthly Rent</span>
                                <span className="font-bold">₹{rent.toLocaleString('en-IN')}</span>
                            </div>
                            {foodSelected && foodCharge > 0 && (
                                <div className="flex justify-between text-sm text-emerald-400">
                                    <span>Food Charge</span>
                                    <span className="font-bold">₹{foodCharge.toLocaleString('en-IN')}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm text-emerald-400">
                                <span>Security Deposit ({depositMonths}m)</span>
                                <span className="font-bold">₹{depositAmount.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-slate-700 text-base font-black">
                                <span>Total Payable</span>
                                <span className="text-yellow-400">₹{(rentTotal + depositAmount).toLocaleString('en-IN')}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 text-center">(Student pays Rent + Deposit. Commission deducted from owner's payout.)</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0 flex gap-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 h-12 rounded-2xl font-bold border-2"
                        disabled={allocating}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAllocate}
                        disabled={!selectedRoom || !selectedBed || allocating}
                        className="flex-1 h-12 rounded-2xl font-black bg-gradient-to-r from-indigo-600 to-purple-700 text-white hover:from-indigo-700 hover:to-purple-800 disabled:opacity-40 shadow-lg shadow-indigo-200"
                    >
                        {allocating ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Allocating...
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" />
                                Confirm Room Allocation
                            </span>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
