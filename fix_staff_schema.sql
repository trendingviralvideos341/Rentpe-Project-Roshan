-- Robust Fix for Staff Management Schema Mismatch

-- 1. Add missing columns to owner_employees (IF NOT EXISTS is supported in ALTER TABLE for columns)
ALTER TABLE "owner_employees" 
ADD COLUMN IF NOT EXISTS "pincode" TEXT,
ADD COLUMN IF NOT EXISTS "city" TEXT,
ADD COLUMN IF NOT EXISTS "state" TEXT,
ADD COLUMN IF NOT EXISTS "postOffice" TEXT,
ADD COLUMN IF NOT EXISTS "address" TEXT,
ADD COLUMN IF NOT EXISTS "invitationToken" TEXT,
ADD COLUMN IF NOT EXISTS "invitationExpires" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- 2. Add unique indices if they don't exist
CREATE UNIQUE INDEX IF NOT EXISTS "owner_employees_invitationToken_key" ON "owner_employees"("invitationToken");
CREATE UNIQUE INDEX IF NOT EXISTS "owner_employees_userId_key" ON "owner_employees"("userId");

-- 3. Create employee_property_assignment table
CREATE TABLE IF NOT EXISTS "employee_property_assignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "assignedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_property_assignment_pkey" PRIMARY KEY ("id")
);

-- 4. Add foreign keys if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_property_assignment_employeeId_fkey') THEN
        ALTER TABLE "employee_property_assignment" ADD CONSTRAINT "employee_property_assignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "owner_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_property_assignment_propertyId_fkey') THEN
        ALTER TABLE "employee_property_assignment" ADD CONSTRAINT "employee_property_assignment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- 5. Add unique constraint to employee_property_assignment
CREATE UNIQUE INDEX IF NOT EXISTS "employee_property_assignment_employeeId_propertyId_key" ON "employee_property_assignment"("employeeId", "propertyId");
