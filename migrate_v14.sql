-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "message" TEXT,
ADD COLUMN     "occupants" INTEGER DEFAULT 1,
ADD COLUMN     "stayDuration" INTEGER;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "licenseNumber" TEXT,
ADD COLUMN     "reraId" TEXT;
