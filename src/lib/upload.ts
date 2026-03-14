import cloudinary from './cloudinary';

/**
 * Uploads a base64 string OR a File object to Cloudinary.
 * Returns the secure URL/public_id of the uploaded file.
 */
export async function uploadToCloudinary(data: string | File, folder: string, isPrivate: boolean = false): Promise<string> {
  // 1. Mock Mode Check
  const isPlaceholder = process.env.CLOUDINARY_API_KEY?.includes('your_api_key');
  if ((!process.env.CLOUDINARY_API_KEY || isPlaceholder) && process.env.NODE_ENV === 'development') {
    console.warn(`[Cloudinary Mock] Uploading to ${folder}... (No valid API Key found)`);
    return typeof data === 'string' ? data : "https://via.placeholder.com/800x600?text=RentPe+Property+Photo";
  }

  try {
    // 2. Handle File object (Streaming Upload — Recommended for Node/Next.js)
    if (data instanceof File) {
      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: folder,
            resource_type: 'auto',
            type: isPrivate ? 'authenticated' : 'upload',
            access_mode: isPrivate ? 'authenticated' : 'public',
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result!.secure_url);
          }
        );
        stream.end(buffer);
      });
    }

    // 3. Handle Base64 string fallback
    const uploadResponse = await cloudinary.uploader.upload(data, {
      folder: `rentpe/${folder}`,
      resource_type: 'auto',
      type: isPrivate ? 'authenticated' : 'upload',
      access_mode: isPrivate ? 'authenticated' : 'public',
    });

    return uploadResponse.secure_url;
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    throw new Error('Failed to upload file to cloud storage.');
  }
}

/**
 * Batch upload utility for arrays of base64 strings or File objects
 */
export async function batchUploadToCloudinary(items: (string | File)[], folder: string): Promise<string[]> {
  // For industry standard performance, we process these in semi-parallel batches
  const uploadPromises = items.map(item => uploadToCloudinary(item, folder));
  return Promise.all(uploadPromises);
}
