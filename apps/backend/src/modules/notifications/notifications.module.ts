import { Module, Controller, Get } from '@nestjs/common';

@Controller('notifications')
export class NotificationsController {
  @Get()
  getNotifications() {
    return { success: true, data: [] };
  }
}

@Module({
  controllers: [NotificationsController],
})
export class NotificationsModule {}
