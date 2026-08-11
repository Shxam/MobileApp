import { Controller, Get, Global, Module, Req, UseGuards } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { VouchersService } from './vouchers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Behind the JWT guard because the list is filtered by what this caller has
 * already redeemed — there is no anonymous version of "offers you can still use".
 */
@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  listActive(@Req() req: any) {
    return this.vouchers.listActive(req.user.userId);
  }
}

@Global()
@Module({
  controllers: [VouchersController],
  providers: [PricingService, VouchersService],
  exports: [PricingService, VouchersService],
})
export class PricingModule {}
