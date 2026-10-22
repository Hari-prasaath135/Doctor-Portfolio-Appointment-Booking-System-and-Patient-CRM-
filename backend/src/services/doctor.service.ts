import { db, collections, admin } from '../config/firebase';
import { Doctor, PaginatedResult, PaginationParams } from '../types';
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
}

export const doctorService = new DoctorService();
