// GET /api/warmup — wakes up the serverless function on page load
// Eliminates first-click cold-start delay. No DB or Cloudinary calls needed.
export async function GET() {
    return Response.json({ status: 'warm' });
}
