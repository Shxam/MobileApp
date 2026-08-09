import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as firebaseAdmin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private initialized = false;

  private get admin(): any {
    return (firebaseAdmin as any).default || firebaseAdmin;
  }

  onModuleInit() {
    this.initFirebase();
  }

  private initFirebase() {
    const adminSDK = this.admin;
    const apps = adminSDK.apps || (adminSDK.default && adminSDK.default.apps);
    if (apps && apps.length > 0) {
      this.initialized = true;
      return;
    }

    try {
      const serviceAccountPath = path.resolve(process.cwd(), 'firebase-service-account.json');

      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        if (serviceAccount.private_key) {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        const certFn = adminSDK.credential?.cert || (adminSDK.default && adminSDK.default.credential && adminSDK.default.credential.cert);
        const initFn = adminSDK.initializeApp || (adminSDK.default && adminSDK.default.initializeApp);

        if (initFn && certFn) {
          initFn({ credential: certFn(serviceAccount) });
          this.initialized = true;
          this.logger.log('🔥 Firebase Admin initialized using service account file');
          return;
        }
      }

      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (projectId && clientEmail && privateKey) {
        const certFn = adminSDK.credential?.cert || (adminSDK.default && adminSDK.default.credential && adminSDK.default.credential.cert);
        const initFn = adminSDK.initializeApp || (adminSDK.default && adminSDK.default.initializeApp);

        if (initFn && certFn) {
          initFn({
            credential: certFn({
              projectId,
              clientEmail,
              privateKey,
            }),
          });
          this.initialized = true;
          this.logger.log('🔥 Firebase Admin initialized using environment variables');
          return;
        }
      }

      this.logger.warn('⚠️ Firebase Admin credential missing. Set FIREBASE_* env vars or provide firebase-service-account.json');
    } catch (err: any) {
      this.logger.error(`Failed to initialize Firebase Admin SDK: ${err.message}`);
    }
  }

  public isConfigured(): boolean {
    const adminSDK = this.admin;
    const apps = adminSDK.apps || (adminSDK.default && adminSDK.default.apps);
    return this.initialized || (Boolean(apps) && apps.length > 0);
  }

  /**
   * Cryptographically verifies a client-provided Firebase ID token
   * @param idToken The JWT token produced by Firebase Client SDK on user sign-in
   * @returns Decoded token containing uid, phone_number, and user claims
   */
  async verifyIdToken(idToken: string): Promise<any> {
    const adminSDK = this.admin;
    const authFn = adminSDK.auth || (adminSDK.default && adminSDK.default.auth);
    if (!this.isConfigured() || !authFn) {
      throw new Error('Firebase Admin SDK is not initialized. Check server credentials.');
    }
    return authFn().verifyIdToken(idToken);
  }
}
