"use client"

import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  MessageSquare,
  CalendarPlus,
  CalendarCheck,
  Bell,
  Users,
  Eye,
  TrendingUp,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Mail,
  Search,
  ChevronDown,
  Stethoscope,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { db } from "@/lib/firebase"
import { collection, query, orderBy, onSnapshot, doc, updateDoc, Timestamp } from "firebase/firestore"
import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { useAuth } from "@/lib/auth-context"
import { doctorInfo } from "@/lib/data"
import { apiUrl } from "@/lib/api"
import { Loader2 } from "lucide-react"

// ---------- Helpers ----------
function timeAgo(timestamp: Timestamp | null | undefined): string {
  if (!timestamp) return "Just now"
  const seconds = Math.floor((Date.now() - timestamp.toDate().getTime()) / 1000)
  if (seconds < 60) return "Just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ---------- Types ----------
interface VisitorStat {
  label: string
  value: string
  change: string
  positive: boolean
  icon: React.ElementType
  tint: string
}

interface DailyVisit {
  day: string
  visits: number
}

type QueryStatus = "pending" | "reviewed"
interface PatientQuery {
  id: string
  name: string
  email: string
  phone: string
  message: string
  submittedAt: string
  status: QueryStatus
}

interface AppointmentSlot {
  id: string
  date: string
  time: string
}


interface RealDashboardInsights {
  traffic: {
    totalPageViews: number
    estimatedUniqueVisitors: number
    appointmentPageVisits: number
    contactPageVisits: number
    weeklyVisits: { day: string; visits: number }[]
    popularPages: { path: string; views: number }[]
  }
  funnel: {
    bookingStarts: number
    consultationSelections: number
    bookingSubmissions: number
    conversionRate: number
  }
  appointments: {
    total: number
    byStatus: Record<string, number>
    activeList: {
      id: string
      patientName: string
      date: string
      time: string
      doctor: string
      status: string
      serviceName: string
      amount: number
    }[]
  }
  inquiries: {
    total: number
    pending: number
    reviewed: number
  }
  recentActivity: {
    id: string
    type: string
    message: string
    timeAgo: string
    timestamp: string
  }[]
  trackingStartedAt: string
  lastUpdated: string
}

// Initial empty state (no fabricated data)
const emptyInsights: RealDashboardInsights = {
  traffic: {
    totalPageViews: 0,
    estimatedUniqueVisitors: 0,
    appointmentPageVisits: 0,
    contactPageVisits: 0,
    weeklyVisits: [],
    popularPages: [],
  },
  funnel: {
    bookingStarts: 0,
    consultationSelections: 0,
    bookingSubmissions: 0,
    conversionRate: 0,
  },
  appointments: {
    total: 0,
    byStatus: {},
    activeList: [],
  },
  inquiries: {
    total: 0,
    pending: 0,
    reviewed: 0,
  },
  recentActivity: [],
  trackingStartedAt: "2026-10-22T00:00:00.000Z",
  lastUpdated: new Date().toISOString(),
}

// ---------- Component ----------
type TabKey = "overview" | "queries" | "slots" | "active"

const navItems: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Dashboard", icon: LayoutDashboard },
  { key: "queries", label: "Query Platform", icon: MessageSquare },
  { key: "slots", label: "Slot Management", icon: CalendarPlus },
  { key: "active", label: "Active Appointments", icon: CalendarCheck },
]

