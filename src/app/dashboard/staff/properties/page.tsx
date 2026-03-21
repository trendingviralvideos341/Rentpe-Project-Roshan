import { PropertiesContainer } from "@/components/dashboard/PropertiesContainer";
import { getCurrentUser } from "@/actions/auth";

export default async function StaffPropertiesPage() {
    const user = await getCurrentUser() as any;
    const permissions = user?.staffPermissions ? JSON.parse(user.staffPermissions) : [];

    return (
        <div className="p-4 md:p-8">
            <PropertiesContainer role="staff" permissions={permissions} />
        </div>
    );
}
