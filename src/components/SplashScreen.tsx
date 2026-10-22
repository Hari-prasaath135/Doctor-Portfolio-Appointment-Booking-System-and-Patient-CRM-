"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"

export default function SplashScreen({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(true)
  const [showLogo, setShowLogo] = useState(false)
  const [showText, setShowText] = useState(false)
  const [flying, setFlying] = useState(false)
  const [revealPage, setRevealPage] = useState(false)
  const [flyStyle, setFlyStyle] = useState<React.CSSProperties>({})

  const logoWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.style.overflow = "hidden"

    // Logo fade-in starts almost immediately
    const raf = requestAnimationFrame(() => setShowLogo(true))

    // Logo fade duration is 700ms — wait for it to finish, then a beat, then show text
    const showTextTimer = setTimeout(() => setShowText(true), 1100)

    const flyTimer = setTimeout(() => {
      const logoEl = logoWrapRef.current
      const target = document.getElementById("navbar-logo-anchor")

      if (logoEl && target) {
        const startRect = logoEl.getBoundingClientRect()
        const targetRect = target.getBoundingClientRect()

        const startCenterX = startRect.left + startRect.width / 2
        const startCenterY = startRect.top + startRect.height / 2
        const targetCenterX = targetRect.left + targetRect.width / 2
        const targetCenterY = targetRect.top + targetRect.height / 2

        const dx = targetCenterX - startCenterX
        const dy = targetCenterY - startCenterY
        const scale = targetRect.width / startRect.width

        setFlyStyle({
          transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`,
        })
      }

      setFlying(true)
      setRevealPage(true)
    }, 2400)

    const unmountTimer = setTimeout(() => {
      setShowSplash(false)
      document.body.style.overflow = ""
    }, 3300)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(showTextTimer)
      clearTimeout(flyTimer)
      clearTimeout(unmountTimer)
      document.body.style.overflow = ""
    }
  }, [])

  return (
    <>
      {showSplash && (
        <div
          className={`fixed inset-0 z-[100] w-screen h-screen flex flex-col items-center justify-center bg-white transition-opacity duration-700 ease-in-out ${
            flying ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <div
            ref={logoWrapRef}
            className={`relative w-40 h-40 sm:w-56 sm:h-56 transition-all duration-700 ease-out ${
              showLogo ? "opacity-100 scale-100" : "opacity-0 scale-95"
            }`}
            style={flyStyle}
          >
            <Image
              src="/vijay-logo-mark.png"
              alt="Dr. Vijay"
              fill
              priority
              sizes="224px"
              className="object-contain"
            />
          </div>

          <div
            className={`relative w-64 sm:w-80 mt-6 transition-all duration-700 ease-out ${
              showText && !flying ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
            }`}
          >
            <Image
              src="/vijay-wordmark.png"
              alt="Dr. Vijay — Healthcare Excellence, Your Health, Our Mission!"
              width={800}
              height={260}
              className="w-full h-auto"
            />
          </div>
        </div>
      )}

      <div
        className={`transition-opacity duration-700 ease-in-out ${
          revealPage ? "opacity-100" : "opacity-0"
        }`}
      >
        {children}
      </div>
    </>
  )
}