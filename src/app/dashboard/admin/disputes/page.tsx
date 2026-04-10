import { redirect } from "next/navigation";
export default function DisputesRedirect() { redirect("/dashboard/admin/resolutions?tab=disputes"); }
