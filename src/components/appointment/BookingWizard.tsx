"use client"

import { useState, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import {
  CalendarDays,
  Clock,
  User,
  Shield,
  Stethoscope,
  Video,
  RefreshCw,
  FileText,
  Upload,
  X,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Loader2,
  FileCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { doctorInfo } from "@/lib/data"
import { auth } from "@/lib/firebase-client"
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth"
import { trackEvent } from "@/lib/analytics"
import { apiUrl } from "@/lib/api"

export type ConsultationType = "IN_PERSON" | "VIDEO" | "FOLLOW_UP"

export interface ConsultationConfig {
  type: ConsultationType
  title: string
  description: string
  durationMinutes: number
  feeInPaise: number
  icon: typeof Stethoscope
  badge: string
}

export const CONSULTATION_TYPES: ConsultationConfig[] = [
  {
    type: "IN_PERSON",
    title: "In-Person Clinic Visit",
    description: "Full clinical examination & direct consultation at Dr. Vijay's Clinic.",
    durationMinutes: 30,
    feeInPaise: 100000, // ₹1,000.00
    icon: Stethoscope,
    badge: "Recommended for first visit",
  },
  {
    type: "VIDEO",
    title: "Video Teleconsultation",
    description: "Secure, remote video consultation from the comfort of your home.",
    durationMinutes: 30,
    feeInPaise: 80000, // ₹800.00
    icon: Video,
    badge: "Convenient & Fast",
  },
  {
    type: "FOLLOW_UP",
    title: "Post-Procedure Follow-Up",
    description: "Progress review and recovery check for existing patients.",
    durationMinutes: 20,
    feeInPaise: 50000, // ₹500.00
    icon: RefreshCw,
    badge: "Existing Patients",
  },
]

export interface AttachmentItem {
  id: string
  name: string
  size: number
  type: string
}

export interface BookingFormData {
  consultationType: ConsultationType
  date: string
  time: string
  fullName: string
  dateOfBirth: string
  age: number
  phone: string
  email: string
  reason: string
  medicalHistory: string
  attachments: AttachmentItem[]
}

const steps = [
  { id: 1, title: "Consultation Type" },
  { id: 2, title: "Date & Slot" },
  { id: 3, title: "Patient Details" },
  { id: 4, title: "Review & Checkout" },
]

export default function BookingWizard() {
  const [currentStep, setCurrentStep] = useState(1)
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null)

  // Booking state
  const [booking, setBooking] = useState<BookingFormData>({
    consultationType: "IN_PERSON",
    date: "",
    time: "",
    fullName: "",
    dateOfBirth: "",
    age: 0,
    phone: "",
    email: "",
    reason: "",
    medicalHistory: "",
    attachments: [],
  })

  // Availability state
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [slots, setSlots] = useState<{ time: string; isAvailable: boolean }[]>([])
  const [loadingDates, setLoadingDates] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isOpeningCheckout, setIsOpeningCheckout] = useState(false)
  const [reservationSuccess, setReservationSuccess] = useState<{ appointmentId: string; fee: number } | null>(null)
  const [paymentConfirmed, setPaymentConfirmed] = useState<{
    appointmentId: string
    paymentId: string
    fee: number
  } | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [reconciliationNotice, setReconciliationNotice] = useState<string | null>(null)

  // Auto-fill logged-in patient details
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
      if (user) {
        setBooking((prev) => ({
          ...prev,
          fullName: prev.fullName || user.displayName || "",
          email: prev.email || user.email || "",
          phone: prev.phone || user.phoneNumber || "",
        }))
      }
    })
    return () => unsub()
  }, [])

  // Fetch published available dates from Phase 1 API
  useEffect(() => {
    let cancelled = false
    const fetchDates = async () => {
      setLoadingDates(true)
      try {
        const datesUrl = apiUrl("/availability/dates?doctorId=" + encodeURIComponent(doctorInfo.id))
        const res = await fetch(datesUrl)
        if (!res.ok) throw new Error("Failed to load clinic availability.")
        const json = await res.json()
        if (!cancelled) {
          const fetched: string[] = json.data?.availableDates || []
          setAvailableDates(fetched)
          setAvailabilityError(null)
          if (fetched.length > 0 && !booking.date) {
            setBooking((prev) => ({ ...prev, date: fetched[0] }))
          }
        }
      } catch {
        if (!cancelled) {
          setAvailableDates([])
          setAvailabilityError("Unable to load clinic availability. Please try again later.")
        }
      } finally {
        if (!cancelled) setLoadingDates(false)
      }
    }
    fetchDates()
    return () => {
      cancelled = true
    }
  }, [booking.date])

  // Fetch slots for selected date from Phase 1 API
  useEffect(() => {
    if (!booking.date) return
    let cancelled = false

    const fetchSlots = async () => {
      setLoadingSlots(true)
      try {
        const slotsUrl = apiUrl(
          "/availability/slots?doctorId=" + encodeURIComponent(doctorInfo.id) +
          "&date=" + encodeURIComponent(booking.date)
        )
        const res = await fetch(slotsUrl)
        if (!res.ok) throw new Error("Failed to load slots.")
        const json = await res.json()
        const data = json.data
        if (!cancelled) {
          if (!data || data.isLeave || data.isPublished === false) {
            setSlots([])
          } else {
            const allSlots: { time: string }[] = data.slots || []
            const freeList: string[] = data.freeSlots || []
            const mapped = allSlots.map((s) => ({
              time: s.time,
              isAvailable: freeList.includes(s.time),
            }))
            setSlots(mapped)
          }
          setSlotsError(null)
        }
      } catch {
        if (!cancelled) {
          setSlots([])
          setBooking((prev) => ({ ...prev, time: "" }))
          setSlotsError("Unable to load time slots. Please retry before booking.")
        }
      } finally {
        if (!cancelled) setLoadingSlots(false)
      }
    }

    fetchSlots()
    return () => {
      cancelled = true
    }
  }, [booking.date])

  // Calculate age from Date of Birth
  const handleDobChange = (dobStr: string) => {
    let age = 0
    if (dobStr) {
      const birth = new Date(dobStr)
      const now = new Date()
      age = now.getFullYear() - birth.getFullYear()
      const m = now.getMonth() - birth.getMonth()
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
        age--
      }
    }
    setBooking((prev) => ({
      ...prev,
      dateOfBirth: dobStr,
      age: Math.max(0, age),
    }))
    setErrors((prev) => ({ ...prev, dateOfBirth: "" }))
  }

  // Handle file uploads (validate file size < 5MB and allowed types PDF / Images)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newAttachments: AttachmentItem[] = [...booking.attachments]
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    let fileError = ""

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!allowedTypes.includes(file.type)) {
        fileError = "Only PDF, JPEG, PNG, and WebP documents are supported."
        continue
      }
      if (file.size > 5 * 1024 * 1024) {
        fileError = "Files must not exceed 5MB each."
        continue
      }
      if (newAttachments.length >= 5) {
        fileError = "Maximum 5 attachments allowed."
        break
      }
      newAttachments.push({
        id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: file.name,
        size: file.size,
        type: file.type,
      })
    }

    setBooking((prev) => ({ ...prev, attachments: newAttachments }))
    if (fileError) {
      setErrors((prev) => ({ ...prev, attachments: fileError }))
    } else {
      setErrors((prev) => ({ ...prev, attachments: "" }))
    }
  }

  const removeAttachment = (id: string) => {
    setBooking((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((a) => a.id !== id),
    }))
  }

  // Validation per step
  const validateCurrentStep = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (currentStep === 1) {
      if (!booking.consultationType) {
        newErrors.consultationType = "Please select a consultation type"
      }
    }

    if (currentStep === 2) {
      if (!booking.date) {
        newErrors.date = "Please select an appointment date"
      }
      if (!booking.time) {
        newErrors.time = "Please select a time slot"
      }
    }

    if (currentStep === 3) {
      if (!booking.fullName.trim() || booking.fullName.trim().length < 2) {
        newErrors.fullName = "Please enter your full name"
      }
      if (!booking.dateOfBirth) {
        newErrors.dateOfBirth = "Please enter your date of birth"
      }
      if (!booking.phone || !/^[0-9+\-\s()]{7,15}$/.test(booking.phone)) {
        newErrors.phone = "Please enter a valid phone number"
      }
      if (!booking.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.email)) {
        newErrors.email = "Please enter a valid email address"
      }
      if (!booking.reason.trim()) {
        newErrors.reason = "Please enter the reason for your consultation"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateCurrentStep()) {
      if (currentStep === 1) {
        trackEvent({
          eventType: "booking_started",
          consultationType: booking.consultationType,
        })
        trackEvent({
          eventType: "consultation_selected",
          consultationType: booking.consultationType,
        })
      } else if (currentStep === 2) {
        trackEvent({
          eventType: "date_selected",
          consultationType: booking.consultationType,
        })
        trackEvent({
          eventType: "slot_selected",
          consultationType: booking.consultationType,
        })
      }
      setCurrentStep((prev) => Math.min(4, prev + 1))
    }
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1))
    setErrors({})
  }

  // Razorpay Checkout Trigger & Verification
  const launchRazorpayCheckout = async (appointmentId: string, feeInPaise: number) => {
    setIsOpeningCheckout(true)
    setPaymentError(null)
    setReconciliationNotice(null)

    try {
      if (!currentUser) throw new Error("Please sign in to proceed with payment.")
      const idToken = await currentUser.getIdToken()
      if (!idToken) throw new Error("Authentication expired. Please sign in again.")

      // 1. Create Razorpay order via backend
      const orderRes = await fetch(apiUrl("/payments/orders"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          appointmentId,
          idempotencyKey: `idem_${appointmentId}`,
        }),
      })

      const orderData = await orderRes.json()
      if (!orderRes.ok || !orderData.data) {
        throw new Error(orderData.error || "Failed to create payment order with payment gateway.")
      }

      const { keyId, orderId, amount, currency } = orderData.data

      // Check if Razorpay script is ready in window
      if (typeof window === "undefined" || !(window as any).Razorpay) {
        throw new Error("Razorpay Checkout failed to load. Please refresh and try again.")
      }

      // 2. Open Razorpay Standard Checkout
      const options = {
        key: keyId,
        amount,
        currency,
        name: "Dr. Vijay Clinic",
        description: `${selectedConfig.title} (Test Mode)`,
        image: "/dr-vijay-hero.png",
        order_id: orderId,
        handler: async (response: {
          razorpay_payment_id: string
          razorpay_order_id: string
          razorpay_signature: string
        }) => {
          setIsSubmitting(true)
          try {
            // 3. Verify checkout response authoritatively on the backend
            const verifyToken = await currentUser.getIdToken()
            const verifyRes = await fetch(apiUrl("/payments/verify"), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${verifyToken}`,
              },
              body: JSON.stringify({
                appointmentId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            })

            const verifyData = await verifyRes.json()
            if (!verifyRes.ok) {
              throw new Error(verifyData.error || "Payment verification failed on the server.")
            }

            if (verifyData.data?.status === "CONFIRMED") {
              setPaymentConfirmed({
                appointmentId,
                paymentId: response.razorpay_payment_id,
                fee: feeInPaise,
              })
            } else if (verifyData.data?.status === "RECONCILIATION_REQUIRED") {
              setReconciliationNotice(
                verifyData.data?.message ||
                  "Payment received but slot reconciliation is required. Our clinic team has been alerted."
              )
            } else {
              setPaymentError("Payment is currently awaiting confirmation. We will notify you once confirmed.")
            }
          } catch (err: any) {
            setPaymentError(err.message || "Failed to verify payment with clinic server.")
          } finally {
            setIsSubmitting(false)
            setIsOpeningCheckout(false)
          }
        },
        prefill: {
          name: booking.fullName,
          email: booking.email || currentUser.email || "",
          contact: booking.phone || "",
        },
        notes: {
          appointmentId,
          environment: "test",
        },
        theme: {
          color: "#0f4c81",
        },
        modal: {
          ondismiss: () => {
            setIsOpeningCheckout(false)
          },
        },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.on("payment.failed", (failResponse: any) => {
        setPaymentError(failResponse.error?.description || "Payment failed at gateway. Please try again.")
        setIsOpeningCheckout(false)
      })
      rzp.open()
    } catch (err: any) {
      setPaymentError(err.message || "Could not initiate payment. Please try again.")
      setIsOpeningCheckout(false)
    }
  }

  // Handoff to Checkout (Atomic Slot Reservation via Backend)
  const handleProceedToCheckout = async () => {
    setIsSubmitting(true)
    setErrors({})
    setPaymentError(null)

    try {
      // Reopening checkout must reuse the existing reservation instead of creating
      // a second appointment when the patient previously dismissed or failed payment.
      if (reservationSuccess) {
        await launchRazorpayCheckout(reservationSuccess.appointmentId, reservationSuccess.fee)
        return
      }

      if (!currentUser) {
        throw new Error("You must be signed in with your verified account to reserve an appointment.")
      }

      const idToken = await currentUser.getIdToken()
      if (!idToken) {
        throw new Error("Your session has expired. Please sign in again.")
      }

      const payload = {
        doctorId: doctorInfo.id,
        consultationType: booking.consultationType,
        date: booking.date,
        time: booking.time,
        patientName: booking.fullName,
        email: booking.email || currentUser.email,
        phone: booking.phone,
        dateOfBirth: booking.dateOfBirth,
        age: booking.age,
        message: booking.reason,
        medicalHistory: booking.medicalHistory,
        attachments: booking.attachments,
      }

      const res = await fetch(apiUrl("/appointments"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        trackEvent({
          eventType: "booking_failed",
          consultationType: booking.consultationType,
          outcome: "failure",
        })
        throw new Error(data.error || "Failed to reserve appointment slot")
      }

      const createdAppointment = data.data
      trackEvent({
        eventType: "booking_submitted",
        consultationType: booking.consultationType,
        outcome: "success",
      })

      const fee = createdAppointment.feeInPaise || selectedConfig.feeInPaise
      setReservationSuccess({
        appointmentId: createdAppointment.id,
        fee,
      })

      // Immediately launch Razorpay checkout modal
      await launchRazorpayCheckout(createdAppointment.id, fee)
    } catch (err: any) {
      trackEvent({
        eventType: "booking_failed",
        consultationType: booking.consultationType,
        outcome: "failure",
      })
      setErrors({
        submit: err.message || "Slot could not be reserved. Please select another slot.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedConfig = CONSULTATION_TYPES.find((c) => c.type === booking.consultationType)!

  return (
    <div className="max-w-4xl mx-auto">
      {/* Step Header */}
      <div className="mb-10 text-center">
        <p className="text-medical-blue font-semibold text-xs tracking-wider uppercase mb-1">
          Patient Appointment Portal
        </p>
        <h1 className="text-3xl md:text-4xl font-heading font-bold text-deep-trust">
          Schedule Consultation with {doctorInfo.name}
        </h1>
        <p className="text-text-secondary text-sm mt-2">
          {doctorInfo.specialization} · Minimally Invasive &amp; Image-Guided Treatments
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-between max-w-2xl mx-auto mb-10 px-4">
        {steps.map((s, idx) => (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  currentStep === s.id
                    ? "bg-medical-blue text-white shadow-md ring-4 ring-medical-blue/20"
                    : currentStep > s.id
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-100 text-text-secondary"
                }`}
              >
                {currentStep > s.id ? <CheckCircle className="w-4 h-4" /> : s.id}
              </div>
              <span className="text-[11px] font-medium text-text-secondary mt-1.5 hidden sm:block whitespace-nowrap">
                {s.title}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-2 transition-all ${
                  currentStep > s.id ? "bg-emerald-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Main Form Content */}
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden p-6 md:p-8">
            {/* Step 1: Consultation Type */}
            {currentStep === 1 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <h2 className="text-xl font-heading font-bold text-deep-trust">Select Consultation Type</h2>
                <p className="text-text-secondary text-xs">
                  Choose the care format that suits your medical requirements.
                </p>

                <div className="grid gap-3.5 pt-2">
                  {CONSULTATION_TYPES.map((cfg) => {
                    const Icon = cfg.icon
                    const isSelected = booking.consultationType === cfg.type
                    return (
                      <div
                        key={cfg.type}
                        onClick={() => {
                          setBooking((prev) => ({ ...prev, consultationType: cfg.type }))
                          setErrors({})
                        }}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4 ${
                          isSelected
                            ? "border-medical-blue bg-soft-sky/40 shadow-sm"
                            : "border-gray-100 hover:border-medical-blue/30 bg-white"
                        }`}
                      >
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected ? "bg-medical-blue text-white" : "bg-soft-sky text-medical-blue"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-heading font-bold text-sm text-deep-trust">{cfg.title}</h3>
                            <span className="font-heading font-bold text-medical-blue text-sm">
                              ₹{(cfg.feeInPaise / 100).toLocaleString("en-IN")}
                            </span>
                          </div>
                          <p className="text-text-secondary text-xs mt-1">{cfg.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                              {cfg.badge}
                            </span>
                            <span className="text-[10px] text-text-secondary">· {cfg.durationMinutes} mins</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {/* Step 2: Date & Available Slot Selection */}
            {currentStep === 2 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div>
                  <h2 className="text-xl font-heading font-bold text-deep-trust">Choose Date &amp; Slot</h2>
                  <p className="text-text-secondary text-xs mt-0.5">
                    Appointments are scheduled according to official clinic working hours in Asia/Kolkata (IST).
                  </p>
                </div>

                {/* Date Chips */}
                <div>
                  <Label className="text-xs font-semibold text-deep-trust mb-2 block flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-medical-blue" /> Published Available Dates
                  </Label>

                  {loadingDates ? (
                    <div className="flex items-center gap-2 py-4 text-xs text-text-secondary">
                      <Loader2 className="w-4 h-4 animate-spin text-medical-blue" /> Loading dates...
                    </div>
                  ) : availableDates.length === 0 ? (
                    <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">
                      {availabilityError || "No published dates available at this time. Please check back soon."}
                    </p>
                  ) : (
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                      {availableDates.map((dateStr) => {
                        const isSelected = booking.date === dateStr
                        const d = new Date(dateStr)
                        return (
                          <button
                            key={dateStr}
                            type="button"
                            onClick={() => {
                              setBooking((prev) => ({ ...prev, date: dateStr, time: "" }))
                              setErrors({})
                            }}
                            className={`flex flex-col items-center justify-center shrink-0 w-20 h-16 rounded-xl border-2 transition-all cursor-pointer ${
                              isSelected
                                ? "border-medical-blue bg-medical-blue text-white shadow-md"
                                : "border-gray-100 bg-white text-deep-trust hover:border-medical-blue/30"
                            }`}
                          >
                            <span className="text-[11px] font-medium opacity-80">
                              {d.toLocaleDateString("en-IN", { weekday: "short" })}
                            </span>
                            <span className="text-sm font-bold">
                              {d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Slots Grid */}
                <div>
                  <Label className="text-xs font-semibold text-deep-trust mb-2 block flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-medical-blue" /> Available Time Slots
                  </Label>

                  {loadingSlots ? (
                    <div className="flex items-center gap-2 py-6 text-xs text-text-secondary">
                      <Loader2 className="w-4 h-4 animate-spin text-medical-blue" /> Fetching slots for {booking.date}...
                    </div>
                  ) : slots.length === 0 ? (
                    <p className="text-xs text-text-secondary py-4 text-center">
                      {slotsError || "No slots available for this date."}
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                      {slots.map((s) => {
                        const isSelected = booking.time === s.time
                        return (
                          <button
                            key={s.time}
                            type="button"
                            disabled={!s.isAvailable}
                            onClick={() => {
                              setBooking((prev) => ({ ...prev, time: s.time }))
                              setErrors({})
                            }}
                            className={`py-2.5 rounded-xl text-xs font-semibold border-2 transition-all cursor-pointer disabled:cursor-not-allowed ${
                              !s.isAvailable
                                ? "border-gray-100 bg-gray-50 text-gray-300 line-through"
                                : isSelected
                                ? "border-medical-blue bg-medical-blue text-white shadow-md"
                                : "border-gray-100 bg-white text-deep-trust hover:border-medical-blue/30"
                            }`}
                          >
                            {s.time}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {errors.time && (
                    <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {errors.time}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 3: Patient Details & Medical Attachments */}
            {currentStep === 3 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <h2 className="text-xl font-heading font-bold text-deep-trust">Patient Information</h2>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-deep-trust mb-1 block">Full Name *</Label>
                    <Input
                      placeholder="e.g. Ramesh Kumar"
                      value={booking.fullName}
                      onChange={(e) => {
                        setBooking((prev) => ({ ...prev, fullName: e.target.value }))
                        setErrors((prev) => ({ ...prev, fullName: "" }))
                      }}
                      className="rounded-xl h-11 text-sm"
                    />
                    {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-deep-trust mb-1 block">
                      Date of Birth * {booking.age > 0 && <span className="text-medical-blue font-semibold">({booking.age} yrs)</span>}
                    </Label>
                    <Input
                      type="date"
                      value={booking.dateOfBirth}
                      onChange={(e) => handleDobChange(e.target.value)}
                      className="rounded-xl h-11 text-sm"
                    />
                    {errors.dateOfBirth && <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth}</p>}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-deep-trust mb-1 block">Phone Number *</Label>
                    <Input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={booking.phone}
                      onChange={(e) => {
                        setBooking((prev) => ({ ...prev, phone: e.target.value }))
                        setErrors((prev) => ({ ...prev, phone: "" }))
                      }}
                      className="rounded-xl h-11 text-sm"
                    />
                    {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-deep-trust mb-1 block">Registered Email *</Label>
                    <Input
                      type="email"
                      placeholder="patient@example.com"
                      value={booking.email}
                      onChange={(e) => {
                        setBooking((prev) => ({ ...prev, email: e.target.value }))
                        setErrors((prev) => ({ ...prev, email: "" }))
                      }}
                      className="rounded-xl h-11 text-sm"
                    />
                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-deep-trust mb-1 block">Reason for Consultation *</Label>
                  <Textarea
                    placeholder="Describe your current symptoms or primary concern..."
                    rows={3}
                    value={booking.reason}
                    onChange={(e) => {
                      setBooking((prev) => ({ ...prev, reason: e.target.value }))
                      setErrors((prev) => ({ ...prev, reason: "" }))
                    }}
                    className="rounded-xl text-sm resize-none"
                  />
                  {errors.reason && <p className="text-red-500 text-xs mt-1">{errors.reason}</p>}
                </div>

                <div>
                  <Label className="text-xs font-medium text-deep-trust mb-1 block">
                    Relevant Medical History <span className="text-text-secondary">(Optional)</span>
                  </Label>
                  <Textarea
                    placeholder="Any prior surgeries, known allergies, chronic conditions..."
                    rows={2}
                    value={booking.medicalHistory}
                    onChange={(e) => setBooking((prev) => ({ ...prev, medicalHistory: e.target.value }))}
                    className="rounded-xl text-sm resize-none"
                  />
                </div>

                {/* Medical Document Uploads */}
                <div className="pt-2">
                  <Label className="text-xs font-medium text-deep-trust mb-1.5 block">
                    Medical Reports &amp; Attachments <span className="text-text-secondary">(Max 5 files, &lt;5MB each)</span>
                  </Label>
                  <label className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-gray-200 hover:border-medical-blue/40 bg-soft-sky/10 transition-colors cursor-pointer">
                    <Upload className="w-5 h-5 text-medical-blue mb-1" />
                    <span className="text-xs font-semibold text-deep-trust">Click to upload documents</span>
                    <span className="text-[10px] text-text-secondary mt-0.5">PDF, JPEG, PNG, WebP</span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,image/png,image/jpeg,image/webp"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  {errors.attachments && (
                    <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {errors.attachments}
                    </p>
                  )}

                  {booking.attachments.length > 0 && (
                    <div className="space-y-1.5 mt-2.5">
                      {booking.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-gray-50 border border-gray-100 text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="w-4 h-4 text-medical-blue shrink-0" />
                            <span className="truncate text-deep-trust font-medium">{att.name}</span>
                            <span className="text-text-secondary shrink-0">
                              ({(att.size / 1024).toFixed(0)} KB)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(att.id)}
                            className="p-1 rounded-md hover:bg-red-50 text-red-600 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 4: Booking Summary & Confirmation */}
            {currentStep === 4 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div>
                  <h2 className="text-xl font-heading font-bold text-deep-trust">Review Booking Details</h2>
                  <p className="text-text-secondary text-xs mt-0.5">
                    Please review your appointment details before proceeding to payment.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-soft-sky/30 border border-medical-blue/15 space-y-3 text-sm">
                  <div className="flex justify-between pb-2 border-b border-gray-200/50">
                    <span className="text-text-secondary text-xs">Doctor</span>
                    <span className="font-semibold text-deep-trust text-xs">{doctorInfo.name}</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-gray-200/50">
                    <span className="text-text-secondary text-xs">Consultation Type</span>
                    <span className="font-semibold text-deep-trust text-xs">{selectedConfig.title}</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-gray-200/50">
                    <span className="text-text-secondary text-xs">Date &amp; Time</span>
                    <span className="font-semibold text-deep-trust text-xs">
                      {booking.date} at {booking.time} (IST)
                    </span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-gray-200/50">
                    <span className="text-text-secondary text-xs">Patient</span>
                    <span className="font-semibold text-deep-trust text-xs">
                      {booking.fullName} ({booking.age} yrs)
                    </span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-gray-200/50">
                    <span className="text-text-secondary text-xs">Contact</span>
                    <span className="font-semibold text-deep-trust text-xs">
                      {booking.phone} · {booking.email}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 text-base">
                    <span className="font-semibold text-deep-trust">Total Consultation Fee</span>
                    <span className="font-bold text-medical-blue">
                      ₹{(selectedConfig.feeInPaise / 100).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {booking.attachments.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-deep-trust mb-2">Uploaded Medical Attachments:</h3>
                    <div className="flex flex-wrap gap-2">
                      {booking.attachments.map((att) => (
                        <span
                          key={att.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-[11px] text-text-primary"
                        >
                          <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                          {att.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/60 text-xs text-blue-900 leading-relaxed">
                  <strong>Razorpay Test Mode Notice:</strong> Your appointment slot is reserved for 15 minutes. The booking is finalized and confirmed automatically upon successful verification of Razorpay test payment. No real money will be charged.
                </div>

                {errors.submit && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {errors.submit}
                  </div>
                )}

                {paymentError && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {paymentError}
                  </div>
                )}

                {reconciliationNotice && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {reconciliationNotice}
                  </div>
                )}

                {reservationSuccess && !paymentConfirmed && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                    <p className="font-bold flex items-center gap-1.5 text-sm text-amber-800">
                      <Clock className="w-4 h-4" /> Slot Reserved (Awaiting Payment)
                    </p>
                    <p>
                      Appointment Reference: <code>{reservationSuccess.appointmentId}</code>
                    </p>
                    <p className="text-text-secondary">
                      Your 15-minute reservation timer is active. Complete payment via Razorpay Checkout to confirm.
                    </p>
                    <Button
                      type="button"
                      onClick={() => launchRazorpayCheckout(reservationSuccess.appointmentId, reservationSuccess.fee)}
                      disabled={isOpeningCheckout || isSubmitting}
                      className="mt-2 bg-medical-blue hover:bg-medical-blue-hover text-white text-xs font-semibold px-4 py-2 rounded-xl"
                    >
                      {isOpeningCheckout ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Opening Checkout...
                        </>
                      ) : (
                        "Reopen Razorpay Checkout"
                      )}
                    </Button>
                  </div>
                )}

                {paymentConfirmed && (
                  <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                    <p className="font-bold flex items-center gap-2 text-base text-emerald-800">
                      <CheckCircle className="w-5 h-5 text-emerald-600" /> Appointment Confirmed!
                    </p>
                    <p className="text-xs">
                      Booking Reference: <strong>{paymentConfirmed.appointmentId}</strong>
                    </p>
                    <p className="text-xs">
                      Razorpay Payment ID: <code>{paymentConfirmed.paymentId}</code>
                    </p>
                    <p className="text-xs text-emerald-700">
                      Your confirmation email will be sent to {booking.email || currentUser?.email} when email delivery is configured. If it does not arrive, please contact the clinic.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step Navigation Controls */}
            <div className="flex items-center justify-between pt-6 mt-6 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1 || isSubmitting || isOpeningCheckout || !!paymentConfirmed}
                className="rounded-xl px-5 text-xs font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back
              </Button>

              {currentStep < 4 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="bg-medical-blue hover:bg-medical-blue-hover text-white rounded-xl px-6 text-xs font-semibold shadow-md"
                >
                  Continue <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleProceedToCheckout}
                  disabled={isSubmitting || isOpeningCheckout || !!paymentConfirmed}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6 text-xs font-bold shadow-md cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting || isOpeningCheckout ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparing Checkout...
                    </>
                  ) : paymentConfirmed ? (
                    "Booking Confirmed"
                  ) : reservationSuccess ? (
                    "Complete Razorpay Payment"
                  ) : (
                    "Reserve Slot & Pay with Razorpay"
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-lg p-6 sticky top-28 space-y-5">
            <div className="flex items-center gap-3.5 pb-4 border-b border-gray-100">
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow-sm ring-1 ring-black/5">
                <Image
                  src="/dr-vijay-hero.png"
                  alt={doctorInfo.name}
                  fill
                  sizes="56px"
                  className="object-cover object-top"
                />
              </div>
              <div className="min-w-0">
                <h3 className="font-heading font-bold text-deep-trust text-sm truncate">{doctorInfo.name}</h3>
                <p className="text-text-secondary text-xs truncate">{doctorInfo.specialization}</p>
                <p className="text-[11px] text-emerald-600 font-medium mt-0.5">10+ Years · Gold Medalist</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-text-secondary">
                <span>Selected Service</span>
                <span className="font-semibold text-deep-trust">{selectedConfig.title}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Appointment Date</span>
                <span className="font-semibold text-deep-trust">{booking.date || "Not selected"}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Time Slot</span>
                <span className="font-semibold text-deep-trust">{booking.time || "Not selected"}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Duration</span>
                <span className="font-semibold text-deep-trust">{selectedConfig.durationMinutes} mins</span>
              </div>
              <div className="flex justify-between text-text-secondary pt-2 border-t border-gray-100">
                <span className="font-bold text-deep-trust">Payable Amount</span>
                <span className="font-bold text-medical-blue text-sm">
                  ₹{(selectedConfig.feeInPaise / 100).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-light-mint/40 border border-emerald-100 flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-deep-trust leading-relaxed">
                Atomic slot reservation guarantees no double-booking. Free cancellation up to 24h before.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
