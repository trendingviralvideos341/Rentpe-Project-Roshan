import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { bookingId, url, type, fileName } = body;

        if (!bookingId || !url || !type) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Verify booking ownership or admin rights
        const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

        if (booking.userId !== (session as any).userId && session.role !== 'ADMIN') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Create or Update TenantDocument
        // Use upsert to prevent duplicates if user re-uploads same type
        const existingDoc = await prisma.tenantDocument.findFirst({
            where: { bookingId, type }
        });

        let document;
        if (existingDoc) {
            document = await prisma.tenantDocument.update({
                where: { id: existingDoc.id },
                data: {
                    fileUrl: url,    // SECURITY FIX: Renamed from fileData — stores Cloudinary URL only
                    fileName: fileName || null,
                    status: 'PENDING',
                    uploadedAt: new Date(),
                    auditTrail: JSON.stringify([
                        ...JSON.parse(existingDoc.auditTrail || '[]'),
                        { action: 'REUPLOAD', by: (session as any).userId, at: new Date() }
                    ])
                }
            });
        } else {
            document = await prisma.tenantDocument.create({
                data: {
                    bookingId,
                    type,
                    fileUrl: url,    // SECURITY FIX: Renamed from fileData — stores Cloudinary URL only
                    fileName: fileName || null,
                    status: 'PENDING',
                    auditTrail: JSON.stringify([{ action: 'UPLOAD', by: (session as any).userId, at: new Date() }])
                }
            });
        }

        // 3. Update booking status if all docs uploaded (Optional industrial standard auto-transition)
        // For now, we'll keep it manual or wait for specialized logic

        return NextResponse.json({ success: true, document });
    } catch (e: any) {
        console.error("Booking Document API Error:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
