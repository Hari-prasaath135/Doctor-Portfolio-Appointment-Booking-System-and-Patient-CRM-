import { auth, db, collections } from '../config/firebase';
import { admin } from '../config/firebase';
import { UserProfile, UserRole } from '../types';
import { NotFoundError, ConflictError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Authentication Service
 *
 * Responsibilities:
 * - Verify Firebase ID tokens (handled by middleware, but exposed here for reuse)
 * - Get or create user Firestore profiles on first sign-in
 * - Assign custom claims (roles) to Firebase users
 */
export class AuthService {
  /**
   * Get user profile from Firestore, or create one if it doesn't exist (first login).
   */
  async getOrCreateProfile(
    uid: string,
    email: string,
    name?: string,
    emailVerified?: boolean
  ): Promise<UserProfile> {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const configuredDoctorEmail = (process.env.DOCTOR_EMAIL || '').trim().toLowerCase();
    const configuredAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

    // Authoritative role resolution from server configuration:
    // Only emails that match the server-side configuration AND have verified email ownership can receive privileged roles.
    let role: UserRole = 'PATIENT';
    if (emailVerified !== false && normalizedEmail) {
      if (configuredAdminEmail && normalizedEmail === configuredAdminEmail) {
        role = 'ADMIN';
      } else if (configuredDoctorEmail && normalizedEmail === configuredDoctorEmail) {
        role = 'DOCTOR';
      }
    }

    const userRef = db.collection(collections.users).doc(uid);
    const snap = await userRef.get();

    if (snap.exists) {
      const existingData = snap.data() || {};
      const currentRole = existingData.role as UserRole;

      // Enforce synchronization: If environment configuration specifies ADMIN or DOCTOR,
      // or if an unconfigured user previously had a privileged role, sync it authoritatively.
      let finalRole: UserRole = currentRole || 'PATIENT';
      if (role === 'ADMIN' || role === 'DOCTOR') {
        finalRole = role;
      } else if (currentRole === 'ADMIN' && normalizedEmail !== configuredAdminEmail) {
        // Demote if no longer configured as admin
        finalRole = 'PATIENT';
      } else if (currentRole === 'DOCTOR' && normalizedEmail !== configuredDoctorEmail) {
        // Demote if no longer configured as doctor
        finalRole = 'PATIENT';
      }

      if (finalRole !== currentRole) {
        await this.setUserRole(uid, finalRole);
      }

      return { id: snap.id, ...existingData, role: finalRole } as unknown as UserProfile;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const profile: Omit<UserProfile, 'uid'> & { uid: string } = {
      uid,
      email: normalizedEmail,
      name: name || normalizedEmail.split('@')[0] || 'User',
      role,
      isActive: true,
      createdAt: now as FirebaseFirestore.Timestamp,
      updatedAt: now as FirebaseFirestore.Timestamp,
    };

    await userRef.set(profile);
    logger.info(`Created new user profile: uid=${uid}, email=${normalizedEmail}, role=${role}`);

    // Assign the custom claim matching the authoritative role
    await this.setUserRole(uid, role);

    return { ...profile, uid } as unknown as UserProfile;
  }

  /**
   * Retrieve an existing user profile.
   */
  async getUserProfile(uid: string): Promise<UserProfile> {
    const snap = await db.collection(collections.users).doc(uid).get();

    if (!snap.exists) {
      throw new NotFoundError('User profile');
    }

    return { uid: snap.id, ...snap.data() } as unknown as UserProfile;
  }

  /**
   * Assign a role custom claim to a Firebase Auth user and update Firestore.
   */
  async setUserRole(uid: string, role: UserRole): Promise<void> {
    // Set Firebase custom claim
    await auth.setCustomUserClaims(uid, { role });

    // Update Firestore profile
    await db.collection(collections.users).doc(uid).update({
      role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`Assigned role ${role} to uid=${uid}`);
  }

  /**
   * Revoke all refresh tokens for a user (force sign-out).
   */
  async revokeTokens(uid: string): Promise<void> {
    await auth.revokeRefreshTokens(uid);
    logger.warn(`Revoked tokens for uid=${uid}`);
  }

  /**
   * Deactivate a user account (does not delete; sets isActive=false and disables Auth account).
   */
  async deactivateUser(uid: string): Promise<void> {
    await Promise.all([
      auth.updateUser(uid, { disabled: true }),
      db.collection(collections.users).doc(uid).update({
        isActive: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }),
    ]);
    logger.warn(`Deactivated user uid=${uid}`);
  }

  /**
   * Check if a user already exists in Firestore.
   */
  async userExists(uid: string): Promise<boolean> {
    const snap = await db.collection(collections.users).doc(uid).get();
    return snap.exists;
  }

  /**
   * Create a new user in Firebase Auth + Firestore with an explicit role.
   * Used by admin to create doctor accounts.
   */
  async createUser(
    email: string,
    password: string,
    name: string,
    role: UserRole
  ): Promise<UserProfile> {
    // Check if email is already registered
    try {
      await auth.getUserByEmail(email);
      throw new ConflictError(`A user with email ${email} already exists`);
    } catch (err: unknown) {
      const fbErr = err as { code?: string };
      if (fbErr.code !== 'auth/user-not-found') throw err;
    }

    const userRecord = await auth.createUser({ email, password, displayName: name });
    return this.getOrCreateProfile(userRecord.uid, email, name).then(async (profile) => {
      await this.setUserRole(userRecord.uid, role);
      return { ...profile, role };
    });
  }
}

export const authService = new AuthService();