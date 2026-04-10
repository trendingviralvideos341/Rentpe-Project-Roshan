import { redirect } from "next/navigation";
export default function KYCRedirect() { redirect("/dashboard/admin/verifications?tab=owner"); }
