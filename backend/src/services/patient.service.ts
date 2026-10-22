import { db, collections, admin } from '../config/firebase';
import { Patient, PaginatedResult, PaginationParams } from '../types';
import { NotFoundError, ConflictError } from '../utils/errors';
import { v4 as uuid } from 'uuid';

export class PatientService {
  /**
   * Create a patient profile (called during user registration).
   */
  async createPatient(
    uid: string,
    data: Omit<Patient, 'id' | 'uid' | 'createdAt' | 'updatedAt'>
  ): Promise<Patient> {
    // Check uniqueness by uid
    const existing = await db.collection(collections.patients).where('uid', '==', uid).get();
    if (!existing.empty) {
      throw new ConflictError('Patient profile already exists for this user');
    }

    const id = uuid();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const patient = { id, uid, ...data, createdAt: now, updatedAt: now };

    await db.collection(collections.patients).doc(id).set(patient);
    return patient as unknown as Patient;
  }

  /**
   * Get patient profile by patient document ID.
   */
  async getPatientById(id: string): Promise<Patient> {
    const snap = await db.collection(collections.patients).doc(id).get();
    if (!snap.exists) throw new NotFoundError('Patient');
    return { id: snap.id, ...snap.data() } as unknown as Patient;
  }

  /**
   * Get patient profile by Firebase uid.
   */
  async getPatientByUid(uid: string): Promise<Patient> {
    const snap = await db
      .collection(collections.patients)
      .where('uid', '==', uid)
      .limit(1)
      .get();

    if (snap.empty) throw new NotFoundError('Patient profile');
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as unknown as Patient;
  }

  /**
   * Update patient profile.
   */
  async updatePatient(id: string, data: Partial<Omit<Patient, 'id' | 'uid' | 'createdAt'>>): Promise<Patient> {
    const ref = db.collection(collections.patients).doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundError('Patient');

    await ref.update({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() } as unknown as Patient;
  }

  /**
   * List all patients (admin only) with basic pagination.
   */
  async listPatients(params: PaginationParams = {}): Promise<PaginatedResult<Patient>> {
    const { page = 1, limit = 20 } = params;

    const totalSnap = await db.collection(collections.patients).count().get();
    const total = totalSnap.data().count;

    const offset = (page - 1) * limit;
    const snap = await db
      .collection(collections.patients)
      .orderBy('createdAt', 'desc')
      .offset(offset)
      .limit(limit)
      .get();

    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Patient[];

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
   * Search patients by name or email (admin/doctor use).
   */
  async searchPatients(query: string): Promise<Patient[]> {
    const snap = await db
      .collection(collections.patients)
      .where('email', '>=', query)
      .where('email', '<=', query + '\uf8ff')
      .limit(20)
      .get();

    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Patient[];
  }
}

export const patientService = new PatientService();
