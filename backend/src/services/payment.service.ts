import axios from 'axios';
import { db, collections, admin } from '../config/firebase';
import { Payment, PaymentStatus } from '../types';
import { NotFoundError, ServiceUnavailableError, ConflictError } from '../utils/errors';
import { logger } from '../utils/logger';
import { v4 as uuid } from 'uuid';

// ─── Pinelabs (Plural Pay) Configuration ─────────────────────────────────────

const PINELABS_BASE_URL = process.env.PINELABS_BASE_URL || 'https://pluraluat.v2.pinepg.in';
const PINELABS_CLIENT_ID = process.env.PINELABS_CLIENT_ID!;
const PINELABS_CLIENT_SECRET = process.env.PINELABS_CLIENT_SECRET!;
const PINELABS_MERCHANT_ID = process.env.PINELABS_MERCHANT_ID!;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

interface PinelabsTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Payment Service — Pinelabs (Plural Pay) Integration
 *
 * Flow:
 *   1. createPaymentOrder() → Pinelabs API → returns order token + redirect URL
 *   2. Frontend redirects patient to Pinelabs payment page
 *   3. Pinelabs calls our webhook → handleWebhook() → verifies → confirms appointment
 */
export class PaymentService {
  /**
   * Obtain a short-lived Pinelabs access token.
   */
  private async getPinelabsToken(): Promise<string> {
    try {
      const response = await axios.post<PinelabsTokenResponse>(
        `${PINELABS_BASE_URL}/api/auth/v1/token`,
        {
          client_id: PINELABS_CLIENT_ID,
          client_secret: PINELABS_CLIENT_SECRET,
          grant_type: 'client_credentials',
        }
      );
      return response.data.access_token;
    } catch (err) {
      logger.error('Failed to obtain Pinelabs token', err);
      throw new ServiceUnavailableError('Pinelabs Payment Gateway');
    }
  }

  /**
   * Create a payment order for an appointment.
   *
   * @param appointmentId  Appointment to pay for
   * @param patientId      Patient document ID
   * @param amountInPaise  Amount in paise (INR × 100)
   * @param billingInfo    Patient billing details
   */
  async createPaymentOrder(
    appointmentId: string,
    patientId: string,
    amountInPaise: number,
    billingInfo: { name: string; email: string; phone: string }
  ): Promise<{ paymentId: string; orderId: string; redirectUrl: string; token: string }> {
    // Check for existing pending payment
    const existingSnap = await db
      .collection(collections.payments)
      .where('appointmentId', '==', appointmentId)
      .where('status', '==', 'PENDING')
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      throw new ConflictError('A pending payment already exists for this appointment');
    }

    const merchantTransactionId = `TXN_${appointmentId}_${Date.now()}`;
    const token = await this.getPinelabsToken();

    let pinelabsResponse: { data: { token: string; redirect_url: string } };
    try {
      pinelabsResponse = await axios.post(
        `${PINELABS_BASE_URL}/api/v2/order/create`,
        {
          merchant_id: PINELABS_MERCHANT_ID,
          unique_merchant_transaction_id: merchantTransactionId,
          amount_in_paisa: amountInPaise,
          currency_code: '356', // INR
          payment_mode: 1,       // All payment modes
          billing_name: billingInfo.name,
          billing_email: billingInfo.email,
          billing_mobile_number: billingInfo.phone,
          callback_url: `${FRONTEND_URL}/payment/callback`,
          txn_completion_datetime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      logger.error('Pinelabs order creation failed', err);
      throw new ServiceUnavailableError('Pinelabs Payment Gateway');
    }

    const { token: orderToken, redirect_url: redirectUrl } = pinelabsResponse.data;

    // Persist payment record
    const paymentId = uuid();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const payment: Omit<Payment, 'createdAt' | 'updatedAt'> & { createdAt: unknown; updatedAt: unknown } = {
      id: paymentId,
      appointmentId,
      patientId,
      amount: amountInPaise,
      currency: 'INR',
      status: 'PENDING',
      provider: 'PINELABS',
      orderId: merchantTransactionId,
      webhookReceived: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection(collections.payments).doc(paymentId).set(payment);

    logger.info(`Payment order created: paymentId=${paymentId}, appointmentId=${appointmentId}`);
    return { paymentId, orderId: merchantTransactionId, redirectUrl, token: orderToken };
  }

  /**
   * Handle Pinelabs payment webhook.
   * Pinelabs POSTs payment status to our webhook endpoint.
   */
  async handleWebhook(payload: Record<string, unknown>): Promise<void> {
    const {
      unique_merchant_transaction_id: merchantTxnId,
      payment_status,
      plural_transaction_id: providerTxnId,
      payment_amount_in_paisa,
    } = payload as {
      unique_merchant_transaction_id: string;
      payment_status: string;
      plural_transaction_id: string;
      payment_amount_in_paisa: number;
    };

    logger.info(`Pinelabs webhook received — txn=${merchantTxnId}, status=${payment_status}`);

    // Find payment by orderId (merchant transaction ID)
    const snap = await db
      .collection(collections.payments)
      .where('orderId', '==', merchantTxnId)
      .limit(1)
      .get();

    if (snap.empty) {
      logger.warn(`Webhook received for unknown order: ${merchantTxnId}`);
      return;
    }

    const paymentDoc = snap.docs[0];
    const paymentData = paymentDoc.data() as Payment;

    // Idempotency check
    if (paymentData.webhookReceived) {
      logger.info(`Duplicate webhook for ${merchantTxnId}, ignoring`);
      return;
    }

    const isSuccess =
      payment_status?.toUpperCase() === 'PAYMENT_SUCCESS' ||
      payment_status?.toUpperCase() === 'SUCCESS' ||
      payment_status?.toUpperCase() === 'CAPTURED';

    const newStatus: PaymentStatus = isSuccess ? 'PAID' : 'FAILED';

    await paymentDoc.ref.update({
      status: newStatus,
      transactionId: providerTxnId,
      amount: payment_amount_in_paisa || paymentData.amount,
      webhookReceived: true,
      paidAt: isSuccess ? admin.firestore.FieldValue.serverTimestamp() : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`Payment ${paymentDoc.id} status updated to ${newStatus}`);
  }

  /**
   * Get payment by ID.
   */
  async getPaymentById(id: string): Promise<Payment> {
    const snap = await db.collection(collections.payments).doc(id).get();
    if (!snap.exists) throw new NotFoundError('Payment');
    return { id: snap.id, ...snap.data() } as unknown as Payment;
  }

  /**
   * Get payment by appointment ID.
   */
  async getPaymentByAppointment(appointmentId: string): Promise<Payment | null> {
    const snap = await db
      .collection(collections.payments)
      .where('appointmentId', '==', appointmentId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as unknown as Payment;
  }

  /**
   * Mark payment as paid (for manual admin overrides or testing).
   */
  async markAsPaid(paymentId: string, transactionId: string): Promise<Payment> {
    const ref = db.collection(collections.payments).doc(paymentId);
    if (!(await ref.get()).exists) throw new NotFoundError('Payment');

    await ref.update({
      status: 'PAID' as PaymentStatus,
      transactionId,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updated = await ref.get();
    return { id: updated.id, ...updated.data() } as unknown as Payment;
  }
}

export const paymentService = new PaymentService();
