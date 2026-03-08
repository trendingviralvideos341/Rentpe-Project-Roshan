import cloudinary from './cloudinary';

/**
 * Uploads a base64 string to Cloudinary.
 * Returns the secure URL/public_id of the uploaded file.
 * @param isPrivate - If true, uploads as 'authenticated' type (not public)
 */
export async function uploadToCloudinary(base64Data: string, folder: string, isPrivate: boolean = false): Promise<string> {
  // If no Cloudinary credentials are set in development, return the base64 as-is (Mock mode)
  if (!process.env.CLOUDINARY_API_KEY && process.env.NODE_ENV === 'development') {
    console.warn(`[Cloudinary Mock] Uploading to ${folder}... (No API Key found)`);
    return base64Data;
  }

  try {
    const uploadResponse = await cloudinary.uploader.upload(base64Data, {
      folder: `rentpe/${folder}`,
      resource_type: 'auto',
      type: isPrivate ? 'authenticated' : 'upload', // 'authenticated' requires signed URLs to view
      access_mode: isPrivate ? 'authenticated' : 'public',
    });

    return uploadResponse.secure_url;
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    throw new Error('Failed to upload file to cloud storage.');
  }
}

/**
 * Batch upload utility for arrays of base64 strings
 */
export async function batchUploadToCloudinary(base64Array: string[], folder: string): Promise<string[]> {
  const uploadPromises = base64Array.map(b64 => uploadToCloudinary(b64, folder));
  return Promise.all(uploadPromises);
}
