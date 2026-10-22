"use client"

import { useAuth } from "@/lib/auth-context"
import BookingWizard from "@/components/appointment/BookingWizard"
import GoogleAuthButton from "@/components/layout/GoogleAuthButton"
import { ShieldCheck, Calendar, Lock, Loader2, Stethoscope, CheckCircle2 } from "lucide-react"
import { doctorInfo } from "@/lib/data"

export default function ProtectedBookingClient() {
  const { user, loading, error } = useAuth()

  // 1. Loading state: Waiting for Firebase to determine auth state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-medical-blue mb-4" />
        <h2 className="text-lg font-heading font-bold text-deep-trust">Verifying Patient Session...</h2>
        <p className="text-text-secondary text-xs mt-1">Connecting securely to medical portal</p>
      </div>
    )
  }

  // 2. Unauthenticated state: Block access to booking wizard and patient data
  if (!user) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-8 sm:p-10 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-soft-sky flex items-center justify-center text-medical-blue mb-6 shadow-sm">
            <Lock className="w-8 h-8" />
          </div>

          <p className="text-medical-blue font-semibold text-xs tracking-wider uppercase mb-1">
            Secure Medical Portal
          </p>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-deep-trust mb-3">
            Sign In to Schedule Your Visit
          </h1>
          <p className="text-text-secondary text-sm leading-relaxed mb-8 max-w-md mx-auto">
            To protect your medical details and link your consultation history with {doctorInfo.name}, please sign in with your verified Google account.
          </p>

          <div className="flex flex-col items-center justify-center gap-3">
            <div className="transform scale-110">
              <GoogleAuthButton />
            </div>
            <p className="text-[11px] text-text-secondary mt-2">
              Fast 1-click verification · No passwords required
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100 grid grid-cols-2 gap-3 text-left">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-soft-sky/20">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-semibold text-deep-trust block">Private Records</span>
                <span className="text-text-secondary text-[11px]">Strictly protected medical notes</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-soft-sky/20">
              <Calendar className="w-4 h-4 text-medical-blue shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-semibold text-deep-trust block">Instant Confirmation</span>
                <span className="text-text-secondary text-[11px]">Real-time calendar reservation</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 3. Authenticated state: Render the booking wizard
  return <BookingWizard />
}
