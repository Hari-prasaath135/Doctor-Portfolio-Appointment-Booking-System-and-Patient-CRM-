import { db, collections, admin } from '../config/firebase';
import { MedicalRecord } from '../types';
import { NotFoundError } from '../utils/errors';
import { v4 as uuid } from 'uuid';

export class MedicalHistoryService {
  /**
   * Add a medical record for a patient.
   */
  async addRecord(
    data: Omit<MedicalRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<MedicalRecord> {
    const id = uuid();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const record = { id, ...data, createdAt: now, updatedAt: now };

    await db.collection(collections.medicalHistory).doc(id).set(record);
    const snap = await db.collection(collections.medicalHistory).doc(id).get();
    return { id: snap.id, ...snap.data() } as unknown as MedicalRecord;
  }

  /**
   * Get a single medical record by ID.
   */
  async getRecordById(id: string): Promise<MedicalRecord> {
    const snap = await db.collection(collections.medicalHistory).doc(id).get();
    if (!snap.exists) throw new NotFoundError('Medical record');
    return { id: snap.id, ...snap.data() } as unknown as MedicalRecord;
  }

  /**
   * Get all medical history for a patient.
   */
  async getPatientHistory(patientId: string): Promise<MedicalRecord[]> {
    const snap = await db
      .collection(collections.medicalHistory)
      .where('patientId', '==', patientId)
      .orderBy('date', 'desc')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as MedicalRecord[];
  }

  /**
   * Get medical history filtered by type.
   */
  async getPatientHistoryByType(
    patientId: string,
    type: MedicalRecord['type']
  ): Promise<MedicalRecord[]> {
    const snap = await db
      .collection(collections.medicalHistory)
      .where('patientId', '==', patientId)
      .where('type', '==', type)
      .orderBy('date', 'desc')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as MedicalRecord[];
  }

  /**
   * Update a medical record.
   */
  async updateRecord(
    id: string,
    data: Partial<Omit<MedicalRecord, 'id' | 'patientId' | 'createdAt'>>
  ): Promise<MedicalRecord> {
    const ref = db.collection(collections.medicalHistory).doc(id);
    if (!(await ref.get()).exists) throw new NotFoundError('Medical record');

    await ref.update({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() } as unknown as MedicalRecord;
  }

  /**
   * Delete a medical record.
   */
  async deleteRecord(id: string): Promise<void> {
    const ref = db.collection(collections.medicalHistory).doc(id);
    if (!(await ref.get()).exists) throw new NotFoundError('Medical record');
    await ref.delete();
  }
}

export const medicalHistoryService = new MedicalHistoryService();
