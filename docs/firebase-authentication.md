# Firebase Phone Authentication Guide — IPL Dhaba Super App

This document covers setup, architecture, environment variables, local testing, and production deployment for Firebase Phone Authentication in the IPL Dhaba Super App codebase.

---

## 1. Architectural Overview

```
User (Web Client)
  ↓ 1. Enter Phone (+91 XXXXXXXXXX)
Firebase Web SDK (signInWithPhoneNumber)
  ↓ 2. Invisible reCAPTCHA verification + SMS OTP delivery
User Phone (Receives 6-digit SMS OTP)
  ↓ 3. Enter OTP code
Firebase Web SDK (confirmationResult.confirm(otp))
  ├─► Returns Firebase Authenticated User
  └─► Obtains Cryptographically Signed Firebase ID Token
        ↓ 4. POST /api/v1/auth/firebase { idToken, name, favoriteTeam }
NestJS Backend (Port 3001)
  ↓ 5. verifyIdToken(idToken) via Firebase Admin SDK
  ↓ 6. Lookup/Upsert User in PostgreSQL (Neon DB)
  ↓ 7. Issue Application JWT Pair (Access Token 15m + Refresh Token 7d)
User Authenticated (IPL Dhaba Super App Session Active)
```

---

## 2. Firebase Console Configuration (Manual Setup Steps)

To complete Firebase Phone Authentication configuration in your project:

### Step A: Enable Phone Sign-in Provider
1. Go to the [Firebase Console](https://console.firebase.google.com/project/ipldhaba).
2. Select your project `ipldhaba`.
3. In the left navigation, click **Authentication** → **Sign-in method** tab.
4. Click **Phone** under Native providers → enable **Phone** toggle → click **Save**.

### Step B: Configure Authorized Domains
1. In Firebase Console, go to **Authentication** → **Settings** → **Authorized domains**.
2. Ensure `localhost` is listed.
3. Add your production domain (e.g. `ipldhaba.com` or your Cloud Run / Vercel domain).

### Step C: Add Test Phone Numbers for Automated & Local Testing
1. In Firebase Console, go to **Authentication** → **Sign-in method** → scroll down to **Phone numbers for testing**.
2. Click **Add test phone number**.
3. Add phone number: `+919876543210`
4. Add verification code: `123456`
5. Click **Save**.
*(Now you can sign in with `+919876543210` and OTP `123456` locally without sending actual SMS).*

---

## 3. Environment Variables Configuration

### Backend Credentials (`.env` & `.env.production`) — **PRIVATE**
> [!CAUTION]
> **NEVER** expose Firebase Admin credentials, private keys, or service-account JSON in client bundles or public repositories.

```env
# Firebase Admin SDK (Backend Private Secrets)
GOOGLE_APPLICATION_CREDENTIALS=firebase-service-account.json
FIREBASE_PROJECT_ID=ipldhaba
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@ipldhaba.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Frontend Configuration (`.env`) — **PUBLIC**
```env
# Firebase Web Client SDK Configuration (Vite Public Frontend)
VITE_FIREBASE_API_KEY=AIzaSyDemoApiKeyForIPLDhabaApp2026
VITE_FIREBASE_AUTH_DOMAIN=ipldhaba.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ipldhaba
VITE_FIREBASE_STORAGE_BUCKET=ipldhaba.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=115362447382
VITE_FIREBASE_APP_ID=1:115362447382:web:demoappkey123
```

---

## 4. API Endpoints

### Exchange Firebase Token for Application JWT
- **Route**: `POST /api/v1/auth/firebase`
- **Auth**: Public (No Bearer token required)
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "idToken": "FIREBASE_ID_TOKEN_JWT_HERE",
  "name": "Rahul Sharma",
  "favoriteTeam": "RCB"
}
```
- **Response** (200 OK):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_919876543210",
    "phone": "+919876543210",
    "name": "Rahul Sharma",
    "favoriteTeam": "RCB",
    "role": "customer"
  }
}
```

### Authentication Health Check Status
- **Route**: `GET /health`
- **Response**:
```json
{
  "status": "UP",
  "checks": {
    "database": { "status": "HEALTHY" },
    "cache": { "status": "HEALTHY" },
    "firebase": "configured"
  }
}
```

---

## 5. Security & OWASP Protections

1. **No Client-Provided Identity Trust**: The backend NEVER accepts `phoneVerified: true` or `userId` directly from client requests. All identities are decoded from cryptographically verified Firebase ID tokens using `firebaseAdmin.auth().verifyIdToken(idToken)`.
2. **Role Safety**: New users authenticated via Firebase default to `role: 'customer'`. Operational roles (`admin`, `kitchen_staff`, `delivery_partner`) require explicit PIN authentication via `POST /api/v1/auth/staff-login`.
3. **No OTP Storage**: OTPs are generated and validated entirely by Firebase infrastructure. Zero OTPs are stored in PostgreSQL or Redis.
4. **Git Safety**: `firebase-service-account.json` and `.env*` secrets are excluded from source control in `.gitignore`.
