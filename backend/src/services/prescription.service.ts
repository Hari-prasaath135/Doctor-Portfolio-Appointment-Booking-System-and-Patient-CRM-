import { db, collections, admin } from '../config/firebase';
import { Prescription } from '../types';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { v4 as uuid } from 'uuid';

export class PrescriptionService {
  /**
   * Create a prescription.
   *
   * Validates:
   * 1. Doctor making the request matches the doctorId on the prescription.
   * 2. The linked consultation exists.
   */
  async createPrescription(
    doctorId: string,
    data: Omit<Prescription, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Prescription> {
    // Validate doctor
    if (data.doctorId !== doctorId) {
      throw new ForbiddenError('You can only create prescriptions for your own consultations');
    }

    // Validate consultation exists
    const consultationSnap = await db
      .collection(collections.consultations)
      .doc(data.consultationId)
      .get();

    if (!consultationSnap.exists) {
      throw new NotFoundError('Consultation');
    }

    const id = uuid();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const prescription = { id, ...data, createdAt: now, updatedAt: now };

    await db.collection(collections.prescriptions).doc(id).set(prescription);
    const snap = await db.collection(collections.prescriptions).doc(id).get();
    return { id: snap.id, ...snap.data() } as unknown as Prescription;
  }

  /**
   * Get prescription by ID.
   */
  async getPrescriptionById(id: string): Promise<Prescription> {
    const snap = await db.collection(collections.prescriptions).doc(id).get();
    if (!snap.exists) throw new NotFoundError('Prescription');
    return { id: snap.id, ...snap.data() } as unknown as Prescription;
  }

  /**
   * List prescriptions for a patient.
   */
  async getPrescriptionsByPatient(patientId: string): Promise<Prescription[]> {
    const snap = await db
      .collection(collections.prescriptions)
      .where('patientId', '==', patientId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Prescription[];
  }

  /**
   * List prescriptions for a consultation.
   */
  async getPrescriptionsByConsultation(consultationId: string): Promise<Prescription[]> {
    const snap = await db
      .collection(collections.prescriptions)
      .where('consultationId', '==', consultationId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Prescription[];
  }

  /**
   * Update prescription (only by the issuing doctor).
   */
  async updatePrescription(
    id: string,
    doctorId: string,
    data: Partial<Pick<Prescription, 'medicines' | 'notes' | 'validUntil'>>
  ): Promise<Prescription> {
    const ref = db.collection(collections.prescriptions).doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundError('Prescription');

    const existing = snap.data() as Prescription;
    if (existing.doctorId !== doctorId) {
      throw new ForbiddenError('Only the prescribing doctor can update this prescription');
    }

    await ref.update({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() } as unknown as Prescription;
  }
}

export const prescriptionService = new PrescriptionService();
