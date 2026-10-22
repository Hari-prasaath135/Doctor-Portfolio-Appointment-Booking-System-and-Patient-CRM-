"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X, Phone, Calendar } from "lucide-react"
import GoogleAuthButton from "@/components/layout/GoogleAuthButton"
import { Button } from "@/components/ui/button"
import { navLinks, doctorInfo } from "@/lib/data"

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled
            ? "bg-white/90 backdrop-blur-xl shadow-[0_2px_20px_rgba(0,0,0,0.06)] border-b border-gray-100/50"
            : "bg-transparent"
        }`}
      >
        <div className="section-container">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div id="navbar-logo-anchor" className="relative w-10 h-10">
                <Image
                  src="/vijay-logo-mark.png"
                  alt="Dr. Vijay"
                  fill
                  priority
                  sizes="40px"
                  className="object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-heading font-bold text-deep-trust text-lg leading-tight">
                  {doctorInfo.name}
                </span>
                <span className="text-text-secondary text-xs leading-tight hidden sm:block">
                  {doctorInfo.specialization}
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-medical-blue transition-colors rounded-lg hover:bg-soft-sky/50 cursor-pointer"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center gap-3">
              <a href="tel:+919876543210" className="flex items-center gap-2 text-sm text-text-secondary hover:text-medical-blue transition-colors">
                <Phone className="w-4 h-4" />
                <span className="hidden xl:inline">Call Us</span>
              </a>
              <GoogleAuthButton />
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl hover:bg-soft-sky transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6 text-deep-trust" />
              ) : (
                <Menu className="w-6 h-6 text-deep-trust" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl z-50 lg:hidden"
            >
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                  <span className="font-heading font-bold text-deep-trust text-lg">Menu</span>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-xl hover:bg-soft-sky transition-colors"
                    aria-label="Close menu"
                  >
                    <X className="w-5 h-5 text-deep-trust" />
                  </button>
                </div>

                <nav className="flex-1 p-6 space-y-1">
                  {navLinks.map((link, i) => (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Link
                        href={link.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="block w-full text-left px-4 py-3 text-base font-medium text-text-primary hover:text-medical-blue hover:bg-soft-sky/50 rounded-xl transition-colors"
                      >
                        {link.label}
                      </Link>
                    </motion.div>
                  ))}
                </nav>

                <div className="p-6 border-t border-gray-100 space-y-3">
                  <a
                    href="tel:+919876543210"
                    className="flex items-center justify-center gap-2 w-full py-3 text-medical-blue border border-medical-blue/20 rounded-xl hover:bg-soft-sky transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    Call Clinic
                  </a>
                  <Link href="/book-appointment" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button
                      className="w-full bg-medical-blue hover:bg-medical-blue-hover text-white rounded-xl py-3 shadow-md cursor-pointer"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Book Appointment
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}