import { ForbiddenError } from './errors';

/**
 * Prevent one authenticated user from mutating another user's notification.
 */
export function assertNotificationOwner(
  notificationUserId: unknown,
  authenticatedUserId: string
): void {
  if (!authenticatedUserId || notificationUserId !== authenticatedUserId) {
    throw new ForbiddenError('You can only mark your own notifications as read');
  }
}
