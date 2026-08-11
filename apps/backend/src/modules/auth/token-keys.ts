import { createHash } from 'crypto';

/**
 * Redis key derivation for tokens, shared by the issuer and the verifier.
 *
 * This lives in its own module because it previously did not: `AuthService`
 * hashed the token before writing the blocklist key, while `JwtStrategy` looked
 * the key up using the raw token. The two never collided, so `POST /auth/logout`
 * reported success and the revoked access token kept working until it expired.
 *
 * Tokens are never stored verbatim — a Redis dump would otherwise hand out
 * usable credentials.
 */
export function tokenKey(prefix: string, token: string): string {
  return `${prefix}:${createHash('sha256').update(token).digest('hex')}`;
}

/** Key under which a revoked access or refresh token is recorded. */
export function blocklistKey(token: string): string {
  return tokenKey('blocklist:token', token);
}

/** Key under which an issued refresh token is tracked for rotation. */
export function refreshKey(token: string): string {
  return tokenKey('refresh', token);
}
