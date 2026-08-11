import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { CelebrationsService } from './celebrations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateCelebrationBookingDto } from './dto/celebration.dto';

@Controller('celebrations')
export class CelebrationsController {
  constructor(private readonly celebrations: CelebrationsService) {}

  /** Public, like the menu: the packages render before anyone signs in. */
  @Get()
  listPackages() {
    return this.celebrations.listPackages();
  }

  /**
   * Prices a party without booking it.
   *
   * Declared before `:id` routes would matter, and kept a POST because the
   * customisation set is a body, not a query string.
   */
  @Post('quote')
  @HttpCode(200)
  quote(@Body() body: CreateCelebrationBookingDto) {
    return this.celebrations.quote(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'admin', 'partner')
  @Post('bookings')
  createBooking(@Req() req: any, @Body() body: CreateCelebrationBookingDto) {
    return this.celebrations.createBooking(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('bookings')
  listBookings(@Req() req: any) {
    return this.celebrations.listBookings(req.user.userId, req.user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Post('bookings/:id/cancel')
  @HttpCode(200)
  cancelBooking(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.celebrations.cancelBooking(req.user.userId, id, req.user.role);
  }
}

@Module({
  controllers: [CelebrationsController],
  providers: [CelebrationsService],
  exports: [CelebrationsService],
})
export class CelebrationsModule {}
