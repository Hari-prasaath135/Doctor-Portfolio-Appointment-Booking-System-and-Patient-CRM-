import { NextRequest, NextResponse } from "next/server"

// Simulated booked slots (in production, query from database)
const bookedSlots: Record<string, string[]> = {}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")

    if (!date) {
      return NextResponse.json(
        { error: "Date parameter is required" },
        { status: 400 }
      )
    }

    // Return booked slots for the given date
    const slots = bookedSlots[date] || []

    return NextResponse.json({
      date,
      bookedSlots: slots,
    })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
