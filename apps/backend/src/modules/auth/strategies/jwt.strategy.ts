import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RedisService } from '../../../common/redis/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(RedisService) private readonly redisService: RedisService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret-jwt-key-ipl-dhaba-2026',
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    const rawToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (rawToken) {
      const isBlocked = await this.redisService.get(`blocklist:token:${rawToken}`);
      if (isBlocked) {
        throw new UnauthorizedException('Token has been revoked or logged out');
      }
    }

    return {
      userId: payload.sub,
      phone: payload.phone,
      role: payload.role || 'customer',
      employeeId: payload.employeeId,
    };
  }
}
