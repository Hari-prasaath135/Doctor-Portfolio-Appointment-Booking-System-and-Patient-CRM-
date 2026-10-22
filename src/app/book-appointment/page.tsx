import type { Metadata } from "next"
import ProtectedBookingClient from "@/components/appointment/ProtectedBookingClient"

export const metadata: Metadata = {
  title: "Book Appointment — Dr. Vijay | Interventional Radiologist",
  description:
    "Book your appointment with Dr. Vijay. Select consultation type, slot, provide patient details and secure your reservation.",
}

export default function BookAppointmentPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-warm-offwhite to-soft-sky/30 pt-28 pb-16">
      <div className="section-container">
        <ProtectedBookingClient />
      </div>
    </div>
  )
}
