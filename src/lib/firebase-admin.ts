import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import serviceAccount from "@/firebase-service-account.json";

let app: App;

if (!getApps().length) {
  app = initializeApp({
    credential: cert(serviceAccount as any),
  });
} else {
  app = getApps()[0];
}

export const adminDb = getFirestore(app);