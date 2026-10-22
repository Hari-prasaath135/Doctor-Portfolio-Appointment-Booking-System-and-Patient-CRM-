import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, subject, message } = body

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // In production, save to database and send email notification
    // For now, just log and return success
    console.log("Contact form submission:", { name, email, phone, subject, message })

    // TODO: Save to database via Prisma
    // TODO: Send notification email via Resend

    return NextResponse.json(
      {
        success: true,
        message: "Your message has been received. We will get back to you shortly.",
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
