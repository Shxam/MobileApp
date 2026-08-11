import { Module, Controller, Get, Post, Body, Req, Query, Param, HttpCode, UseGuards } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateBookingDto, VerifyGatePassDto } from './dto/booking.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /** Public: the turf screen lists availability before the customer signs in. */
  @Get('slots')
  getSlots(@Query('date') date?: string) {
    return this.bookingsService.getSlots(date);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'admin', 'partner')
  @Post()
  createBooking(@Req() req: any, @Body() body: CreateBookingDto) {
    return this.bookingsService.createBooking(
      req.user.userId,
      body.slotId,
      body.addons ?? [],
      body.paymentMethod ?? PaymentMethod.wallet,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  getUserBookings(@Req() req: any) {
    return this.bookingsService.getUserBookings(req.user.userId, req.user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/cancel')
  @HttpCode(200)
  cancelBooking(@Req() req: any, @Param('id') id: string) {
    return this.bookingsService.cancelBooking(req.user.userId, id, req.user.role);
  }

  /** The gate scanner is staff-operated, so it authenticates like staff. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'partner', 'kitchen_staff')
  @Post('verify-gate-pass')
  @HttpCode(200)
  verifyGatePass(@Body() body: VerifyGatePassDto) {
    return this.bookingsService.verifyGatePass(body.token);
  }
}

@Module({
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
