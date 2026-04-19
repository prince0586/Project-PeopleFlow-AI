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
let isPrimaryUnhealthy = false;
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');

if (fs.existsSync(firebaseConfigPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: config.projectId,
      });
      admin.firestore().settings({
        ignoreUndefinedProperties: true,
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
  
  if (useDefault || isPrimaryUnhealthy) return getFirestore(app);
  return firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
};

interface FirestoreError extends Error {
  code?: number;
}

/**
 * Executes a Firestore operation with an automatic fallback to the default database
 * if the primary instance returns PERMISSION_DENIED or NOT_FOUND errors.
 * 
 * @param operation - An async function that accepts a Firestore instance and returns a result.
 * @returns The result of the operation.
 * @throws The error from the second attempt if both fail.
 */
export const executeWithFirestoreFallback = async <T>(
  operation: (db: Firestore) => Promise<T>
): Promise<T> => {
  const db = getFirestoreDB();
  if (!db) throw new Error('Firestore not initialized');

  try {
    return await operation(db);
  } catch (error: unknown) {
    const err = error as FirestoreError;
    const errorMsg = (err.message || String(err)).toUpperCase();
    const isAccessError = errorMsg.includes('PERMISSION_DENIED') || 
                         errorMsg.includes('NOT_FOUND') ||
                         err.code === 5 || // NOT_FOUND
                         err.code === 7;   // PERMISSION_DENIED
    
    if (isAccessError && !isPrimaryUnhealthy) {
      const dbIdLabel = firestoreDatabaseId || '(default)';
      console.log(`[Firebase] Primary DB Instance [${dbIdLabel}] returned ${err.code || 'ACCESS_ERROR'}. Switching to fallback instance.`);
      isPrimaryUnhealthy = true;
      const defaultDb = getFirestoreDB(true);
      if (defaultDb) {
        return await operation(defaultDb);
      }
    }
    throw error;
  }
};

/**
 * Simple health check for Firestore connection.
 * 
 * @returns A Promise resolving to true if Firestore is responsive.
 */
export const checkFirestoreHealth = async (): Promise<boolean> => {
  try {
    const db = getFirestoreDB();
    if (!db) return false;
    await db.collection('_health').limit(1).get();
    return true;
  } catch (err) {
    return false;
  }
};
