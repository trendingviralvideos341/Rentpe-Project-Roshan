import { redirect } from "next/navigation";
// Disputes are now handled via Support Tickets (category=DISPUTE)
export default function DisputesRedirect() {
    redirect("/dashboard/admin/tickets");
}
