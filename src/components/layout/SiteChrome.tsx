"use client"

import { usePathname } from "next/navigation"
import Navbar from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"

// Routes that manage their own top bar / chrome and should not
// get the site-wide Navbar + Footer.
const CHROME_LESS_ROUTES = ["/doctor-dashboard","/admin-dashboard"]

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hideChrome = CHROME_LESS_ROUTES.some((route) => pathname?.startsWith(route))

  if (hideChrome) {
    return <>{children}</>
  }

  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  )
}