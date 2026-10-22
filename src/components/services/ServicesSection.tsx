"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import {
  Heart,
  Activity,
  Target,
  Stethoscope,
  Shield,
  Search,
  Droplets,
  Zap,
  ArrowRight,
} from "lucide-react"
import { services } from "@/lib/data"

gsap.registerPlugin(ScrollTrigger)

const iconMap: Record<string, React.ElementType> = {
  Heart,
  Activity,
  Target,
  Stethoscope,
  Shield,
  Search,
  Droplets,
  Zap,
}

export default function ServicesSection() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReducedMotion) return

    const ctx = gsap.context(() => {
      gsap.from(".service-card", {
        scrollTrigger: {
          trigger: ".services-grid",
          start: "top 85%",
          toggleActions: "play none none none",
        },
        opacity: 0,
        y: 40,
        duration: 0.6,
        stagger: 0.08,
        ease: "power3.out",
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} id="services" className="section-padding bg-soft-sky/30">
      <div className="section-container">
        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-medical-blue font-semibold text-sm tracking-wider uppercase mb-3">Our Services</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-deep-trust mb-4">
            Medical Services We Offer
          </h2>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            Comprehensive interventional radiology services using minimally invasive, image-guided techniques for faster recovery and better outcomes.
          </p>
        </div>

        {/* Services Grid */}
        <div className="services-grid grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, i) => {
            const Icon = iconMap[service.icon]
            return (
              <div
                key={service.id}
                className="service-card group relative p-6 rounded-2xl bg-white border border-gray-100 hover:border-medical-blue/20 hover:shadow-xl transition-all duration-300 cursor-pointer"
              >
                {/* Category badge */}
                <span className="inline-block text-[11px] font-medium text-medical-blue bg-soft-sky rounded-full px-3 py-1 mb-4">
                  {service.category}
                </span>

                {/* Icon */}
                <div className="w-14 h-14 rounded-2xl bg-soft-sky group-hover:bg-medical-blue group-hover:shadow-lg flex items-center justify-center mb-4 transition-all duration-300">
                  {Icon && (
                    <Icon className="w-7 h-7 text-medical-blue group-hover:text-white transition-colors duration-300" />
                  )}
                </div>

                {/* Content */}
                <h3 className="font-heading font-semibold text-deep-trust text-lg mb-2 group-hover:text-medical-blue transition-colors">
                  {service.name}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed mb-4">
                  {service.shortDescription}
                </p>

                {/* Learn More */}
                <div className="flex items-center gap-1 text-medical-blue text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span>Learn More</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
