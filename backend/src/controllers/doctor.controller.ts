import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { doctorService } from '../services/doctor.service';
import { sendSuccess, sendCreated, sendPaginated, sendNoContent } from '../utils/response';

export class DoctorController {
  async createDoctor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const doctor = await doctorService.createDoctor(req.body);
      sendCreated(res, doctor, 'Doctor profile created');
    } catch (err) {
      next(err);
    }
  }

  async getDoctor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);

      const doctor = await doctorService.getDoctorById(id);
      sendSuccess(res, doctor);
    } catch (err) {
      next(err);
    }
  }

  async listDoctors(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = '1', limit = '20' } = req.query as Record<string, string>;

      const result = await doctorService.listDoctors({
        page: parseInt(page),
        limit: parseInt(limit),
      });

      sendPaginated(res, result);
    } catch (err) {
      next(err);
    }
  }

  async updateDoctor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);

      const updated = await doctorService.updateDoctor(id, req.body);
      sendSuccess(res, updated, 'Doctor profile updated');
    } catch (err) {
      next(err);
    }
  }

  async deactivateDoctor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);

      await doctorService.deactivateDoctor(id);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  }
}

export const doctorController = new DoctorController();