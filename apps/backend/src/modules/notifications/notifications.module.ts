import {
  Controller,
  Get,
  Inject,
  Injectable,
  Logger,
  Module,
  OnModuleInit,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IsBooleanString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class ListNotificationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  // A query string carries `"true"`, not `true`; validating it as a boolean
  // would reject every request that sets it.
  @IsOptional()
  @IsBooleanString()
  unreadOnly?: string;
}

/**
 * The signed-in user's notification feed.
 *
 * Every route is scoped to `req.user.userId`. The previous controller was
 * unauthenticated and returned `{ success: true, data: [] }` — a permanently
 * empty feed that looked like "no notifications" rather than "not implemented".
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() req: any, @Query() query: ListNotificationsDto) {
    return this.notifications.list(req.user.userId, query.limit ?? 25, query.unreadOnly === 'true');
  }

  // Declared before `:id/read` so the literal segment is matched first rather
  // than being swallowed as an id.
  @Patch('read-all')
  markAllRead(@Req() req: any) {
    return this.notifications.markAllRead(req.user.userId);
  }

  @Patch(':id/read')
  markRead(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(req.user.userId, id);
  }
}

/**
 * Nightly cleanup of read notifications past the retention window.
 *
 * Running on every replica is harmless: the second and third pods find the rows
 * already gone and delete nothing.
 */
@Injectable()
export class NotificationsSweepService {
  private readonly logger = new Logger(NotificationsSweepService.name);

  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async prune(): Promise<void> {
    const removed = await this.notifications.pruneExpired();
    if (removed > 0) this.logger.log(`Pruned ${removed} expired notifications.`);
  }
}

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsSweepService],
  exports: [NotificationsService],
})
export class NotificationsModule implements OnModuleInit {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  /**
   * Event subscriptions are attached at boot rather than in the service
   * constructor, so the service stays constructible in a unit test without
   * silently registering listeners on a shared bus.
   */
  onModuleInit(): void {
    this.notifications.registerListeners();
  }
}
