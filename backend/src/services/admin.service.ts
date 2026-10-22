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
}

export const adminService = new AdminService();
