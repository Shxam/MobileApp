import { Injectable, Logger, UnauthorizedException, BadRequestException, Inject } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { JwtService } from '@nestjs/jwt';
import { env } from '../../common/config/env';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthUserProfile } from './auth.service';
import { refreshKey } from './token-keys';

const REFRESH_TTL_SECONDS = 7 * 86400;

/**
 * Server-side Google ID token verification.
 *
 * The client obtains a Google ID token via `@react-oauth/google`'s
 * `useGoogleLogin` / `GoogleLogin` and sends it to `POST /api/v1/auth/google`.
 * This service verifies the token cryptographically with `google-auth-library`
 * against Google's public keys — the client never sends its own claims, so a
 * forged token cannot mint an IPL Dhaba session.
 */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly client: OAuth2Client;

  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(RedisService) private readonly redisService: RedisService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {
    // The OAuth2Client is constructed with the Google Client ID so that
    // `verifyIdToken` checks the `aud` claim against it. If the env var is
    // missing, verification will fail with a clear error rather than silently
    // accepting any token.
    this.client = new OAuth2Client(env.googleClientId);
  }

  /**
   * Verifies a Google ID token and upserts the user.
   *
   * Returns the same shape as `AuthService.verifyFirebaseToken` so the
   * controller can hand the response straight to the client.
   */
  async authenticateWithGoogle(
    idToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: AuthUserProfile }> {
    let payload;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: env.googleClientId,
      });
      payload = ticket.getPayload();
    } catch (err: any) {
      this.logger.error(`Google ID Token verification failed: ${err.message}`);
      throw new UnauthorizedException('Invalid or expired Google authentication token');
    }

    if (!payload) {
      throw new UnauthorizedException('Google token contained no identity claims');
    }

    const email = payload.email?.toLowerCase();
    const name = payload.name?.trim() || 'IPL Dhaba Fan';
    const avatar = payload.picture || null;

    if (!email) {
      throw new BadRequestException('Google account does not have a verified email address');
    }

    // Upsert by email — this is the stable identity for Google OAuth.
    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Check if a user with this email already exists under a different
      // identity (e.g. a Firebase phone-auth user who later signs in with
      // Google). Link the Google email to that existing account.
      const byFirebaseUid = payload.sub
        ? await this.prisma.user.findUnique({ where: { firebaseUid: payload.sub } })
        : null;

      if (byFirebaseUid) {
        user = await this.prisma.user.update({
          where: { id: byFirebaseUid.id },
          data: { email, avatar, name },
        });
        this.logger.log(`Linked Google email to existing user ${user.id}`);
      } else {
        user = await this.prisma.user.create({
          data: {
            email,
            name,
            avatar,
            // `phone` is intentionally null until the customer completes the
            // onboarding step. `favoriteTeam` is also null until then.
            role: 'customer',
          },
        });
        this.logger.log(`Created new customer user ${user.id} via Google OAuth`);
      }
    } else {
      // Existing user — refresh their avatar and name from Google.
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          ...(avatar ? { avatar } : {}),
          ...(name && name !== 'IPL Dhaba Fan' ? { name } : {}),
        },
      });
    }

    const tokens = await this.generateTokens(user.id, user.phone ?? '', user.role, user.dhabaId);
    return { ...tokens, user: await this.buildProfile(user.id) };
  }

  /**
   * Completes the onboarding step: phone number + favorite team.
   *
   * Called after a successful Google sign-in when the user's profile is
   * incomplete. The server validates the phone format and updates the user.
   */
  async completeProfile(
    userId: string,
    dto: { phone?: string; name?: string; favoriteTeam?: string },
  ): Promise<AuthUserProfile> {
    const data: { phone?: string; name?: string; favoriteTeam?: string } = {};

    if (dto.phone) {
      // Normalise to E.164 (+91...)
      const raw = dto.phone.replace(/[\s-]/g, '');
      const normalized = raw.startsWith('+') ? raw : `+${raw}`;
      data.phone = normalized;
    }

    if (dto.name !== undefined && dto.name.trim().length >= 2) {
      data.name = dto.name.trim();
    }

    if (dto.favoriteTeam !== undefined) {
      const team = dto.favoriteTeam.trim();
      if (team.length > 0) data.favoriteTeam = team;
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.user.update({ where: { id: userId }, data });
    }

    return this.buildProfile(userId);
  }

  /**
   * Builds the client-facing profile — mirrors `AuthService.buildProfile` but
   * also includes `email` and `avatar`.
   */
  async buildProfile(userId: string): Promise<AuthUserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true, fanPoints: true, staffCredential: true },
    });
    if (!user) throw new UnauthorizedException('Account no longer exists');

    return {
      id: user.id,
      name: user.name ?? 'IPL Dhaba Fan',
      phone: user.phone ?? '',
      email: user.email ?? undefined,
      avatar: user.avatar ?? undefined,
      favoriteTeam: user.favoriteTeam,
      walletBalancePaise: user.wallet?.balancePaise ?? 0,
      fanPoints: user.fanPoints?.balance ?? 0,
      role: user.role,
      dhabaId: user.dhabaId ?? null,
      employeeId: user.employeeId ?? null,
      isLoggedIn: true,
      ...(user.staffCredential ? { mustChangePin: user.staffCredential.mustChangePin } : {}),
      createdAt: user.createdAt.toISOString(),
    };
  }

  private async generateTokens(
    userId: string,
    phone: string,
    role: string = 'customer',
    dhabaId?: string | null,
  ) {
    const accessPayload = { sub: userId, phone, role, dhabaId: dhabaId ?? null, type: 'access' as const };
    const refreshPayload = { sub: userId, phone, type: 'refresh' as const };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: env.jwtSecret,
      expiresIn: env.jwtAccessTtl,
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: env.jwtRefreshSecret,
      expiresIn: env.jwtRefreshTtl,
    });

    await this.redisService.set(refreshKey(refreshToken), userId, REFRESH_TTL_SECONDS);

    return { accessToken, refreshToken };
  }
}