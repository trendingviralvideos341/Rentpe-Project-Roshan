// GET /api/warmup — called on page load to pre-warm Cloudinary connection
// This eliminates the first-click delay caused by Cloudinary's cold-start initialization.
export async function GET() {
    // Just import and initialize cloudinary config — no actual upload happens
    await import('@/lib/cloudinary');
    return Response.json({ status: 'warm' });
}
