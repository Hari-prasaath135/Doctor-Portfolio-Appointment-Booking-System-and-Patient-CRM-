import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { refundService } from '../services/refund.service';
import { appointmentService } from '../services/appointment.service';
import { notificationService } from '../services/notification.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

export class RefundController {
  /**
   * POST /api/v1/refunds
   * Requests a refund for a cancelled appointment.
   */
  async requestRefund(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const { appointmentId, reason } = req.body;

      const appointment = await appointmentService.getAppointmentById(
        appointmentId
      );

      // Only an Admin, Doctor, or the patient who owns this appointment may initiate a refund request
      const userRole = req.user['role'];
      const userId = req.user.uid;
      if (userRole === 'PATIENT' && appointment.patientId !== userId) {
        throw new ForbiddenError('You can only request refunds for your own appointments');
      }

      const refund = await refundService.processRefund(
        appointmentId,
        appointment.date,
        appointment.time,
        reason || 'Appointment cancelled'
      );

      if (refund.status === 'PROCESSED') {
        notificationService
          .createNotification(
            appointment.patientId,
            'REFUND_INITIATED',
            'Refund Initiated',
            `Refund of ₹${(refund.amount / 100).toFixed(2)} has been initiated and will be credited within 5-7 business days.`
          )
          .catch(() => {});
      }

      sendCreated(res, refund, 'Refund processed');
    } catch (err) {
      next(err);
    }
  }

  async getRefund(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const id = String(req.params.id);
      const refund = await refundService.getRefundById(id);

      const userRole = req.user['role'];
      const userId = req.user.uid;

      if (userRole === 'PATIENT') {
        const appointment = await appointmentService.getAppointmentById(refund.appointmentId);
        if (appointment.patientId !== userId) {
          throw new ForbiddenError('You can only view your own refund records');
        }
      }

      sendSuccess(res, refund);
    } catch (err) {
      next(err);
    }
  }

  async getRefundByAppointment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const appointmentId = String(req.params.appointmentId);
      const refund =
        await refundService.getRefundByAppointment(appointmentId);

      const userRole = req.user['role'];
      const userId = req.user.uid;

      if (userRole === 'PATIENT') {
        const appointment = await appointmentService.getAppointmentById(appointmentId);
        if (appointment.patientId !== userId) {
          throw new ForbiddenError('You can only view your own refund records');
        }
      }

      sendSuccess(res, refund);
    } catch (err) {
      next(err);
    }
  }
}

export const refundController = new RefundController();