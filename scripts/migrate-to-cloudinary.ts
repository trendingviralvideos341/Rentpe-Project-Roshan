import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function uploadToCloudinary(base64Data: string, folder: string): Promise<string> {
  if (!base64Data || !base64Data.startsWith('data:')) return base64Data;
  try {
    const res = await cloudinary.uploader.upload(base64Data, {
      folder: `rentpe/migration/${folder}`,
      resource_type: 'auto',
    });
    return res.secure_url;
  } catch (e) {
    console.error(`Failed to upload to ${folder}:`, e);
    return base64Data;
  }
}

async function migrate() {
  console.log('🚀 Starting Cloudinary Migration...');

  // 1. Tenant Documents — fileData was renamed to fileUrl in July 2026 schema cleanup
  const docs = await prisma.tenantDocument.findMany({
    where: { fileUrl: { startsWith: 'data:' } }
  });
  console.log(`Found ${docs.length} Tenant Documents to migrate.`);
  for (const doc of docs) {
    const url = await uploadToCloudinary(doc.fileUrl, `kyc/${doc.bookingId}`);
    await prisma.tenantDocument.update({
      where: { id: doc.id },
      data: { fileUrl: url }
    });
  }

  // 2. Properties
  const properties = await prisma.property.findMany();
  console.log(`Checking ${properties.length} Properties for migration...`);
  for (const p of properties) {
    const updateData: any = {};
    
    // Single fields
    const singleFields = ['pgPhotoUrl', 'aadhaarProof', 'panProof', 'pgLicenceUrl', 'parkingPhoto', 'bathroomPhoto', 'livePhotoUrl'];
    for (const field of singleFields) {
        const val = (p as any)[field];
        if (val && val.startsWith('data:')) {
            updateData[field] = await uploadToCloudinary(val, `properties/${p.id}`);
        }
    }

    // JSON Arrays
    const arrayFields = ['images', 'buildingPhotos', 'commonAreaPhotos'];
    for (const field of arrayFields) {
        const val = (p as any)[field];
        if (val) {
            try {
                const photos = JSON.parse(val);
                if (Array.isArray(photos)) {
                    const newPhotos = [];
                    for (const photo of photos) {
                        if (photo.startsWith('data:')) {
                            newPhotos.push(await uploadToCloudinary(photo, `properties/${p.id}`));
                        } else {
                            newPhotos.push(photo);
                        }
                    }
                    updateData[field] = JSON.stringify(newPhotos);
                }
            } catch (e) {}
        }
    }

    if (Object.keys(updateData).length > 0) {
        await prisma.property.update({
            where: { id: p.id },
            data: updateData
        });
    }
  }

  // 3. Employees
  const employees = await prisma.employee.findMany();
  console.log(`Checking ${employees.length} Employee records...`);
  for (const emp of employees) {
    const updateData: any = {};
    const docFields = ['aadhaarDoc', 'panDoc', 'photo', 'educationCert', 'experienceLetter', 'policeVerification', 'addressProof'];
    for (const field of docFields) {
        const val = (emp as any)[field];
        if (val && val.startsWith('data:')) {
            updateData[field] = await uploadToCloudinary(val, `employees/${emp.id}`);
        }
    }
    if (Object.keys(updateData).length > 0) {
        await prisma.employee.update({
            where: { id: emp.id },
            data: updateData
        });
    }
  }

  // 4. Owner Onboarding — *Data fields renamed to *Url in July 2026 schema cleanup
  const onboards = await prisma.ownerOnboarding.findMany();
  console.log(`Checking ${onboards.length} Owner Onboarding records...`);
  for (const o of onboards) {
    const updateData: any = {};
    const fields = ['idProofUrl', 'pgLicenceUrl', 'buildingImageUrl'];
    for (const f of fields) {
        const val = (o as any)[f];
        if (val && val.startsWith('data:')) {
            updateData[f] = await uploadToCloudinary(val, `onboarding/${o.displayId}`);
        }
    }
    if (o.additionalPhotos) {
        try {
            const photos = JSON.parse(o.additionalPhotos);
            const newPhotos = [];
            for (const p of photos) {
                if (p.startsWith('data:')) {
                    newPhotos.push(await uploadToCloudinary(p, `onboarding/${o.displayId}`));
                } else {
                    newPhotos.push(p);
                }
            }
            updateData.additionalPhotos = JSON.stringify(newPhotos);
        } catch (e) {}
    }
    if (Object.keys(updateData).length > 0) {
        await prisma.ownerOnboarding.update({
            where: { id: o.id },
            data: updateData
        });
    }
  }

  console.log('✅ Migration Completed!');
}

migrate()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
