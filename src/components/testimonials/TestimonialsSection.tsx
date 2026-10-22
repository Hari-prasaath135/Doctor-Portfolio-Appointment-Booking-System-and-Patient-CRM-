"use client"

import { useEffect, useRef, useState } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react"
import { testimonials } from "@/lib/data"

gsap.registerPlugin(ScrollTrigger)

export default function TestimonialsSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Show 1 on mobile, 2 on md, 3 on lg
  const getVisibleCount = () => {
    if (typeof window === "undefined") return 3
    if (window.innerWidth >= 1024) return 3
    if (window.innerWidth >= 768) return 2
    return 1
  }

  const [visibleCount, setVisibleCount] = useState(3)

  useEffect(() => {
    const handleResize = () => setVisibleCount(getVisibleCount())
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const maxIndex = Math.max(0, testimonials.length - visibleCount)

  const handlePrev = () => setCurrentIndex((prev) => Math.max(0, prev - 1))
  const handleNext = () => setCurrentIndex((prev) => Math.min(maxIndex, prev + 1))

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReducedMotion) return

    const ctx = gsap.context(() => {
      gsap.from(".testimonials-header", {
        scrollTrigger: {
          trigger: ".testimonials-header",
          start: "top 85%",
          toggleActions: "play none none none",
        },
        opacity: 0,
        y: 30,
        duration: 0.7,
        ease: "power3.out",
      })

      gsap.from(".testimonials-carousel", {
        scrollTrigger: {
          trigger: ".testimonials-carousel",
          start: "top 85%",
          toggleActions: "play none none none",
        },
        opacity: 0,
        y: 40,
        duration: 0.8,
        ease: "power3.out",
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} id="testimonials" className="section-padding bg-white">
      <div className="section-container">
        {/* Section Header */}
        <div className="testimonials-header text-center mb-14">
          <p className="text-medical-blue font-semibold text-sm tracking-wider uppercase mb-3">
            Testimonials
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-deep-trust mb-4">
            What Our Patients Say
          </h2>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            Real experiences from patients who trusted us with their care.
          </p>
        </div>

        {/* Carousel */}
        <div className="testimonials-carousel relative">
          {/* Navigation Buttons */}
          <div className="flex justify-end gap-2 mb-6">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="p-2 rounded-xl border border-gray-200 hover:border-medical-blue hover:bg-soft-sky disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              aria-label="Previous testimonials"
            >
              <ChevronLeft className="w-5 h-5 text-deep-trust" />
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex >= maxIndex}
              className="p-2 rounded-xl border border-gray-200 hover:border-medical-blue hover:bg-soft-sky disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              aria-label="Next testimonials"
            >
              <ChevronRight className="w-5 h-5 text-deep-trust" />
            </button>
          </div>

          {/* Cards Container */}
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{
                transform: `translateX(-${currentIndex * (100 / visibleCount)}%)`,
              }}
            >
              {testimonials.map((testimonial) => (
                <div
                  key={testimonial.id}
                  className="shrink-0 px-3"
                  style={{ width: `${100 / visibleCount}%` }}
                >
                  <div className="h-full p-6 md:p-8 rounded-2xl bg-warm-offwhite border border-gray-100 hover:border-medical-blue/15 hover:shadow-lg transition-all duration-300">
                    {/* Quote Icon */}
                    <Quote className="w-8 h-8 text-medical-blue/20 mb-4" />

                    {/* Review */}
                    <p className="text-text-secondary leading-relaxed mb-6 text-sm md:text-base">
                      &ldquo;{testimonial.review}&rdquo;
                    </p>

                    {/* Rating */}
                    <div className="flex items-center gap-0.5 mb-4">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star
                          key={j}
                          className={`w-4 h-4 ${
                            j < testimonial.rating
                              ? "text-amber-400 fill-amber-400"
                              : "text-gray-200"
                          }`}
                        />
                      ))}
                    </div>

                    {/* Patient Info */}
                    <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-medical-blue to-deep-trust flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {testimonial.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-deep-trust text-sm">{testimonial.name}</p>
                        <p className="text-text-secondary text-xs">{testimonial.treatment}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dots indicator */}
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: maxIndex + 1 }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i === currentIndex
                    ? "bg-medical-blue w-6"
                    : "bg-gray-300 hover:bg-gray-400"
                }`}
                aria-label={`Go to testimonial group ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
