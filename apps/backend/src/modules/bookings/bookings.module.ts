import { Module, Controller, Get, Post, Body, Req, UseGuards, Inject } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('bookings')
export class BookingsController {
  constructor(@Inject(BookingsService) private readonly bookingsService: BookingsService) {}

  @Get('slots')
  getSlots() {
    return this.bookingsService.getSlots();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createBooking(@Req() req: any, @Body() body: { slotId: string; addons?: string[] }) {
    return this.bookingsService.createBooking(req.user.userId, body.slotId, body.addons || []);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  getUserBookings(@Req() req: any) {
    return this.bookingsService.getUserBookings(req.user.userId);
  }
}

@Module({
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
