import { adminGetAllOnboardingFees } from "@/actions/properties";
import AdminOnboardingFeesClient from "./AdminOnboardingFeesClient";

export const metadata = { title: "Property Onboarding Fees | Admin Finance | RentPe" };

export default async function AdminOnboardingFeesPage() {
    let data: any = { properties: [], feeAmount: 99, totalCollected: 0, paidCount: 0, pendingCount: 0 };
    try {
        data = await adminGetAllOnboardingFees();
    } catch {}
    return <AdminOnboardingFeesClient data={data} />;
}
