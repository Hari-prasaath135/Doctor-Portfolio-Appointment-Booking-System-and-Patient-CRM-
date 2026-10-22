import HeroSection from "@/components/hero/HeroSection"
import ServicesTeaser from "@/components/services/ServicesTeaser"
import WhyDrVijaySection from "@/components/why/WhyDrVijaySection"
import ProceduresTeaser from "@/components/procedures/ProceduresTeaser"
import AchievementsSection from "@/components/achievements/AchievementsSection"
import TestimonialsTeaser from "@/components/testimonials/TestimonialsTeaser"
import ArticlesBlogsSection from "@/components/articles-blogs/ArticlesBlogsSection"
import ContactTeaser from "@/components/contact/ContactTeaser"

export default function HomePage() {
  return (
    <>
      <HeroSection />
      {/* TODO: AboutTeaser goes here once AboutSection.tsx is provided */}
      <ServicesTeaser />
      <WhyDrVijaySection />
  
      <AchievementsSection />
      <TestimonialsTeaser />
      <ArticlesBlogsSection />
      <ContactTeaser />
    </>
  )
}