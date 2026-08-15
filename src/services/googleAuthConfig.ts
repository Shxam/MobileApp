// ===================================================
// IPL Dhaba Frontend — Google OAuth Configuration
//
// Initializes the GoogleOAuthProvider with the Google Client ID.
// The Client ID comes from VITE_GOOGLE_CLIENT_ID (defaults to the
// IPL Dhaba development app in Google Cloud Console).
// ===================================================

export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

/**
 * True when a Google Client ID has been configured.
 *
 * The UI hides the "Sign in with Google" button when this is false rather
 * than throwing at render time, so local development without the env var
 * still shows the Firebase fallback.
 */
export const isGoogleAuthConfigured = GOOGLE_CLIENT_ID.length > 0;