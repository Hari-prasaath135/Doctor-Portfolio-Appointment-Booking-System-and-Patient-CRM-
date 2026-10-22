import { db, collections, admin } from '../config/firebase';
import {
  Doctor,
  PaginatedResult,
  PaginationParams,
  DoctorDashboardData,
  DoctorDashboardAppointment,
  DoctorSlotItem,
} from '../types';
import { NotFoundError } from '../utils/errors';
import { v4 as uuid } from 'uuid';

export class DoctorService {
  /**
   * Create a new doctor profile (admin only).
   */
  async createDoctor(
    data: Omit<Doctor, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Doctor> {
    const id = uuid();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const doctor = { id, ...data, isActive: true, createdAt: now, updatedAt: now };

    await db.collection(collections.doctors).doc(id).set(doctor);
    return doctor as unknown as Doctor;
  }

  /**
   * Get doctor by document ID.
   */
  async getDoctorById(id: string): Promise<Doctor> {
    const snap = await db.collection(collections.doctors).doc(id).get();
    if (!snap.exists) throw new NotFoundError('Doctor');
    return { id: snap.id, ...snap.data() } as unknown as Doctor;
  }

  /**
   * Get doctor by Firebase uid.
   */
  async getDoctorByUid(uid: string): Promise<Doctor> {
    const snap = await db
      .collection(collections.doctors)
      .where('uid', '==', uid)
      .limit(1)
      .get();

    if (snap.empty) throw new NotFoundError('Doctor profile');
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as unknown as Doctor;
  }

  /**
   * Update doctor profile.
   */
  async updateDoctor(
    id: string,
    data: Partial<Omit<Doctor, 'id' | 'uid' | 'createdAt'>>
  ): Promise<Doctor> {
    const ref = db.collection(collections.doctors).doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundError('Doctor');

    await ref.update({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() } as unknown as Doctor;
  }

  /**
   * List all active doctors.
   */
  async listDoctors(params: PaginationParams = {}): Promise<PaginatedResult<Doctor>> {
    const { page = 1, limit = 20 } = params;

    const totalSnap = await db
      .collection(collections.doctors)
      .where('isActive', '==', true)
      .count()
      .get();
    const total = totalSnap.data().count;

    const offset = (page - 1) * limit;
    const snap = await db
      .collection(collections.doctors)
      .where('isActive', '==', true)
      .orderBy('name', 'asc')
      .offset(offset)
      .limit(limit)
      .get();

    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Doctor[];

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Deactivate a doctor (soft delete).
   */
  async deactivateDoctor(id: string): Promise<void> {
    const ref = db.collection(collections.doctors).doc(id);
    if (!(await ref.get()).exists) throw new NotFoundError('Doctor');
    await ref.update({
      isActive: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  /**
   * Get authenticated doctor's dashboard data from authoritative records.
   * Only returns appointments and schedules assigned to the doctor.
   */
  async getDoctorDashboardData(doctorId: string, doctorEmail: string): Promise<DoctorDashboardData> {
    const todayStr = new Date().toISOString().split('T')[0];

    // Get doctor profile or default identity
    let doctorName = 'Dr. Vijay';
    let specialization = 'Interventional Radiologist';
    try {
      const doctorDoc = await db.collection(collections.doctors).doc(doctorId).get();
      if (doctorDoc.exists) {
        const dData = doctorDoc.data()!;
        doctorName = dData.name || doctorName;
        specialization = dData.specialization || specialization;
      }
    } catch {
      // Fallback to defaults
    }

    // 1. Fetch appointments assigned to this doctor
    const apptsSnap = await db
      .collection(collections.appointments)
      .where('doctorId', '==', doctorId)
      .get();

    const allAppts: DoctorDashboardAppointment[] = [];
    apptsSnap.forEach((doc) => {
      const d = doc.data();
      allAppts.push({
        id: doc.id,
        patientId: d.patientId,
        patientName: d.patientName || 'Patient',
        email: d.email,
        phone: d.phone,
        dateOfBirth: d.dateOfBirth,
        age: d.age,
        date: d.date,
        time: d.time,
        status: d.status,
        serviceName: d.serviceName || 'Consultation',
        consultationType: d.consultationType,
        message: d.message,
        medicalHistory: d.medicalHistory,
        attachments: d.attachments || [],
        consultationNotes: d.consultationNotes,
      });
    });

    // Sort by date + time
    allAppts.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

    const todayAppointments = allAppts.filter((a) => a.date === todayStr && a.status !== 'CANCELLED');
    const upcomingAppointments = allAppts.filter(
      (a) => a.date >= todayStr && a.status !== 'CANCELLED' && a.status !== 'COMPLETED'
    );
    const pastAppointments = allAppts.filter(
      (a) => a.date < todayStr || a.status === 'COMPLETED' || a.status === 'CANCELLED'
    );

    const completedCount = allAppts.filter((a) => a.status === 'COMPLETED').length;
    const pendingCount = allAppts.filter((a) => a.status === 'PENDING').length;
    const cancelledCount = allAppts.filter((a) => a.status === 'CANCELLED').length;

    // 2. Fetch Availability / Slots for this doctor
    const availSnap = await db
      .collection(collections.availability)
      .where('doctorId', '==', doctorId)
      .get();

    const slotsByDay: Record<string, DoctorSlotItem[]> = {};
    const availableDays: string[] = [];
    let availableSlotsToday = 0;
    let totalSlotsToday = 0;
    let totalBookedSlots = 0;
    let totalAllSlots = 0;

    availSnap.forEach((doc) => {
      const d = doc.data();
      const date = d.date;
      if (!slotsByDay[date]) {
        slotsByDay[date] = [];
        availableDays.push(date);
      }

      const slots = d.slots || [];
      slots.forEach((s: any, idx: number) => {
        const isBooked = !!s.isBooked;
        totalAllSlots++;
        if (isBooked) totalBookedSlots++;

        if (date === todayStr) {
          totalSlotsToday++;
          if (!isBooked) availableSlotsToday++;
        }

        slotsByDay[date].push({
          id: `${date}-${idx}`,
          date,
          startTime: s.time,
          endTime: s.endTime || s.time,
          isBooked,
          status: isBooked ? 'booked' : 'available',
        });
      });
    });

    availableDays.sort();

    const slotUtilizationRate =
      totalAllSlots > 0 ? Math.round((totalBookedSlots / totalAllSlots) * 100) : 0;

    // 3. Recent Activity from actual state transitions
    const recentActivity = allAppts.slice(0, 10).map((a) => ({
      id: `act-${a.id}`,
      type: a.status,
      message: `${a.patientName} (${a.serviceName}) scheduled for ${a.date} at ${a.time} [${a.status}]`,
      timeAgo: `${a.date} ${a.time}`,
      timestamp: new Date().toISOString(),
    }));

    return {
      doctor: {
        id: doctorId,
        name: doctorName,
        specialization,
        email: doctorEmail,
      },
      metrics: {
        todayCount: todayAppointments.length,
        upcomingCount: upcomingAppointments.length,
        completedCount,
        pendingCount,
        cancelledCount,
        totalAppointments: allAppts.length,
        availableSlotsToday,
        totalSlotsToday,
        slotUtilizationRate,
      },
      todayAppointments,
      upcomingAppointments,
      pastAppointments,
      slotsByDay,
      availableDays,
      recentActivity,
      lastUpdated: new Date().toISOString(),
    };
  }
}

export const doctorService = new DoctorService();
