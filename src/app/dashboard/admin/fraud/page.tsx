import prisma from "@/lib/prisma";
import { getFraudFlags, getLinkedAccounts, getFraudSummary, resolveFraudFlag, blockFraudUser, freezeUserPayouts, approveFlaggedBooking } from "@/actions/fraudAdmin";
import FraudDashboardClient from "./FraudDashboardClient";

export const dynamic = 'force-dynamic';

export default async function FraudManagementPage() {
    const [summary, flags, linkedAccounts] = await Promise.all([
        getFraudSummary(),
        getFraudFlags(undefined, 100),
        getLinkedAccounts(50)
    ]);

    return (
        <FraudDashboardClient
            summary={summary}
            flags={flags as any}
            linkedAccounts={linkedAccounts as any}
        />
    );
}
