import cloudinary from './cloudinary';

/**
 * Uploads a base64 string to Cloudinary.
 * Returns the secure URL of the uploaded image.
 */
export async function uploadToCloudinary(base64Data: string, folder: string): Promise<string> {
  // If no Cloudinary credentials are set in development, return the base64 as-is (Mock mode)
  if (!process.env.CLOUDINARY_API_KEY && process.env.NODE_ENV === 'development') {
    console.warn(`[Cloudinary Mock] Uploading to ${folder}... (No API Key found)`);
    return base64Data; // Fallback to base64 so dev doesn't break
  }

  try {
    const uploadResponse = await cloudinary.uploader.upload(base64Data, {
      folder: `rentpe/${folder}`,
      resource_type: 'auto', // Automatically detect if it's an image, pdf, etc.
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
