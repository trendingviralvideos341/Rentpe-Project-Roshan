"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PhotoEntry = { url: string; label: string };

function parsePhotos(val: any, label: string): PhotoEntry[] {
    if (!val) return [];
    try {
        const parsed = typeof val === "string" ? JSON.parse(val) : val;
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        return arr
            .map((p: any, i: number) => ({
                url: typeof p === "string" ? p : p?.url,
                label: arr.length > 1 ? `${label} ${i + 1}` : label,
            }))
            .filter((p: PhotoEntry) => !!p.url);
    } catch {
        return typeof val === "string" && val.startsWith("http")
            ? [{ url: val, label }]
            : [];
    }
}

interface PropertyPhotoCarouselProps {
    property: {
        buildingPhotos?: any;
        commonAreaPhotos?: any;
        roomsAndBathroomPhotos?: any;
        parkingPhotos?: any;
        amenitiesPhotos?: any;
    };
    className?: string;
    aspectClassName?: string;
}

export function PropertyPhotoCarousel({ property, className = "", aspectClassName = "aspect-video" }: PropertyPhotoCarouselProps) {
    const [idx, setIdx] = useState(0);

    const all: PhotoEntry[] = [
        ...parsePhotos(property.buildingPhotos, "Building"),
        ...parsePhotos(property.commonAreaPhotos, "Common Area"),
        ...parsePhotos(property.roomsAndBathroomPhotos, "Rooms & Bathrooms"),
        ...parsePhotos(property.parkingPhotos, "Parking"),
        ...parsePhotos(property.amenitiesPhotos, "Amenities"),
    ];

    if (all.length === 0) {
        return (
            <div className={`flex items-center justify-center bg-slate-100 rounded-2xl h-64 text-slate-400 text-sm font-bold ${className}`}>
                No property photos uploaded yet.
            </div>
        );
    }

    const safeIdx = idx % all.length;
    const current = all[safeIdx];

    const prev = () => setIdx(i => (i - 1 + all.length) % all.length);
    const next = () => setIdx(i => (i + 1) % all.length);

    return (
        <div className={`rounded-2xl overflow-hidden bg-slate-100 ${className}`}>
            {/* Image Area */}
            <div className={`relative ${aspectClassName} flex items-center justify-center overflow-hidden bg-slate-900`}>
                <img
                    key={safeIdx}
                    src={current.url}
                    alt={current.label}
                    className="w-full h-full object-cover transition-all duration-300"
                />

                {/* Arrows */}
                {all.length > 1 && (
                    <>
                        <button
                            onClick={prev}
                            className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-sm flex items-center justify-center transition-all active:scale-90 shadow-lg"
                        >
                            <ChevronLeft className="h-5 w-5 text-white" />
                        </button>
                        <button
                            onClick={next}
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-sm flex items-center justify-center transition-all active:scale-90 shadow-lg"
                        >
                            <ChevronRight className="h-5 w-5 text-white" />
                        </button>
                    </>
                )}

                {/* Counter */}
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-black px-2.5 py-1 rounded-full">
                    {safeIdx + 1} / {all.length}
                </div>

                {/* Label */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full whitespace-nowrap">
                    {current.label}
                </div>
            </div>

            {/* Dots */}
            {all.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 py-3 bg-white border-t">
                    {all.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setIdx(i)}
                            className={`rounded-full transition-all duration-200 ${
                                i === safeIdx
                                    ? "h-2 w-6 bg-indigo-500"
                                    : "h-2 w-2 bg-slate-200 hover:bg-slate-300"
                            }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
