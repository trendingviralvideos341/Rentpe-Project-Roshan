/**
 * Industry-standard client-side image compression.
 * Resizes images to a maximum dimension and reduces quality to optimize for web.
 * Bypasses the need for heavy external libraries by using the native Canvas API.
 */
export async function compressImage(file: File, maxWidth = 1600, quality = 0.8): Promise<File> {
    // Only compress image files
    if (!file.type.startsWith('image/')) return file;
    
    // Skip if it's already a small file (under 200KB)
    if (file.size < 200 * 1024) return file;

    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        
        img.src = objectUrl;
        
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            
            let { width, height } = img;

            // Maintain aspect ratio while resizing
            if (width > maxWidth || height > maxWidth) {
                if (width > height) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                } else {
                    width = Math.round((width * maxWidth) / height);
                    height = maxWidth;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error("Failed to get canvas context"));

            ctx.drawImage(img, 0, 0, width, height);

            // Convert to JPEG for best compression ratio (industry standard for property photos)
            canvas.toBlob(
                (blob) => {
                    if (!blob) return reject(new Error("Image compression resulted in null blob"));
                    
                    // Create a new File from the blob
                    const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });
                    
                    // If the "compressed" file is somehow larger than the original, return original
                    if (compressedFile.size > file.size) {
                        resolve(file);
                    } else {
                        resolve(compressedFile);
                    }
                },
                'image/jpeg',
                quality
            );
        };
        
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Failed to load image for compression"));
        };
    });
}
