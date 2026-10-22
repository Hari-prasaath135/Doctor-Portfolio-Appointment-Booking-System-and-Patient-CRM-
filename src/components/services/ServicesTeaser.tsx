"use client"

import Link from "next/link"
import { ArrowRight, Heart, Activity, Target, Stethoscope } from "lucide-react"
import { services } from "@/lib/data"

const iconMap: Record<string, React.ElementType> = { Heart, Activity, Target, Stethoscope }

export default function ServicesTeaser() {
  const featured = services.slice(0, 4)

  return (
    <section className="section-padding bg-soft-sky/30">
      <div className="section-container">
        <div className="text-center mb-12">
          <p className="text-medical-blue font-semibold text-sm tracking-wider uppercase mb-3">
            Our Services
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-deep-trust mb-4">
            Medical Services We Offer
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {featured.map((service) => {
            const Icon = iconMap[service.icon]
            return (
              <div
                key={service.id}
                className="p-6 rounded-2xl bg-white border border-gray-100 hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-soft-sky flex items-center justify-center mb-4">
                  {Icon && <Icon className="w-6 h-6 text-medical-blue" />}
                </div>
                <h3 className="font-heading font-semibold text-deep-trust text-base mb-1">
                  {service.name}
                </h3>
                <p className="text-text-secondary text-sm">{service.shortDescription}</p>
              </div>
            )
          })}
        </div>

        <div className="text-center">
          <Link
            href="/services"
            className="inline-flex items-center gap-2 text-medical-blue font-semibold hover:underline"
          >
            View All Services
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}