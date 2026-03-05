import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import RazorpaySettingsClient from "./RazorpaySettingsClient";

export default async function RazorpaySettingsPage() {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') redirect('/login');

    const user = await prisma.user.findUnique({
        where: { id: (session as any).userId },
        select: { razorpayAccountId: true }
    });

    return <RazorpaySettingsClient initialAccountId={user?.razorpayAccountId || null} />;
}
