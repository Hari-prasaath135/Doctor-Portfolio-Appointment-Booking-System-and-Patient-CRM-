"use client"

import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  Calendar,
  Users,
  Settings2,
  Bell,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCcw,
  ChevronDown,
  X,
  Plus,
  MoreVertical,
  UserCircle2,
  Stethoscope,
} from "lucide-react"
import ProtectedRoute from "@/components/auth/ProtectedRoute"

// ---------- Types ----------
type SlotStatus = "available" | "booked"
interface Slot {
  id: string
  startTime: string
  endTime: string
  status: SlotStatus
  booked: number
  capacity: number
}

type AppointmentStatus = "upcoming" | "completed"
interface Appointment {
  id: string
  patientName: string
  date: string
  time: string
  reason: string
  status: AppointmentStatus
}

interface NotificationItem {
  id: string
  message: string
  time: string
}

// ---------- Mock Data ----------
const days = ["Mon 8", "Tue 9", "Wed 10", "Thu 11", "Fri 12"]

const slotsByDay: Record<string, Slot[]> = {
  "Mon 8": [
    { id: "s1", startTime: "09:00 AM", endTime: "09:30 AM", status: "available", booked: 0, capacity: 1 },
    { id: "s2", startTime: "09:30 AM", endTime: "10:00 AM", status: "available", booked: 0, capacity: 1 },
    { id: "s3", startTime: "10:00 AM", endTime: "10:30 AM", status: "booked", booked: 1, capacity: 1 },
    { id: "s4", startTime: "10:30 AM", endTime: "11:00 AM", status: "available", booked: 0, capacity: 1 },
    { id: "s5", startTime: "11:00 AM", endTime: "11:30 AM", status: "available", booked: 0, capacity: 1 },
    { id: "s6", startTime: "11:30 AM", endTime: "12:00 PM", status: "available", booked: 0, capacity: 1 },
  ],
  "Tue 9": [
    { id: "s7", startTime: "09:00 AM", endTime: "09:30 AM", status: "booked", booked: 1, capacity: 1 },
    { id: "s8", startTime: "09:30 AM", endTime: "10:00 AM", status: "available", booked: 0, capacity: 1 },
    { id: "s9", startTime: "10:00 AM", endTime: "10:30 AM", status: "available", booked: 0, capacity: 1 },
  ],
}

const appointments: Appointment[] = [
  {
    id: "a1",
    patientName: "Aarav Menon",
    date: "Mon 8 Sep",
    time: "09:30 AM",
    reason: "Follow-up: Varicose Vein Treatment",
    status: "upcoming",
  },
  {
    id: "a2",
    patientName: "Priya Suresh",
    date: "Mon 8 Sep",
    time: "11:00 AM",
    reason: "Initial Consultation: Pain Management",
    status: "upcoming",
  },
  {
    id: "a3",
    patientName: "Karthik Raja",
    date: "Fri 5 Sep",
    time: "02:00 PM",
    reason: "Post-Procedure Review",
    status: "completed",
  },
]

const notifications: NotificationItem[] = [
  { id: "n1", message: "Priya Suresh booked a new appointment", time: "5m ago" },
  { id: "n2", message: "Aarav Menon rescheduled to 09:30 AM", time: "1h ago" },
  { id: "n3", message: "Karthik Raja's appointment marked completed", time: "3h ago" },
]

// ---------- Component ----------
type TabKey = "slots" | "appointments" | "manage"

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "slots", label: "Appointment Slots", icon: Calendar },
  { key: "appointments", label: "View Appointments", icon: Users },
  { key: "manage", label: "Manage Appointments", icon: Settings2 },
]

