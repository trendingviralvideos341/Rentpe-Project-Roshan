import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import OnboardingPaymentClient from "./OnboardingPaymentClient";

export default async function PayOnboardingPage({ params }: { params: { id: string } }) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') redirect('/login');

    const property = await prisma.property.findUnique({
        where: { id: params.id, ownerId: (session as any).userId },
        select: { id: true, name: true, status: true, rooms: true }
    });

    if (!property || property.status !== 'PAYMENT_PENDING') {
        redirect('/dashboard/owner/properties');
    }

    const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
    const fee = settings?.ownerOnboardingFeeFlat || 99;

    return <OnboardingPaymentClient property={property} fee={fee} />;
}
