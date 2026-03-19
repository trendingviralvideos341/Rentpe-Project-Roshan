import { ActivityLogContainer } from "@/components/dashboard/ActivityLogContainer";

export default function StaffActivityLogPage() {
    return (
        <div className="p-4 md:p-8">
            <ActivityLogContainer role="staff" />
        </div>
    );
}
