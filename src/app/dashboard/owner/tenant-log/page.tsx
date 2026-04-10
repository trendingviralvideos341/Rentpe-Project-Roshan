import { redirect } from "next/navigation";
export default function TenantLogRedirect() {
    redirect("/dashboard/owner");
}
