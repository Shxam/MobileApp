// ===================================================
// IPL Dhaba Frontend — Firebase Client SDK Config
// Initializing Firebase App & Authentication Services
// ===================================================

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBQJMIawWA7VdJ3TkuL9Yuuo9dj0MsgTnQ',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'ipldhaba.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ipldhaba',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'ipldhaba.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '220974606382',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:220974606382:web:79a5963edbbe6c97add7bf',
};

// Initialize Firebase once
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
