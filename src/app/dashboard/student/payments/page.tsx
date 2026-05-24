import { getAllStudentBookingsWithPayments } from "@/actions/payments";
import PaymentHistoryClient from "./PaymentHistoryClient";

export const metadata = { title: "Payment History | RentPe Student Dashboard" };

export default async function PaymentsPage() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allData: any[] = [];
    try {
        allData = await getAllStudentBookingsWithPayments();
    } catch {}

    return <PaymentHistoryClient allData={allData} />;
}
