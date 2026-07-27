'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidateGlobalTenants } from "@/lib/cache";
import { createNotification } from "@/actions/notifications";
import { sendEmail } from "@/lib/email";

/**
 * Start or continue a message thread between student and owner
 * threadId = "booking:{bookingId}" or "property:{propertyId}:{userId}"
 */
export async function sendMessage(data: {
    receiverId: string;
    content: string;
    bookingId?: string;
    propertyId?: string;
    attachmentData?: string;
    attachmentName?: string;
}) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    if (!data.content?.trim()) throw new Error("Message cannot be empty");

    const senderId = (session as any).userId;

    // Build thread ID from context
    const threadId = data.bookingId
        ? `booking:${data.bookingId}`
        : data.propertyId
        ? `property:${data.propertyId}:${[senderId, data.receiverId].sort().join(':')}`
        : `direct:${[senderId, data.receiverId].sort().join(':')}`;

    const message = await (prisma as any).message.create({
        data: {
            threadId,
            bookingId: data.bookingId,
            propertyId: data.propertyId,
            senderId,
            receiverId: data.receiverId,
            content: data.content.trim(),
            attachmentData: data.attachmentData,
            attachmentName: data.attachmentName,
        }
    });

    // Notify receiver (in-dashboard notification)
    const sender = await prisma.user.findUnique({ where: { id: senderId }, select: { name: true } });
    await createNotification(
        data.receiverId,
        'MESSAGE',
        `💬 New message from ${sender?.name || 'Someone'}: "${data.content.slice(0, 60)}${data.content.length > 60 ? '...' : ''}"`
    );

    const receiver = await prisma.user.findUnique({ where: { id: data.receiverId }, select: { email: true, name: true } });
    if (receiver?.email) {
        sendEmail({
            to: receiver.email,
            subject: `New message from ${sender?.name || 'Support'} 💬`,
            html: `<p>Hi ${receiver.name || 'there'},</p><p>You have a new message from <strong>${sender?.name || 'RentPe User'}</strong>:</p><blockquote style="border-left: 4px solid #8b5cf6; padding-left: 15px; font-style: italic; color: #475569;">"${data.content.slice(0, 100)}${data.content.length > 100 ? '...' : ''}"</blockquote><p><a href="https://rentpe.in/dashboard" style="display:inline-block; background:#8b5cf6; color:white; padding:10px 20px; border-radius:6px; text-decoration:none;">Reply in Dashboard</a></p>`
        }).catch(err => console.error('Failed to email message notification:', err));
    }

     revalidateGlobalTenants();
    return message;
}

/**
 * Get all message threads for current user (inbox)
 */
export async function getMessageThreads() {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const userId = (session as any).userId;

    // Get latest message per thread
    const allMessages = await (prisma as any).message.findMany({
        where: {
            OR: [{ senderId: userId }, { receiverId: userId }],
            AND: [
                { deletedBySender: userId === undefined ? false : { equals: false } },
            ]
        },
        include: {
            sender: { select: { id: true, name: true, role: true, profilePhoto: true } },
            receiver: { select: { id: true, name: true, role: true, profilePhoto: true } },
        },
        orderBy: { createdAt: 'desc' }
    });

    // Group by threadId, keep only latest per thread
    const threads = new Map<string, any>();
    for (const msg of allMessages) {
        if (!threads.has(msg.threadId)) {
            const otherUser = msg.senderId === userId ? msg.receiver : msg.sender;
            const unread = allMessages.filter((m: any) =>
                m.threadId === msg.threadId && m.receiverId === userId && !m.isRead
            ).length;
            threads.set(msg.threadId, { ...msg, otherUser, unreadCount: unread });
        }
    }

    return Array.from(threads.values());
}

/**
 * Get all messages in a thread
 */
export async function getThreadMessages(threadId: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const userId = (session as any).userId;

    const messages = await (prisma as any).message.findMany({
        where: { threadId },
        include: {
            sender: { select: { id: true, name: true, role: true, profilePhoto: true } },
        },
        orderBy: { createdAt: 'asc' }
    });

    // Filter out messages deleted by this user
    const filtered = messages.filter((m: any) =>
        !(m.senderId === userId && m.deletedBySender) &&
        !(m.receiverId === userId && m.deletedByReceiver)
    );

    // Mark messages sent to me as read
    const unreadIds = messages
        .filter((m: any) => m.receiverId === userId && !m.isRead)
        .map((m: any) => m.id);

    if (unreadIds.length) {
        await (prisma as any).message.updateMany({
            where: { id: { in: unreadIds } },
            data: { isRead: true, readAt: new Date() }
        });
    }

    return filtered;
}

/**
 * Get unread message count for current user
 */
export async function getUnreadMessageCount(): Promise<number> {
    const session = await getSession();
    if (!session) return 0;

    return (prisma as any).message.count({
        where: { receiverId: (session as any).userId, isRead: false }
    });
}

/**
 * Delete a message (soft delete for the user's side only)
 */
export async function deleteMessage(messageId: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const msg = await (prisma as any).message.findUnique({ where: { id: messageId } });
    if (!msg) throw new Error("Message not found");

    const userId = (session as any).userId;
    const update = msg.senderId === userId
        ? { deletedBySender: true }
        : { deletedByReceiver: true };

    await (prisma as any).message.update({ where: { id: messageId }, data: update });
     revalidateGlobalTenants();
    return { success: true };
}
