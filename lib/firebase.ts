import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Import the Firebase configuration from the local config file
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app, firebaseConfig.storageBucket);

// Set shorter retry times to prevent long "stuck" states (default is 10 mins)
storage.maxUploadRetryTime = 30000; // 30 seconds
storage.maxOperationRetryTime = 30000; // 30 seconds

export default app;
