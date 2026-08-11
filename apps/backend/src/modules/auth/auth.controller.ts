import { Controller, Post, Body, Get, UseGuards, Req, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { FirebaseAuthDto } from './dto/firebase-auth.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangeStaffPinDto, StaffLoginDto } from './dto/staff-login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * The credential-facing routes carry their own throttles rather than inheriting
 * the global 120/minute. Login is the one place where an attacker's request rate
 * *is* the attack: a six-digit staff PIN is 10^6 candidates, which 120 requests
 * a minute exhausts in under six days and 10 a minute stretches past a decade.
 *
 * This complements, but does not replace, the per-account lockout in
 * `AuthService.staffLogin` — the lockout stops one account being ground down,
 * the throttle stops one IP grinding through many accounts.
 */
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  /**
   * POST /api/v1/auth/firebase
   * Exchange verified Firebase ID token for IPL Dhaba JWT access + refresh tokens
   */
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('firebase')
  @HttpCode(HttpStatus.OK)
  async authenticateWithFirebase(@Body() dto: FirebaseAuthDto) {
    return this.authService.verifyFirebaseToken(dto);
  }

  /**
   * Typed rather than an inline object literal: the global ValidationPipe can
   * only enforce a class, so the previous signature let a request with no `pin`
   * reach bcrypt as `undefined`.
   *
   * The throttle here is looser than it first looks, on purpose. It keys on IP,
   * and a dhaba's staff all share one NAT'd connection — a tight per-IP limit
   * would lock the whole kitchen out of the login screen at shift change, which
   * is an outage rather than a control. The real brute-force defence is the
   * per-account lockout in `AuthService.staffLogin`: it counts against the
   * employee id, so it is unaffected by how many people share an address. This
   * limit exists only to slow an attacker grinding through *many* ids from one
   * host.
   */
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('staff-login')
  @HttpCode(HttpStatus.OK)
  async staffLogin(@Body() dto: StaffLoginDto) {
    return this.authService.staffLogin(dto);
  }

  /** A staff member rotating their own PIN; required after a seeded first login. */
  @UseGuards(JwtAuthGuard)
  @Post('staff/change-pin')
  @HttpCode(HttpStatus.OK)
  async changeStaffPin(@Req() req: any, @Body() dto: ChangeStaffPinDto) {
    return this.authService.changeStaffPin(req.user.userId, dto.currentPin, dto.newPin);
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any, @Body() dto: Partial<RefreshTokenDto>) {
    const authHeader = req.headers['authorization'];
    return this.authService.logout(authHeader, dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Req() req: any) {
    return {
      success: true,
      user: req.user,
    };
  }
}
