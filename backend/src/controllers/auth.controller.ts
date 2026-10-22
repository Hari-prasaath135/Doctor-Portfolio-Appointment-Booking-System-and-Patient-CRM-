import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { authService } from '../services/auth.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';

export class AuthController {
  /**
   * POST /api/v1/auth/verify
   * Verifies the token (already done by middleware) and returns user profile.
   * Creates the profile on first login.
   */
  async verify(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();
      const profile = await authService.getOrCreateProfile(
        req.user.uid,
        req.user.email || '',
        req.user.name as string | undefined,
        req.user.email_verified
      );
      sendSuccess(res, profile, 'Authenticated');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/auth/me
   * Returns the current user's profile.
   */
  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();
      const profile = await authService.getUserProfile(req.user.uid);
      sendSuccess(res, profile);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/register
   * Registers a new user (admin creates doctor accounts).
   */
  async register(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, name, role } = req.body;
      const user = await authService.createUser(email, password, name, role);
      sendCreated(res, user, 'User created successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/revoke
   * Revokes all tokens for the current user (force sign-out on all devices).
   */
  async revokeTokens(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();
      await authService.revokeTokens(req.user.uid);
      sendSuccess(res, null, 'All sessions have been revoked');
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
