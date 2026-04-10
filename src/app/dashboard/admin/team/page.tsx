import { redirect } from "next/navigation";
export default function TeamRedirect() { redirect("/dashboard/admin/internal-team?tab=roles"); }
