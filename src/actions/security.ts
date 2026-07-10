'use server';

import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import cloudinary from "@/lib/cloudinary";
import { decryptIfPresent } from "@/lib/crypto";

/**
 * Parses a Cloudinary URL to extract its public ID.
 * Returns null if it doesn't look like a Cloudinary URL.
 */
function extractCloudinaryPublicId(url: string): string | null {
    if (!url) return null;
    
    // Example: https://res.cloudinary.com/demo/image/upload/v1234567/sample.jpg
    // or private:my_private_id
    if (url.startsWith('private:')) return url.replace('private:', '');

    try {
        const urlObj = new URL(url);
        if (!urlObj.hostname.includes('cloudinary.com')) return null;

        const pathParts = urlObj.pathname.split('/');
        // Path usually looks like /demo/image/upload/v1234/folder/file.jpg
        const uploadIndex = pathParts.findIndex(p => p === 'upload');
        
        if (uploadIndex !== -1 && pathParts.length > uploadIndex + 1) {
            // Find where version starts (e.g. 'v1234') or just take the rest
            const publicIdWithExt = pathParts.slice(uploadIndex + 1)
                .filter(p => !p.match(/^v\d+$/)) // remove version if present
                .join('/');
            
            // Remove extension
            const lastDotIndex = publicIdWithExt.lastIndexOf('.');
            if (lastDotIndex !== -1) {
                return publicIdWithExt.substring(0, lastDotIndex);
            }
            return publicIdWithExt;
        }
    } catch (e) {
        return null;
    }
    return null;
}

export async function verifyRevealOTP(propertyId: string, inputOtp: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    // 1. Check Mock OTP
    if (inputOtp !== "123456") {
        throw new Error("Invalid verification code");
    }

    // 2. Fetch Property to ensure access and get details
    const property = await prisma.property.findUnique({
        where: { id: propertyId }
    });

    if (!property) throw new Error("Property not found");

    // Ensure access control: Must be ADMIN, or OWNER/STAFF of this property
    const isOwner = property.ownerId === session.userId || property.ownerId === (session as any).parentOwnerId;
    if (session.role !== 'ADMIN' && !isOwner) {
        // Double check staff assignment if it's a staff member
        if (session.role === 'STAFF') {
            const user = await prisma.user.findUnique({
                where: { id: session.userId },
                include: { staffProfile: true }
            });
            if (user?.staffProfile) {
                const isAssigned = await prisma.staffPropertyAssignment.findUnique({
                    where: { staffMemberId_propertyId: { staffMemberId: user.staffProfile.id, propertyId: propertyId } }
                });
                if (!isAssigned) throw new Error("Access denied");
            } else {
                throw new Error("Access denied");
            }
        } else {
            throw new Error("Access denied");
        }
    }

    // 3. Log the Reveal Action to AuditLog
    await prisma.auditLog.create({
        data: {
            actorId: session.userId,
            actorRole: session.role || 'USER',
            actorName: session.name || 'User',
            actionType: 'VIEW_BANK_DETAILS',
            entityType: 'PROPERTY',
            entityId: propertyId,
            description: `User verified identity via OTP and unmasked bank details for property: ${property.name || propertyId}`
        }
    });

    // 4. Generate Expiring Cloudinary URL for Cancelled Cheque (120 seconds TTL)
    let secureChequeUrl = property.cancelChequeUrl;
    
    if (secureChequeUrl) {
        const publicId = extractCloudinaryPublicId(secureChequeUrl);
        if (publicId) {
            // Check if it was uploaded as private
            const isPrivate = secureChequeUrl.startsWith('private:');
            
            if (isPrivate) {
                secureChequeUrl = cloudinary.utils.private_download_url(publicId, 'jpg', {
                    expires_at: Math.floor(Date.now() / 1000) + 120, // 2 minutes
                    attachment: false,
                });
            } else {
                // For standard uploads, use sign_url
                secureChequeUrl = cloudinary.utils.url(publicId, {
                    secure: true,
                    sign_url: true,
                    expires_at: Math.floor(Date.now() / 1000) + 120 // 2 minutes
                });
            }
        }
    }

    // 5. Decrypt Bank Details
    const bankAccountNo = decryptIfPresent(property.bankAccountNoEncrypted);
    const bankIfsc = decryptIfPresent(property.bankIfscEncrypted);

    return {
        success: true,
        bankAccountNo,
        bankIfsc,
        cancelChequeUrl: secureChequeUrl,
        expiresAt: Date.now() + 120 * 1000 // 2 minutes from now in ms
    };
}
