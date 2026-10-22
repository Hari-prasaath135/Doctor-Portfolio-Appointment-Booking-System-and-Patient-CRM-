import Link from "next/link"
import { Phone, Mail, MapPin, Clock, Heart } from "lucide-react"
import { doctorInfo, clinicInfo, navLinks } from "@/lib/data"

export default function Footer() {
  return (
    <footer className="bg-deep-trust text-white">
      {/* Main Footer */}
      <div className="section-container py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Doctor Info */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <span className="text-medical-blue font-heading font-bold text-lg">V</span>
              </div>
              <div>
                <h3 className="font-heading font-bold text-white text-lg">{doctorInfo.name}</h3>
                <p className="text-white/60 text-sm">{doctorInfo.specialization}</p>
              </div>
            </div>
            <p className="text-white/70 text-sm leading-relaxed mt-4">
              {doctorInfo.shortBio}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-heading font-semibold text-white text-base mb-5">Quick Links</h4>
            <ul className="space-y-3">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/70 hover:text-medical-blue transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="#appointment"
                  className="text-white/70 hover:text-medical-blue transition-colors text-sm"
                >
                  Book Appointment
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-heading font-semibold text-white text-base mb-5">Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-medical-blue mt-0.5 shrink-0" />
                <div>
                  <a href={`tel:${clinicInfo.phone}`} className="text-white/70 hover:text-white transition-colors text-sm">
                    {clinicInfo.phone}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-medical-blue mt-0.5 shrink-0" />
                <a href={`mailto:${clinicInfo.email}`} className="text-white/70 hover:text-white transition-colors text-sm">
                  {clinicInfo.email}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-medical-blue mt-0.5 shrink-0" />
                <span className="text-white/70 text-sm">
                  {clinicInfo.address}, {clinicInfo.city}, {clinicInfo.state}
                </span>
              </li>
            </ul>
          </div>

          {/* Working Hours */}
          <div>
            <h4 className="font-heading font-semibold text-white text-base mb-5">Working Hours</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-medical-blue mt-0.5 shrink-0" />
                <div>
                  <p className="text-white/90 text-sm font-medium">Mon – Fri</p>
                  <p className="text-white/60 text-sm">{clinicInfo.workingHours.weekdays}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-medical-blue mt-0.5 shrink-0" />
                <div>
                  <p className="text-white/90 text-sm font-medium">Saturday</p>
                  <p className="text-white/60 text-sm">{clinicInfo.workingHours.saturday}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-white/30 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white/90 text-sm font-medium">Sunday</p>
                  <p className="text-white/60 text-sm">{clinicInfo.workingHours.sunday}</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="section-container py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/50 text-sm flex items-center gap-1">
            © {new Date().getFullYear()} {doctorInfo.name}. Made with{" "}
            <Heart className="w-3 h-3 text-red-400 fill-red-400" /> for patient care.
          </p>
          <div className="flex items-center gap-6">
            <Link href="#" className="text-white/50 hover:text-white/80 transition-colors text-sm">
              Privacy Policy
            </Link>
            <Link href="#" className="text-white/50 hover:text-white/80 transition-colors text-sm">
              Terms & Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
