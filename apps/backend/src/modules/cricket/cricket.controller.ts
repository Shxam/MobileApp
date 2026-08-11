import { Controller, Get, Inject } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CricketService, LiveMatchItem } from './cricket.service';

/**
 * Live scores. Deliberately public — the home screen shows them before sign-in,
 * and the payload is the same public scoreboard anyone can read on CricAPI.
 *
 * It is throttled harder than the global default because it fronts a metered
 * third-party API: the 15-second Redis cache absorbs normal traffic, but a
 * cache-miss stampede would otherwise burn the upstream quota.
 */
@Controller('cricket')
export class CricketController {
  constructor(@Inject(CricketService) private readonly cricketService: CricketService) {}

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('live-scores')
  async getLiveScores(): Promise<{ success: boolean; data: LiveMatchItem[] }> {
    const data = await this.cricketService.getLiveScores();
    return {
      success: true,
      data,
    };
  }
}
