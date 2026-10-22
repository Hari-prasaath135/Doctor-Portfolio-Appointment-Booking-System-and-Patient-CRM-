"use client"

import { useState, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock,
  CheckCircle,
  Loader2,
  Shield,
  Stethoscope,
  AlertCircle,
  User,
  Phone,
  Mail,
  MessageSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { doctorInfo } from "@/lib/data"

interface BookingFormData {
  fullName: string
  phone: string
  email: string
  reasonForConsultation: string
}

interface TimeSlot {
  time: string
  isBooked: boolean
}

// Fallback slots used only if /api/availability is unreachable or returns
// nothing — replace/remove once the availability endpoint is wired up.
const FALLBACK_SLOTS: TimeSlot[] = [
  { time: "09:00 AM", isBooked: false },
  { time: "09:30 AM", isBooked: true },
  { time: "10:00 AM", isBooked: false },
  { time: "10:30 AM", isBooked: false },
  { time: "11:30 AM", isBooked: false },
  { time: "02:00 PM", isBooked: false },
  { time: "02:30 PM", isBooked: true },
  { time: "03:00 PM", isBooked: false },
  { time: "04:00 PM", isBooked: false },
  { time: "04:30 PM", isBooked: false },
]

const NUM_UPCOMING_DAYS = 10

const toISODate = (d: Date) => d.toISOString().split("T")[0]

const formatDayLabel = (d: Date) =>
  d.toLocaleDateString("en-IN", { weekday: "short" })

const formatDateLabel = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
}

