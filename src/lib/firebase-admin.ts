import { cert, getApp, getApps, initializeApp, type App, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function readServiceAccount(): ServiceAccount | undefined {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (json) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(json) as Record<string, unknown>;
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON.");
    }

    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON must include project_id, client_email, and private_key."
      );
    }

    return {
      projectId: String(parsed.project_id),
      clientEmail: String(parsed.client_email),
      privateKey: String(parsed.private_key).replace(/\\n/g, "\n"),
    };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  // Allows local development, CI builds, and deployed environments using
  // Application Default Credentials without requiring a committed JSON file.
  return undefined;
}

function getFirebaseAdminApp(): App {
  if (getApps().length) return getApp();

  const serviceAccount = readServiceAccount();
  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId || process.env.FIREBASE_PROJECT_ID,
    });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  return initializeApp(projectId ? { projectId } : {});
}

const app = getFirebaseAdminApp();

export const adminDb = getFirestore(app);
