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
    let uploadData: string;
    
    // Convert File to Base64 Data URI if needed (More reliable in Serverless than streams)
    if (data instanceof File) {
      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Data = buffer.toString('base64');
      uploadData = `data:${data.type};base64,${base64Data}`;
    } else {
      uploadData = data;
    }

    const targetFolder = folder.startsWith('rentpe/') ? folder : `rentpe/${folder}`;
    
    const result = await cloudinary.uploader.upload(uploadData, {
      folder: targetFolder,
      resource_type: 'auto',
    });

    return result.secure_url;
  } catch (error: any) {
    console.error('Cloudinary Upload Error:', error);
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
