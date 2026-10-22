import { Response, NextFunction } from 'express';
import { auth, db } from '../config/firebase';
import { AuthenticatedRequest } from '../types';
import { UnauthorizedError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Authentication Middleware
 *
 * Flow:
 *   Frontend → sends Firebase ID Token in Authorization: Bearer <token>
 *         ↓
 *   auth.middleware → verifies token via Firebase Admin SDK
 *         ↓
 *   attaches decoded token (uid, email, custom claims) to req.user
 *         ↓
 *   controller runs with trusted user identity
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No authentication token provided');
    }

    const idToken = authHeader.substring(7); // Strip "Bearer "

    if (!idToken) {
      throw new UnauthorizedError('Empty authentication token');
    }

    // Verify the ID token using Firebase Admin SDK
    const decodedToken = await auth.verifyIdToken(idToken, true);

    // Attach decoded token to request. Custom claims (role) are included.
    const userObj = decodedToken as NonNullable<AuthenticatedRequest['user']>;
    if (!userObj['role']) {
      // In case custom claims are not yet set or propagated on the token,
      // fallback to user's profile role from database
      try {
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();
        if (userDoc.exists) {
          userObj['role'] = userDoc.data()?.role || 'PATIENT';
        } else {
          userObj['role'] = 'PATIENT';
        }
      } catch {
        userObj['role'] = 'PATIENT';
      }
    }
    req.user = userObj;

    logger.debug(`Authenticated request — uid: ${decodedToken.uid}, role: ${userObj['role']}`);

    next();
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      next(error);
      return;
    }

    // Firebase token verification failures
    const firebaseError = error as { code?: string; message?: string };
    if (
      firebaseError.code === 'auth/id-token-expired' ||
      firebaseError.code === 'auth/id-token-revoked'
    ) {
      next(new UnauthorizedError('Authentication token has expired. Please sign in again.'));
    } else if (firebaseError.code === 'auth/argument-error') {
      next(new UnauthorizedError('Invalid authentication token format'));
    } else {
      logger.error('Token verification failed', error);
      next(new UnauthorizedError('Authentication failed'));
    }
  }
}

/**
 * Optional authentication — attaches user if token present, but does not block.
 * Use on public endpoints that behave differently for logged-in users.
 */
export async function optionalAuthenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  try {
    const idToken = authHeader.substring(7);
    const decodedToken = await auth.verifyIdToken(idToken, true);
    req.user = decodedToken as AuthenticatedRequest['user'];
  } catch {
    // Silently ignore — optional auth failure is non-blocking
  }
  next();
}
