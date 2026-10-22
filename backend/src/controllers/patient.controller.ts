import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { patientService } from '../services/patient.service';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export class PatientController {
  async createPatient(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const patient = await patientService.createPatient(
        req.user.uid,
        req.body
      );

      sendCreated(res, patient, 'Patient profile created');
    } catch (err) {
      next(err);
    }
  }

  async getPatient(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);

      // Patients can only view their own profile; doctors/admins can view any
      const patient = await patientService.getPatientById(id);

      if (req.user?.['role'] === 'PATIENT' && patient.uid !== req.user.uid) {
        throw new ForbiddenError();
      }

      sendSuccess(res, patient);
    } catch (err) {
      next(err);
    }
  }

  async getMyProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const patient = await patientService.getPatientByUid(req.user.uid);

      sendSuccess(res, patient);
    } catch (err) {
      next(err);
    }
  }

  async updatePatient(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);

      const patient = await patientService.getPatientById(id);

      if (req.user?.['role'] === 'PATIENT' && patient.uid !== req.user.uid) {
        throw new ForbiddenError();
      }

      const updated = await patientService.updatePatient(id, req.body);

      sendSuccess(res, updated, 'Patient profile updated');
    } catch (err) {
      next(err);
    }
  }

  async listPatients(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = '1', limit = '20' } = req.query as Record<string, string>;

      const result = await patientService.listPatients({
        page: parseInt(page),
        limit: parseInt(limit),
      });

      sendPaginated(res, result);
    } catch (err) {
      next(err);
    }
  }
}

export const patientController = new PatientController();