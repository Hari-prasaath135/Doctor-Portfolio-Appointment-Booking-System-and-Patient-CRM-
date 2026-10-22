import { db, collections, auth, admin } from '../config/firebase';
import { AdminStats, AppointmentStatus, UserProfile, UserRole } from '../types';
import { NotFoundError } from '../utils/errors';

export class AdminService {
  /**
   * Get high-level platform statistics.
   */
  async getDashboardStats(): Promise<AdminStats> {
    const [patientsSnap, doctorsSnap, appointmentsSnap] = await Promise.all([
      db.collection(collections.patients).count().get(),
      db.collection(collections.doctors).where('isActive', '==', true).count().get(),
      db.collection(collections.appointments).get(),
    ]);

    const totalPatients = patientsSnap.data().count;
    const totalDoctors = doctorsSnap.data().count;

    const appointmentsByStatus: Record<AppointmentStatus, number> = {
      PENDING: 0,
      CONFIRMED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      RESCHEDULED: 0,
    };

    let totalRevenue = 0;
    let totalRefunds = 0;
    const recentAppointments = appointmentsSnap.docs.slice(0, 5).map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    for (const doc of appointmentsSnap.docs) {
      const status = doc.data().status as AppointmentStatus;
      if (appointmentsByStatus[status] !== undefined) {
        appointmentsByStatus[status]++;
      }
    }

    // Revenue from payments
    const paymentsSnap = await db
      .collection(collections.payments)
      .where('status', '==', 'PAID')
      .get();
    paymentsSnap.docs.forEach((d) => {
      totalRevenue += d.data().amount || 0;
    });

    // Refunds
    const refundsSnap = await db
      .collection(collections.refunds)
      .where('status', '==', 'PROCESSED')
      .get();
    refundsSnap.docs.forEach((d) => {
      totalRefunds += d.data().amount || 0;
    });

    return {
      totalPatients,
      totalDoctors,
      totalAppointments: appointmentsSnap.size,
      appointmentsByStatus,
      totalRevenue,
      totalRefunds,
      recentAppointments: recentAppointments as never,
    };
  }

  /**
   * List all platform users (paginated).
   */
  async listAllUsers(page = 1, limit = 20): Promise<UserProfile[]> {
    const offset = (page - 1) * limit;
    const snap = await db
      .collection(collections.users)
      .orderBy('createdAt', 'desc')
      .offset(offset)
      .limit(limit)
      .get();

    return snap.docs.map((d) => ({ uid: d.id, ...d.data() })) as unknown as UserProfile[];
  }

  /**
   * Assign a role to any user (admin action).
   */
  async assignRole(uid: string, role: UserRole): Promise<void> {
    const userRef = db.collection(collections.users).doc(uid);
    if (!(await userRef.get()).exists) throw new NotFoundError('User');

    await Promise.all([
      auth.setCustomUserClaims(uid, { role }),
      userRef.update({ role, updatedAt: admin.firestore.FieldValue.serverTimestamp() }),
    ]);
  }

  /**
   * Get a specific user's full profile.
   */
  async getUserById(uid: string): Promise<UserProfile> {
    const snap = await db.collection(collections.users).doc(uid).get();
    if (!snap.exists) throw new NotFoundError('User');
    return { uid: snap.id, ...snap.data() } as unknown as UserProfile;
  }

  /**
   * Disable / enable a Firebase Auth account.
   */
  async toggleUserAccount(uid: string, disabled: boolean): Promise<void> {
    await Promise.all([
      auth.updateUser(uid, { disabled }),
      db.collection(collections.users).doc(uid).update({
        isActive: !disabled,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }),
    ]);
  }

  /**
   * Delete a user from Firebase Auth and Firestore (irreversible).
   */
  async deleteUser(uid: string): Promise<void> {
    await Promise.all([
      auth.deleteUser(uid),
      db.collection(collections.users).doc(uid).delete(),
    ]);
  }
  /**
   * Get comprehensive, real-time dashboard insights for the admin portal.
   * Merges persisted analytics events, authoritative appointment records, and contact inquiries.
   */
  async getDashboardInsights(): Promise<import('../types').DashboardInsights> {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    const sevenDaysTimestamp = admin.firestore.Timestamp.fromDate(sevenDaysAgo);

    // Parallel fetch from authoritative collections
    const [
      analyticsSnap,
      appointmentsSnap,
      enquiriesSnap,
    ] = await Promise.all([
      db.collection(collections.analytics)
        .where('timestamp', '>=', sevenDaysTimestamp)
        .orderBy('timestamp', 'desc')
        .limit(2000)
        .get(),
      db.collection(collections.appointments)
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get(),
      db.collection(collections.enquiries)
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get(),
    ]);

    // 1. Process Traffic Analytics
    let totalPageViews = 0;
    let appointmentPageVisits = 0;
    let contactPageVisits = 0;
    let bookingStarts = 0;
    let consultationSelections = 0;
    let bookingSubmissions = 0;
    const uniqueSessions = new Set<string>();
    const pageViewCounts: Record<string, number> = {};
    const dailyVisitMap: Record<string, number> = {};

    // Initialize daily map for last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyVisitMap[dayKey] = 0;
    }

