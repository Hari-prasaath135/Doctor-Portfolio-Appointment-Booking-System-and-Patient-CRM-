import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { paymentService } from '../services/payment.service';
import { appointmentService } from '../services/appointment.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError, ForbiddenError, BadRequestError } from '../utils/errors';
import { logger } from '../utils/logger';
import { assertAppointmentAccess } from '../utils/appointment-access';

export class PaymentController {
  /**
   * POST /api/v1/payments/orders
   * Creates a Razorpay payment order for an authenticated patient's pending appointment.
   */
  async createOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const { appointmentId, idempotencyKey } = req.body;
      if (!appointmentId) {
        throw new BadRequestError('appointmentId is required');
      }

      const result = await paymentService.createRazorpayOrder({
        appointmentId,
        patientId: req.user.uid,
        idempotencyKey,
      });

      sendCreated(res, result, 'Payment order created');
    } catch (err: any) {
      logger.error('createOrder failed in controller', err);
      next(err);
    }
  }

  /**
   * POST /api/v1/payments/verify
   * Verifies Razorpay checkout signature and captured payment state.
   */
  async verifyPayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const { appointmentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

      if (!appointmentId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        throw new BadRequestError('Missing required payment verification parameters');
      }

      const result = await paymentService.verifyPayment({
        appointmentId,
        patientId: req.user.uid,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });

      sendSuccess(res, result, 'Payment verified and appointment confirmed');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/webhooks/razorpay
   * Ingests and processes Razorpay webhooks.
   * Public endpoint, verifies X-Razorpay-Signature HMAC header using raw body.
   */
  async handleRazorpayWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      if (!signature) {
        res.status(400).json({ error: 'Missing X-Razorpay-Signature header' });
        return;
      }

      const rawBody = (req as any).rawBody;
      if (!rawBody) {
        res.status(400).json({ error: 'Raw body required for webhook verification' });
        return;
      }

      const result = await paymentService.handleRazorpayWebhook(rawBody, signature, req.body);
      res.status(200).json({ received: true, ...result });
    } catch (err: any) {
      logger.error('Razorpay webhook processing error', err);
      // If signature invalid, 400; otherwise 200/500 depending on retry intent
      if (err instanceof BadRequestError) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Webhook processing error' });
    }
  }

  /**
   * GET /api/v1/payments/:id/status
   */
  async getPaymentStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const id = String(req.params.id);
      const payment = await paymentService.getPaymentById(id);
      const appointment = await appointmentService.getAppointmentById(payment.appointmentId);
      assertAppointmentAccess(req.user, appointment);

      sendSuccess(res, {
        id: payment.id,
        appointmentId: payment.appointmentId,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        orderId: payment.orderId,
        paymentId: payment.paymentId,
        paidAt: payment.paidAt,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/payments/appointment/:appointmentId
   * Only the appointment owner, assigned doctor, or an admin may view its payment.
   */
  async getPaymentByAppointment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const appointmentId = String(req.params.appointmentId);
      const appointment = await appointmentService.getAppointmentById(appointmentId);
      assertAppointmentAccess(req.user, appointment);

      const payment = await paymentService.getPaymentByAppointment(appointmentId);
      sendSuccess(res, payment);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/appointments/:id/status
   */
  async getAppointmentStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const id = String(req.params.id);
      const appt = await appointmentService.getAppointmentById(id);

      const userRole = req.user['role'];
      const userId = req.user.uid;

      if (userRole === 'PATIENT' && appt.patientId !== userId) {
        throw new ForbiddenError('You can only view your own appointments');
      }

      sendSuccess(res, {
        id: appt.id,
        status: appt.status,
        doctorId: appt.doctorId,
        date: appt.date,
        time: appt.time,
        serviceName: appt.serviceName,
        paymentId: appt.paymentId,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/appointments/cleanup-expired
   * Periodic or on-demand worker to release expired slot reservations.
   */
  async cleanupExpiredReservations(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await appointmentService.releaseExpiredReservations();
      sendSuccess(res, result, `Released ${result.releasedCount} expired slot reservations`);
    } catch (err) {
      next(err);
    }
  }
}

export const paymentController = new PaymentController();