import { redirect } from "next/navigation";
// Resolution centre is now split: Tickets → /tickets, Refunds → /refunds
export default function ResolutionsRedirect() {
    redirect("/dashboard/admin/tickets");
}
