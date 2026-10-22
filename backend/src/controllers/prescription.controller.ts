import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { prescriptionService } from '../services/prescription.service';
import { notificationService } from '../services/notification.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';

export class PrescriptionController {
  async createPrescription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const prescription = await prescriptionService.createPrescription(
        req.user.uid,
        req.body
      );

      notificationService
        .createNotification(
          prescription.patientId,
          'PRESCRIPTION_CREATED',
          'Prescription Issued',
          'Your doctor has issued a new prescription. Please check your prescriptions.'
        )
        .catch(() => {});

      sendCreated(res, prescription, 'Prescription created');
    } catch (err) {
      next(err);
    }
  }

  async getPrescription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);

      const prescription =
        await prescriptionService.getPrescriptionById(id);

      sendSuccess(res, prescription);
    } catch (err) {
      next(err);
    }
  }

  async getPatientPrescriptions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = String(req.params.patientId);

      const prescriptions =
        await prescriptionService.getPrescriptionsByPatient(patientId);

      sendSuccess(res, prescriptions);
    } catch (err) {
      next(err);
    }
  }

  async updatePrescription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const id = String(req.params.id);

      const prescription =
        await prescriptionService.updatePrescription(
          id,
          req.user.uid,
          req.body
        );

      sendSuccess(res, prescription, 'Prescription updated');
    } catch (err) {
      next(err);
    }
  }
}

export const prescriptionController = new PrescriptionController();