import { initializeApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

let firestore: Firestore | null = null;

const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');

if (fs.existsSync(firebaseConfigPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    const app = initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      appId: config.appId,
    });
    
    // Initialize Firestore with the specific database ID
    firestore = getFirestore(app, config.firestoreDatabaseId || '(default)');
    console.log(`[Firebase Client] Initialized for project: ${config.projectId}, database: ${config.firestoreDatabaseId || '(default)'}`);
  } catch (err) {
    console.error('[Firebase Client] Failed to initialize:', err);
  }
}

export const getFirestoreClient = () => firestore;
