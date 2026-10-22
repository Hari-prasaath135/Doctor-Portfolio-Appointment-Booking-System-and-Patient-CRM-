import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { availabilityService } from '../services/availability.service';
import { sendSuccess } from '../utils/response';

export class AvailabilityController {
  async setAvailability(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { doctorId, date, slots } = req.body;
      const availability = await availabilityService.setAvailability(doctorId, date, slots);
      sendSuccess(res, availability, 'Availability set');
    } catch (err) { next(err); }
  }

  async createSchedule(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const availability = await availabilityService.createOrUpdateSchedule(req.body);
      sendSuccess(res, availability, 'Schedule configured successfully');
    } catch (err) { next(err); }
  }

  async togglePublish(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { doctorId, date, isPublished } = req.body;
      const availability = await availabilityService.togglePublishSchedule(doctorId, date, Boolean(isPublished));
      sendSuccess(res, availability, `Schedule ${isPublished ? 'published' : 'unpublished'} successfully`);
    } catch (err) { next(err); }
  }

  async blockSlot(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { doctorId, date, time, isBlocked = true, reason } = req.body;
      const availability = await availabilityService.blockSlot(doctorId, date, time, isBlocked, reason);
      sendSuccess(res, availability, `Slot ${time} ${isBlocked ? 'blocked' : 'unblocked'} successfully`);
    } catch (err) { next(err); }
  }

  async markLeave(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dates = await availabilityService.markDoctorLeave(req.body);
      sendSuccess(res, { updatedDates: dates }, 'Doctor leave marked successfully');
    } catch (err) { next(err); }
  }

  async getAvailability(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { doctorId, date } = req.query as { doctorId: string; date: string };
      const full = await availabilityService.getAvailability(doctorId, date);
      const freeSlots = await availabilityService.getFreeSlots(doctorId, date);
      sendSuccess(res, {
        doctorId,
        date,
        isPublished: full?.isPublished ?? true,
        isLeave: full?.isLeave ?? false,
        consultationTypes: full?.consultationTypes ?? [],
        slots: full?.slots ?? [],
        freeSlots,
      });
    } catch (err) { next(err); }
  }

  async getAvailableDates(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { doctorId, from, to } = req.query as Record<string, string>;
      const dates = await availabilityService.getAvailableDates(doctorId, from, to);
      sendSuccess(res, { doctorId, availableDates: dates });
    } catch (err) { next(err); }
  }
}

export const availabilityController = new AvailabilityController();
