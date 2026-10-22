import type { Metadata } from "next"
import { Plus_Jakarta_Sans, Inter } from "next/font/google"
import "./globals.css"
import "mapbox-gl/dist/mapbox-gl.css"
import Script from "next/script"
import SiteChrome from "@/components/layout/SiteChrome"
import SmoothScroll from "@/components/layout/SmoothScroll"
import Providers from "@/components/Providers"
import SplashScreen from "@/components/SplashScreen"
import AnalyticsTracker from "@/components/AnalyticsTracker"

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap", 
  weight: ["400", "500", "600", "700", "800"],
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "Dr. Vijay — Interventional Radiologist | Minimally Invasive Treatments",
  description:
    "Dr. Vijay is a leading Interventional Radiologist specializing in minimally invasive, image-guided procedures. Book your appointment for advanced vascular interventions, pain management, and more.",
  keywords: [
    "Interventional Radiologist",
    "Minimally Invasive Procedures",
    "Vascular Interventions",
    "Image-Guided Treatment",
    "Dr. Vijay",
    "Uterine Fibroid Embolization",
    "Varicose Vein Treatment",
    "Pain Management",
  ],
  authors: [{ name: "Dr. Vijay" }],
  openGraph: {
    title: "Dr. Vijay — Interventional Radiologist",
    description:
      "Pioneering minimally invasive image-guided treatments. Book your appointment today.",
    type: "website",
    locale: "en_IN",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${inter.variable}`}>
      <body className="font-body antialiased">
        <SplashScreen>
          <Providers>
            <AnalyticsTracker />
            <SmoothScroll>
              <SiteChrome>{children}</SiteChrome>
            </SmoothScroll>
          </Providers>
        </SplashScreen>
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      </body>
    </html>
  )
}