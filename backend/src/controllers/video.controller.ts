import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { videoService } from '../services/video.service';
import { appointmentService } from '../services/appointment.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

export class VideoController {
  /**
   * POST /api/v1/video/:appointmentId/create
   * Creates a Zoom meeting for a confirmed appointment.
   */
  async createMeeting(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const appointmentId = String(req.params.appointmentId);

      const appointment = await appointmentService.getAppointmentById(
        appointmentId
      );

      const meeting = await videoService.createMeeting(
        appointmentId,
        appointment.date,
        appointment.time,
        `Consultation with Dr. Vijay — ${appointment.serviceName}`,
        30
      );

      // Attach meeting to appointment
      await appointmentService.attachMeeting(
        appointmentId,
        meeting.id
      );

      sendCreated(res, meeting, 'Meeting created');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/video/:appointmentId
   * Retrieves meeting details for an appointment.
   */
  async getMeeting(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const appointmentId = String(req.params.appointmentId);
      const userRole = req.user['role'];
      const userId = req.user.uid;

      if (userRole === 'PATIENT') {
        const appointment = await appointmentService.getAppointmentById(appointmentId);
        if (appointment.patientId !== userId) {
          throw new ForbiddenError('You can only view meetings for your own appointments');
        }
      }

      const meeting =
        await videoService.getMeetingByAppointment(appointmentId);

      sendSuccess(res, meeting);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/video/:appointmentId
   * Deletes a Zoom meeting (on appointment cancellation).
   */
  async deleteMeeting(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const appointmentId = String(req.params.appointmentId);

      const meeting =
        await videoService.getMeetingByAppointment(appointmentId);

      if (meeting) {
        await videoService.deleteMeeting(meeting.id);
      }

      sendSuccess(res, null, 'Meeting deleted');
    } catch (err) {
      next(err);
    }
  }
}

export const videoController = new VideoController();