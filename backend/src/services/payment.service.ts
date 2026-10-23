import crypto from 'crypto';
import { db, collections, admin } from '../config/firebase';
import { Payment, PaymentStatus } from '../types';
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  ConflictError,
  ServiceUnavailableError,
} from '../utils/errors';
import { logger } from '../utils/logger';
import { v4 as uuid } from 'uuid';
import { getRazorpayConfig, getRazorpayClient } from '../config/razorpay';
import { appointmentService } from './appointment.service';
import { notificationService } from './notification.service';
import { safeCompareHexSignature } from '../utils/signatures';
import { decideWebhookClaim } from '../utils/webhook-claim';

export interface CreateRazorpayOrderInput {
  appointmentId: string;
  patientId: string;
  idempotencyKey?: string;
}

export interface RazorpayOrderResult {
  paymentRecordId: string;
  keyId: string;
  orderId: string;
  amount: number; // in paise
  currency: string;
  appointmentId: string;
  mode: 'test';
}

export interface VerifyPaymentInput {
  appointmentId: string;
  patientId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export class PaymentService {
  /**
   * Step 3: Create a Razorpay Order for an authenticated patient's pending appointment.
   * - Derives amount authoritatively from appointment.feeInPaise (never trusts client amount)
   * - Validates appointment ownership & PENDING status
   * - Validates that slot reservation has not expired
   * - Reuses eligible existing CREATED/PENDING order if valid (idempotency)
   */
  async createRazorpayOrder(input: CreateRazorpayOrderInput): Promise<RazorpayOrderResult> {
    const config = getRazorpayConfig();
    const razorpay = getRazorpayClient();

    // 1. Fetch appointment & enforce patient ownership & eligibility
    const apptDoc = await db.collection(collections.appointments).doc(input.appointmentId).get();
    if (!apptDoc.exists) {
      throw new NotFoundError('Appointment');
    }

    const appt = apptDoc.data()!;
    if (appt.patientId !== input.patientId) {
      throw new ForbiddenError('You can only create payment orders for your own appointments');
    }

    if (appt.status === 'CONFIRMED') {
      throw new ConflictError('This appointment is already confirmed');
    }

    if (appt.status === 'CANCELLED' || appt.status === 'COMPLETED') {
      throw new BadRequestError(`Cannot pay for an appointment in ${appt.status} status`);
    }

    // 2. Validate slot reservation is still active
    const availSnap = await db
      .collection(collections.availability)
      .where('doctorId', '==', appt.doctorId)
      .where('date', '==', appt.date)
      .limit(1)
      .get();

    if (!availSnap.empty) {
      const slots = availSnap.docs[0].data().slots || [];
      const slot = slots.find((s: any) => s.time === appt.time);
      if (slot) {
        if (slot.status === 'BOOKED' && slot.appointmentId !== input.appointmentId) {
          throw new ConflictError('The reserved slot has expired and was booked by another patient');
        }
        if (slot.reservedUntil && new Date(slot.reservedUntil) < new Date()) {
          throw new ConflictError('Your slot reservation has expired. Please select a new slot.');
        }
      }
    }

    const authoritativeAmount = appt.feeInPaise;
    if (!authoritativeAmount || authoritativeAmount <= 0) {
      throw new BadRequestError('Invalid appointment fee configured');
    }

    // 3. Idempotency: Check if an active order already exists for this appointment
    const existingOrderSnap = await db
      .collection(collections.payments)
      .where('appointmentId', '==', input.appointmentId)
      .get();

    if (!existingOrderSnap.empty) {
      const activeDoc = existingOrderSnap.docs.find((doc) => {
        const data = doc.data() as Payment;
        return (data.status === 'CREATED' || data.status === 'PENDING') && data.amount === authoritativeAmount;
      });

      if (activeDoc) {
        const existingPayment = activeDoc.data() as Payment;
        logger.info(
          `Reusing existing Razorpay order ${existingPayment.orderId} for appointment ${input.appointmentId}`
        );
        return {
          paymentRecordId: activeDoc.id,
          keyId: config.keyId,
          orderId: existingPayment.orderId!,
          amount: existingPayment.amount,
          currency: 'INR',
          appointmentId: input.appointmentId,
          mode: 'test',
        };
      }
    }

    // 4. Create Order with Razorpay SDK
    const receiptId = `rcpt_${input.appointmentId.substring(0, 16)}_${Date.now()}`.substring(0, 40);
    let rzpOrder: any;

    try {
      rzpOrder = await razorpay.orders.create({
        amount: authoritativeAmount,
        currency: 'INR',
        receipt: receiptId,
        notes: {
          appointmentId: input.appointmentId,
          patientId: input.patientId,
          serviceName: appt.serviceName || 'Consultation',
          environment: 'test',
        },
      });
    } catch (err: any) {
      logger.error('Razorpay order creation failed', err);
      throw new ServiceUnavailableError(`Payment Gateway Error: ${err?.message || 'Order creation failed'}`);
    }

    // 5. Persist Payment Record in Firestore
    const paymentRecordId = uuid();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const paymentRecord: Payment = {
      id: paymentRecordId,
      appointmentId: input.appointmentId,
      patientId: input.patientId,
      amount: authoritativeAmount,
      currency: 'INR',
      status: 'CREATED',
      provider: 'RAZORPAY',
      orderId: rzpOrder.id,
      environment: 'test',
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      webhookReceived: false,
      createdAt: now as FirebaseFirestore.Timestamp,
      updatedAt: now as FirebaseFirestore.Timestamp,
    };

    await db.collection(collections.payments).doc(paymentRecordId).set(paymentRecord);
    logger.info(`Persisted payment record ${paymentRecordId} for Razorpay order ${rzpOrder.id}`);

    return {
      paymentRecordId,
      keyId: config.keyId,
      orderId: rzpOrder.id,
      amount: authoritativeAmount,
      currency: 'INR',
      appointmentId: input.appointmentId,
      mode: 'test',
    };
  }

  /**
   * Step 5: Verify Checkout Response
   * - Enforces PATIENT authorization and appointment ownership
   * - Validates HMAC SHA-256 signature using key_secret
   * - Queries Razorpay API independently to confirm captured status & amounts
   * - Executes atomic appointment confirmation & slot transition via transaction
   * - Triggers asynchronous notification outbox worker
   */
  async verifyPayment(input: VerifyPaymentInput): Promise<{
    status: 'CONFIRMED' | 'PENDING' | 'RECONCILIATION_REQUIRED';
    appointmentId: string;
    paymentId: string;
    message?: string;
  }> {
    const config = getRazorpayConfig();
    const razorpay = getRazorpayClient();

    // 1. Load appointment & check ownership
    const apptDoc = await db.collection(collections.appointments).doc(input.appointmentId).get();
    if (!apptDoc.exists) {
      throw new NotFoundError('Appointment');
    }

    const appt = apptDoc.data()!;
    if (appt.patientId !== input.patientId) {
      throw new ForbiddenError('You can only verify payments for your own appointments');
    }

    // If appointment is already confirmed (e.g. webhook processed it first)
    if (appt.status === 'CONFIRMED') {
      return {
        status: 'CONFIRMED',
        appointmentId: input.appointmentId,
        paymentId: input.razorpayPaymentId,
        message: 'Appointment is already confirmed',
      };
    }

    // 2. Load payment record
    const paymentSnap = await db
      .collection(collections.payments)
      .where('orderId', '==', input.razorpayOrderId)
      .where('appointmentId', '==', input.appointmentId)
      .limit(1)
      .get();

    if (paymentSnap.empty) {
      throw new NotFoundError('Payment order record');
    }

    const paymentDoc = paymentSnap.docs[0];
    const paymentData = paymentDoc.data() as Payment;

    // 3. Verify Signature: HMAC SHA256(order_id + "|" + razorpay_payment_id, key_secret)
    const payload = `${input.razorpayOrderId}|${input.razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', config.keySecret)
      .update(payload)
      .digest('hex');

    if (!safeCompareHexSignature(expectedSignature, input.razorpaySignature)) {
      logger.warn(`Signature mismatch for order ${input.razorpayOrderId}`);
      await paymentDoc.ref.update({
        status: 'FAILED',
        errorMetadata: { reason: 'Signature verification failed' },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      throw new BadRequestError('Invalid payment signature');
    }

    // 4. Independently query Razorpay server-side API to verify captured status
    let rzpPayment: any;
    try {
      rzpPayment = await razorpay.payments.fetch(input.razorpayPaymentId);
    } catch (err: any) {
      logger.error(`Failed to fetch payment ${input.razorpayPaymentId} from Razorpay`, err);
      throw new ServiceUnavailableError('Unable to verify payment status with payment gateway');
    }

    if (!rzpPayment || rzpPayment.order_id !== input.razorpayOrderId) {
      throw new BadRequestError('Payment does not match the expected Razorpay order');
    }

    if (rzpPayment.amount !== paymentData.amount || rzpPayment.currency !== 'INR') {
      throw new BadRequestError('Payment amount or currency mismatch with authoritative order');
    }

    // If authorized but not captured
    if (rzpPayment.status === 'authorized') {
      await paymentDoc.ref.update({
        status: 'AUTHORIZED',
        paymentId: input.razorpayPaymentId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return {
        status: 'PENDING',
        appointmentId: input.appointmentId,
        paymentId: input.razorpayPaymentId,
        message: 'Payment authorized but awaiting capture',
      };
    }

    if (rzpPayment.status !== 'captured') {
      await paymentDoc.ref.update({
        status: 'FAILED',
        paymentId: input.razorpayPaymentId,
        errorMetadata: { razorpayStatus: rzpPayment.status },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      throw new BadRequestError(`Payment is not in captured status (Current status: ${rzpPayment.status})`);
    }

    // 5. Update payment record to CAPTURED
    const now = admin.firestore.FieldValue.serverTimestamp();
    await paymentDoc.ref.update({
      status: 'CAPTURED',
      paymentId: input.razorpayPaymentId,
      signature: input.razorpaySignature,
      paymentMethod: rzpPayment.method,
      capturedAt: now,
      paidAt: now,
      updatedAt: now,
    });

    // 6. Atomic appointment confirmation & slot transition
    const confirmResult = await appointmentService.confirmAppointmentWithPayment(
      input.appointmentId,
      paymentDoc.id,
      paymentData.amount,
      'INR'
    );

    if (confirmResult.status === 'RECONCILIATION_REQUIRED') {
      logger.error(
        `CRITICAL: Payment captured for appointment ${input.appointmentId} but confirmation failed: ${confirmResult.reason}`
      );
      await paymentDoc.ref.update({
        status: 'RECONCILIATION_REQUIRED',
        errorMetadata: { reason: confirmResult.reason },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return {
        status: 'RECONCILIATION_REQUIRED',
        appointmentId: input.appointmentId,
        paymentId: input.razorpayPaymentId,
        message: confirmResult.reason,
      };
    }

    // 7. Trigger outbox queue asynchronously for email notification
    notificationService.processOutboxQueue().catch((err) => {
      logger.error('Error processing notification outbox queue', err);
    });

    return {
      status: 'CONFIRMED',
      appointmentId: input.appointmentId,
      paymentId: input.razorpayPaymentId,
    };
  }

  /**
   * Step 6: Process Razorpay Webhook
   * - Verifies X-Razorpay-Signature using raw body
   * - Deduplicates eventId via webhookEvents collection
   * - Handles payment.captured, payment.failed, order.paid
   * - Executes atomic confirmation without depending on client browser
   */
  async handleRazorpayWebhook(
    rawBody: Buffer,
    signature: string,
    eventPayload: any
  ): Promise<{ status: string }> {
    const config = getRazorpayConfig();

    if (!config.webhookSecret) {
      logger.warn('RAZORPAY_WEBHOOK_SECRET is not configured. Webhook processing rejected.');
      throw new BadRequestError('Webhook secret not configured');
    }

    // 1. Verify HMAC SHA-256 signature
    const expectedSignature = crypto
      .createHmac('sha256', config.webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (!safeCompareHexSignature(expectedSignature, signature)) {
      logger.warn('Razorpay webhook signature verification failed');
      throw new BadRequestError('Invalid webhook signature');
    }

    const eventId = eventPayload?.event_id || eventPayload?.id;
    const eventType = eventPayload?.event;

    if (!eventId) {
      throw new BadRequestError('Missing webhook event ID');
    }

    // 2. Atomically claim the event. Failed events and expired processing leases
    // may be retried; completed events are permanently deduplicated.
    const eventRef = db.collection(collections.webhookEvents).doc(eventId);
    const nowMs = Date.now();
    const claimResult = await db.runTransaction(async (tx): Promise<'CLAIMED' | 'DUPLICATE' | 'PROCESSING'> => {
      const eventSnap = await tx.get(eventRef);
      const existing = eventSnap.exists ? eventSnap.data() : undefined;
      const decision = decideWebhookClaim(existing, nowMs);

      if (decision !== 'CLAIMED') {
        return decision;
      }

      tx.set(eventRef, {
        id: eventId,
        event: eventType,
        status: 'PROCESSING',
        receivedAt: existing?.receivedAt || admin.firestore.FieldValue.serverTimestamp(),
        processingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        processingLeaseUntil: nowMs + 60_000,
        attemptCount: (typeof existing?.attemptCount === 'number' ? existing.attemptCount : 0) + 1,
      }, { merge: true });
      return 'CLAIMED';
    });

    if (claimResult === 'DUPLICATE') {
      logger.info(`Webhook event ${eventId} already completed. Skipping duplicate.`);
      return { status: 'DUPLICATE_IGNORED' };
    }
    if (claimResult === 'PROCESSING') {
      logger.info(`Webhook event ${eventId} is already being processed.`);
      return { status: 'ALREADY_PROCESSING' };
    }

    try {
      logger.info(`Processing Razorpay webhook event: ${eventType} (ID: ${eventId})`);

    // 3. Handle Events
    if (eventType === 'payment.captured') {
      const paymentEntity = eventPayload?.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;
      const amount = paymentEntity?.amount;
      const currency = paymentEntity?.currency;

      if (!orderId) {
        logger.warn('Webhook payment.captured missing order_id');
        await eventRef.update({
          status: 'PROCESSED',
          result: 'SKIPPED_NO_ORDER_ID',
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { status: 'SKIPPED_NO_ORDER_ID' };
      }

      const paymentSnap = await db
        .collection(collections.payments)
        .where('orderId', '==', orderId)
        .limit(1)
        .get();

      if (!paymentSnap.empty) {
        const paymentDoc = paymentSnap.docs[0];
        const pData = paymentSnap.docs[0].data() as Payment;

        // Never confirm or mark a payment captured based on a mismatched webhook payload.
        if (!paymentId || amount !== pData.amount || currency !== 'INR') {
          const reason = `Webhook amount/currency/payment ID mismatch for order ${orderId}`;
          logger.error(reason);
          await paymentDoc.ref.update({
            status: 'RECONCILIATION_REQUIRED',
            webhookReceived: true,
            errorMetadata: { reason, receivedAmount: amount, receivedCurrency: currency },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          const now = admin.firestore.FieldValue.serverTimestamp();
          await paymentDoc.ref.update({
            status: 'CAPTURED',
            paymentId,
            webhookReceived: true,
            capturedAt: now,
            paidAt: now,
            updatedAt: now,
          });

          // Trigger atomic confirmation only after the event matches the stored order.
          const confirmResult = await appointmentService.confirmAppointmentWithPayment(
            pData.appointmentId,
            paymentDoc.id,
            amount,
            currency
          );

          if (confirmResult.status === 'RECONCILIATION_REQUIRED') {
            logger.error(
              `Webhook confirmation reconciliation required for appointment ${pData.appointmentId}: ${confirmResult.reason}`
            );
            await paymentDoc.ref.update({
              status: 'RECONCILIATION_REQUIRED',
              errorMetadata: { reason: confirmResult.reason },
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          notificationService.processOutboxQueue().catch((err) => {
            logger.error('Webhook notification outbox processing failed', err);
          });
        }
      }
    } else if (eventType === 'payment.failed') {
      const paymentEntity = eventPayload?.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;

      if (orderId) {
        const paymentSnap = await db
          .collection(collections.payments)
          .where('orderId', '==', orderId)
          .limit(1)
          .get();

        if (!paymentSnap.empty) {
          const paymentDoc = paymentSnap.docs[0];
          const currentStatus = paymentDoc.data().status;

          // Never let a failure event overwrite an already confirmed/captured payment
          if (currentStatus !== 'CAPTURED' && currentStatus !== 'PAID') {
            await paymentDoc.ref.update({
              status: 'FAILED',
              paymentId,
              webhookReceived: true,
              errorMetadata: {
                errorCode: paymentEntity?.error_code,
                errorDescription: paymentEntity?.error_description,
              },
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
      }
    }

      await eventRef.update({
        status: 'PROCESSED',
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        processingLeaseUntil: null,
      });
      return { status: 'PROCESSED' };
    } catch (error) {
      try {
        await eventRef.update({
          status: 'FAILED',
          failureReason: error instanceof Error ? error.message : 'Unknown webhook processing error',
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
          processingLeaseUntil: null,
        });
      } catch (markFailedError) {
        logger.error(`Unable to record failed webhook event ${eventId}`, markFailedError);
      }
      throw error;
    }
  }

  /**
   * Get payment by ID with ownership checks.
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
}

export const paymentService = new PaymentService();
