import { Injectable, UnauthorizedException, BadRequestException, Logger, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { env } from '../../common/config/env';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FirebaseAdminService } from '../../common/firebase/firebase-admin.service';
import { FirebaseAuthDto } from './dto/firebase-auth.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { blocklistKey, refreshKey } from './token-keys';

export interface TokenPayload {
  sub: string;
  phone: string;
  type: 'access' | 'refresh';
}

const REFRESH_TTL_SECONDS = 7 * 86400;
const ACCESS_BLOCKLIST_TTL_SECONDS = 86400;

/** Wrong-PIN attempts before a staff account locks. */
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MINUTES = 15;
const PIN_SALT_ROUNDS = 10;

/**
 * A real bcrypt hash of a value no PIN can be, compared against when the
 * employee id is unknown. Without it, an unknown id returns immediately while a
 * known one pays ~100 ms of bcrypt, which enumerates valid employee ids.
 */
const DUMMY_PIN_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8e1dMTBLu5Ux/gWvNkGrEBAWU0Fm9C';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(RedisService) private readonly redisService: RedisService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FirebaseAdminService) private readonly firebaseAdmin: FirebaseAdminService,
  ) {}

  /**
   * 1. Authenticate user via Firebase ID Token (Phone Auth)
   * Client performs Firebase Phone OTP verification, obtains Firebase ID Token,
   * and sends it here for cryptographic verification.
   */
  async verifyFirebaseToken(dto: FirebaseAuthDto): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    let decodedToken;
    try {
      decodedToken = await this.firebaseAdmin.verifyIdToken(dto.idToken);
    } catch (err: any) {
      this.logger.error(`Firebase ID Token verification failed: ${err.message}`);
      throw new UnauthorizedException('Invalid or expired Firebase authentication token');
    }

    const firebaseUid = decodedToken.uid;
    const rawPhone = decodedToken.phone_number;

    if (!rawPhone) {
      throw new BadRequestException('Firebase user does not have a verified phone number');
    }

    // Standardize phone number format (+919876543210)
    const phone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;

    // NOTE: database errors are deliberately NOT caught here. A previous
    // version fabricated an in-memory user on failure, which turned a database
    // outage into a successful login for anyone.
    let user = await this.prisma.user.findUnique({ where: { firebaseUid } });

    if (!user) {
      const byPhone = await this.prisma.user.findUnique({ where: { phone } });
      if (byPhone) {
        user = await this.prisma.user.update({
          where: { id: byPhone.id },
          data: {
            firebaseUid,
            ...(dto.name ? { name: dto.name.trim() } : {}),
            ...(dto.favoriteTeam ? { favoriteTeam: dto.favoriteTeam } : {}),
          },
        });
        this.logger.log(`Linked Firebase UID to existing user ${user.id}`);
      }
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          firebaseUid,
          phone,
          name: dto.name?.trim() || 'IPL Dhaba Fan',
          favoriteTeam: dto.favoriteTeam || 'RCB',
          role: 'customer',
        },
      });
      this.logger.log(`Created new customer user ${user.id} via Firebase Auth`);
    }

    const tokens = await this.generateTokens(user.id, phone, user.role, user.dhabaId);

    return { ...tokens, user };
  }

  /**
   * 2. Refresh Token Rotation
   *
   * The role is re-read from the database rather than trusted from the token,
   * so a role change (or a deleted account) takes effect on the next refresh.
   */
  async refreshToken(dto: RefreshTokenDto): Promise<{ accessToken: string; refreshToken: string }> {
    const revokedKey = blocklistKey(dto.refreshToken);
    if (await this.redisService.get(revokedKey)) {
      throw new UnauthorizedException('Refresh token has been revoked or logout occurred');
    }

    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(dto.refreshToken, {
        secret: env.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Single-use: the token must still be the one we issued and have not been
    // rotated already.
    const issuedKey = refreshKey(dto.refreshToken);
    const issuedFor = await this.redisService.get(issuedKey);
    if (!issuedFor || issuedFor !== payload.sub) {
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }

    // Blocklist and consume the old refresh token (rotation)
    await this.redisService.set(revokedKey, 'revoked', REFRESH_TTL_SECONDS);
    await this.redisService.del(issuedKey);

    // Role comes from the database, not the incoming token. The previous
    // implementation omitted it entirely, silently downgrading every staff
    // member to `customer` on refresh.
    return this.generateTokens(user.id, user.phone, user.role, user.dhabaId);
  }

  /**
   * 3. Staff PIN authentication.
   *
   * Every employee has their own bcrypt-hashed PIN in `staff_credentials`. The
   * previous implementation compared against a single shared `STAFF_PIN`
   * environment variable in plaintext and derived the role by matching the
   * employee id against three more environment variables — so one leaked PIN
   * was every staff account, and rotating it locked out the whole team at once.
   *
   * Lockout state lives in Postgres rather than Redis: it must survive a cache
   * eviction, and with 2–10 replicas a per-process counter is not a lockout at
   * all.
   */
  async staffLogin(dto: { employeeId: string; pin: string }) {
    const employeeId = dto.employeeId.trim().toUpperCase();

    const credential = await this.prisma.staffCredential.findUnique({
      where: { employeeId },
      include: { user: true },
    });

    // A missing employee id still pays the bcrypt cost below via the dummy
    // compare, so response time does not reveal which ids exist.
    if (!credential) {
      await bcrypt.compare(dto.pin, DUMMY_PIN_HASH);
      throw new UnauthorizedException('Invalid Employee ID or PIN');
    }

    if (credential.lockedUntil && credential.lockedUntil > new Date()) {
      const minutes = Math.ceil((credential.lockedUntil.getTime() - Date.now()) / 60_000);
      // 401, not 403: the caller never authenticated, so this is "we do not know
      // who you are" rather than "we know and you may not". It also keeps every
      // failure on this endpoint a single status code, so a client cannot use
      // the code to tell a locked account from a wrong PIN — the message says
      // what happened, and only after the id and PIN were already correct
      // enough to reach a real credential.
      throw new UnauthorizedException(
        `Account locked after ${MAX_PIN_ATTEMPTS} failed attempts. Try again in ${minutes} minute(s) or contact an admin.`,
      );
    }

    const matches = await bcrypt.compare(dto.pin, credential.pinHash);
    if (!matches) {
      const failedAttempts = credential.failedAttempts + 1;
      const locked = failedAttempts >= MAX_PIN_ATTEMPTS;
      await this.prisma.staffCredential.update({
        where: { id: credential.id },
        data: {
          failedAttempts,
          lockedUntil: locked ? new Date(Date.now() + PIN_LOCKOUT_MINUTES * 60_000) : null,
        },
      });
      this.logger.warn(`Failed staff login for ${employeeId} (${failedAttempts}/${MAX_PIN_ATTEMPTS}).`);
      throw new UnauthorizedException('Invalid Employee ID or PIN');
    }

    // Success clears the counter — attempts must not accumulate across days.
    await this.prisma.staffCredential.update({
      where: { id: credential.id },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const staff = credential.user;
    const dhabaId = staff.dhabaId ?? env.defaultDhabaId;

    const accessToken = this.jwtService.sign(
      { sub: staff.id, employeeId, role: staff.role, dhabaId, type: 'access' },
      { secret: env.jwtSecret, expiresIn: env.staffTokenTtl },
    );

    return {
      accessToken,
      user: {
        id: staff.id,
        employeeId,
        name: staff.name,
        role: staff.role,
        dhabaId,
        // The client routes to a change-PIN screen on first login.
        mustChangePin: credential.mustChangePin,
        createdAt: staff.createdAt.toISOString(),
      },
    };
  }

  /**
   * Lets a signed-in staff member replace their own PIN. This is what makes
   * `mustChangePin` meaningful — a seeded or admin-issued PIN is a bootstrap
   * credential, not a permanent one.
   */
  async changeStaffPin(userId: string, currentPin: string, newPin: string) {
    const credential = await this.prisma.staffCredential.findUnique({ where: { userId } });
    if (!credential) {
      throw new UnauthorizedException('No staff credential exists for this account.');
    }
    if (!(await bcrypt.compare(currentPin, credential.pinHash))) {
      throw new UnauthorizedException('Current PIN is incorrect.');
    }
    if (await bcrypt.compare(newPin, credential.pinHash)) {
      throw new BadRequestException('The new PIN must be different from the current one.');
    }

    await this.prisma.staffCredential.update({
      where: { id: credential.id },
      data: {
        pinHash: await bcrypt.hash(newPin, PIN_SALT_ROUNDS),
        mustChangePin: false,
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
    this.logger.log(`Staff ${credential.employeeId} changed their PIN.`);
    return { success: true };
  }

  /**
   * 4. Logout & Blocklist Tokens
   */
  async logout(accessToken?: string, refreshToken?: string): Promise<{ success: boolean }> {
    if (accessToken) {
      const tokenStr = accessToken.replace('Bearer ', '');
      await this.redisService.set(blocklistKey(tokenStr), 'revoked', ACCESS_BLOCKLIST_TTL_SECONDS);
    }
    if (refreshToken) {
      await this.redisService.set(blocklistKey(refreshToken), 'revoked', REFRESH_TTL_SECONDS);
      await this.redisService.del(refreshKey(refreshToken));
    }
    return { success: true };
  }

  private async generateTokens(userId: string, phone: string, role: string = 'customer', dhabaId?: string | null) {
    const accessPayload = { sub: userId, phone, role, dhabaId: dhabaId ?? null, type: 'access' as const };
    const refreshPayload: TokenPayload = { sub: userId, phone, type: 'refresh' };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: env.jwtSecret,
      expiresIn: env.jwtAccessTtl,
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: env.jwtRefreshSecret,
      expiresIn: env.jwtRefreshTtl,
    });

    // Store a digest (not the token) for single-use rotation verification.
    await this.redisService.set(refreshKey(refreshToken), userId, REFRESH_TTL_SECONDS);

    return { accessToken, refreshToken };
  }
}
