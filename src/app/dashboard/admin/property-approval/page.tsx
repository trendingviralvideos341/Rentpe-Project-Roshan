import { redirect } from "next/navigation";
export default function PropertyApprovalRedirect() {
    redirect("/dashboard/admin/properties");
}
