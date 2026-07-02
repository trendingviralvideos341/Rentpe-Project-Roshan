import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const monthNames: Record<string, string> = {
  JAN: "01", JANU: "01", JANUARY: "01",
  FEB: "02", FEBR: "02", FEBRUARY: "02",
  MAR: "03", MARC: "03", MARCH: "03",
  APR: "04", APRI: "04", APRIL: "04",
  MAY: "05",
  JUN: "06", JUNE: "06",
  JUL: "07", JULY: "07",
  AUG: "08", AUGU: "08", AUGUST: "08",
  SEP: "09", SEPT: "09", SEPTEMBER: "09",
  OCT: "10", OCTO: "10", OCTOBER: "10",
  NOV: "11", NOVE: "11", NOVEMBER: "11",
  DEC: "12", DECE: "12", DECEMBER: "12"
};

function parseToBillingMonth(monthStr: string): string | null {
  if (!monthStr) return null;
  const trimmed = monthStr.trim().toUpperCase();

  // Already YYYY-MM format (e.g. "2026-07")
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Legacy human format (e.g. "July 2026" or "Jun 2026")
  const parts = trimmed.split(/\s+/);
  if (parts.length === 2) {
    const monthName = parts[0].substring(0, 3);
    const year = parts[1];
    const monthNum = monthNames[monthName];
    if (monthNum && /^\d{4}$/.test(year)) {
      return `${year}-${monthNum}`;
    }
  }

  return null;
}

async function main() {
  console.log("Starting month format standardization migration...");

  // 1. Migrate RentRecords
  const rentRecords = await prisma.rentRecord.findMany();
  console.log(`Found ${rentRecords.length} RentRecords.`);
  
  let migratedRecords = 0;
  for (const record of rentRecords) {
    const standardizedMonth = parseToBillingMonth(record.month);
    if (standardizedMonth && standardizedMonth !== record.month) {
      await prisma.rentRecord.update({
        where: { id: record.id },
        data: { month: standardizedMonth }
      });
      migratedRecords++;
    }
  }
  console.log(`Standardized ${migratedRecords} RentRecords to YYYY-MM format.`);

  // 2. Migrate RentInvoices
  const rentInvoices = await prisma.rentInvoice.findMany();
  console.log(`Found ${rentInvoices.length} RentInvoices.`);

  let migratedInvoices = 0;
  for (const invoice of rentInvoices) {
    const standardizedMonth = parseToBillingMonth(invoice.month);
    if (standardizedMonth && standardizedMonth !== invoice.month) {
      await prisma.rentInvoice.update({
        where: { id: invoice.id },
        data: { month: standardizedMonth }
      });
      migratedInvoices++;
    }
  }
  console.log(`Standardized ${migratedInvoices} RentInvoices to YYYY-MM format.`);

  // 3. Synchronize Payment Statuses
  console.log("Synchronizing paid RentInvoices with RentRecords...");
  const paidInvoices = await prisma.rentInvoice.findMany({
    where: { status: "PAID" },
    include: { billingProfile: true }
  });

  let synchronizedCount = 0;
  for (const invoice of paidInvoices) {
    if (!invoice.tenantId && !invoice.billingProfile?.tenantId) continue;
    const tenantId = invoice.tenantId || invoice.billingProfile.tenantId;

    // Standard month string (e.g. "2026-07")
    const targetMonth = invoice.month; 

    // Find RentRecord for this tenant and month
    const matchingRecord = await prisma.rentRecord.findFirst({
      where: {
        tenantId,
        month: targetMonth
      }
    });

    if (matchingRecord && !matchingRecord.paid) {
      const paidOnDate = invoice.paidAt
        ? new Date(invoice.paidAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
        : new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

      await prisma.rentRecord.update({
        where: { id: matchingRecord.id },
        data: {
          paid: true,
          paidOn: paidOnDate,
          note: matchingRecord.note || `Auto-synchronized with Invoice ${invoice.displayId}`
        }
      });
      synchronizedCount++;
      console.log(`Synced: Tenant ${tenantId} | Month ${targetMonth} marked PAID (Invoice: ${invoice.displayId})`);
    }
  }

  console.log(`Synchronization finished. Successfully synced ${synchronizedCount} records.`);
  console.log("Migration complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
