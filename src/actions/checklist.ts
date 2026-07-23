'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";

const DEFAULT_CHECKLIST_ITEMS = [
    { id: '1', category: 'Documents', item: 'Original Aadhaar Card', required: true, done: false },
    { id: '2', category: 'Documents', item: 'Original PAN Card', required: true, done: false },
    { id: '3', category: 'Documents', item: 'College/Office ID Card', required: true, done: false },
    { id: '4', category: 'Documents', item: 'Passport size photos (4)', required: true, done: false },
    { id: '5', category: 'Documents', item: 'Rent agreement copy', required: true, done: false },
    { id: '6', category: 'Documents', item: 'Emergency contact details', required: true, done: false },
    { id: '7', category: 'Verify at PG', item: 'Room condition matches photos', required: true, done: false },
    { id: '8', category: 'Verify at PG', item: 'All furniture is intact', required: true, done: false },
    { id: '9', category: 'Verify at PG', item: 'AC / Fan working properly', required: false, done: false },
    { id: '10', category: 'Verify at PG', item: 'WiFi credentials received', required: false, done: false },
    { id: '11', category: 'Verify at PG', item: 'Water supply is adequate', required: true, done: false },
    { id: '12', category: 'Verify at PG', item: 'Bathroom is clean', required: true, done: false },
    { id: '13', category: 'Verify at PG', item: 'Lock and key received', required: true, done: false },
    { id: '14', category: 'Verify at PG', item: 'Emergency exits noted', required: true, done: false },
    { id: '15', category: 'Essentials to Pack', item: 'Bedsheet and pillow covers', required: false, done: false },
    { id: '16', category: 'Essentials to Pack', item: 'Toiletries for first week', required: false, done: false },
    { id: '17', category: 'Essentials to Pack', item: 'Extension cord / power strip', required: false, done: false },
    { id: '18', category: 'Essentials to Pack', item: 'Laptop and chargers', required: false, done: false },
    { id: '19', category: 'Financial', item: 'Security deposit paid', required: true, done: false },
    { id: '20', category: 'Financial', item: 'First month rent paid', required: true, done: false },
    { id: '21', category: 'Financial', item: 'Receipt for deposit received', required: true, done: false },
];

/** Auto-creates checklist for a booking (called on approval). Idempotent. */
export async function initializeChecklist(bookingId: string, userId: string) {
    const existing = await prisma.moveInChecklist.findUnique({ where: { bookingId } });
    if (existing) return existing;

    return await prisma.moveInChecklist.create({
        data: {
            bookingId,
            userId,
            items: JSON.stringify(DEFAULT_CHECKLIST_ITEMS),
        }
    });
}

/** Get checklist for the logged-in student's booking */
export async function getChecklist(bookingId: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const userId = (session as any).userId;

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.userId !== userId) throw new Error("Unauthorized");

    let checklist = await prisma.moveInChecklist.findUnique({ where: { bookingId } });
    if (!checklist) {
        checklist = await initializeChecklist(bookingId, userId);
    }

    let parsedItems: typeof DEFAULT_CHECKLIST_ITEMS = DEFAULT_CHECKLIST_ITEMS;
    try { parsedItems = JSON.parse(checklist.items || '[]') as typeof DEFAULT_CHECKLIST_ITEMS; } catch { parsedItems = DEFAULT_CHECKLIST_ITEMS; }
    return { ...checklist, items: parsedItems };
}

/** Toggle a checklist item's done state */
export async function updateChecklistItem(bookingId: string, itemId: string, done: boolean) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const userId = (session as any).userId;

    const checklist = await prisma.moveInChecklist.findUnique({ where: { bookingId } });
    if (!checklist || checklist.userId !== userId) throw new Error("Unauthorized");

    let items: typeof DEFAULT_CHECKLIST_ITEMS = DEFAULT_CHECKLIST_ITEMS;
    try { items = JSON.parse(checklist.items || '[]') as typeof DEFAULT_CHECKLIST_ITEMS; } catch { items = DEFAULT_CHECKLIST_ITEMS; }
    const updated = items.map((item: any) => item.id === itemId ? { ...item, done } : item);
    const allDone = updated.every((i: any) => i.done);

    const result = await prisma.moveInChecklist.update({
        where: { bookingId },
        data: {
            items: JSON.stringify(updated),
            completedAt: allDone ? new Date() : null,
        }
    });

    revalidatePath(`/dashboard/student/bookings/${bookingId}/checklist`);
    return { ...result, items: updated };
}
