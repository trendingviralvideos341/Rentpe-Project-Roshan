import { redirect } from "next/navigation";
export default function DocVerificationRedirect() { redirect("/dashboard/admin/verifications?tab=tenant"); }
