import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth, DecodedIdToken } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app?: App;
  private auth?: Auth;
  private initialized = false;

  onModuleInit() {
    this.initFirebase();
  }

  private initFirebase() {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      this.app = existingApps[0];
      this.auth = getAuth(this.app);
      this.initialized = true;
      return;
    }

    try {
      const pathsToTry = [
        path.resolve(process.cwd(), 'firebase-service-account.json'),
        path.resolve(process.cwd(), 'apps/backend/firebase-service-account.json'),
      ];

      for (const serviceAccountPath of pathsToTry) {
        if (fs.existsSync(serviceAccountPath)) {
          const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
          if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
          }
          this.app = initializeApp({
            credential: cert(serviceAccount),
          });
          this.auth = getAuth(this.app);
          this.initialized = true;
          this.logger.log(`🔥 Firebase Admin initialized using service account: ${serviceAccountPath}`);
          return;
        }
      }

      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (projectId && clientEmail && privateKey) {
        this.app = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        this.auth = getAuth(this.app);
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
    return this.initialized || getApps().length > 0;
  }

  /**
   * Cryptographically verifies a client-provided Firebase ID token
   * @param idToken The JWT token produced by Firebase Client SDK on user sign-in
   * @returns Decoded token containing uid, phone_number, and user claims
   */
  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    if (!this.auth) {
      this.initFirebase();
    }
    if (!this.auth) {
      throw new Error('Firebase Admin SDK is not initialized. Check server credentials.');
    }
    return this.auth.verifyIdToken(idToken);
  }
}