export default function PatientDetailsForm() {
  const upcomingDates = Array.from({ length: NUM_UPCOMING_DAYS }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d
  })

  const [selectedDate, setSelectedDate] = useState<string>(toISODate(upcomingDates[0]))
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  const [formData, setFormData] = useState<BookingFormData>({
    fullName: "",
    phone: "",
    email: "",
    reasonForConsultation: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const updateField = useCallback(
    (field: keyof BookingFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
      setErrors((prev) => ({ ...prev, [field]: "" }))
    },
    []
  )

  // Fetch available slots whenever the selected date changes.
  useEffect(() => {
    let cancelled = false

    const fetchSlots = async () => {
      setLoadingSlots(true)
      setSelectedTime(null)
      try {
        const res = await fetch(
          `/api/availability?doctorId=${doctorInfo.id}&date=${selectedDate}`
        )
        if (!res.ok) throw new Error("Failed to fetch availability")
        const data = await res.json()
        if (!cancelled) setSlots(data.slots || [])
      } catch {
        if (!cancelled) setSlots(FALLBACK_SLOTS)
      } finally {
        if (!cancelled) setLoadingSlots(false)
      }
    }

    fetchSlots()
    return () => {
      cancelled = true
    }
  }, [selectedDate])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!selectedTime) {
      newErrors.slot = "Please select an available time slot"
    }
    if (!formData.fullName || formData.fullName.trim().length < 2) {
      newErrors.fullName = "Please enter your full name"
    }
    if (!formData.phone || formData.phone.length < 10) {
      newErrors.phone = "Please enter a valid phone number"
    }
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      const submissionData = {
        doctorId: doctorInfo.id,
        date: selectedDate,
        time: selectedTime,
        patientName: formData.fullName,
        phone: formData.phone,
        email: formData.email,
        message: formData.reasonForConsultation,
      }

      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submissionData),
      })

      if (!response.ok) {
        const data = await response.json()
        setErrors({ submit: data.error || "Failed to book. Please try again." })
        setIsSubmitting(false)
        return
      }

      setIsSubmitted(true)
    } catch {
      setErrors({ submit: "Something went wrong. Please try again." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedDateObj = upcomingDates.find((d) => toISODate(d) === selectedDate)

  // Success state
  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-xl mx-auto text-center py-16"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
          className="w-20 h-20 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-6"
        >
          <CheckCircle className="w-10 h-10 text-emerald-600" />
        </motion.div>

        <h2 className="text-2xl md:text-3xl font-heading font-bold text-deep-trust mb-3">
          Appointment Requested
        </h2>
        <p className="text-text-secondary mb-8">
          {formData.fullName}, your slot on{" "}
          <span className="font-medium text-deep-trust">
            {selectedDateObj ? formatDateLabel(selectedDateObj) : selectedDate}
          </span>{" "}
          at <span className="font-medium text-deep-trust">{selectedTime}</span> is pending
          confirmation. We&apos;ll reach out shortly.
        </p>

        <Link href="/">
          <Button className="bg-medical-blue hover:bg-medical-blue-hover text-white rounded-xl px-6 cursor-pointer">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>
      </motion.div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <p className="text-medical-blue font-semibold text-sm tracking-wider uppercase mb-1">
          Book Appointment
        </p>
        <h1 className="text-3xl md:text-4xl font-heading font-bold text-deep-trust">
          Choose a slot with {doctorInfo.name}
        </h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main booking panel */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="lg:col-span-2"
        >
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-medical-blue via-deep-trust to-medical-blue" />

            <div className="p-6 md:p-8 space-y-8">
              {/* Date picker */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <CalendarDays className="w-4 h-4 text-medical-blue" />
                  <Label className="text-deep-trust font-medium text-sm">Select a date</Label>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                  {upcomingDates.map((d) => {
                    const iso = toISODate(d)
                    const isActive = iso === selectedDate
                    return (
                      <button
                        key={iso}
                        onClick={() => setSelectedDate(iso)}
                        className={`flex flex-col items-center justify-center shrink-0 w-16 h-16 rounded-xl border-2 transition-all cursor-pointer ${
                          isActive
                            ? "border-medical-blue bg-medical-blue text-white shadow-md"
                            : "border-gray-100 bg-white text-deep-trust hover:border-medical-blue/30"
                        }`}
                      >
                        <span className="text-[11px] font-medium opacity-80">
                          {formatDayLabel(d)}
                        </span>
                        <span className="text-sm font-bold">{d.getDate()}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Time slots */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-medical-blue" />
                  <Label className="text-deep-trust font-medium text-sm">
                    Available time slots
                  </Label>
                </div>

                {loadingSlots ? (
                  <div className="flex items-center justify-center py-10 text-text-secondary text-sm gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading slots...
                  </div>
                ) : slots.length === 0 ? (
                  <p className="text-text-secondary text-sm py-6 text-center">
                    No slots available for this date. Please choose another date.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {slots.map((slot) => {
                      const isActive = selectedTime === slot.time
                      return (
                        <button
                          key={slot.time}
                          disabled={slot.isBooked}
                          onClick={() => {
                            setSelectedTime(slot.time)
                            setErrors((prev) => ({ ...prev, slot: "" }))
                          }}
                          className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-all cursor-pointer disabled:cursor-not-allowed ${
                            slot.isBooked
                              ? "border-gray-100 bg-gray-50 text-gray-300 line-through"
                              : isActive
                              ? "border-medical-blue bg-medical-blue text-white shadow-md"
                              : "border-gray-100 bg-white text-deep-trust hover:border-medical-blue/30"
                          }`}
                        >
                          {slot.time}
                        </button>
                      )
                    })}
                  </div>
                )}
                <AnimatePresence>
                  {errors.slot && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="text-red-500 text-sm mt-3 flex items-center gap-1"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.slot}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="w-full h-px bg-gray-100" />

              {/* Contact details — kept minimal */}
              <div className="space-y-5">
                <div>
                  <Label htmlFor="fullName" className="text-deep-trust font-medium mb-2 block text-sm">
                    Full Name <span className="text-red-400">*</span>
                  </Label>
                  <div className="relative">
                    <User className="w-4 h-4 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      id="fullName"
                      placeholder="Enter your full name"
                      value={formData.fullName}
                      onChange={(e) => updateField("fullName", e.target.value)}
                      className={`rounded-xl h-12 pl-10 text-base ${
                        errors.fullName ? "border-red-400" : "focus:border-medical-blue"
                      }`}
                    />
                  </div>
                  {errors.fullName && (
                    <p className="text-red-500 text-sm mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {errors.fullName}
                    </p>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <Label htmlFor="phone" className="text-deep-trust font-medium mb-2 block text-sm">
                      Phone <span className="text-red-400">*</span>
                    </Label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={(e) => updateField("phone", e.target.value)}
                        className={`rounded-xl h-12 pl-10 text-base ${
                          errors.phone ? "border-red-400" : "focus:border-medical-blue"
                        }`}
                      />
                    </div>
                    {errors.phone && (
                      <p className="text-red-500 text-sm mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {errors.phone}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-deep-trust font-medium mb-2 block text-sm">
                      Email <span className="text-red-400">*</span>
                    </Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="your.email@example.com"
                        value={formData.email}
                        onChange={(e) => updateField("email", e.target.value)}
                        className={`rounded-xl h-12 pl-10 text-base ${
                          errors.email ? "border-red-400" : "focus:border-medical-blue"
                        }`}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-red-500 text-sm mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {errors.email}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label
                    htmlFor="reasonForConsultation"
                    className="text-deep-trust font-medium mb-2 block text-sm"
                  >
                    Reason for consultation{" "}
                    <span className="text-text-secondary font-normal">(optional)</span>
                  </Label>
                  <div className="relative">
                    <MessageSquare className="w-4 h-4 text-text-secondary absolute left-3.5 top-3.5" />
                    <Textarea
                      id="reasonForConsultation"
                      placeholder="Briefly describe your concern..."
                      value={formData.reasonForConsultation}
                      onChange={(e) => updateField("reasonForConsultation", e.target.value)}
                      className="rounded-xl min-h-[90px] pl-10 pt-3 text-base resize-none focus:border-medical-blue"
                    />
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {errors.submit && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errors.submit}
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-medical-blue hover:bg-medical-blue-hover text-white rounded-xl h-12 shadow-md hover:shadow-lg transition-all cursor-pointer text-base font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Booking...
                  </>
                ) : (
                  <>
                    Confirm Appointment
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Sidebar — trimmed doctor card */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible" className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6 sticky top-28">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative w-16 h-16 rounded-2xl overflow-hidden shrink-0 shadow-md ring-1 ring-black/5">
                <Image
                  src="/dr-vijay-hero.png"
                  alt={doctorInfo.name}
                  fill
                  sizes="64px"
                  className="object-cover object-top"
                />
              </div>
              <div>
                <h3 className="font-heading font-bold text-deep-trust">{doctorInfo.name}</h3>
                <p className="text-text-secondary text-sm">{doctorInfo.specialization}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-soft-sky mb-3">
              <Stethoscope className="w-4 h-4 text-medical-blue shrink-0" />
              <p className="text-sm text-deep-trust font-medium">
                {doctorInfo.experience}+ years · {doctorInfo.proceduresCount}+ procedures
              </p>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-light-mint/40">
              <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-sm text-deep-trust font-medium">
                Confirmation within 24 hours · Data kept private
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}