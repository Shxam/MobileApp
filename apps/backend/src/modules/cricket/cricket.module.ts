import { Module } from '@nestjs/common';
import { CricketController } from './cricket.controller';
import { CricketService } from './cricket.service';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [CricketController],
  providers: [CricketService],
  exports: [CricketService],
})
export class CricketModule {}
