import { Global, Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { VouchersService } from './vouchers.service';

@Global()
@Module({
  providers: [PricingService, VouchersService],
  exports: [PricingService, VouchersService],
})
export class PricingModule {}
