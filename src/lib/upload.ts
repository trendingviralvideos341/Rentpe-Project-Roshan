import cloudinary from './cloudinary';

/**
 * Uploads a base64 string OR a File object to Cloudinary.
 *
 * SECURITY POLICY (DPDP Act 2023 / RBI KYC Guidelines):
 *   isPrivate = true  → uploaded as Cloudinary "private" type (never public-accessible).
 *                       Returns the public_id so server can generate short-lived signed URLs.
 *   isPrivate = false → standard public upload (used for property / room photos).
 *                       Returns the secure_url as before.
 */
export async function uploadToCloudinary(
  data: string | File,
  folder: string,
  isPrivate: boolean = false,
): Promise<string> {
  // 1. Mock Mode Check
  const isPlaceholder = process.env.CLOUDINARY_API_KEY?.includes('your_api_key');
  if ((!process.env.CLOUDINARY_API_KEY || isPlaceholder) && process.env.NODE_ENV === 'development') {
    console.warn(`[Cloudinary Mock] Uploading to ${folder}... (No valid API Key found)`);
    return typeof data === 'string' ? data : 'https://via.placeholder.com/800x600?text=RentPe+Property+Photo';
  }

  try {
    let uploadData: string;

    // Convert File to Base64 Data URI (reliable in serverless — no disk I/O)
    if (data instanceof File) {
      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Data = buffer.toString('base64');
      uploadData = `data:${data.type};base64,${base64Data}`;
    } else {
      uploadData = data;
    }

    const targetFolder = folder.startsWith('rentpe/') ? folder : `rentpe/${folder}`;

    if (isPrivate) {
      // ── PRIVATE UPLOAD (owner KYC docs: Aadhaar, PAN, PG Licence) ──────────
      // type:'private' means Cloudinary will NEVER serve the file publicly.
      // We return the public_id; callers use generateSignedDocUrl() to produce
      // a short-lived (10-min) URL when a verifier needs to view the file.
      const result = await cloudinary.uploader.upload(uploadData, {
        folder: targetFolder,
        resource_type: 'image',
        type: 'private',          // 🔒 private storage — no public access
        invalidate: true,
      });
      // Prefix with "private:" so callers can distinguish IDs from public URLs
      return `private:${result.public_id}`;
    } else {
      // ── PUBLIC UPLOAD (property photos, room images) ────────────────────────
      const result = await cloudinary.uploader.upload(uploadData, {
        folder: targetFolder,
        resource_type: 'auto',
      });
      return result.secure_url;
    }
  } catch (error: any) {
    console.error('Cloudinary Upload Error:', error);
    throw error;
  }
}

/**
 * Generates a short-lived signed URL for a privately-stored Cloudinary asset.
 * Valid for 10 minutes — suitable for admin/verifier document review sessions.
 * Complies with DPDP Act 2023 & RBI KYC access-control requirements.
 *
 * @param storedValue  The value returned by uploadToCloudinary(..., isPrivate=true)
 *                     Format: "private:<public_id>"  OR a legacy plain URL.
 */
export function generateSignedDocUrl(storedValue: string): string {
  if (!storedValue) return '';

  // Legacy plain URL (uploaded before this security patch) — return as-is.
  if (!storedValue.startsWith('private:')) return storedValue;

  const publicId = storedValue.replace(/^private:/, '');
  const EXPIRES_IN_SECONDS = 600; // 10 minutes

  // Cloudinary SDK: private_download_url generates a signed, time-limited URL
  return cloudinary.utils.private_download_url(publicId, 'jpg', {
    expires_at: Math.floor(Date.now() / 1000) + EXPIRES_IN_SECONDS,
    attachment: false,   // open inline in browser, not force-download
  });
}

/**
 * Batch upload utility for arrays of base64 strings or File objects.
 * All items are uploaded with the same privacy setting.
 */
export async function batchUploadToCloudinary(
  items: (string | File)[],
  folder: string,
  isPrivate: boolean = false,
): Promise<string[]> {
  const uploadPromises = items.map(item => uploadToCloudinary(item, folder, isPrivate));
  return Promise.all(uploadPromises);
}
