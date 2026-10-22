"use client"

import { Award } from "lucide-react"
import { awards } from "@/lib/data"

export default function AwardsSection() {
  return (
    <section className="py-16 md:py-24 bg-soft-sky/20">
      <div className="section-container">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-heading font-bold text-deep-trust">
            Awards & Accomplishments
          </h2>
          <p className="text-text-secondary mt-3 max-w-2xl mx-auto">
            Academic recognitions earned throughout Dr. Vijay's medical training.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {awards.map((award) => (
            <div
              key={award.id}
              className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 flex flex-col"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-medical-blue to-deep-trust flex items-center justify-center shadow-md mb-4">
                <Award className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-heading font-bold text-deep-trust text-lg mb-1">
                {award.title}
              </h3>
              <p className="text-medical-blue text-sm font-medium mb-3">
                {award.issuer}
              </p>
              <p className="text-text-secondary text-sm leading-relaxed">
                {award.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}