function AdminDashboardContent() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview")
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [queries, setQueries] = useState<PatientQuery[]>([])
  const [slots, setSlots] = useState<AppointmentSlot[]>([])
  const [newDate, setNewDate] = useState("")
  const [newTime, setNewTime] = useState("")

  // Real Insights State from Backend API
  const [insights, setInsights] = useState<RealDashboardInsights>(emptyInsights)
  const [loadingInsights, setLoadingInsights] = useState(true)
  const [insightsError, setInsightsError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { getIdToken } = useAuth()

  const fetchInsights = async (isManual = false) => {
    if (isManual) setIsRefreshing(true)
    setInsightsError(null)

    try {
      const token = await getIdToken()
      if (!token) return

      const res = await fetch(apiUrl("/admin/insights"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        throw new Error("Failed to load dashboard insights")
      }

      const json = await res.json()
      if (json.data) {
        setInsights(json.data)
      }
    } catch (err: any) {
      console.error("Dashboard insights error:", err)
      setInsightsError(err.message || "Could not connect to analytics service")
    } finally {
      setLoadingInsights(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchInsights()
    // Periodic refresh every 30 seconds for live monitoring
    const timer = setInterval(() => fetchInsights(), 30000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  // Live Firestore listener for enquiries submitted from the contact form
  useEffect(() => {
    const q = query(collection(db, "enquiries"), orderBy("createdAt", "desc"))
    const unsub = onSnapshot(q, (snap) => {
      setQueries(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            name: data.name,
            email: data.email,
            phone: data.phone,
            message: data.message,
            status: data.status as QueryStatus,
            submittedAt: timeAgo(data.createdAt),
          }
        })
      )
    })
    return unsub
  }, [])

  const pendingCount = queries.filter((q) => q.status === "pending").length
  const reviewedCount = queries.filter((q) => q.status === "reviewed").length

  const queryBreakdown = [
    { name: "Pending", value: pendingCount, color: "#f59e0b" },
    { name: "Reviewed", value: reviewedCount, color: "#10b981" },
  ]

  const visitorStats: VisitorStat[] = [
    {
      label: "Total Page Views",
      value: String(insights.traffic.totalPageViews),
      change: `${insights.traffic.appointmentPageVisits} booking visits`,
      positive: true,
      icon: Eye,
      tint: "bg-blue-50 text-blue-600",
    },
    {
      label: "Unique Visitors",
      value: String(insights.traffic.estimatedUniqueVisitors),
      change: "Estimated by session",
      positive: true,
      icon: Users,
      tint: "bg-purple-50 text-purple-600",
    },
    {
      label: "Pending Queries",
      value: String(pendingCount),
      change: `${reviewedCount} reviewed`,
      positive: pendingCount === 0,
      icon: MessageSquare,
      tint: "bg-amber-50 text-amber-600",
    },
    {
      label: "Active Appointments",
      value: String(insights.appointments.total),
      change: `${insights.appointments.byStatus["CONFIRMED"] || 0} confirmed`,
      positive: true,
      icon: CalendarCheck,
      tint: "bg-emerald-50 text-emerald-600",
    },
  ]

  const [isSavingSchedule, setIsSavingSchedule] = useState(false)
  const [scheduleSuccessMsg, setScheduleSuccessMsg] = useState<string | null>(null)
  const [scheduleErrorMsg, setScheduleErrorMsg] = useState<string | null>(null)

  // Fetch real configured slots for selected date
  const loadSlotsForDate = async (dateStr: string) => {
    if (!dateStr) return
    try {
      const res = await fetch(apiUrl("/availability/slots?doctorId=" + encodeURIComponent(doctorInfo.id) + "&date=" + encodeURIComponent(dateStr)))
      if (res.ok) {
        const json = await res.json()
        const data = json.data
        if (data && data.slots) {
          setSlots(
            data.slots.map((s: any, idx: number) => ({
              id: `slot-${idx}`,
              date: dateStr,
              time: s.time,
            }))
          )
        }
      }
    } catch (err) {
      console.error("Failed to load slots for date", err)
    }
  }

  useEffect(() => {
    if (newDate) {
      loadSlotsForDate(newDate)
    }
  }, [newDate])

  const saveFullSchedule = async () => {
    if (!newDate) {
      setScheduleErrorMsg("Please select a schedule date.")
      return
    }

    setIsSavingSchedule(true)
    setScheduleSuccessMsg(null)
    setScheduleErrorMsg(null)

    try {
      const startTime = (document.getElementById("sched-start-time") as HTMLInputElement)?.value || "09:00"
      const endTime = (document.getElementById("sched-end-time") as HTMLInputElement)?.value || "17:00"
      const duration = parseInt((document.getElementById("sched-duration") as HTMLSelectElement)?.value || "30")
      const buffer = parseInt((document.getElementById("sched-buffer") as HTMLSelectElement)?.value || "10")
      const feeInPerson = parseInt((document.getElementById("sched-fee-inperson") as HTMLInputElement)?.value || "1000") * 100
      const feeVideo = parseInt((document.getElementById("sched-fee-video") as HTMLInputElement)?.value || "800") * 100
      const isPublished = (document.getElementById("sched-published") as HTMLInputElement)?.checked ?? true

      const token = await getIdToken()

      const res = await fetch(apiUrl("/availability/schedule"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctorId: doctorInfo.id,
          date: newDate,
          startTime,
          endTime,
          slotDurationMinutes: duration,
          bufferMinutes: buffer,
          consultationTypes: [
            { type: "IN_PERSON", feeInPaise: feeInPerson, durationMinutes: duration },
            { type: "VIDEO", feeInPaise: feeVideo, durationMinutes: duration },
            { type: "FOLLOW_UP", feeInPaise: Math.round(feeInPerson * 0.6), durationMinutes: Math.max(15, duration - 10) },
          ],
          isPublished,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        const count = json.data?.totalSlots || 0
        setScheduleSuccessMsg(`Successfully generated ${count} slots for ${newDate}. Published immediately to patient booking!`)
        await loadSlotsForDate(newDate)
      } else {
        const errJson = await res.json()
        setScheduleErrorMsg(errJson.error || "Failed to create schedule")
      }
    } catch (err: any) {
      setScheduleErrorMsg(err?.message || "Network error while saving schedule")
    } finally {
      setIsSavingSchedule(false)
    }
  }

  const markReviewed = async (id: string) => {
    try {
      await updateDoc(doc(db, "enquiries", id), { status: "reviewed" })
    } catch (err) {
      console.error("Failed to mark enquiry as reviewed", err)
    }
  }

  const addSlot = () => {
    saveFullSchedule()
  }

  const removeSlot = (id: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div
      className={`min-h-screen bg-soft-sky/30 flex transition-opacity duration-500 ease-out ${
        mounted ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* ---------- Sidebar ---------- */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 bg-deep-trust min-h-screen sticky top-0">
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-medical-blue to-emerald-400 flex items-center justify-center shadow-md flex-shrink-0">
            <Stethoscope className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-heading font-bold text-white text-sm leading-tight truncate">
              Dr. Vijay Clinic
            </p>
            <p className="text-white/50 text-xs leading-tight truncate">
              Admin Portal
            </p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === key
                  ? "bg-medical-blue text-white shadow-md"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ---------- Main column ---------- */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
          <div className="flex items-center justify-between gap-4 px-6 h-20">
            <div className="hidden md:flex items-center gap-2 flex-1 max-w-md bg-soft-sky/40 rounded-xl px-4 py-2.5">
              <Search className="w-4 h-4 text-text-secondary flex-shrink-0" />
              <input
                type="text"
                placeholder="Search patients, queries, appointments…"
                className="bg-transparent text-sm outline-none flex-1 text-text-primary placeholder:text-text-secondary"
              />
            </div>

            <div className="flex items-center gap-4 ml-auto">
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setNotifOpen((prev) => !prev)}
                  className="relative p-2.5 rounded-xl hover:bg-soft-sky transition-colors cursor-pointer"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5 text-deep-trust" />
                  {insights.recentActivity.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center text-[10px] font-bold text-white bg-medical-blue rounded-full">
                      {insights.recentActivity.length}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-40">
                    <div className="px-4 py-3 border-b border-gray-100 font-heading font-semibold text-deep-trust text-sm flex items-center justify-between">
                      <span>Recent Activity</span>
                      <span className="text-[11px] font-normal text-text-secondary">Persisted Events</span>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {insights.recentActivity.map((n) => (
                        <div
                          key={n.id}
                          className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-soft-sky/40 transition-colors"
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            n.type === "APPOINTMENT" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                          }`}>
                            {n.type === "APPOINTMENT" ? <CalendarCheck className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-text-primary leading-tight">{n.message}</p>
                            <p className="text-xs text-text-secondary mt-1">{n.timeAgo}</p>
                          </div>
                        </div>
                      ))}
                      {insights.recentActivity.length === 0 && (
                        <div className="py-8 text-center text-xs text-text-secondary">
                          No recent activity recorded yet.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Admin profile */}
              <div className="relative">
                <button
                  onClick={() => setProfileOpen((prev) => !prev)}
                  className="flex items-center gap-3 pl-4 border-l border-gray-100 cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-medical-blue to-deep-trust flex items-center justify-center shadow-md flex-shrink-0">
                    <span className="text-white font-heading font-bold text-sm">A</span>
                  </div>
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="font-heading font-semibold text-deep-trust text-sm leading-tight">
                      Admin
                    </span>
                    <span className="text-text-secondary text-xs leading-tight">
                      Clinic Administrator
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-text-secondary hidden sm:block" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="p-6 space-y-6">
          {/* --- Overview / Dashboard Tab --- */}
          {activeTab === "overview" && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="font-heading font-bold text-2xl text-deep-trust">
                    Admin Dashboard
                  </h1>
                  <p className="text-text-secondary text-sm mt-1">
                    Live analytics and authoritative clinic activity (Tracking active since {new Date(insights.trackingStartedAt).toLocaleDateString()})
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-secondary">
                    Updated: {new Date(insights.lastUpdated).toLocaleTimeString()}
                  </span>
                  <button
                    onClick={() => fetchInsights(true)}
                    disabled={isRefreshing}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-soft-sky/40 text-deep-trust text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-medical-blue" : ""}`} />
                    Refresh
                  </button>
                </div>
              </div>

              {insightsError && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span>{insightsError}</span>
                  </div>
                  <button
                    onClick={() => fetchInsights(true)}
                    className="underline text-red-700 hover:text-red-900 font-semibold cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Stat cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {visitorStats.map(({ label, value, change, positive, icon: Icon, tint }) => (
                  <div
                    key={label}
                    className="bg-white rounded-2xl shadow-md border border-gray-100 p-5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tint}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-text-secondary text-sm">{label}</p>
                    <p className="font-heading font-bold text-2xl text-deep-trust mt-1">
                      {value}
                    </p>
                    <p
                      className={`flex items-center gap-1 text-xs mt-2 ${
                        positive ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      <ArrowUpRight className="w-3 h-3" />
                      {change}
                    </p>
                  </div>
                ))}
              </div>

              {/* Booking Funnel Row */}
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading font-bold text-base text-deep-trust">
                    Patient Booking Funnel (First-Party Conversion)
                  </h2>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-soft-sky text-medical-blue">
                    Conversion Rate: {insights.funnel.conversionRate}%
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3.5 rounded-xl bg-soft-sky/30 border border-medical-blue/10">
                    <p className="text-xs text-text-secondary">Booking Starts</p>
                    <p className="font-heading font-bold text-xl text-deep-trust mt-1">
                      {insights.funnel.bookingStarts}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-soft-sky/30 border border-medical-blue/10">
                    <p className="text-xs text-text-secondary">Consultation Selected</p>
                    <p className="font-heading font-bold text-xl text-deep-trust mt-1">
                      {insights.funnel.consultationSelections}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100">
                    <p className="text-xs text-emerald-800">Booking Submissions</p>
                    <p className="font-heading font-bold text-xl text-emerald-700 mt-1">
                      {insights.funnel.bookingSubmissions}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-100">
                    <p className="text-xs text-purple-800">Appointment Visits</p>
                    <p className="font-heading font-bold text-xl text-purple-700 mt-1">
                      {insights.traffic.appointmentPageVisits}
                    </p>
                  </div>
                </div>
              </div>

              {/* Charts row */}
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-heading font-bold text-lg text-deep-trust">
                      Website Visits — Last 7 Days
                    </h2>
                    <span className="text-xs text-text-secondary">Deduplicated Page Views</span>
                  </div>
                  <div className="h-64">
                    {insights.traffic.weeklyVisits.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={insights.traffic.weeklyVisits}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#64748b" }} />
                          <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
                          <Tooltip
                            contentStyle={{
                              borderRadius: "0.75rem",
                              border: "1px solid #e2e8f0",
                              fontSize: "0.75rem",
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="visits"
                            stroke="#2563eb"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: "#2563eb" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-text-secondary">
                        No traffic events recorded in this period yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 flex flex-col">
                  <h2 className="font-heading font-bold text-lg text-deep-trust mb-4">
                    Query Status
                  </h2>
                  <div className="flex-1 flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={queryBreakdown}
                          dataKey="value"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={4}
                        >
                          {queryBreakdown.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center">
                      <span className="font-heading font-bold text-2xl text-deep-trust">
                        {queries.length}
                      </span>
                      <span className="text-xs text-text-secondary">Total</span>
                    </div>
                  </div>
                  <div className="space-y-2 mt-2">
                    {queryBreakdown.map((entry) => (
                      <div key={entry.name} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-text-secondary">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          {entry.name}
                        </span>
                        <span className="font-medium text-deep-trust">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Table + side panels row */}
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-heading font-bold text-lg text-deep-trust">
                      Active Appointments
                    </h2>
                    <button
                      onClick={() => setActiveTab("active")}
                      className="text-medical-blue text-sm font-medium hover:underline cursor-pointer"
                    >
                      View All →
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-text-secondary border-b border-gray-100">
                          <th className="pb-3 font-medium">Patient</th>
                          <th className="pb-3 font-medium">Doctor</th>
                          <th className="pb-3 font-medium">Date &amp; Time</th>
                          <th className="pb-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insights.appointments.activeList.map((appt) => (
                          <tr key={appt.id} className="border-b border-gray-50 last:border-0">
                            <td className="py-3 font-medium text-deep-trust">
                              {appt.patientName}
                            </td>
                            <td className="py-3 text-text-secondary">{appt.doctor}</td>
                            <td className="py-3 text-text-secondary">
                              {appt.date}, {appt.time}
                            </td>
                            <td className="py-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                appt.status === "CONFIRMED"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}>
                                {appt.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {insights.appointments.activeList.length === 0 && (
                      <div className="py-8 text-center text-xs text-text-secondary">
                        No appointments booked yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                  <h2 className="font-heading font-bold text-lg text-deep-trust mb-4">
                    Quick Actions
                  </h2>
                  <div className="space-y-2">
                    {[
                      { label: "Add Appointment Slot", tab: "slots" as TabKey, icon: CalendarPlus },
                      { label: "Review Queries", tab: "queries" as TabKey, icon: MessageSquare },
                      { label: "View Appointments", tab: "active" as TabKey, icon: CalendarCheck },
                    ].map(({ label, tab, icon: Icon }) => (
                      <button
                        key={label}
                        onClick={() => setActiveTab(tab)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 hover:bg-soft-sky/40 transition-colors cursor-pointer group"
                      >
                        <span className="flex items-center gap-3 text-sm font-medium text-deep-trust">
                          <Icon className="w-4 h-4 text-medical-blue" />
                          {label}
                        </span>
                        <ArrowUpRight className="w-4 h-4 text-text-secondary group-hover:text-medical-blue transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* --- Query Platform Tab --- */}
          {activeTab === "queries" && (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
              <h2 className="font-heading font-bold text-lg text-deep-trust mb-4">
                Patient Queries
              </h2>
              <div className="space-y-3">
                {queries.map((q) => (
                  <div
                    key={q.id}
                    className="p-4 rounded-xl border border-gray-100 hover:bg-soft-sky/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-deep-trust text-sm">{q.name}</p>
                        <p className="text-text-secondary text-xs flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3" />
                          {q.email}
                        </p>
                        {q.phone && (
                          <p className="text-text-secondary text-xs mt-0.5">{q.phone}</p>
                        )}
                        <p className="text-text-primary text-sm mt-2">{q.message}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className="text-xs text-text-secondary whitespace-nowrap">
                          {q.submittedAt}
                        </span>
                        <span
                          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                            q.status === "pending"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {q.status === "pending" ? (
                            <Clock className="w-3 h-3" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          {q.status === "pending" ? "Pending" : "Reviewed"}
                        </span>
                      </div>
                    </div>
                    {q.status === "pending" && (
                      <button
                        onClick={() => markReviewed(q.id)}
                        className="mt-3 flex items-center gap-1 px-4 py-1.5 text-xs font-medium text-medical-blue border border-medical-blue/20 rounded-lg hover:bg-soft-sky transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark as Reviewed
                      </button>
                    )}
                  </div>
                ))}
                {queries.length === 0 && (
                  <p className="text-text-secondary text-sm">
                    No queries submitted yet.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* --- Slot & Schedule Management Tab --- */}
          {activeTab === "slots" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                  <div>
                    <h2 className="font-heading font-bold text-lg text-deep-trust">
                      Doctor Consultation Schedule Configuration
                    </h2>
                    <p className="text-text-secondary text-sm mt-0.5">
                      Configure clinic working hours, slot durations, buffer intervals, consultation fees, and publish settings.
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full w-fit">
                    Asia/Kolkata (IST)
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                  <div>
                    <label className="text-xs font-semibold text-deep-trust block mb-1.5">Schedule Date</label>
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-medical-blue/30"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-deep-trust block mb-1.5">Start Time</label>
                    <input
                      type="time"
                      defaultValue="09:00"
                      id="sched-start-time"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-medical-blue/30"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-deep-trust block mb-1.5">End Time</label>
                    <input
                      type="time"
                      defaultValue="17:00"
                      id="sched-end-time"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-medical-blue/30"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-deep-trust block mb-1.5">Slot Duration</label>
                    <select
                      id="sched-duration"
                      defaultValue="30"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-medical-blue/30"
                    >
                      <option value="15">15 Minutes</option>
                      <option value="20">20 Minutes</option>
                      <option value="30">30 Minutes</option>
                      <option value="45">45 Minutes</option>
                      <option value="60">60 Minutes</option>
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-4 mb-6 p-4 rounded-xl bg-soft-sky/20 border border-medical-blue/10">
                  <div>
                    <label className="text-xs font-medium text-deep-trust block mb-1">Buffer Interval Between Appointments</label>
                    <select
                      id="sched-buffer"
                      defaultValue="10"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                    >
                      <option value="0">0 Minutes (No buffer)</option>
                      <option value="5">5 Minutes</option>
                      <option value="10">10 Minutes</option>
                      <option value="15">15 Minutes</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-deep-trust block mb-1">In-Person Consultation Fee (₹)</label>
                    <input
                      type="number"
                      id="sched-fee-inperson"
                      defaultValue="1000"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-deep-trust block mb-1">Video Consultation Fee (₹)</label>
                    <input
                      type="number"
                      id="sched-fee-video"
                      defaultValue="800"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="sched-published"
                      defaultChecked
                      className="w-4 h-4 rounded text-medical-blue"
                    />
                    <label htmlFor="sched-published" className="text-xs font-medium text-text-primary cursor-pointer">
                      Publish to patient booking immediately
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={addSlot}
                      disabled={isSavingSchedule}
                      className="flex items-center gap-2 px-5 py-2.5 bg-medical-blue hover:bg-medical-blue-hover text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer disabled:opacity-60"
                    >
                      {isSavingSchedule ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Save &amp; Generate Schedule
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {scheduleSuccessMsg && (
                  <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    {scheduleSuccessMsg}
                  </div>
                )}

                {scheduleErrorMsg && (
                  <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4 text-red-600 flex-shrink-0" />
                    {scheduleErrorMsg}
                  </div>
                )}
              </div>

              {/* Existing Configured Slots & Blocking */}
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading font-bold text-base text-deep-trust">
                    Generated Time Slots &amp; Controls
                  </h3>
                  <span className="text-xs text-text-secondary">
                    {slots.length} configured slots
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {slots.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-gray-100 bg-soft-sky/10 hover:border-medical-blue/30 transition-all"
                    >
                      <div>
                        <p className="text-sm font-medium text-deep-trust">{slot.date}</p>
                        <p className="text-xs text-text-secondary mt-0.5">{slot.time}</p>
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 mt-1">
                          Available
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => removeSlot(slot.id)}
                          className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors cursor-pointer"
                          title="Block / Remove slot"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {slots.length === 0 && (
                    <p className="text-text-secondary text-sm col-span-full py-4 text-center">
                      No slots generated for this date.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* --- Active Appointments Tab --- */}
          {activeTab === "active" && (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
              <h2 className="font-heading font-bold text-lg text-deep-trust mb-4">
                Active Booked Appointments
              </h2>
              <div className="space-y-3">
                {insights.appointments.activeList.map((appt) => (
                  <div
                    key={appt.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-gray-100 hover:bg-soft-sky/30 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-deep-trust text-sm">
                        {appt.patientName}
                      </p>
                      <p className="text-text-secondary text-xs">with {appt.doctor} • {appt.serviceName || "Consultation"}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-deep-trust">{appt.date}</p>
                        <p className="text-xs text-text-secondary">{appt.time}</p>
                      </div>
                      <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                        appt.status === "CONFIRMED"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}>
                        <CalendarCheck className="w-3 h-3" />
                        {appt.status}
                      </span>
                    </div>
                  </div>
                ))}
                {insights.appointments.activeList.length === 0 && (
                  <div className="py-12 text-center text-sm text-text-secondary">
                    No active appointments recorded in the system.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["ADMIN"]} dashboardName="Admin Dashboard">
      <AdminDashboardContent />
    </ProtectedRoute>
  )
}