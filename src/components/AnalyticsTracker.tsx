"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { trackEvent } from "@/lib/analytics"

export default function AnalyticsTracker() {
  const pathname = usePathname()
  const lastTracked = useRef<string | null>(null)

  useEffect(() => {
    // Avoid double counting same path within quick rerender or React Strict Mode
    if (lastTracked.current === pathname) return
    lastTracked.current = pathname

    trackEvent({
      eventType: "page_view",
      path: pathname,
    })

    if (pathname === "/book-appointment") {
      trackEvent({
        eventType: "appointment_page_view",
        path: pathname,
      })
    }
  }, [pathname])

  return null
}
