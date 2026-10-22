"use client"

export default function ArticlesBlogsSection() {
  const placeholders = [1, 2, 3]

  return (
    <section id="articles-blogs" className="section-padding bg-white">
      <div className="section-container">
        {/* Section Header */}
        <div className="text-center mb-12">
          <p className="text-medical-blue font-semibold text-sm tracking-wider uppercase mb-3">
            Resources
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-deep-trust leading-tight mb-4">
            Articles &amp; Blogs
          </h2>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            Insights, updates, and educational content on interventional radiology and patient care.
          </p>
        </div>

        {/* Placeholder Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {placeholders.map((item) => (
            <div
              key={item}
              className="rounded-3xl overflow-hidden bg-soft-sky/40 border border-gray-100 shadow-sm"
            >
              {/* Horizontal curved rectangle placeholder */}
              <div className="w-full aspect-[16/9] rounded-t-3xl bg-gradient-to-br from-soft-sky to-medical-blue/10" />

              <div className="p-6 space-y-2">
                <div className="h-4 w-24 rounded-full bg-medical-blue/10" />
                <div className="h-5 w-3/4 rounded-full bg-deep-trust/10" />
                <div className="h-4 w-full rounded-full bg-gray-100" />
                <div className="h-4 w-2/3 rounded-full bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}