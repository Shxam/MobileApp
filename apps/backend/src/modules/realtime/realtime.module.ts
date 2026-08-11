import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Imports `AuthModule` for its `JwtService` — the gateway verifies the handshake
 * token itself rather than going through `JwtAuthGuard`, because a WebSocket
 * upgrade is not an HTTP request context and Passport's `ExtractJwt` has nothing
 * to read from.
 */
@Global()
@Module({
  imports: [AuthModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
