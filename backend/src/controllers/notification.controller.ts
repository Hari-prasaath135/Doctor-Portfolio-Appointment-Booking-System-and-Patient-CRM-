import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { notificationService } from '../services/notification.service';
import { sendSuccess } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';

export class NotificationController {
  async getMyNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const notifications = await notificationService.getUserNotifications(
        req.user.uid
      );

      sendSuccess(res, notifications);
    } catch (err) {
      next(err);
    }
  }

  async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const id = String(req.params.id);

      await notificationService.markAsRead(id, req.user.uid);

      sendSuccess(res, null, 'Notification marked as read');
    } catch (err) {
      next(err);
    }
  }

  async markAllAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      await notificationService.markAllAsRead(req.user.uid);

      sendSuccess(res, null, 'All notifications marked as read');
    } catch (err) {
      next(err);
    }
  }
}

export const notificationController = new NotificationController();