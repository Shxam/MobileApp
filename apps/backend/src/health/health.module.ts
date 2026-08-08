import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RedisService } from '../common/redis/redis.service';
import { FirebaseAdminService } from '../common/firebase/firebase-admin.service';

@Module({
  controllers: [HealthController],
  providers: [RedisService, FirebaseAdminService],
})
export class HealthModule {}
