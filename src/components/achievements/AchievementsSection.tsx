"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { achievements } from "@/lib/data"

gsap.registerPlugin(ScrollTrigger)

export default function AchievementsSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const countersRef = useRef<HTMLDivElement[]>([])

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReducedMotion) return

    const ctx = gsap.context(() => {
      countersRef.current.forEach((counter, i) => {
        if (!counter) return

        const numberEl = counter.querySelector(".counter-number")
        if (!numberEl) return

        const target = achievements[i].number

        gsap.from(counter, {
          scrollTrigger: {
            trigger: counter,
            start: "top 90%",
            toggleActions: "play none none none",
          },
          opacity: 0,
          y: 30,
          duration: 0.6,
          delay: i * 0.15,
          ease: "power3.out",
        })

        // Animated counter
        const obj = { val: 0 }
        gsap.to(obj, {
          scrollTrigger: {
            trigger: counter,
            start: "top 90%",
            toggleActions: "play none none none",
          },
          val: target,
          duration: 2,
          delay: i * 0.15,
          ease: "power2.out",
          onUpdate: () => {
            numberEl.textContent = Math.floor(obj.val).toLocaleString()
          },
        })
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="section-padding" style={{ background: "var(--gradient-soft)" }}>
      <div className="section-container">
        {/* Section Header */}
        <div className="text-center mb-14">
          <p className="text-medical-blue font-semibold text-sm tracking-wider uppercase mb-3">
            Our Track Record
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-deep-trust">
            Numbers That Speak
          </h2>
        </div>

        {/* Counters Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {achievements.map((achievement, i) => (
            <div
              key={i}
              ref={(el) => {
                if (el) countersRef.current[i] = el
              }}
              className="group text-center p-8 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/60 hover:bg-white hover:shadow-xl transition-all duration-300"
            >
              <div className="mb-3">
                <span className="counter-number text-4xl md:text-5xl font-heading font-bold text-medical-blue">
                  0
                </span>
                <span className="text-3xl md:text-4xl font-heading font-bold text-medical-blue">
                  {achievement.suffix}
                </span>
              </div>
              <p className="text-text-secondary font-medium text-sm md:text-base">
                {achievement.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
