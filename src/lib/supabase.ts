// ─────────────────────────────────────────────────────────────────────────────
// src/lib/supabase.ts
//
// SECURITY: This file uses the service_role key, which has FULL bucket access.
// It must ONLY be used on the server side (API routes, server actions).
// NEVER import this file from client components or pages with 'use client'.
//
// Security Head:   Service role key is only passed in server environment vars.
// Hacker Guard:    No CORS exposure. This file is excluded from client bundles
//                  because it has no 'use client' directive.
// Architect:       Uses lazy singleton to avoid creating new clients per request.
// CA / Auditor:    All upload paths are deterministic: {invoiceId}/{copy}.pdf
//                  This guarantees receipts are always traceable per invoice.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ─── Singleton pattern — one client per server process ────────────────────────
let _client: SupabaseClient | null = null;

function getSupabaseAdminClient(): SupabaseClient {
    if (_client) return _client;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error(
            "[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables."
        );
    }

    _client = createClient(url, key, {
        auth: {
            // Disable auto-refresh for server-side service role usage
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    return _client;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? "receipts";

// ─── Upload a PDF buffer to private Supabase Storage ─────────────────────────
// Path format: receipts/{invoiceId}/tenant.pdf  or  receipts/{invoiceId}/landlord.pdf
// Returns the full storage path (NOT a public URL — we use signed URLs for downloads).
//
// Security note: upsert=true is safe here because:
//   - PDF content is deterministic (generated from DB data), so re-uploading
//     the same invoice produces an identical file.
//   - We control the file path via invoiceId, so no external user can overwrite.
export async function uploadReceiptToStorage(
    invoiceId: string,
    copy: "tenant" | "landlord",
    pdfBuffer: Buffer
): Promise<string> {
    const supabase = getSupabaseAdminClient();
    const path = `${invoiceId}/${copy}.pdf`;

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, pdfBuffer, {
            contentType: "application/pdf",
            upsert: true, // Overwrite if regenerated (prevents stale receipts)
        });

    if (error) {
        throw new Error(`[Supabase Storage] Upload failed: ${error.message}`);
    }

    return path;
}

// ─── Download a PDF from private Supabase Storage ────────────────────────────
// Returns the raw buffer. The Next.js API route streams this to the user.
// The user NEVER gets a direct Supabase URL — our server acts as the gatekeeper.
//
// Security note: By downloading on the server and streaming to the authenticated
// user, we prevent any unauthorized access even if someone guesses the storage path.
export async function downloadReceiptFromStorage(storagePath: string): Promise<Buffer> {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase.storage
        .from(BUCKET)
        .download(storagePath);

    if (error || !data) {
        throw new Error(`[Supabase Storage] Download failed: ${error?.message ?? "No data returned"}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

// ─── Check if a receipt already exists in storage ─────────────────────────────
// Used by the route to skip PDF generation and serve the cached file instantly.
export async function receiptExistsInStorage(storagePath: string): Promise<boolean> {
    const supabase = getSupabaseAdminClient();

    // Extract folder from path (e.g. "abc123" from "abc123/tenant.pdf")
    const folder = storagePath.split("/")[0];
    const filename = storagePath.split("/")[1];

    const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(folder, { search: filename });

    if (error || !data) return false;
    return data.length > 0;
}