function DoctorDashboardContent() {
  const [activeTab, setActiveTab] = useState<TabKey>("slots")
  const [selectedDay, setSelectedDay] = useState(days[0])
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [appointmentList, setAppointmentList] = useState(appointments)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const currentSlots = slotsByDay[selectedDay] ?? []
  const upcomingAppointments = appointmentList.filter((a) => a.status === "upcoming")

  // Derived stat-card numbers from the mock data above.
  // "Pending Requests" has no real data model yet on this page — placeholder count.
  const todaysAppointmentsCount = appointmentList.filter(
    (a) => a.date === "Mon 8 Sep" && a.status === "upcoming"
  ).length
  const availableSlotsToday = currentSlots.filter((s) => s.status === "available").length
  const pendingRequestsCount = 2 // placeholder — no backing data yet

  const handleCancel = (id: string) => {
    setAppointmentList((prev) => prev.filter((a) => a.id !== id))
  }

  const handleReschedule = (id: string) => {
    setRescheduleId(null)
    // Hook up real reschedule logic (date/time picker + API call) here.
    alert(`Reschedule flow for appointment ${id} would open here.`)
  }

  return (
    <div
      className={`min-h-screen bg-soft-sky/20 flex transition-opacity duration-500 ease-out ${
        mounted ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* ---------- Sidebar ---------- */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 bg-white border-r border-gray-100 min-h-screen sticky top-0">
        <div className="flex items-center gap-3 px-6 py-6 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-medical-blue to-deep-trust flex items-center justify-center shadow-md flex-shrink-0">
            <Stethoscope className="w-4 h-4 text-white" />
          </div>
          <span className="font-heading font-bold text-deep-trust text-lg">
            Dr. Vijay
          </span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          <button
            onClick={() => setActiveTab("slots")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === "slots"
                ? "bg-soft-sky text-medical-blue"
                : "text-text-secondary hover:bg-soft-sky/50"
            }`}
          >
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
            Dashboard
          </button>

          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === key
                  ? "bg-soft-sky text-medical-blue"
                  : "text-text-secondary hover:bg-soft-sky/50"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Doctor profile pinned at the bottom */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-medical-blue to-deep-trust flex items-center justify-center shadow-md flex-shrink-0">
              <span className="text-white font-heading font-bold text-sm">V</span>
            </div>
            <div className="min-w-0">
              <p className="font-medium text-deep-trust text-sm truncate">Dr. Vijay</p>
              <p className="text-text-secondary text-xs truncate">
                Interventional Radiologist
              </p>
              <span className="flex items-center gap-1 text-emerald-600 text-xs mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Online
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* ---------- Main column ---------- */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
          <div className="flex items-center justify-end gap-4 px-6 h-16">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((prev) => !prev)}
                className="relative p-2.5 rounded-xl hover:bg-soft-sky transition-colors cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5 text-deep-trust" />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-40">
                  <div className="px-4 py-3 border-b border-gray-100 font-heading font-semibold text-deep-trust text-sm">
                    Notifications
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className="px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-soft-sky/40 transition-colors"
                      >
                        <p className="text-sm text-text-primary">{n.message}</p>
                        <p className="text-xs text-text-secondary mt-1">{n.time}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Profile dropdown trigger */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen((prev) => !prev)}
                className="flex items-center gap-1.5 cursor-pointer"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-medical-blue to-deep-trust flex items-center justify-center shadow-md">
                  <span className="text-white font-heading font-bold text-xs">V</span>
                </div>
                <ChevronDown className="w-4 h-4 text-text-secondary" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-40">
                  <button className="w-full flex items-center gap-2 px-4 py-3 text-sm text-text-primary hover:bg-soft-sky/40 transition-colors cursor-pointer">
                    <UserCircle2 className="w-4 h-4" />
                    View Profile
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-8">
          {/* Greeting */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
            <div>
              <h1 className="font-heading font-bold text-2xl text-deep-trust">
                Good Morning, Dr. Vijay
              </h1>
              <p className="text-text-secondary text-sm mt-1">
                Here&apos;s your schedule and upcoming appointments for today.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Calendar className="w-4 h-4" />
              Mon, 8 Sep 2026
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-text-secondary text-sm">Today&apos;s Appointments</p>
                <p className="font-heading font-bold text-2xl text-deep-trust">
                  {todaysAppointmentsCount}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-text-secondary text-sm">Total Appointments (This Week)</p>
                <p className="font-heading font-bold text-2xl text-deep-trust">
                  {appointmentList.length}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-text-secondary text-sm">Available Slots Today</p>
                <p className="font-heading font-bold text-2xl text-deep-trust">
                  {availableSlotsToday}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                <UserCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-text-secondary text-sm">Pending Requests</p>
                <p className="font-heading font-bold text-2xl text-deep-trust">
                  {pendingRequestsCount}
                </p>
              </div>
            </div>
          </div>

          {/* Card containing underlined sub-tabs + content */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
            {/* Underlined tab switcher */}
            <div className="flex items-center gap-6 border-b border-gray-100 mb-6 overflow-x-auto">
              {tabs.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 pb-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                    activeTab === key
                      ? "border-medical-blue text-medical-blue"
                      : "border-transparent text-text-secondary hover:text-medical-blue"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* --- Appointment Slots Tab --- */}
            {activeTab === "slots" && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
                  <div>
                    <h2 className="font-heading font-bold text-lg text-deep-trust">
                      Your Appointment Slots
                    </h2>
                    <p className="text-text-secondary text-sm">
                      Manage your available time slots for patient appointments.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedDay}
                      onChange={(e) => setSelectedDay(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-medical-blue/30"
                    >
                      {days.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                    <button className="flex items-center gap-2 px-4 py-2 bg-medical-blue hover:bg-medical-blue-hover text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer whitespace-nowrap">
                      <Plus className="w-4 h-4" />
                      Add Slot
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto mt-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-text-secondary border-b border-gray-100">
                        <th className="pb-3 font-medium">Time</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Patients Booked</th>
                        <th className="pb-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentSlots.map((slot) => (
                        <tr key={slot.id} className="border-b border-gray-50 last:border-0">
                          <td className="py-4 text-text-primary">
                            {slot.startTime} – {slot.endTime}
                          </td>
                          <td className="py-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                slot.status === "available"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-soft-sky text-medical-blue"
                              }`}
                            >
                              {slot.status === "available" ? "Available" : "Booked"}
                            </span>
                          </td>
                          <td className="py-4 text-text-primary">
                            {slot.booked} / {slot.capacity}
                          </td>
                          <td className="py-4 text-right">
                            <button
                              className="p-2 rounded-lg hover:bg-soft-sky transition-colors cursor-pointer"
                              aria-label="Slot actions"
                            >
                              <MoreVertical className="w-4 h-4 text-text-secondary" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {currentSlots.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-text-secondary">
                            No slots configured for this day.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* --- View Appointments Tab --- */}
            {activeTab === "appointments" && (
              <div>
                <h2 className="font-heading font-bold text-lg text-deep-trust mb-4">
                  Booked Appointments
                </h2>
                <div className="space-y-3">
                  {appointmentList.map((appt) => (
                    <div
                      key={appt.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-gray-100 hover:bg-soft-sky/30 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-11 h-11 rounded-full bg-soft-sky flex items-center justify-center flex-shrink-0">
                          <UserCircle2 className="w-6 h-6 text-medical-blue" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-deep-trust text-sm truncate">
                            {appt.patientName}
                          </p>
                          <p className="text-text-secondary text-xs truncate">
                            {appt.reason}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-medium text-deep-trust">{appt.date}</p>
                          <p className="text-xs text-text-secondary">{appt.time}</p>
                        </div>
                        <span
                          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                            appt.status === "upcoming"
                              ? "bg-soft-sky text-medical-blue"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {appt.status === "upcoming" ? (
                            <Clock className="w-3 h-3" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          {appt.status === "upcoming" ? "Upcoming" : "Completed"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- Manage Appointments Tab --- */}
            {activeTab === "manage" && (
              <div>
                <h2 className="font-heading font-bold text-lg text-deep-trust mb-4">
                  Manage Appointments
                </h2>
                <div className="space-y-3">
                  {upcomingAppointments.map((appt) => (
                    <div
                      key={appt.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-gray-100"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-11 h-11 rounded-full bg-soft-sky flex items-center justify-center flex-shrink-0">
                          <UserCircle2 className="w-6 h-6 text-medical-blue" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-deep-trust text-sm truncate">
                            {appt.patientName}
                          </p>
                          <p className="text-text-secondary text-xs truncate">
                            {appt.date} · {appt.time}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => setRescheduleId(appt.id)}
                          className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-medical-blue border border-medical-blue/20 rounded-xl hover:bg-soft-sky transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <RefreshCcw className="w-4 h-4" />
                          Reschedule
                        </button>
                        <button
                          onClick={() => handleCancel(appt.id)}
                          className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}

                  {upcomingAppointments.length === 0 && (
                    <p className="text-text-secondary text-sm">
                      No active appointments to manage.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reschedule confirm modal */}
      {rescheduleId && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-deep-trust">
                Reschedule Appointment
              </h3>
              <button
                onClick={() => setRescheduleId(null)}
                className="p-1 rounded-lg hover:bg-soft-sky transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-deep-trust" />
              </button>
            </div>
            <p className="text-sm text-text-secondary mb-6">
              Plug in your date/time picker here before calling the reschedule API.
            </p>
            <button
              onClick={() => handleReschedule(rescheduleId)}
              className="w-full bg-medical-blue hover:bg-medical-blue-hover text-white rounded-xl py-2.5 text-sm font-semibold shadow-md cursor-pointer"
            >
              Confirm Reschedule
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DoctorDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["DOCTOR"]} dashboardName="Doctor Dashboard">
      <DoctorDashboardContent />
    </ProtectedRoute>
  )
}