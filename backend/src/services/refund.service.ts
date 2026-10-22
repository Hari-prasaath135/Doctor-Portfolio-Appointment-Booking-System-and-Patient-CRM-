import axios from 'axios';
import { db, collections, admin } from '../config/firebase';
import { Refund, RefundStatus } from '../types';
import { paymentService } from './payment.service';
import { NotFoundError, UnprocessableError, ServiceUnavailableError } from '../utils/errors';
import { logger } from '../utils/logger';
import { v4 as uuid } from 'uuid';

const PINELABS_BASE_URL = process.env.PINELABS_BASE_URL || 'https://pluraluat.v2.pinepg.in';

// ─── Refund Policy ────────────────────────────────────────────────────────────
// > 48 hours before appointment: 100% refund
// > 24 hours before appointment: 50% refund
// ≤ 24 hours before appointment: No refund

function calculateRefundPolicy(
  appointmentDate: string,
  appointmentTime: string
): { eligible: boolean; percentage: number; reason: string } {
  const [year, month, day] = appointmentDate.split('-').map(Number);
  const [hour, minute] = appointmentTime.split(':').map(Number);
  const apptDateTime = new Date(year, month - 1, day, hour, minute);
  const hoursUntil = (apptDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

  if (hoursUntil > 48) {
    return { eligible: true, percentage: 100, reason: 'Cancelled more than 48 hours in advance' };
  }
  if (hoursUntil > 24) {
    return { eligible: true, percentage: 50, reason: 'Cancelled between 24–48 hours in advance' };
  }
  return {
    eligible: false,
    percentage: 0,
    reason: 'Cancellation within 24 hours of appointment — no refund applicable',
  };
}

export class RefundService {
  /**
   * Process a refund for a cancelled appointment.
   *
   * Flow:
   *  1. Get payment → verify status is PAID
   *  2. Check refund eligibility by policy
   *  3. Calculate refund amount
   *  4. Call Pinelabs refund API
   *  5. Update Firestore payment + create refund record
   */
  async processRefund(
    appointmentId: string,
    appointmentDate: string,
    appointmentTime: string,
    reason: string
  ): Promise<Refund> {
    const payment = await paymentService.getPaymentByAppointment(appointmentId);

    if (!payment) {
      throw new NotFoundError('Payment for this appointment');
    }

    if (payment.status !== 'PAID') {
      throw new UnprocessableError(
        `Cannot refund — payment status is ${payment.status}`
      );
    }

    // 1. Check eligibility
    const policy = calculateRefundPolicy(appointmentDate, appointmentTime);

    const refundId = uuid();
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (!policy.eligible) {
      // Record as ineligible
      const refund: Omit<Refund, 'createdAt' | 'updatedAt'> & {
        createdAt: unknown;
        updatedAt: unknown;
      } = {
        id: refundId,
        paymentId: payment.id,
        appointmentId,
        patientId: payment.patientId,
        amount: 0,
        refundPercentage: 0,
        status: 'INELIGIBLE',
        reason: policy.reason,
        createdAt: now,
        updatedAt: now,
      };

      await db.collection(collections.refunds).doc(refundId).set(refund);
      return refund as unknown as Refund;
    }

    // 2. Calculate refund amount
    const refundAmount = Math.floor((payment.amount * policy.percentage) / 100);

    // 3. Call Pinelabs refund API
    let providerRefundId: string | undefined;
    try {
      const tokenRes = await axios.post<{ access_token: string }>(
        `${PINELABS_BASE_URL}/api/auth/v1/token`,
        {
          client_id: process.env.PINELABS_CLIENT_ID,
          client_secret: process.env.PINELABS_CLIENT_SECRET,
          grant_type: 'client_credentials',
        }
      );
      const accessToken = tokenRes.data.access_token;

      const refundRes = await axios.post<{ refund_id: string }>(
        `${PINELABS_BASE_URL}/api/v2/refund`,
        {
          plural_transaction_id: payment.transactionId,
          refund_amount: refundAmount,
          merchant_id: process.env.PINELABS_MERCHANT_ID,
          reason,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      providerRefundId = refundRes.data.refund_id;
      logger.info(`Pinelabs refund initiated: refundId=${providerRefundId}, amount=${refundAmount}`);
    } catch (err) {
      logger.error('Pinelabs refund API failed', err);
      throw new ServiceUnavailableError('Pinelabs Refund Service');
    }

    // 4. Update payment status in Firestore
    const newPaymentStatus =
      policy.percentage === 100 ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    await db.collection(collections.payments).doc(payment.id).update({
      status: newPaymentStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 5. Create refund record
    const refund: Omit<Refund, 'createdAt' | 'updatedAt'> & {
      createdAt: unknown;
      updatedAt: unknown;
    } = {
      id: refundId,
      paymentId: payment.id,
      appointmentId,
      patientId: payment.patientId,
      amount: refundAmount,
      refundPercentage: policy.percentage,
      status: 'PROCESSED',
      reason,
      providerRefundId,
      processedAt: admin.firestore.Timestamp.now(),
      createdAt: now,
      updatedAt: now,
    };

    await db.collection(collections.refunds).doc(refundId).set(refund);
    logger.info(`Refund record saved: refundId=${refundId}`);

    return refund as unknown as Refund;
  }

  /**
   * Get refund by ID.
   */
  async getRefundById(id: string): Promise<Refund> {
    const snap = await db.collection(collections.refunds).doc(id).get();
    if (!snap.exists) throw new NotFoundError('Refund');
    return { id: snap.id, ...snap.data() } as unknown as Refund;
  }

  /**
   * Get refund by appointment ID.
   */
  async getRefundByAppointment(appointmentId: string): Promise<Refund | null> {
    const snap = await db
      .collection(collections.refunds)
      .where('appointmentId', '==', appointmentId)
      .limit(1)
      .get();

    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as unknown as Refund;
  }

  /**
   * Update refund status (e.g., after Pinelabs webhook confirms the refund).
   */
  async updateRefundStatus(id: string, status: RefundStatus): Promise<Refund> {
    const ref = db.collection(collections.refunds).doc(id);
    if (!(await ref.get()).exists) throw new NotFoundError('Refund');

    await ref.update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updated = await ref.get();
    return { id: updated.id, ...updated.data() } as unknown as Refund;
  }
}

export const refundService = new RefundService();
