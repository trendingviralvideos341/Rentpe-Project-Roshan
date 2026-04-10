import { redirect } from "next/navigation";

export default function StudentMaintenanceRedirect() {
    redirect("/dashboard/student/tickets");
}
