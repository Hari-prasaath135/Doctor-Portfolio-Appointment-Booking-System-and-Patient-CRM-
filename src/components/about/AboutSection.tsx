"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import {
  ArrowRight,
  Brain,
  Activity,
  GitBranch,
  Droplet,
  Syringe,
  Wind,
  Filter,
  Award,
  Bone,
} from "lucide-react"

gsap.registerPlugin(ScrollTrigger)

const bubbleServices = [
  { icon: Brain, title: "Neuro-interventions" },
  { icon: Activity, title: "Peripheral Vascular" },
  { icon: GitBranch, title: "Aortic Interventions" },
  { icon: Droplet, title: "Vascular Bleeders" },
  { icon: Syringe, title: "Vascular Access" },
  { icon: Wind, title: "Thoracic Interventions" },
  { icon: Filter, title: "Hepatobiliary" },
  { icon: Award, title: "Onco-interventions" },
  { icon: Bone, title: "Musculoskeletal" },
  { icon: ArrowRight, title: "Diagnostic Radiology" },
]

export default function ServiceBubbles() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const cards = gsap.utils.toArray<HTMLElement>(".bubble-card")

    if (prefersReducedMotion) {
      gsap.set(cards, { clearProps: "all" })
      return
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        cards,
        { autoAlpha: 0, y: 60, scale: 0.85 },
        {
          scrollTrigger: {
            trigger: scrollRef.current,
            start: "top 85%",
            toggleActions: "play none none none",
          },
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 1.1,
          ease: "power3.out",
          stagger: 0.25, // slow, deliberate delay between each bubble
        }
      )
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({
      left: direction === "left" ? -300 : 300,
      behavior: "smooth",
    })
  }

  return (
    <section ref={sectionRef} className="section-padding" style={{ background: "var(--gradient-hero)" }}>
      <div className="section-container">
        <div className="text-center mb-12">
          <p className="text-medical-blue font-semibold text-sm tracking-wider uppercase mb-3">
            Explore
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-deep-trust">
            Areas of Expertise
          </h2>
        </div>

        <div className="relative">
          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {bubbleServices.map((service, i) => {
              const Icon = service.icon
              return (
                <div
                  key={i}
                  className="bubble-card snap-start shrink-0 w-[180px] sm:w-[200px] h-[240px] rounded-[2.5rem] bg-white shadow-lg hover:shadow-2xl border border-gray-100 flex flex-col items-center justify-center gap-4 text-center px-5 transition-shadow duration-300 cursor-default"
                >
                  <div className="w-14 h-14 rounded-2xl bg-soft-sky flex items-center justify-center">
                    <Icon className="w-7 h-7 text-medical-blue" />
                  </div>
                  <h3 className="font-heading font-semibold text-deep-trust text-sm leading-snug">
                    {service.title}
                  </h3>
                </div>
              )
            })}
          </div>

          <div className="hidden md:flex justify-center gap-3 mt-6">
            <button
              onClick={() => scroll("left")}
              aria-label="Scroll left"
              className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-soft-sky transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 rotate-180 text-deep-trust" />
            </button>
            <button
              onClick={() => scroll("right")}
              aria-label="Scroll right"
              className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-soft-sky transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 text-deep-trust" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}