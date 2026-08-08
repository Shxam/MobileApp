import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private initialized = false;

  private get sdk(): any {
    return (admin as any).default || admin;
  }

  onModuleInit() {
    this.initFirebase();
  }

  private initFirebase() {
    const firebaseAdmin = this.sdk;
    if (firebaseAdmin.apps && firebaseAdmin.apps.length > 0) {
      this.initialized = true;
      return;
    }

    try {
      // Strategy 1: Look for firebase-service-account.json file in root
      const serviceAccountPath = path.resolve(process.cwd(), 'firebase-service-account.json');

      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        firebaseAdmin.initializeApp({
          credential: firebaseAdmin.credential.cert(serviceAccount),
        });
        this.initialized = true;
        this.logger.log('🔥 Firebase Admin initialized using service account file');
        return;
      }

      // Strategy 2: Use environment variables
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (projectId && clientEmail && privateKey) {
        firebaseAdmin.initializeApp({
          credential: firebaseAdmin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        this.initialized = true;
        this.logger.log('🔥 Firebase Admin initialized using environment variables');
        return;
      }

      this.logger.warn('⚠️ Firebase Admin credential missing. Set FIREBASE_* env vars or provide firebase-service-account.json');
    } catch (err: any) {
      this.logger.error(`Failed to initialize Firebase Admin SDK: ${err.message}`);
    }
  }

  public isConfigured(): boolean {
    const firebaseAdmin = this.sdk;
    return this.initialized || (Boolean(firebaseAdmin.apps) && firebaseAdmin.apps.length > 0);
  }

  /**
   * Cryptographically verifies a client-provided Firebase ID token
   * @param idToken The JWT token produced by Firebase Client SDK on user sign-in
   * @returns Decoded token containing uid, phone_number, and user claims
   */
  async verifyIdToken(idToken: string): Promise<any> {
    const firebaseAdmin = this.sdk;
    if (!this.isConfigured()) {
      throw new Error('Firebase Admin SDK is not initialized. Check server credentials.');
    }
    return firebaseAdmin.auth().verifyIdToken(idToken);
  }
}
