import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Firebase Admin SDK initializer.
 *
 * Supports two credential strategies:
 * 1. GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service-account JSON file.
 * 2. Inline env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.
 */
function initializeFirebase(): admin.app.App {
  // Avoid re-initializing if already done (e.g., hot-reload)
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // The private key may contain escaped newlines (\n) from the env file
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  let credential: admin.credential.Credential;

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Strategy 1: Service-account file path
    credential = admin.credential.applicationDefault();
  } else if (projectId && clientEmail && privateKey) {
    // Strategy 2: Inline env vars
    credential = admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    });
  } else {
    throw new Error(
      'Firebase Admin credentials not configured. ' +
        'Set GOOGLE_APPLICATION_CREDENTIALS or ' +
        'FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.'
    );
  }

  return admin.initializeApp({
    credential,
    projectId: projectId || undefined,
  });
}

// Initialize on module load
initializeFirebase();

/** Firestore database instance */
export const db = admin.firestore();

/** Firebase Auth instance */
export const auth = admin.auth();

/** Firebase Admin namespace (for FieldValue, Timestamp, etc.) */
export { admin };

// ─── Firestore Collection References ──────────────────────────────────────────

export const collections = {
  users: 'users',
  doctors: 'doctors',
  patients: 'patients',
  appointments: 'appointments',
  payments: 'payments',
  refunds: 'refunds',
  consultations: 'consultations',
  prescriptions: 'prescriptions',
  medicalHistory: 'medicalHistory',
  patientQueries: 'patientQueries',
  notifications: 'notifications',
  availability: 'availability',
  meetingDetails: 'meetingDetails',
  analytics: 'analytics',
  enquiries: 'enquiries',
  webhookEvents: 'webhookEvents',
  notificationOutbox: 'notificationOutbox',
} as const;
