import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { RedisService } from '../common/redis/redis.service';
import { FirebaseAdminService } from '../common/firebase/firebase-admin.service';
import { PrismaService } from '../common/prisma/prisma.service';

type CheckState = 'connected' | 'down';

interface Check {
  status: CheckState;
  latencyMs: number | null;
  error?: string;
}

/**
 * Liveness vs readiness:
 *   /health/live  — is the process running? Never touches a dependency, so a
 *                   database blip cannot get the pod killed by the kubelet.
 *   /health/ready — can this replica serve traffic? Really probes Postgres and
 *                   Redis and returns 503 when either is down, so a broken pod
 *                   is pulled from the load balancer.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly redis: RedisService,
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHealth() {
    return {
      status: 'up',
      service: 'IPL Dhaba API',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  getLive() {
    return {
      status: 'up',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async getReady(@Res() res: Response) {
    const [database, cache] = await Promise.all([this.checkDatabase(), this.checkRedis()]);

    const isReady = database.status === 'connected' && cache.status === 'connected';

    return res.status(isReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({
      status: isReady ? 'ready' : 'not_ready',
      checks: {
        database,
        cache,
        firebase: this.firebaseAdmin.isConfigured() ? 'configured' : 'not_configured',
      },
      timestamp: new Date().toISOString(),
    });
  }

  private async checkDatabase(): Promise<Check> {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'connected', latencyMs: Date.now() - startedAt };
    } catch (error) {
      return { status: 'down', latencyMs: null, error: (error as Error).message };
    }
  }

  private async checkRedis(): Promise<Check> {
    const startedAt = Date.now();
    try {
      await this.redis.ping();
      return { status: 'connected', latencyMs: Date.now() - startedAt };
    } catch (error) {
      return { status: 'down', latencyMs: null, error: (error as Error).message };
    }
  }
}
