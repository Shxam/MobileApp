import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

// RedisService, FirebaseAdminService and PrismaService all come from @Global()
// modules. Re-declaring them here would construct a *second* instance of each
// (a second Redis connection, a second Prisma pool) that reports on itself
// rather than on the connections the app actually uses.
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
