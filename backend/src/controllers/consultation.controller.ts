import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { consultationService } from '../services/consultation.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';

export class ConsultationController {
  async createConsultation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const consultation = await consultationService.createConsultation(req.body);

      sendCreated(res, consultation, 'Consultation created');
    } catch (err) {
      next(err);
    }
  }

  async getConsultation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);

      const consultation = await consultationService.getConsultationById(id);

      sendSuccess(res, consultation);
    } catch (err) {
      next(err);
    }
  }

  async getConsultationByAppointment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const appointmentId = String(req.params.appointmentId);

      const consultation =
        await consultationService.getConsultationByAppointment(appointmentId);

      sendSuccess(res, consultation);
    } catch (err) {
      next(err);
    }
  }

  async updateConsultation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const id = String(req.params.id);

      const consultation = await consultationService.updateConsultation(
        id,
        req.user.uid,
        req.body
      );

      sendSuccess(res, consultation, 'Consultation updated');
    } catch (err) {
      next(err);
    }
  }

  async completeConsultation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const id = String(req.params.id);

      const consultation =
        await consultationService.completeConsultation(id, req.user.uid);

      sendSuccess(res, consultation, 'Consultation completed');
    } catch (err) {
      next(err);
    }
  }

  async getMyConsultations(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const role = req.user['role'];

      const consultations =
        role === 'DOCTOR'
          ? await consultationService.getConsultationsByDoctor(req.user.uid)
          : await consultationService.getConsultationsByPatient(req.user.uid);

      sendSuccess(res, consultations);
    } catch (err) {
      next(err);
    }
  }
}

export const consultationController = new ConsultationController();