"use client"

import Link from "next/link"
import { Phone, Mail, MapPin, ArrowRight } from "lucide-react"
import ClinicLocationMap from "./ClinicLocationMap"
import { clinicInfo } from "@/lib/data"

export default function ContactTeaser() {
  return (
    <section className="section-padding bg-soft-sky/30">
      <div className="section-container">
        <div className="text-center mb-10">
          <p className="text-medical-blue font-semibold text-sm tracking-wider uppercase mb-3">
            Get In Touch
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-deep-trust mb-4">
            Contact & Location
          </h2>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 items-start mb-10">
          {/* Contact info cards */}
          <div className="space-y-4">
            <div className="p-5 rounded-xl bg-white border border-gray-100">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-medical-blue flex-shrink-0" />
                <p className="text-text-secondary text-sm">{clinicInfo.phone}</p>
              </div>
            </div>
            <div className="p-5 rounded-xl bg-white border border-gray-100">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-medical-blue flex-shrink-0" />
                <p className="text-text-secondary text-sm">{clinicInfo.email}</p>
              </div>
            </div>
            <div className="p-5 rounded-xl bg-white border border-gray-100">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-medical-blue flex-shrink-0" />
                <p className="text-text-secondary text-sm">{clinicInfo.city}</p>
              </div>
            </div>
          </div>

          {/* Live Map */}
          <div className="lg:col-span-2 rounded-2xl overflow-hidden shadow-lg border border-gray-100">
            <ClinicLocationMap />
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 text-medical-blue font-semibold hover:underline"
          >
            View Full Contact Details & Map
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}