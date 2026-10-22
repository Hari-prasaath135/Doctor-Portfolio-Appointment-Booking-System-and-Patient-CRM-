"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { CheckCircle2, ArrowRight, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { procedures } from "@/lib/data"

gsap.registerPlugin(ScrollTrigger)

export default function ProceduresSection() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReducedMotion) return

    const ctx = gsap.context(() => {
      const procedureItems = gsap.utils.toArray(".procedure-item") as HTMLElement[]
      procedureItems.forEach((item) => {
        gsap.from(item, {
          scrollTrigger: {
            trigger: item,
            start: "top 85%",
            toggleActions: "play none none none",
          },
          opacity: 0,
          y: 50,
          duration: 0.8,
          ease: "power3.out",
        })
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  const handleNavClick = (href: string) => {
    if (href.startsWith("#")) {
      const element = document.querySelector(href)
      if (element) {
        element.scrollIntoView({ behavior: "smooth" })
      }
    }
  }

  return (
    <section ref={sectionRef} id="procedures" className="section-padding bg-white">
      <div className="section-container">
        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-medical-blue font-semibold text-sm tracking-wider uppercase mb-3">
            Featured Procedures
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-deep-trust mb-4">
            Our Expertise in Action
          </h2>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            Advanced minimally invasive procedures performed with precision imaging guidance for optimal patient outcomes.
          </p>
        </div>

        {/* Procedures - Alternating Layout */}
        <div className="space-y-20">
          {procedures.map((procedure, i) => (
            <div
              key={procedure.id}
              className={`procedure-item grid lg:grid-cols-2 gap-12 lg:gap-16 items-center ${
                i % 2 !== 0 ? "lg:[direction:rtl]" : ""
              }`}
            >
              {/* Image Side */}
              <div className="lg:[direction:ltr]">
                <div className="relative rounded-2xl overflow-hidden aspect-[4/3] shadow-lg">
                  <div
                    className={`absolute inset-0 ${
                      i === 0
                        ? "bg-gradient-to-br from-soft-sky via-white to-light-mint"
                        : i === 1
                        ? "bg-gradient-to-br from-light-mint via-white to-soft-sky"
                        : "bg-gradient-to-br from-soft-sky/80 via-light-mint/50 to-medical-blue/5"
                    }`}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center p-8">
                      <div className="w-20 h-20 mx-auto rounded-2xl bg-white/80 shadow-md flex items-center justify-center mb-4">
                        <svg className="w-10 h-10 text-medical-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                        </svg>
                      </div>
                      <p className="font-heading font-semibold text-deep-trust text-lg">{procedure.name}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content Side */}
              <div className="lg:[direction:ltr] space-y-5">
                <h3 className="text-2xl md:text-3xl font-heading font-bold text-deep-trust">
                  {procedure.name}
                </h3>
                <p className="text-text-secondary leading-relaxed">
                  {procedure.description}
                </p>

                {/* Benefits */}
                <div className="space-y-3">
                  <h4 className="font-heading font-semibold text-deep-trust">Key Benefits</h4>
                  <ul className="space-y-2">
                    {procedure.benefits.map((benefit, j) => (
                      <li key={j} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-text-secondary text-sm">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Who needs it */}
                <div className="p-4 rounded-xl bg-soft-sky/50 border border-medical-blue/10">
                  <p className="text-sm text-text-primary">
                    <span className="font-semibold text-deep-trust">Who may benefit: </span>
                    {procedure.whoNeedsIt}
                  </p>
                </div>

                <Button
                  onClick={() => handleNavClick("#appointment")}
                  className="bg-medical-blue hover:bg-medical-blue-hover text-white rounded-xl px-6 shadow-md hover:shadow-lg transition-all group cursor-pointer"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Book a Consultation
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
