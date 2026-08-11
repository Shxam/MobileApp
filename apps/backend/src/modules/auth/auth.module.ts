import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { env } from '../../common/config/env';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RedisService } from '../../common/redis/redis.service';
import { FirebaseAdminService } from '../../common/firebase/firebase-admin.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: env.jwtSecret,
      signOptions: { expiresIn: env.jwtAccessTtl },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RedisService, FirebaseAdminService],
  exports: [AuthService, JwtStrategy, JwtModule, PassportModule],
})
export class AuthModule {}
