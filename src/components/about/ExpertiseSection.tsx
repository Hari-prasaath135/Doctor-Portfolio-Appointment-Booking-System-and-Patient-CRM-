"use client"

import { useRef } from "react"
import { ChevronLeft, ChevronRight, Stethoscope } from "lucide-react"
import { expertiseCategories } from "@/lib/data"

export default function ExpertiseSection() {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return
    const amount = 340
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    })
  }

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="section-container">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl sm:text-4xl font-heading font-bold text-deep-trust">
              Areas of Expertise
            </h2>
            <p className="text-text-secondary mt-3 max-w-2xl">
              A comprehensive range of interventional radiology procedures.
            </p>
          </div>
          <div className="hidden sm:flex gap-2 flex-shrink-0">
            <button
              onClick={() => scroll("left")}
              className="p-2.5 rounded-xl border border-gray-200 hover:bg-soft-sky transition-colors cursor-pointer"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4 text-deep-trust" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="p-2.5 rounded-xl border border-gray-200 hover:bg-soft-sky transition-colors cursor-pointer"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4 text-deep-trust" />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {expertiseCategories.map((category) => (
            <div
              key={category.id}
              className="flex-shrink-0 w-80 snap-start bg-soft-sky/20 border border-gray-100 rounded-2xl p-6"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-medical-blue to-deep-trust flex items-center justify-center shadow-md mb-4">
                <Stethoscope className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-heading font-bold text-deep-trust text-base mb-3">
                {category.title}
              </h3>
              <ul className="space-y-2">
                {category.items.map((item, i) => (
                  <li
                    key={i}
                    className="text-text-secondary text-xs leading-relaxed flex gap-2"
                  >
                    <span className="text-medical-blue flex-shrink-0">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}