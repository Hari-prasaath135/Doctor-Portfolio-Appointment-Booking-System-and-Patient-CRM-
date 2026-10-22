"use client"

const API_BASE_URL = "http://localhost:5000/api/v1"

// Generate or retrieve an anonymous session identifier (persisted per browser session)
function getAnonymousSessionId(): string {
  if (typeof window === "undefined") return "server_session"
  try {
    let sid = sessionStorage.getItem("clinic_anon_sid")
    if (!sid) {
      sid = "sid_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
      sessionStorage.setItem("clinic_anon_sid", sid)
    }
    return sid
  } catch {
    return "anon_session"
  }
}

// Track an analytics event
export async function trackEvent(input: {
  eventType:
    | "page_view"
    | "appointment_page_view"
    | "booking_started"
    | "consultation_selected"
    | "date_selected"
    | "slot_selected"
    | "booking_submitted"
    | "booking_failed"
    | "contact_form_submitted"
  path?: string
  consultationType?: string
  outcome?: "success" | "failure"
  eventId?: string
}): Promise<void> {
  if (typeof window === "undefined") return

  try {
    const path = input.path || window.location.pathname
    const sessionId = getAnonymousSessionId()

    await fetch(`${API_BASE_URL}/analytics/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventType: input.eventType,
        path,
        sessionId,
        consultationType: input.consultationType,
        outcome: input.outcome,
        eventId: input.eventId,
      }),
    })
  } catch {
    // Non-blocking fire-and-forget
  }
}
