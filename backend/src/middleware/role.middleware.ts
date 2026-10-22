import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserRole } from '../types';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

/**
 * Role-based Authorization Middleware factory.
 *
 * Flow:
 *   Authenticated User
 *         ↓
 *   requireRole('ADMIN') or requireAnyRole('DOCTOR', 'ADMIN')
 *         ↓
 *   Check role custom claim on req.user
 *         ↓
 *   Allow or deny request
 *
 * Usage:
 *   router.get('/admin/stats', authenticate, requireRole('ADMIN'), controller)
 *   router.post('/appointments', authenticate, requireAnyRole('PATIENT', 'ADMIN'), controller)
 */

/**
 * Require exactly one role.
 */
export function requireRole(role: UserRole) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const userRole = req.user['role'] as UserRole | undefined;

    if (!userRole) {
      next(new ForbiddenError('Your account has no role assigned. Contact support.'));
      return;
    }

    if (userRole !== role) {
      next(
        new ForbiddenError(
          `Access restricted to ${role} accounts. Your role: ${userRole}`
        )
      );
      return;
    }

    next();
  };
}

/**
 * Require any one of the listed roles (OR logic).
 */
export function requireAnyRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const userRole = req.user['role'] as UserRole | undefined;

    if (!userRole) {
      next(new ForbiddenError('Your account has no role assigned. Contact support.'));
      return;
    }

    if (!roles.includes(userRole)) {
      next(
        new ForbiddenError(
          `Access restricted to: ${roles.join(', ')}. Your role: ${userRole}`
        )
      );
      return;
    }

    next();
  };
}

/**
 * Require ADMIN role shorthand.
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Require DOCTOR role shorthand.
 */
export const requireDoctor = requireRole('DOCTOR');

/**
 * Require DOCTOR or ADMIN.
 */
export const requireDoctorOrAdmin = requireAnyRole('DOCTOR', 'ADMIN');