    analyticsSnap.docs.forEach((doc) => {
      const data = doc.data();
      const eventType = data.eventType;
      const path = data.path || '/';
      const session = data.sessionId;

      if (session) uniqueSessions.add(session);

      if (eventType === 'page_view') {
        totalPageViews++;
        pageViewCounts[path] = (pageViewCounts[path] || 0) + 1;

        if (data.timestamp) {
          const evDate = data.timestamp.toDate();
          const dayKey = evDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if (dailyVisitMap[dayKey] !== undefined) {
            dailyVisitMap[dayKey]++;
          }
        }
      } else if (eventType === 'appointment_page_view') {
        appointmentPageVisits++;
      } else if (eventType === 'booking_started') {
        bookingStarts++;
      } else if (eventType === 'consultation_selected') {
        consultationSelections++;
      } else if (eventType === 'booking_submitted') {
        bookingSubmissions++;
      } else if (eventType === 'contact_form_submitted') {
        contactPageVisits++;
      }
    });

    const weeklyVisits = Object.entries(dailyVisitMap).map(([day, visits]) => ({
      day,
      visits,
    }));

    const popularPages = Object.entries(pageViewCounts)
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    const conversionRate =
      bookingStarts > 0
        ? Math.round((bookingSubmissions / bookingStarts) * 100)
        : 0;

    // 2. Process Authoritative Appointments
    const byStatus: Record<AppointmentStatus, number> = {
      PENDING: 0,
      CONFIRMED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      RESCHEDULED: 0,
    };

    const activeList = appointmentsSnap.docs.map((doc) => {
      const data = doc.data();
      const status = data.status as AppointmentStatus;
      if (byStatus[status] !== undefined) {
        byStatus[status]++;
      }
      return {
        id: doc.id,
        patientName: data.patientName || data.fullName || 'Anonymous Patient',
        date: data.date || '',
        time: data.time || '',
        doctor: data.doctorName || 'Dr. Vijay',
        status: data.status || 'PENDING',
        serviceName: data.serviceName || 'Consultation',
        amount: data.amount || 0,
      };
    });

    // 3. Process Inquiries
    let pendingInquiries = 0;
    let reviewedInquiries = 0;

    enquiriesSnap.docs.forEach((doc) => {
      const status = doc.data().status;
      if (status === 'reviewed') {
        reviewedInquiries++;
      } else {
        pendingInquiries++;
      }
    });

    // 4. Build Real Activity Feed
    const recentActivity: import('../types').DashboardInsights['recentActivity'] = [];

    // Add recent appointments to activity
    appointmentsSnap.docs.slice(0, 5).forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt ? data.createdAt.toDate() : new Date();
      recentActivity.push({
        id: `act-appt-${doc.id}`,
        type: 'APPOINTMENT',
        message: `Appointment ${data.status?.toLowerCase() || 'reserved'} for ${data.patientName || 'Patient'} on ${data.date}`,
        timeAgo: this.formatTimeAgo(createdAt),
        timestamp: createdAt.toISOString(),
      });
    });

    // Add recent inquiries to activity
    enquiriesSnap.docs.slice(0, 5).forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt ? data.createdAt.toDate() : new Date();
      recentActivity.push({
        id: `act-inq-${doc.id}`,
        type: 'INQUIRY',
        message: `New query submitted by ${data.name || 'Visitor'}: "${(data.message || '').substring(0, 35)}..."`,
        timeAgo: this.formatTimeAgo(createdAt),
        timestamp: createdAt.toISOString(),
      });
    });

    recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      traffic: {
        totalPageViews,
        estimatedUniqueVisitors: uniqueSessions.size,
        appointmentPageVisits,
        contactPageVisits,
        weeklyVisits,
        popularPages,
      },
      funnel: {
        bookingStarts,
        consultationSelections,
        bookingSubmissions,
        conversionRate,
      },
      appointments: {
        total: appointmentsSnap.size,
        byStatus,
        activeList: activeList.slice(0, 10),
      },
      inquiries: {
        total: enquiriesSnap.size,
        pending: pendingInquiries,
        reviewed: reviewedInquiries,
      },
      recentActivity: recentActivity.slice(0, 8),
      trackingStartedAt: '2026-10-22T00:00:00.000Z',
      lastUpdated: new Date().toISOString(),
    };
  }

  private formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}

export const adminService = new AdminService();

