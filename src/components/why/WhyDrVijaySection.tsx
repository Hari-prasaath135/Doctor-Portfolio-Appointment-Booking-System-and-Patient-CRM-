"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Image from "next/image"
import { doctorInfo } from "@/lib/data"

gsap.registerPlugin(ScrollTrigger)

export default function WhyDrVijaySection() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const section = sectionRef.current
    if (!section) return

    const animatedNodes = section.querySelectorAll(".why-eyebrow, .why-photo, .why-text > *")

    // SAFETY NET: force everything visible after 3s no matter what happens with GSAP/ScrollTrigger.
    const safetyTimeout = setTimeout(() => {
      gsap.set(animatedNodes, { clearProps: "all" })
    }, 3000)

    if (prefersReducedMotion) {
      gsap.set(animatedNodes, { clearProps: "all" })
      return () => clearTimeout(safetyTimeout)
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top 80%",
          toggleActions: "play none none none",
        },
        onComplete: () => {
          gsap.set(animatedNodes, { clearProps: "all" })
        },
      })

      tl.from(".why-eyebrow", { autoAlpha: 0, y: 20, duration: 0.5, ease: "power3.out" })
        .from(".why-photo", { autoAlpha: 0, y: 40, duration: 0.8, ease: "power3.out" }, "+=0.05")
        .from(
          ".why-text > *",
          { autoAlpha: 0, y: 25, duration: 0.6, stagger: 0.15, ease: "power3.out" },
          "+=0.1"
        )
    }, section)

    return () => {
      clearTimeout(safetyTimeout)
      ctx.revert()
    }
  }, [])

  return (
    <section ref={sectionRef} id="why-dr-vijay" className="section-padding bg-white">
      <div className="section-container">
        {/* Section Header */}
        <div className="text-center mb-12">
       <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold leading-tight mb-4 text-deep-trust">
  Why <span className="gradient-text">Dr Vijay?</span>
</h2>
        </div>

        {/* Horizontal photo */}
        <div className="why-photo relative w-full aspect-[21/9] rounded-3xl overflow-hidden shadow-xl ring-1 ring-white/40 mb-12">
          <Image
            src="/dr-vijay-hero-2.png"
            alt={doctorInfo.name}
            fill
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-deep-trust/20 via-transparent to-transparent" />
        </div>

        {/* Header + description */}
        <div className="why-text max-w-3xl mx-auto text-center space-y-5">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-deep-trust leading-tight">
            "Listening to you. Understanding your needs. Caring for your health!"    
          </h2>
          <p className="text-text-secondary text-lg leading-relaxed">
            {doctorInfo.name} takes the time to listen to your concerns, understand your needs, and
            provide clear guidance so you can feel confident and comfortable throughout your
            healthcare journey.
          </p>
        </div>
      </div>
    </section>
  )
}