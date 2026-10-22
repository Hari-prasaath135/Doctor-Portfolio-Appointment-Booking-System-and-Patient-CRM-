import { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/analytics.service';
import { sendCreated } from '../utils/response';
import { ValidationError } from '../utils/errors';

export class AnalyticsController {
  /**
   * POST /api/v1/analytics/events
   * Accepts first-party privacy-safe website interaction events.
   * Anonymous, no PII collected, payload size limited.
   */
  async recordEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventType, path, sessionId, consultationType, outcome, eventId } = req.body;

      if (!eventType || typeof eventType !== 'string') {
        throw new ValidationError('eventType is required');
      }

      // Enforce payload constraints: reject any payload attempting to attach PII
      const forbiddenFields = [
        'name',
        'email',
        'phone',
        'password',
        'dateOfBirth',
        'medicalHistory',
        'attachments',
        'role',
        'uid',
      ];
      for (const field of forbiddenFields) {
        if (req.body[field] !== undefined) {
          throw new ValidationError(`Forbidden field in analytics payload: ${field}`);
        }
      }

      const recorded = await analyticsService.recordEvent({
        eventType,
        path: typeof path === 'string' ? path : '/',
        sessionId: typeof sessionId === 'string' ? sessionId : undefined,
        consultationType: typeof consultationType === 'string' ? consultationType : undefined,
        outcome: outcome === 'success' || outcome === 'failure' ? outcome : undefined,
        eventId: typeof eventId === 'string' ? eventId : undefined,
      });

      res.status(200).json({
        success: true,
        data: { id: recorded.id, eventType: recorded.eventType },
        deduplicated: (recorded as any).deduplicated ?? false,
        message: (recorded as any).deduplicated ? 'Event already recorded' : 'Event recorded successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}

export const analyticsController = new AnalyticsController();
