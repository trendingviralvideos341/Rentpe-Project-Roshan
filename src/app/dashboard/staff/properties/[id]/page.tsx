import { PropertyDetailsContainer } from "@/components/dashboard/PropertyDetailsContainer";
import { getSession } from "@/lib/auth";

export default async function StaffPropertyDetailsPage() {
    const session = await getSession();
    
    return (
        <div className="p-4 md:p-8">
            <PropertyDetailsContainer role="staff" permissions={session?.permissions || []} />
        </div>
    );
}
