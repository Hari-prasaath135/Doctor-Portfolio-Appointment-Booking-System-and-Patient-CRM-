import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { paymentService } from '../services/payment.service';
import { appointmentService } from '../services/appointment.service';
import { notificationService } from '../services/notification.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';

export class PaymentController {
  /**
   * POST /api/v1/payments/order
   * Creates a Pinelabs payment order for an appointment.
   */
  async createOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const { appointmentId, amountInPaise, billingInfo } = req.body;

      const result = await paymentService.createPaymentOrder(
        appointmentId,
        req.user.uid,
        amountInPaise,
        billingInfo
      );

      sendCreated(res, result, 'Payment order created');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/payments/webhook
   * Receives Pinelabs payment status callbacks.
   * Must be publicly accessible (no auth middleware).
   */
  async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.info('Pinelabs webhook received');

      await paymentService.handleWebhook(
        req.body as Record<string, unknown>
      );

      // After successful payment, confirm appointment
      const merchantTxnId = (
        req.body as Record<string, unknown>
      ).unique_merchant_transaction_id as string;

      const payment = await paymentService['getPaymentByAppointment'](
        merchantTxnId.split('_')[1]
      );

      if (payment?.status === 'PAID') {
        await appointmentService.confirmAppointment(payment.appointmentId);

        notificationService
          .createNotification(
            payment.patientId,
            'PAYMENT_SUCCESS',
            'Payment Confirmed',
            `Your payment of ₹${(payment.amount / 100).toFixed(2)} has been received and your appointment is confirmed.`
          )
          .catch(() => {});
      }

      res.status(200).json({ received: true });
    } catch (err) {
      logger.error('Webhook processing error', err);

      // Always respond 200 to Pinelabs to prevent retries
      res.status(200).json({
        received: true,
        error: 'Processing failed',
      });

      next(err);
    }
  }

  /**
   * GET /api/v1/payments/:id
   */
  async getPayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const id = String(req.params.id);
      const payment = await paymentService.getPaymentById(id);

      const userRole = req.user['role'];
      const userId = req.user.uid;

      if (userRole === 'PATIENT' && payment.patientId !== userId) {
        throw new ForbiddenError('You can only view your own payment records');
      }

      sendSuccess(res, payment);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/payments/appointment/:appointmentId
   */
  async getPaymentByAppointment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const appointmentId = String(req.params.appointmentId);
      const payment =
        await paymentService.getPaymentByAppointment(appointmentId);

      const userRole = req.user['role'];
      const userId = req.user.uid;

      if (payment && userRole === 'PATIENT' && payment.patientId !== userId) {
        throw new ForbiddenError('You can only view your own payment records');
      }

      sendSuccess(res, payment);
    } catch (err) {
      next(err);
    }
  }
}

export const paymentController = new PaymentController();