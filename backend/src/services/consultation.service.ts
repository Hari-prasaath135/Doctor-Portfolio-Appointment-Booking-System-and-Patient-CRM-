import { db, collections, admin } from '../config/firebase';
import { Consultation, ConsultationStatus } from '../types';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { v4 as uuid } from 'uuid';

export class ConsultationService {
  /**
   * Create a consultation record (doctor only).
   */
  async createConsultation(
    data: Omit<Consultation, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<Consultation> {
    const id = uuid();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const consultation = {
      id,
      ...data,
      status: 'IN_PROGRESS' as ConsultationStatus,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection(collections.consultations).doc(id).set(consultation);
    const snap = await db.collection(collections.consultations).doc(id).get();
    return { id: snap.id, ...snap.data() } as unknown as Consultation;
  }

  /**
   * Get consultation by ID.
   */
  async getConsultationById(id: string): Promise<Consultation> {
    const snap = await db.collection(collections.consultations).doc(id).get();
    if (!snap.exists) throw new NotFoundError('Consultation');
    return { id: snap.id, ...snap.data() } as unknown as Consultation;
  }

  /**
   * Get consultation by appointment ID.
   */
  async getConsultationByAppointment(appointmentId: string): Promise<Consultation | null> {
    const snap = await db
      .collection(collections.consultations)
      .where('appointmentId', '==', appointmentId)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as unknown as Consultation;
  }

  /**
   * Update consultation details (add symptoms, diagnosis, notes, recommendations).
   */
  async updateConsultation(
    id: string,
    doctorId: string,
    data: Partial<
      Pick<Consultation, 'symptoms' | 'diagnosis' | 'notes' | 'recommendations' | 'followUpDate'>
    >
  ): Promise<Consultation> {
    const ref = db.collection(collections.consultations).doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundError('Consultation');

    const existing = snap.data() as Consultation;
    if (existing.doctorId !== doctorId) {
      throw new ForbiddenError('Only the consulting doctor can update this record');
    }

    await ref.update({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() } as unknown as Consultation;
  }

  /**
   * Mark consultation as completed.
   */
  async completeConsultation(id: string, doctorId: string): Promise<Consultation> {
    const ref = db.collection(collections.consultations).doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundError('Consultation');

    const existing = snap.data() as Consultation;
    if (existing.doctorId !== doctorId) {
      throw new ForbiddenError('Only the consulting doctor can complete this consultation');
    }

    await ref.update({
      status: 'COMPLETED' as ConsultationStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updated = await ref.get();
    return { id: updated.id, ...updated.data() } as unknown as Consultation;
  }

  /**
   * List consultations for a patient.
   */
  async getConsultationsByPatient(patientId: string): Promise<Consultation[]> {
    const snap = await db
      .collection(collections.consultations)
      .where('patientId', '==', patientId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Consultation[];
  }

  /**
   * List consultations for a doctor.
   */
  async getConsultationsByDoctor(doctorId: string): Promise<Consultation[]> {
    const snap = await db
      .collection(collections.consultations)
      .where('doctorId', '==', doctorId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Consultation[];
  }
}

export const consultationService = new ConsultationService();
