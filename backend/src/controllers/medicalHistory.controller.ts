import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { medicalHistoryService } from '../services/medicalHistory.service';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export class MedicalHistoryController {
  async addRecord(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const record = await medicalHistoryService.addRecord({
        ...req.body,
        // If a patient is submitting their own record, ensure patientId is theirs
        patientId: req.user['role'] === 'PATIENT'
          ? req.user.uid
          : req.body.patientId,
      });

      sendCreated(res, record, 'Medical record added');
    } catch (err) {
      next(err);
    }
  }

  async getRecord(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const id = String(req.params.id);

      const record = await medicalHistoryService.getRecordById(id);

      // Enforce access control for patients
      if (req.user['role'] === 'PATIENT' && record.patientId !== req.user.uid) {
        throw new ForbiddenError('You can only view your own medical records');
      }

      sendSuccess(res, record);
    } catch (err) {
      next(err);
    }
  }

  async getPatientHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const patientId = String(req.params.patientId);

      if (req.user['role'] === 'PATIENT' && patientId !== req.user.uid) {
        throw new ForbiddenError('You can only view your own medical records');
      }

      const records = req.query.type
        ? await medicalHistoryService.getPatientHistoryByType(
            patientId,
            req.query.type as any
          )
        : await medicalHistoryService.getPatientHistory(patientId);

      sendSuccess(res, records);
    } catch (err) {
      next(err);
    }
  }

  async updateRecord(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const id = String(req.params.id);

      // Check if patient owns the record before updating
      if (req.user['role'] === 'PATIENT') {
        const existing = await medicalHistoryService.getRecordById(id);

        if (existing.patientId !== req.user.uid) {
          throw new ForbiddenError('You can only update your own medical records');
        }
      }

      const updated = await medicalHistoryService.updateRecord(id, req.body);

      sendSuccess(res, updated, 'Medical record updated');
    } catch (err) {
      next(err);
    }
  }

  async deleteRecord(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const id = String(req.params.id);

      if (req.user['role'] === 'PATIENT') {
        const existing = await medicalHistoryService.getRecordById(id);

        if (existing.patientId !== req.user.uid) {
          throw new ForbiddenError('You can only delete your own medical records');
        }
      }

      await medicalHistoryService.deleteRecord(id);

      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  }
}

export const medicalHistoryController = new MedicalHistoryController();