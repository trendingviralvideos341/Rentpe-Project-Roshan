import { redirect } from "next/navigation";

export default function OwnerMaintenanceRedirect() {
    redirect("/dashboard/owner/tickets");
}
