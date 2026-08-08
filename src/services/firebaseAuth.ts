// ===================================================
// IPL Dhaba Frontend — Firebase Phone Authentication Service
// Encapsulates Firebase Web SDK Phone Auth Flow (Invisible reCAPTCHA, OTP, ID Tokens)
// ===================================================

import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  ConfirmationResult,
  UserCredential,
} from 'firebase/auth';
import { auth } from './firebaseConfig';

export class FirebaseAuthService {
  /**
   * Initializes invisible reCAPTCHA verifier for Phone Auth
   * @param containerId HTML element ID where reCAPTCHA will render (e.g. 'recaptcha-container')
   */
  public static createRecaptchaVerifier(containerId: string): RecaptchaVerifier {
    // Clear any existing verifier on window if re-rendered
    if ((window as any).recaptchaVerifier) {
      try {
        (window as any).recaptchaVerifier.clear();
      } catch {
        // ignore clear error
      }
    }

    const verifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved — allow signInWithPhoneNumber
      },
      'expired-callback': () => {
        // Response expired — ask user to solve reCAPTCHA again
      },
    });

    (window as any).recaptchaVerifier = verifier;
    return verifier;
  }

  /**
   * Sends phone OTP using Firebase Phone Auth
   * @param phoneNumber E.164 formatted phone number (+919876543210)
   * @param appVerifier RecaptchaVerifier instance
   */
  public static async sendPhoneOtp(
    phoneNumber: string,
    appVerifier: RecaptchaVerifier
  ): Promise<ConfirmationResult> {
    return signInWithPhoneNumber(auth, phoneNumber, appVerifier);
  }

  /**
   * Confirms 6-digit OTP code with Firebase and obtains UserCredential
   */
  public static async confirmOtp(
    confirmationResult: ConfirmationResult,
    otp: string
  ): Promise<UserCredential> {
    return confirmationResult.confirm(otp);
  }

  /**
   * Obtains current Firebase ID token cryptographically signed by Firebase
   */
  public static async getCurrentIdToken(userCredential?: UserCredential): Promise<string> {
    const user = userCredential?.user || auth.currentUser;
    if (!user) {
      throw new Error('No authenticated Firebase user found');
    }
    return user.getIdToken(/* forceRefresh */ true);
  }

  /**
   * Signs out user from Firebase Auth client SDK
   */
  public static async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch {
      // ignore logout errors if unauthenticated
    }
  }
}
