import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  // Prefer explicit service-account credentials in hosted environments.
  // Application Default Credentials remain available for local/cloud environments
  // that provide them through the standard Google credential mechanism.
  const credential =
    projectId && clientEmail && privateKey
      ? cert({ projectId, clientEmail, privateKey })
      : applicationDefault();

  return initializeApp({
    credential,
    ...(projectId ? { projectId } : {}),
  });
}

export const adminDb = getFirestore(getAdminApp());
