"use client"

import { useState } from "react"
import { db } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { Mail, Phone, User, MessageSquare, CheckCircle2, Loader2 } from "lucide-react"
import { trackEvent } from "@/lib/analytics"

interface FormState {
  name: string
  email: string
  phone: string
  message: string
}

const initialForm: FormState = { name: "", email: "", phone: "", message: "" }

export default function ContactSection() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const validate = (): string | null => {
    if (!form.name.trim()) return "Please enter your name."
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Please enter a valid email."
    if (!/^[0-9+\-\s()]{7,15}$/.test(form.phone)) return "Please enter a valid phone number."
    if (!form.message.trim()) return "Please enter a message."
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await addDoc(collection(db, "enquiries"), {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        message: form.message.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
      })
      trackEvent({
        eventType: "contact_form_submitted",
        path: "/contact",
        outcome: "success",
      })
      setSubmitted(true)
      setForm(initialForm)
    } catch (err) {
      console.error("Failed to submit enquiry", err)
      setError("Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 text-center max-w-xl mx-auto">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
        <h3 className="font-heading font-bold text-xl text-deep-trust">Thank you!</h3>
        <p className="text-text-secondary text-sm mt-2">
          Your enquiry has been received. Our team will get back to you shortly.
        </p>
        <button
          onClick={() => setSubmitted(false)}
          className="mt-5 text-medical-blue text-sm font-medium hover:underline cursor-pointer"
        >
          Submit another enquiry
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 max-w-xl mx-auto space-y-4"
    >
      <h2 className="font-heading font-bold text-2xl text-deep-trust">Get in Touch</h2>
      <p className="text-text-secondary text-sm">
        Have a question? Send us a message and we'll respond as soon as possible.
      </p>

      <div>
        <label className="text-sm font-medium text-deep-trust flex items-center gap-2 mb-1.5">
          <User className="w-4 h-4" /> Name
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => handleChange("name", e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-medical-blue/30"
          placeholder="Your full name"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-deep-trust flex items-center gap-2 mb-1.5">
          <Mail className="w-4 h-4" /> Email
        </label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => handleChange("email", e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-medical-blue/30"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-deep-trust flex items-center gap-2 mb-1.5">
          <Phone className="w-4 h-4" /> Phone
        </label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-medical-blue/30"
          placeholder="+91 98765 43210"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-deep-trust flex items-center gap-2 mb-1.5">
          <MessageSquare className="w-4 h-4" /> Message
        </label>
        <textarea
          value={form.message}
          onChange={(e) => handleChange("message", e.target.value)}
          rows={4}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-medical-blue/30 resize-none"
          placeholder="How can we help you?"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-medical-blue hover:bg-medical-blue-hover disabled:opacity-60 text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
          </>
        ) : (
          "Submit Enquiry"
        )}
      </button>
    </form>
  )
}