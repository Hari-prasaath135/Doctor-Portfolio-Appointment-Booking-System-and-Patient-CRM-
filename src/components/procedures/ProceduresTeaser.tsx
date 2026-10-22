"use client"

import Link from "next/link"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { procedures } from "@/lib/data"

export default function ProceduresTeaser() {
  return (
    <section className="section-padding bg-white">
      <div className="section-container">
        <div className="text-center mb-12">
          <p className="text-medical-blue font-semibold text-sm tracking-wider uppercase mb-3">
            Featured Procedures
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-deep-trust mb-4">
            Our Expertise in Action
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {procedures.map((procedure) => (
            <div
              key={procedure.id}
              className="p-6 rounded-2xl border border-gray-100 hover:shadow-lg transition-all"
            >
              <h3 className="font-heading font-semibold text-deep-trust text-lg mb-2">
                {procedure.name}
              </h3>
              <p className="text-text-secondary text-sm mb-4 line-clamp-3">
                {procedure.description}
              </p>
              <div className="flex items-center gap-2 text-emerald-600 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {procedure.benefits[0]}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/procedures"
            className="inline-flex items-center gap-2 text-medical-blue font-semibold hover:underline"
          >
            View All Procedures
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}