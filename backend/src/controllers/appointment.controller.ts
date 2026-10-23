import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { appointmentService } from '../services/appointment.service';
import { notificationService } from '../services/notification.service';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { resolveDoctorId } from '../utils/identity';

export class AppointmentController {
  /**
   * POST /api/v1/appointments
   * Creates an appointment using a Firestore transaction (prevents double booking).
   */
  async createAppointment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !req.user.uid) {
        throw new UnauthorizedError('Authentication token required to reserve an appointment');
      }

      const patientId = req.user.uid;
      const verifiedEmail = req.user.email || req.body.email;

      const appointment = await appointmentService.createAppointment({
        ...req.body,
        patientId,
        email: verifiedEmail,
      });

      // Fire-and-forget notification
      if (req.user?.uid) {
        notificationService
          .createNotification(
            req.user.uid,
            'APPOINTMENT_BOOKED',
            'Slot Reserved (Pending Payment)',
            `Your slot for ${appointment.serviceName} on ${appointment.date} at ${appointment.time} is held. Please complete payment to confirm.`,
            { appointmentId: appointment.id }
          )
          .catch(() => {});
      }

      sendCreated(res, appointment, 'Appointment slot reserved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/appointments
   * Role-filtered: patients see their own, doctors see their own, admins see all.
   */
  async listAppointments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const { page = '1', limit = '20', status } =
        req.query as Record<string, string>;

      const role = req.user['role'];

      const result = await appointmentService.listAppointments({
        page: parseInt(page),
        limit: parseInt(limit),
        status: status as never,
        patientId:
          role === 'PATIENT'
            ? req.user.uid
            : req.query.patientId as string | undefined,
        doctorId:
          role === 'DOCTOR'
            ? req.user.uid
            : req.query.doctorId as string | undefined,
      });

      sendPaginated(res, result);
    } catch (err) {
      next(err);
    }
  }

  async getAppointment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const id = String(req.params.id);
      const appointment = await appointmentService.getAppointmentById(id);

      const userRole = req.user['role'];
      const userId = req.user.uid;

      // Patients can only view their own appointments; doctors can only view appointments assigned to them; admins can view all.
      if (userRole === 'PATIENT' && appointment.patientId !== userId) {
        throw new ForbiddenError('You can only view your own appointment records');
      }
      if (userRole === 'DOCTOR' && appointment.doctorId !== resolveDoctorId(req.user)) {
        throw new ForbiddenError('You can only view appointments assigned to you');
      }

      sendSuccess(res, appointment);
    } catch (err) {
      next(err);
    }
  }

  async confirmAppointment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();
      const id = String(req.params.id);
      if (req.user.role === 'DOCTOR') {
        const existing = await appointmentService.getAppointmentById(id);
        if (existing.doctorId !== resolveDoctorId(req.user)) {
          throw new ForbiddenError('You can only confirm appointments assigned to you');
        }
      }

      const appointment = await appointmentService.confirmAppointment(id);

      sendSuccess(res, appointment, 'Appointment confirmed');
    } catch (err) {
      next(err);
    }
  }

  async completeAppointment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();
      const id = String(req.params.id);
      if (req.user.role === 'DOCTOR') {
        const existing = await appointmentService.getAppointmentById(id);
        if (existing.doctorId !== resolveDoctorId(req.user)) {
          throw new ForbiddenError('You can only complete appointments assigned to you');
        }
      }

      const appointment = await appointmentService.completeAppointment(id);

      sendSuccess(res, appointment, 'Appointment marked as completed');
    } catch (err) {
      next(err);
    }
  }

  async cancelAppointment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const id = String(req.params.id);
      const { reason = 'Cancelled by user' } = req.body;

      const existingAppointment = await appointmentService.getAppointmentById(id);
      const userRole = req.user['role'];
      const userId = req.user.uid;

      if (userRole === 'PATIENT' && existingAppointment.patientId !== userId) {
        throw new ForbiddenError('You can only cancel your own appointments');
      }
      if (userRole === 'DOCTOR' && existingAppointment.doctorId !== resolveDoctorId(req.user)) {
        throw new ForbiddenError('You can only cancel appointments assigned to you');
      }

      const appointment = await appointmentService.cancelAppointment(
        id,
        reason
      );

      notificationService
        .createNotification(
          req.user.uid,
          'APPOINTMENT_CANCELLED',
          'Appointment Cancelled',
          `Your appointment on ${appointment.date} has been cancelled.`
        )
        .catch(() => {});

      sendSuccess(res, appointment, 'Appointment cancelled');
    } catch (err) {
      next(err);
    }
  }

  async rescheduleAppointment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const id = String(req.params.id);
      const { newDate, newTime, reason } = req.body;

      const existingAppointment = await appointmentService.getAppointmentById(id);
      const userRole = req.user['role'];
      const userId = req.user.uid;

      if (userRole === 'PATIENT' && existingAppointment.patientId !== userId) {
        throw new ForbiddenError('You can only reschedule your own appointments');
      }
      if (userRole === 'DOCTOR' && existingAppointment.doctorId !== userId) {
        throw new ForbiddenError('You can only reschedule appointments assigned to you');
      }

      const appointment = await appointmentService.rescheduleAppointment(id, {
        newDate,
        newTime,
        reason,
      });

      sendSuccess(res, appointment, 'Appointment rescheduled');
    } catch (err) {
      next(err);
    }
  }
}

export const appointmentController = new AppointmentController();