import { db, collections, admin } from '../config/firebase';
import { PatientQuery, QueryStatus } from '../types';
import { NotFoundError } from '../utils/errors';
import { v4 as uuid } from 'uuid';

export class QueryService {
  /**
   * Submit a new patient query.
   */
  async submitQuery(
    patientId: string,
    subject: string,
    message: string
  ): Promise<PatientQuery> {
    const id = uuid();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const query = {
      id,
      patientId,
      subject,
      message,
      status: 'OPEN' as QueryStatus,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection(collections.patientQueries).doc(id).set(query);
    const snap = await db.collection(collections.patientQueries).doc(id).get();
    return { id: snap.id, ...snap.data() } as unknown as PatientQuery;
  }

  /**
   * Get a single query by ID.
   */
  async getQueryById(id: string): Promise<PatientQuery> {
    const snap = await db.collection(collections.patientQueries).doc(id).get();
    if (!snap.exists) throw new NotFoundError('Query');
    return { id: snap.id, ...snap.data() } as unknown as PatientQuery;
  }

  /**
   * List queries for a specific patient.
   */
  async getQueriesByPatient(patientId: string): Promise<PatientQuery[]> {
    const snap = await db
      .collection(collections.patientQueries)
      .where('patientId', '==', patientId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as PatientQuery[];
  }

  /**
   * List all queries (admin/doctor view), optionally filtered by status.
   */
  async listAllQueries(status?: QueryStatus): Promise<PatientQuery[]> {
    let query: FirebaseFirestore.Query = db.collection(collections.patientQueries);
    if (status) query = query.where('status', '==', status);
    const snap = await query.orderBy('createdAt', 'desc').get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as PatientQuery[];
  }

  /**
   * Assign a query to a doctor.
   */
  async assignQuery(id: string, doctorId: string): Promise<PatientQuery> {
    const ref = db.collection(collections.patientQueries).doc(id);
    if (!(await ref.get()).exists) throw new NotFoundError('Query');

    await ref.update({
      assignedDoctorId: doctorId,
      status: 'IN_REVIEW' as QueryStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updated = await ref.get();
    return { id: updated.id, ...updated.data() } as unknown as PatientQuery;
  }

  /**
   * Respond to and resolve a query.
   */
  async resolveQuery(id: string, response: string): Promise<PatientQuery> {
    const ref = db.collection(collections.patientQueries).doc(id);
    if (!(await ref.get()).exists) throw new NotFoundError('Query');

    await ref.update({
      response,
      status: 'RESOLVED' as QueryStatus,
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updated = await ref.get();
    return { id: updated.id, ...updated.data() } as unknown as PatientQuery;
  }

  /**
   * Close a query.
   */
  async closeQuery(id: string): Promise<void> {
    const ref = db.collection(collections.patientQueries).doc(id);
    if (!(await ref.get()).exists) throw new NotFoundError('Query');
    await ref.update({
      status: 'CLOSED' as QueryStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

export const queryService = new QueryService();
