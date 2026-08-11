import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { env } from '../../../common/config/env';
import { RedisService } from '../../../common/redis/redis.service';
import { blocklistKey } from '../token-keys';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(RedisService) private readonly redisService: RedisService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.jwtSecret,
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    const rawToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (rawToken) {
      // Must use the same derivation the issuer used. This previously looked up
      // the raw token while logout wrote a hashed key, so revocation never took
      // effect.
      const isBlocked = await this.redisService.get(blocklistKey(rawToken));
      if (isBlocked) {
        throw new UnauthorizedException('Token has been revoked or logged out');
      }
    }

    return {
      userId: payload.sub,
      phone: payload.phone,
      role: payload.role || 'customer',
      employeeId: payload.employeeId,
      // Carried on the token so dhaba-scoped guards can enforce tenancy
      // without an extra database round-trip.
      dhabaId: payload.dhabaId ?? null,
    };
  }
}
