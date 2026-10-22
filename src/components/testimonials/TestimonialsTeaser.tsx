"use client"

import Link from "next/link"
import { Star, Quote, ArrowRight } from "lucide-react"
import { testimonials } from "@/lib/data"

export default function TestimonialsTeaser() {
  const featured = testimonials.slice(0, 3)

  return (
    <section className="section-padding bg-white">
      <div className="section-container">
        <div className="text-center mb-12">
          <p className="text-medical-blue font-semibold text-sm tracking-wider uppercase mb-3">
            Testimonials
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-deep-trust mb-4">
            What Our Patients Say
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {featured.map((t) => (
            <div
              key={t.id}
              className="p-6 rounded-2xl bg-warm-offwhite border border-gray-100"
            >
              <Quote className="w-7 h-7 text-medical-blue/20 mb-3" />
              <p className="text-text-secondary text-sm mb-4 line-clamp-4">
                &ldquo;{t.review}&rdquo;
              </p>
              <div className="flex items-center gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star
                    key={j}
                    className={`w-3.5 h-3.5 ${
                      j < t.rating ? "text-amber-400 fill-amber-400" : "text-gray-200"
                    }`}
                  />
                ))}
              </div>
              <p className="font-semibold text-deep-trust text-sm">{t.name}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/testimonials"
            className="inline-flex items-center gap-2 text-medical-blue font-semibold hover:underline"
          >
            Read More Testimonials
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}