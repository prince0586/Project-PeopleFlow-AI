/**
 * Firestore Database Service (Server-side)
 * 
 * Handles the initialization of the Firebase Admin SDK and provides access to the
 * Firestore database instance. It automatically detects the configuration from
 * firebase-applet-config.json.
 */
import admin from 'firebase-admin';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let firestoreDatabaseId: string | undefined;
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');

if (fs.existsSync(firebaseConfigPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: config.projectId,
      });
      console.log(`[Firebase] Admin SDK initialized for project: ${config.projectId}`);
    }
    firestoreDatabaseId = config.firestoreDatabaseId;
    console.log(`[Firebase] Using Firestore Database: ${firestoreDatabaseId || '(default)'}`);
  } catch (err) {
    console.error('[Firebase] Failed to parse config or initialize admin SDK:', err);
  }
} else {
  console.warn('[Firebase] firebase-applet-config.json not found. Firestore will be unavailable.');
}

/**
 * Helper to get the Firestore instance with the correct database ID.
 * 
 * @returns The Firestore database instance or null if the SDK is not initialized.
 */
export const getFirestoreDB = (useDefault: boolean = false): Firestore | null => {
  if (!admin.apps.length) return null;
  const app = admin.app();
  if (useDefault) return getFirestore(app);
  return firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
};
