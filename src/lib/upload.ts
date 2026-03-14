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

      const uploadPromise = new Promise<string>((resolve, reject) => {
        const targetFolder = folder.startsWith('rentpe/') ? folder : `rentpe/${folder}`;
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: targetFolder,
            resource_type: 'auto',
          },
          (error, result) => {
            if (error) {
              console.error("[Cloudinary] Upload Stream Error:", error);
              reject(error);
            } else if (result) {
              resolve(result.secure_url);
            } else {
              reject(new Error("Empty upload result"));
            }
          }
        );

        // Ensure the stream is destroyed on timeout to prevent memory leaks
        const timeout = setTimeout(() => {
          stream.destroy();
          reject(new Error("Cloudinary upload timed out after 25s"));
        }, 25000);

        stream.on('finish', () => clearTimeout(timeout));
        stream.on('error', (err) => {
           clearTimeout(timeout);
           reject(err);
        });

        // Pass the actual file buffer to the stream
        const { Readable } = require('stream');
        Readable.from(buffer).pipe(stream);
      });

      return await uploadPromise;
    }

    // 3. Handle Base64 string fallback
    const targetFolder = folder.startsWith('rentpe/') ? folder : `rentpe/${folder}`;
    const uploadPromise = cloudinary.uploader.upload(data, {
      folder: targetFolder,
      resource_type: 'auto',
      type: isPrivate ? 'authenticated' : 'upload',
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Cloudinary upload timed out after 25s")), 25000)
    );

    const result = await Promise.race([uploadPromise, timeoutPromise]) as any;
    return result.secure_url;
  } catch (error: any) {
    console.error('Cloudinary Upload Error:', error);
    // Re-throw the original error to preserve properties like http_code for the action logger
    throw error;
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
