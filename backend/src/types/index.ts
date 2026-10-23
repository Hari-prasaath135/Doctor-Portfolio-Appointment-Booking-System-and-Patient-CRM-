import { Request } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';

// ─── User & Auth ─────────────────────────────────────────────────────────────

export type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken & { role?: UserRole; doctorId?: string };
}

// ─── Doctor ──────────────────────────────────────────────────────────────────

export interface Doctor {
  id: string;
  uid: string;
  name: string;
  specialization: string;
  bio: string;
  email: string;
  phone: string;
  qualifications: string[];
  isActive: boolean;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

// ─── Patient ─────────────────────────────────────────────────────────────────

export interface Patient {
  id: string;
  uid: string;
  name: string;
  email: string;
  phone: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: string;
  address?: string;
  bloodGroup?: string;
  allergies?: string[];
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

// ─── Availability & Schedule Management ──────────────────────────────────────

export type ConsultationType = 'IN_PERSON' | 'VIDEO' | 'FOLLOW_UP';

export interface ConsultationTypeConfig {
  type: ConsultationType;
  feeInPaise: number; // e.g. 100000 = ₹1,000.00
  durationMinutes: number;
}

export type SlotStatus = 'AVAILABLE' | 'RESERVED' | 'BOOKED' | 'BLOCKED';

export interface TimeSlot {
  time: string;   // e.g. "09:00"
  endTime?: string; // e.g. "09:30"
  isBooked: boolean; // backward-compatibility flag (true if BOOKED)
  status?: SlotStatus; // AVAILABLE | RESERVED | BOOKED | BLOCKED
  reservedUntil?: string | null; // ISO timestamp for pending-payment expiration
  reservedBy?: string | null;
  appointmentId?: string | null;
}

export interface Availability {
  id: string;
  doctorId: string;
  date: string;        // ISO date "YYYY-MM-DD"
  isPublished: boolean;
  isLeave?: boolean;
  leaveReason?: string;
  slotDurationMinutes?: number;
  bufferMinutes?: number;
  consultationTypes?: ConsultationTypeConfig[];
  slots: TimeSlot[];
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface CreateScheduleInput {
  doctorId: string;
  date: string;
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
  slotDurationMinutes: number; // e.g. 30
  bufferMinutes?: number;      // e.g. 10
  consultationTypes: ConsultationTypeConfig[];
  isPublished?: boolean;
}

export interface BlockSlotInput {
  doctorId: string;
  date: string;
  time: string;
  reason?: string;
}

export interface MarkLeaveInput {
  doctorId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

// ─── Appointment ─────────────────────────────────────────────────────────────

export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RESCHEDULED';

export interface MedicalAttachmentMetadata {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  storagePath?: string;
  uploadedAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  serviceId: string;
  serviceName: string;
  consultationType?: ConsultationType;
  feeInPaise?: number;
  patientName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  age?: number;
  date: string;          // ISO date "YYYY-MM-DD"
  time: string;          // "HH:mm"
  status: AppointmentStatus;
  message?: string;
  medicalHistory?: string;
  attachments?: MedicalAttachmentMetadata[];
  attachmentUrls?: string[];
  paymentId?: string;
  meetingId?: string;
  cancelledAt?: FirebaseFirestore.Timestamp;
  cancelReason?: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface CreateAppointmentInput {
  patientId: string;
  doctorId: string;
  serviceId?: string;
  serviceName?: string;
  consultationType: ConsultationType;
  feeInPaise?: number;
  patientName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  age?: number;
  date: string;
  time: string;
  message?: string;
  medicalHistory?: string;
  attachments?: MedicalAttachmentMetadata[];
  attachmentUrls?: string[];
}

export interface RescheduleAppointmentInput {
  newDate: string;
  newTime: string;
  reason?: string;
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'PAID'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'RECONCILIATION_REQUIRED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type PaymentProvider = 'RAZORPAY' | 'PINELABS';

export interface Payment {
  id: string;
  appointmentId: string;
  patientId: string;
  amount: number;          // amount in paise (INR)
  currency: string;        // 'INR'
  status: PaymentStatus;
  provider: PaymentProvider;
  orderId?: string;        // Razorpay order ID (e.g. order_xxx)
  paymentId?: string;      // Razorpay payment ID (e.g. pay_xxx)
  transactionId?: string;  // provider transaction ID
  signature?: string;      // payment signature
  paymentMethod?: string;
  webhookReceived?: boolean;
  environment?: 'test' | 'live';
  idempotencyKey?: string;
  errorMetadata?: Record<string, unknown>;
  capturedAt?: FirebaseFirestore.Timestamp;
  paidAt?: FirebaseFirestore.Timestamp;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

// ─── Refund ───────────────────────────────────────────────────────────────────

export type RefundStatus = 'PENDING' | 'PROCESSED' | 'FAILED' | 'INELIGIBLE';

export interface Refund {
  id: string;
  paymentId: string;
  appointmentId: string;
  patientId: string;
  amount: number;         // refund amount in paise
  refundPercentage: number;
  status: RefundStatus;
  reason: string;
  providerRefundId?: string;
  processedAt?: FirebaseFirestore.Timestamp;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

// ─── Meeting / Video ─────────────────────────────────────────────────────────

export type MeetingProvider = 'ZOOM';

export interface MeetingDetails {
  id: string;
  appointmentId: string;
  provider: MeetingProvider;
  meetingId: string;         // Zoom meeting ID
  meetingUrl: string;        // Join URL for patient/doctor
  hostUrl?: string;          // Host-only start URL
  password?: string;
  startTime: string;         // ISO 8601
  duration: number;          // minutes
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

// ─── Consultation ─────────────────────────────────────────────────────────────

export type ConsultationStatus = 'IN_PROGRESS' | 'COMPLETED';

export interface Consultation {
  id: string;
  appointmentId: string;
  doctorId: string;
  patientId: string;
  status: ConsultationStatus;
  symptoms: string[];
  diagnosis: string;
  notes: string;
  recommendations: string[];
  followUpDate?: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

// ─── Prescription ─────────────────────────────────────────────────────────────

export interface Medicine {
  name: string;
  dosage: string;
  frequency: string;  // e.g. "Twice daily"
  duration: string;   // e.g. "5 days"
  instructions?: string;
}

export interface Prescription {
  id: string;
  consultationId: string;
  appointmentId: string;
  doctorId: string;
  patientId: string;
  medicines: Medicine[];
  notes?: string;
  validUntil?: string;   // ISO date
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

// ─── Medical History ─────────────────────────────────────────────────────────

export interface MedicalRecord {
  id: string;
  patientId: string;
  type: 'CONDITION' | 'SURGERY' | 'ALLERGY' | 'MEDICATION' | 'LAB_RESULT' | 'OTHER';
  title: string;
  description: string;
  date: string;           // ISO date
  doctorId?: string;
  attachmentUrls?: string[];
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

// ─── Patient Query ─────────────────────────────────────────────────────────────

export type QueryStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED';

export interface PatientQuery {
  id: string;
  patientId: string;
  subject: string;
  message: string;
  status: QueryStatus;
  assignedDoctorId?: string;
  response?: string;
  resolvedAt?: FirebaseFirestore.Timestamp;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

// ─── Notification ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'APPOINTMENT_BOOKED'
  | 'APPOINTMENT_CONFIRMED'
  | 'APPOINTMENT_CANCELLED'
  | 'APPOINTMENT_REMINDER'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'REFUND_INITIATED'
  | 'REFUND_PROCESSED'
  | 'CONSULTATION_COMPLETED'
  | 'PRESCRIPTION_CREATED'
  | 'QUERY_RESPONSE'
  | 'GENERAL';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: FirebaseFirestore.Timestamp;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ─── Pinelabs ─────────────────────────────────────────────────────────────────

export interface PinelabsOrderRequest {
  merchant_id: string;
  merchant_access_code: string;
  unique_merchant_transaction_id: string;
  amount_in_paisa: number;
  currency_code: string;        // "356" for INR
  payment_mode: number;         // 1 = all, 3 = card, 4 = netbanking, 10 = UPI
  billing_name: string;
  billing_email: string;
  billing_mobile_number: string;
  callback_url: string;
  txn_completion_datetime: string;
  is_surecharge_enabled?: string;
}

export interface PinelabsOrderResponse {
  token: string;
  redirect_url: string;
  response_code: number;
  response_message: string;
}

// ─── Zoom ─────────────────────────────────────────────────────────────────────

export interface ZoomMeetingRequest {
  topic: string;
  type: 2;           // 2 = scheduled meeting
  start_time: string; // ISO 8601 in UTC
  duration: number;   // minutes
  timezone: string;   // e.g. "Asia/Kolkata"
  agenda?: string;
  settings?: {
    host_video: boolean;
    participant_video: boolean;
    join_before_host: boolean;
    mute_upon_entry: boolean;
    waiting_room: boolean;
  };
}

export interface ZoomMeetingResponse {
  id: number;
  join_url: string;
  start_url: string;
  password: string;
  start_time: string;
  duration: number;
}

// ─── Analytics & Dashboard Insights ──────────────────────────────────────────

export type AnalyticsEventType =
  | 'page_view'
  | 'appointment_page_view'
  | 'booking_started'
  | 'consultation_selected'
  | 'date_selected'
  | 'slot_selected'
  | 'booking_submitted'
  | 'booking_failed'
  | 'contact_form_submitted';

export interface AnalyticsEvent {
  id: string;
  eventType: AnalyticsEventType;
  path: string;
  sessionId: string;
  consultationType?: string;
  outcome?: 'success' | 'failure';
  timestamp: FirebaseFirestore.Timestamp;
}

export interface DashboardInsights {
  traffic: {
    totalPageViews: number;
    estimatedUniqueVisitors: number;
    appointmentPageVisits: number;
    contactPageVisits: number;
    weeklyVisits: { day: string; visits: number }[];
    popularPages: { path: string; views: number }[];
  };
  funnel: {
    bookingStarts: number;
    consultationSelections: number;
    bookingSubmissions: number;
    conversionRate: number; // percentage (submissions / starts)
  };
  appointments: {
    total: number;
    byStatus: Record<AppointmentStatus, number>;
    activeList: {
      id: string;
      patientName: string;
      date: string;
      time: string;
      doctor: string;
      status: string;
      serviceName: string;
      amount: number;
    }[];
  };
  inquiries: {
    total: number;
    pending: number;
    reviewed: number;
  };
  recentActivity: {
    id: string;
    type: string;
    message: string;
    timeAgo: string;
    timestamp: string;
  }[];
  trackingStartedAt: string;
  lastUpdated: string;
}

// ─── Admin Stats ──────────────────────────────────────────────────────────────

export interface AdminStats {
  totalPatients: number;
  totalDoctors: number;
  totalAppointments: number;
  appointmentsByStatus: Record<AppointmentStatus, number>;
  totalRevenue: number;         // in paise
  totalRefunds: number;         // in paise
  recentAppointments: Appointment[];
}

// ─── Doctor Dashboard ─────────────────────────────────────────────────────────

export interface DoctorDashboardAppointment {
  id: string;
  patientId: string;
  patientName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  age?: number;
  date: string;
  time: string;
  status: AppointmentStatus;
  serviceName: string;
  consultationType?: ConsultationType;
  message?: string;
  medicalHistory?: string;
  attachments?: MedicalAttachmentMetadata[];
  consultationId?: string;
  consultationNotes?: string;
}

export interface DoctorSlotItem {
  id: string;
  startTime: string;
  endTime: string;
  date: string;
  isBooked: boolean;
  status: 'available' | 'booked';
}

export interface DoctorDashboardData {
  doctor: {
    id: string;
    name: string;
    specialization: string;
    email: string;
  };
  metrics: {
    todayCount: number;
    upcomingCount: number;
    completedCount: number;
    pendingCount: number;
    cancelledCount: number;
    totalAppointments: number;
    availableSlotsToday: number;
    totalSlotsToday: number;
    slotUtilizationRate: number; // percentage
  };
  todayAppointments: DoctorDashboardAppointment[];
  upcomingAppointments: DoctorDashboardAppointment[];
  pastAppointments: DoctorDashboardAppointment[];
  slotsByDay: Record<string, DoctorSlotItem[]>;
  availableDays: string[];
  recentActivity: {
    id: string;
    type: string;
    message: string;
    timeAgo: string;
    timestamp: string;
  }[];
  lastUpdated: string;
}

