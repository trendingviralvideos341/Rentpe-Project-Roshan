import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: "File exceeds 5MB limit" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Ensure upload directory exists
        const uploadDir = join(process.cwd(), "public", "uploads");
        if (!existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true });
        }

        // Clean filename, append timestamp to prevent overwrites
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const cleanedName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const filename = `${uniqueSuffix}-${cleanedName}`;
        const filepath = join(uploadDir, filename);

        await writeFile(filepath, buffer);

        // Return the public URL path
        return NextResponse.json({ url: `/uploads/${filename}` });

    } catch (e: any) {
        console.error("Upload error:", e);
        return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }
}
