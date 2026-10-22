import { z } from "zod"

export const appointmentSchema = z.object({
  patientName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  email: z
    .string()
    .email("Please enter a valid email address"),
  phone: z
    .string()
    .min(10, "Please enter a valid phone number")
    .max(15, "Phone number is too long"),
  serviceId: z
    .string()
    .min(1, "Please select a service"),
  date: z
    .string()
    .min(1, "Please select a date"),
  time: z
    .string()
    .min(1, "Please select a time slot"),
  message: z
    .string()
    .max(500, "Message must be less than 500 characters")
    .optional(),
})

export type AppointmentFormData = z.infer<typeof appointmentSchema>

export const contactSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  email: z
    .string()
    .email("Please enter a valid email address"),
  phone: z
    .string()
    .min(10, "Please enter a valid phone number")
    .optional(),
  subject: z
    .string()
    .min(2, "Subject is required")
    .max(200, "Subject must be less than 200 characters"),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(1000, "Message must be less than 1000 characters"),
})

export type ContactFormData = z.infer<typeof contactSchema>
