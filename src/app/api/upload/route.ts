import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { uploadToCloudinary } from "@/lib/upload";

/**
 * POST /api/upload
 * Streams the file directly to Cloudinary — no local filesystem writes.
 * This is required for Vercel (read-only filesystem) and any cloud environment.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !session.userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        // Reject oversized files (5MB cap for document uploads via this route)
        const MAX_SIZE = 25 * 1024 * 1024; // 25MB — matches global limit
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: "File exceeds 25MB limit" }, { status: 400 });
        }

        // Security: only allow real image/PDF types
        const ALLOWED_TYPES = [
            "image/jpeg", "image/png", "image/webp", "image/gif",
            "application/pdf",
        ];
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: `File type "${file.type}" is not allowed` }, { status: 400 });
        }

        // Stream file directly to Cloudinary — zero disk I/O
        const folder = `rentpe/properties/${session.userId}`;
        const cloudUrl = await uploadToCloudinary(file, folder);

        return NextResponse.json({ url: cloudUrl });

    } catch (e: any) {
        console.error("[/api/upload] Error:", e);
        return NextResponse.json({ error: e.message || "Upload failed" }, { status: 500 });
    }
}
