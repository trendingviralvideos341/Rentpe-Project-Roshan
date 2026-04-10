import { redirect } from "next/navigation";
export default function RentCollectionRedirect() {
    redirect("/dashboard/owner/payments");
}
