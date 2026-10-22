"use client"

import { useEffect, useLayoutEffect, useRef } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowRight, Calendar, Sparkles, Video, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { doctorInfo } from "@/lib/data"

gsap.registerPlugin(ScrollTrigger)

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

export default function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useIsomorphicLayoutEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const node = contentRef.current
    if (!node) return

    // SAFETY NET: force everything visible after 3s no matter what happens with GSAP.
    const safetyTimeout = setTimeout(() => {
      gsap.set(node, { clearProps: "all" })
    }, 3000)

    if (prefersReducedMotion) {
      gsap.set(node, { clearProps: "all" })
      return () => clearTimeout(safetyTimeout)
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        node,
        { autoAlpha: 0, y: 24 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1.2,
          delay: 0.3,
          ease: "power2.out",
          onComplete: () => {
            // Belt-and-braces: guarantee end state is fully visible
            gsap.set(node, { clearProps: "all" })
          },
        }
      )
    }, heroRef)

    return () => {
      clearTimeout(safetyTimeout)
      ctx.revert()
    }
  }, [])

  // Handles both in-page anchor scrolling (e.g. "#consult-online") and
  // full route navigation (e.g. "/book-appointment"). Previously this
  // only handled "#" hrefs, so the Book Appointment button — which points
  // to a full page, not an anchor — silently did nothing.
  const handleNavClick = (href: string) => {
    if (href.startsWith("#")) {
      const element = document.querySelector(href)
      if (element) {
        element.scrollIntoView({ behavior: "smooth" })
      }
    } else {
      router.push(href)
    }
  }

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex items-center overflow-hidden pt-20"
      style={{ background: "var(--gradient-hero)" }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-[10%] w-72 h-72 bg-medical-blue/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-[5%] w-96 h-96 bg-light-mint/50 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-soft-sky/30 rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, var(--deep-trust-blue) 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div ref={contentRef} className="section-container relative z-10 py-12 md:py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="relative hidden lg:block order-1">
            <div className="relative">
              <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-medical-blue/20 via-light-mint/30 to-transparent blur-2xl" />
              <div className="absolute -top-10 -left-10 w-56 h-56 rounded-full bg-medical-blue/10 blur-3xl" />
              <div className="absolute -bottom-12 -right-8 w-64 h-64 rounded-full bg-light-mint/40 blur-3xl" />
              <div className="relative w-full aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/40">
                <Image
                  src="/dr-vijay-hero.png"
                  alt={doctorInfo.name}
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover object-top"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-deep-trust/15 via-transparent to-transparent" />
              </div>
            </div>
          </div>

          <div className="space-y-6 md:space-y-8 order-2">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-soft-sky border border-medical-blue/10 text-medical-blue text-sm font-medium">
                <Sparkles className="w-4 h-4" />
                <span>Interventional Radiology Specialist</span>
              </div>
            </div>

            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-heading font-bold text-deep-trust leading-[1.1] tracking-tight">
                Meet <span className="gradient-text">{doctorInfo.name}</span>
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {doctorInfo.qualifications.map((qual, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-100 shadow-sm"
                >
                  <GraduationCap className="w-4 h-4 text-medical-blue" />
                  <span className="text-sm font-medium text-deep-trust">{qual}</span>
                </div>
              ))}
            </div>

            <p className="text-text-secondary text-lg md:text-xl leading-relaxed max-w-lg">
              {doctorInfo.shortBio}
            </p>

            <div>
              <p className="text-2xl font-heading font-bold text-deep-trust">15+ Years of Experience</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <Button
                size="lg"
                onClick={() => handleNavClick("/book-appointment")}
                className="bg-medical-blue hover:bg-medical-blue-hover text-white rounded-xl px-8 py-6 text-base font-semibold shadow-lg hover:shadow-xl transition-all group cursor-pointer"
              >
                <Calendar className="w-5 h-5 mr-2" />
                Book Appointment
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => handleNavClick("#consult-online")}
                className="border-2 border-deep-trust/20 text-deep-trust hover:bg-soft-sky hover:border-medical-blue/30 rounded-xl px-8 py-6 text-base font-semibold transition-all cursor-pointer"
              >
                <Video className="w-5 h-5 mr-2" />
                Consult Online
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}