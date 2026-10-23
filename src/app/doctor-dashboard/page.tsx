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
import { useAuth } from "@/lib/auth-context"
import { apiUrl } from "@/lib/api"

// ---------- Types ----------
type SlotStatus = "available" | "booked" | "blocked" | "reserved"
interface Slot {
  id: string
  startTime: string
  endTime: string
  status: SlotStatus
  booked: number
  capacity: number
}

type AppointmentStatus = "upcoming" | "completed" | "pending"
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

// ---------- Component ----------
type TabKey = "slots" | "appointments" | "manage"

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "slots", label: "Appointment Slots", icon: Calendar },
  { key: "appointments", label: "View Appointments", icon: Users },
  { key: "manage", label: "Manage Appointments", icon: Settings2 },
]

function formatClinicDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00")
  if (Number.isNaN(date.getTime())) return dateString
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  })
}

function DoctorDashboardContent() {
  const [activeTab, setActiveTab] = useState<TabKey>("slots")
  const [days, setDays] = useState<string[]>([])
  const [selectedDay, setSelectedDay] = useState("")
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [appointmentList, setAppointmentList] = useState<Appointment[]>([])
  const [slotsByDay, setSlotsByDay] = useState<Record<string, Slot[]>>({})
  const [notifications] = useState<NotificationItem[]>([])
  const [mounted, setMounted] = useState(false)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSavingAction, setIsSavingAction] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState("")
  const [rescheduleTime, setRescheduleTime] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [scheduleDate, setScheduleDate] = useState("")
  const [scheduleStartTime, setScheduleStartTime] = useState("09:00")
  const [scheduleEndTime, setScheduleEndTime] = useState("17:00")
  const [scheduleDuration, setScheduleDuration] = useState("30")
  const [scheduleBuffer, setScheduleBuffer] = useState("10")
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const refreshTimer = setInterval(() => setRefreshKey((value) => value + 1), 30_000)
    return () => clearInterval(refreshTimer)
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setDashboardLoading(false)
      setDashboardError("Please sign in to load your clinic dashboard.")
      return
    }

    let cancelled = false
    const loadDashboard = async () => {
      setDashboardLoading(true)
      setDashboardError(null)
      try {
        const token = await user.getIdToken()
        const [datesRes, appointmentsRes] = await Promise.all([
          fetch(apiUrl("/availability/dates?doctorId=dr-vijay-main")),
          fetch(apiUrl("/appointments?limit=100"), {
            headers: { Authorization: "Bearer " + token },
          }),
        ])
        if (!datesRes.ok || !appointmentsRes.ok) {
          throw new Error("Could not load appointment or availability data.")
        }

        const [datesJson, appointmentsJson] = await Promise.all([
          datesRes.json(),
          appointmentsRes.json(),
        ])
        if (cancelled) return

        const availableDays: string[] = datesJson.data?.availableDates || []
        const rawAppointments: Array<Record<string, unknown>> = appointmentsJson.data || []
        const mappedAppointments: Appointment[] = rawAppointments
          .filter((item) => String(item.status || "").toUpperCase() !== "CANCELLED")
          .map((item) => {
            const status = String(item.status || "").toUpperCase()
            return {
              id: String(item.id),
              patientName: String(item.patientName || "Patient"),
              date: String(item.date || ""),
              time: String(item.time || ""),
              reason: String(item.message || item.serviceName || "Consultation"),
              status: status === "COMPLETED" ? "completed" : status === "PENDING" ? "pending" : "upcoming",
            }
          })

        const fetchedDays = [...new Set([
          ...availableDays,
          ...mappedAppointments.map((appointment) => appointment.date),
        ])].filter(Boolean).sort()
        setDays(fetchedDays)
        setSelectedDay((previous) =>
          previous && fetchedDays.includes(previous) ? previous : fetchedDays[0] || ""
        )
        setAppointmentList(mappedAppointments)
      } catch (error) {
        if (!cancelled) {
          setDashboardError(
            error instanceof Error ? error.message : "Could not load clinic dashboard data."
          )
        }
      } finally {
        if (!cancelled) setDashboardLoading(false)
      }
    }

    void loadDashboard()
    return () => {
      cancelled = true
    }
  }, [user, authLoading, refreshKey])

  useEffect(() => {
    if (!selectedDay) return
    let cancelled = false
    const loadSlots = async () => {
      try {
        const res = await fetch(
          apiUrl("/availability/slots?doctorId=dr-vijay-main&date=" + encodeURIComponent(selectedDay))
        )
        if (!res.ok) throw new Error("Could not load slots for this date.")
        const json = await res.json()
        if (cancelled) return
        const data = json.data
        const mapped: Slot[] = (data?.slots || []).map((slot: {
          time: string
          endTime?: string
          isBooked?: boolean
          status?: string
        }, index: number) => {
          const rawStatus = String(slot.status || "").toUpperCase()
          const status: SlotStatus =
            rawStatus === "BLOCKED" ? "blocked" :
            rawStatus === "RESERVED" ? "reserved" :
            slot.isBooked || rawStatus === "BOOKED" ? "booked" : "available"
          return {
            id: selectedDay + "-" + slot.time + "-" + index,
            startTime: slot.time,
            endTime: slot.endTime || "",
            status,
            booked: status === "booked" || status === "reserved" ? 1 : 0,
            capacity: 1,
          }
        })
        setSlotsByDay((previous) => ({ ...previous, [selectedDay]: mapped }))
      } catch (error) {
        if (!cancelled) {
          setSlotsByDay((previous) => ({ ...previous, [selectedDay]: [] }))
          setDashboardError(error instanceof Error ? error.message : "Could not load slots.")
        }
      }
    }
    void loadSlots()
    return () => {
      cancelled = true
    }
  }, [selectedDay, refreshKey])

  const currentSlots = slotsByDay[selectedDay] ?? []
  const upcomingAppointments = appointmentList.filter((a) => a.status !== "completed")
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
  const todaysAppointmentsCount = appointmentList.filter(
    (a) => a.date === today && a.status !== "completed"
  ).length
  const availableSlotsToday = currentSlots.filter((s) => s.status === "available").length
  const pendingRequestsCount = appointmentList.filter((a) => a.status === "pending").length

  const saveSchedule = async () => {
    if (!scheduleDate) {
      setActionError("Choose a date for the new schedule.")
      return
    }
    if (scheduleStartTime >= scheduleEndTime) {
      setActionError("The schedule end time must be later than its start time.")
      return
    }

    setIsSavingAction(true)
    setActionError(null)
    try {
      const token = await user?.getIdToken()
      if (!token) throw new Error("Please sign in again.")
      const res = await fetch(apiUrl("/availability/schedule"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          doctorId: "dr-vijay-main",
          date: scheduleDate,
          startTime: scheduleStartTime,
          endTime: scheduleEndTime,
          slotDurationMinutes: Number(scheduleDuration),
          bufferMinutes: Number(scheduleBuffer),
          consultationTypes: [
            { type: "IN_PERSON", feeInPaise: 100000, durationMinutes: Number(scheduleDuration) },
            { type: "VIDEO", feeInPaise: 80000, durationMinutes: Number(scheduleDuration) },
            { type: "FOLLOW_UP", feeInPaise: 50000, durationMinutes: Number(scheduleDuration) },
          ],
          isPublished: true,
        }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(result.error || result.message || "Schedule creation failed.")
      setSelectedDay(scheduleDate)
      setShowScheduleForm(false)
      setRefreshKey((value) => value + 1)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Schedule creation failed.")
    } finally {
      setIsSavingAction(false)
    }
  }

  const handleCancel = async (id: string) => {
    setIsSavingAction(true)
    setActionError(null)
    try {
      const token = await user?.getIdToken()
      if (!token) throw new Error("Please sign in again.")
      const res = await fetch(apiUrl("/appointments/" + encodeURIComponent(id) + "/cancel"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ reason: "Cancelled by doctor from dashboard" }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(result.error || "Appointment cancellation failed.")
      setAppointmentList((previous) => previous.filter((appointment) => appointment.id !== id))
      setRefreshKey((value) => value + 1)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Appointment cancellation failed.")
    } finally {
      setIsSavingAction(false)
    }
  }

  const handleReschedule = async (id: string) => {
    if (!rescheduleDate || !rescheduleTime) {
      setActionError("Choose a new date and time before rescheduling.")
      return
    }
    setIsSavingAction(true)
    setActionError(null)
    try {
      const token = await user?.getIdToken()
      if (!token) throw new Error("Please sign in again.")
      const res = await fetch(apiUrl("/appointments/" + encodeURIComponent(id) + "/reschedule"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ newDate: rescheduleDate, newTime: rescheduleTime }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(result.error || "Appointment rescheduling failed.")
      setAppointmentList((previous) =>
        previous.map((appointment) =>
          appointment.id === id
            ? { ...appointment, date: rescheduleDate, time: rescheduleTime, status: "upcoming" }
            : appointment
        )
      )
      setRescheduleId(null)
      setRescheduleDate("")
      setRescheduleTime("")
      setRefreshKey((value) => value + 1)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Appointment rescheduling failed.")
    } finally {
      setIsSavingAction(false)
    }
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
              {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}
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
                <p className="text-text-secondary text-sm">Available Slots</p>
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

          {(dashboardError || actionError) && (
            <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {actionError || dashboardError}
              <button type="button" onClick={() => setActionError(null)} className="ml-3 underline">Dismiss</button>
            </div>
          )}

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
                          {formatClinicDate(day)}
                        </option>
                      ))}
                    </select>
                    <button className="flex items-center gap-2 px-4 py-2 bg-medical-blue hover:bg-medical-blue-hover text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer whitespace-nowrap">
                      <Plus className="w-4 h-4" />
                      Add Slot
                    </button>
                  </div>
                </div>

                {showScheduleForm && (
                  <div className="mt-5 rounded-xl border border-gray-200 bg-soft-sky/20 p-4">
                    <h3 className="font-semibold text-deep-trust text-sm mb-3">Create clinic schedule</h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <label className="text-xs text-text-secondary">
                        Date
                        <input type="date" min={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })} value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-text-primary" />
                      </label>
                      <label className="text-xs text-text-secondary">
                        Start time
                        <input type="time" value={scheduleStartTime} onChange={(event) => setScheduleStartTime(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-text-primary" />
                      </label>
                      <label className="text-xs text-text-secondary">
                        End time
                        <input type="time" value={scheduleEndTime} onChange={(event) => setScheduleEndTime(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-text-primary" />
                      </label>
                      <label className="text-xs text-text-secondary">
                        Slot duration
                        <select value={scheduleDuration} onChange={(event) => setScheduleDuration(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-text-primary">
                          <option value="15">15 minutes</option>
                          <option value="20">20 minutes</option>
                          <option value="30">30 minutes</option>
                          <option value="45">45 minutes</option>
                          <option value="60">60 minutes</option>
                        </select>
                      </label>
                      <label className="text-xs text-text-secondary">
                        Buffer between slots
                        <select value={scheduleBuffer} onChange={(event) => setScheduleBuffer(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-text-primary">
                          <option value="0">No buffer</option>
                          <option value="5">5 minutes</option>
                          <option value="10">10 minutes</option>
                          <option value="15">15 minutes</option>
                        </select>
                      </label>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <button type="button" onClick={() => setShowScheduleForm(false)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-text-secondary">Cancel</button>
                      <button type="button" disabled={isSavingAction} onClick={() => void saveSchedule()} className="rounded-lg bg-medical-blue px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{isSavingAction ? "Saving..." : "Publish schedule"}</button>
                    </div>
                  </div>
                )}

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
                            {slot.endTime ? slot.startTime + " – " + slot.endTime : slot.startTime}
                          </td>
                          <td className="py-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                slot.status === "available"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : slot.status === "blocked"
                                  ? "bg-red-50 text-red-700"
                                  : slot.status === "reserved"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-soft-sky text-medical-blue"
                              }`}
                            >
                              {slot.status === "available" ? "Available" : slot.status === "blocked" ? "Blocked" : slot.status === "reserved" ? "Reserved" : "Booked"}
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
                  {dashboardLoading && <p className="text-sm text-text-secondary">Loading appointments...</p>}
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
                          <p className="text-sm font-medium text-deep-trust">{formatClinicDate(appt.date)}</p>
                          <p className="text-xs text-text-secondary">{appt.time}</p>
                        </div>
                        <span
                          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                            appt.status === "completed"
                              ? "bg-emerald-50 text-emerald-700"
                              : appt.status === "pending"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-soft-sky text-medical-blue"
                          }`}
                        >
                          {appt.status !== "completed" ? (
                            <Clock className="w-3 h-3" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          {appt.status === "completed" ? "Completed" : appt.status === "pending" ? "Awaiting payment" : "Upcoming"}
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
                            {formatClinicDate(appt.date)} · {appt.time}
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
                          disabled={isSavingAction}
                          className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
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
            <div className="space-y-3 mb-5">
              <label className="block text-sm text-text-secondary">
                New date
                <input
                  type="date"
                  min={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}
                  value={rescheduleDate}
                  onChange={(event) => setRescheduleDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-text-primary"
                />
              </label>
              <label className="block text-sm text-text-secondary">
                New time
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={(event) => setRescheduleTime(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-text-primary"
                />
              </label>
            </div>
            <button
              disabled={isSavingAction}
              onClick={() => handleReschedule(rescheduleId)}
              className="w-full bg-medical-blue hover:bg-medical-blue-hover text-white rounded-xl py-2.5 text-sm font-semibold shadow-md cursor-pointer disabled:opacity-50"
            >
              {isSavingAction ? "Saving..." : "Confirm Reschedule"}
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