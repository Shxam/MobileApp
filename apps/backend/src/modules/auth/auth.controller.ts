import { Controller, Post, Body, Get, UseGuards, Req, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { AuthService } from './auth.service';
import { FirebaseAuthDto } from './dto/firebase-auth.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  /**
   * POST /api/v1/auth/firebase
   * Exchange verified Firebase ID token for IPL Dhaba JWT access + refresh tokens
   */
  @Post('firebase')
  @HttpCode(HttpStatus.OK)
  async authenticateWithFirebase(@Body() dto: FirebaseAuthDto) {
    return this.authService.verifyFirebaseToken(dto);
  }

  @Post('staff-login')
  @HttpCode(HttpStatus.OK)
  async staffLogin(@Body() dto: { employeeId: string; pin: string }) {
    return this.authService.staffLogin(dto);
  }

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
