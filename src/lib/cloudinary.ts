import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  api_key: process.env.CLOUDINARY_API_KEY?.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
  secure: true,
});

// Diagnostic Masked Logging for Vercel
if (typeof window === 'undefined') {
  const mask = (str: string | undefined) => str ? `${str.slice(0, 3)}...${str.slice(-3)}` : 'MISSING';
  console.log("🛡️ Cloudinary Config Check:", {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: mask(process.env.CLOUDINARY_API_KEY),
    api_secret_present: !!process.env.CLOUDINARY_API_SECRET,
    api_secret_mask: mask(process.env.CLOUDINARY_API_SECRET)
  });
}

export default cloudinary;
