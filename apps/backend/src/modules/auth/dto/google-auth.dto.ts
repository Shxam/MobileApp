import { IsNotEmpty, IsOptional, IsString, MaxLength, Matches, MinLength } from 'class-validator';

/**
 * Payload for `POST /api/v1/auth/google`.
 *
 * The client sends the Google ID token obtained from `@react-oauth/google`'s
 * `useGoogleLogin` / `GoogleLogin` component. The server verifies it
 * cryptographically with `google-auth-library` — the client never sends its own
 * claims, so a forged token cannot mint an IPL Dhaba session.
 */
export class GoogleAuthDto {
  @IsNotEmpty({ message: 'idToken is required' })
  @IsString()
  idToken: string;
}

/**
 * Payload for `PATCH /api/v1/auth/complete-profile`.
 *
 * Called after a successful Google sign-in when the user's profile is
 * incomplete (no phone number yet). The server updates `phone`, `name` and
 * `favoriteTeam` on the authenticated user.
 */
export class CompleteProfileDto {
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{9,14}$/, {
    message: 'phone must be a valid international phone number (e.g. +919876543210)',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  favoriteTeam?: string;
}