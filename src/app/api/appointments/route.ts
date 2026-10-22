import { NextRequest, NextResponse } from "next/server"

// In-memory store for demo (replace with Prisma in production)
const appointments: Array<{
  id: string
  patientName: string
  email: string
  phone: string
  gender: string
  dateOfBirth: string
  serviceId: string
  serviceName: string
  date: string
  time: string
  message: string
  attachmentCount: number
  status: string
  createdAt: string
}> = []

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      patientName,
      email,
      phone,
      gender,
      dateOfBirth,
      serviceId,
      serviceName,
      date,
      time,
      message,
      attachmentCount,
    } = body

    // Validate required fields
    if (!patientName || !email || !phone) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Check for double booking (only if date and time are provided)
    if (date && time) {
      const existingAppointment = appointments.find(
        (apt) => apt.date === date && apt.time === time && apt.status !== "cancelled"
      )

      if (existingAppointment) {
        return NextResponse.json(
          { error: "This time slot is already booked. Please choose another time." },
          { status: 409 }
        )
      }
    }

    // Create appointment
    const appointment = {
      id: `apt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      patientName,
      email,
      phone,
      gender: gender || "",
      dateOfBirth: dateOfBirth || "",
      serviceId: serviceId || "",
      serviceName: serviceName || "",
      date: date || "",
      time: time || "",
      message: message || "",
      attachmentCount: attachmentCount || 0,
      status: "pending",
      createdAt: new Date().toISOString(),
    }

    appointments.push(appointment)

    // TODO: Send email notification via Resend
    // await sendConfirmationEmail(appointment)
    // await sendClinicNotification(appointment)

    return NextResponse.json(
      {
        success: true,
        appointment: {
          id: appointment.id,
          date: appointment.date,
          time: appointment.time,
          service: appointment.serviceName,
          status: appointment.status,
        },
      },
      { status: 201 }
    )
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ appointments: appointments.length })
}

