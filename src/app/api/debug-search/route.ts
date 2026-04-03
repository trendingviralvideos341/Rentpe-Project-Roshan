import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
    try {
        // 1. Get ALL properties with their room data
        const allProperties = await prisma.property.findMany({
            include: {
                rooms: { select: { id: true, price: true, availability: true, status: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        const report = allProperties.map((p: any) => {
            const totalAvailableBeds = p.rooms.reduce((sum: number, r: any) => sum + (r.availability || 0), 0);
            let verifiedDocs: string[] = [];
            try { verifiedDocs = JSON.parse(p.verifiedDocs || "[]"); } catch { }
            let buildingPhotos: string[] = [];
            try { buildingPhotos = JSON.parse(p.buildingPhotos || "[]"); } catch { }

            return {
                id: p.id,
                displayId: p.displayId,
                name: p.name,
                city: p.city,
                status: p.status,
                isVerified: p.isVerified,
                roomCount: p.rooms.length,
                totalAvailableBeds,
                verifiedDocsCount: verifiedDocs.length,
                buildingPhotosCount: buildingPhotos.length,
                // WHY IT IS HIDDEN:
                failsStatusCheck: p.status !== "APPROVED",
                failsAvailabilityCheck: totalAvailableBeds <= 0,
                wouldShowInSearch: p.status === "APPROVED" && totalAvailableBeds > 0,
                rooms: p.rooms.map((r: any) => ({
                    price: r.price,
                    availability: r.availability,
                    status: r.status
                }))
            };
        });

        const summary = {
            totalProperties: allProperties.length,
            approvedCount: report.filter(r => r.status === "APPROVED").length,
            wouldShowInSearch: report.filter(r => r.wouldShowInSearch).length,
            hiddenByStatus: report.filter(r => r.failsStatusCheck).map(r => ({ name: r.name, status: r.status })),
            hiddenByAvailability: report.filter(r => !r.failsStatusCheck && r.failsAvailabilityCheck).map(r => ({ name: r.name, rooms: r.roomCount, availableBeds: r.totalAvailableBeds })),
        };

        return NextResponse.json({ summary, properties: report });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
