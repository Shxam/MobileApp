import { Module, Controller, Get, Global, Query, Req, UseGuards, Inject } from '@nestjs/common';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class WalletQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

/**
 * The wallet is read-only over HTTP.
 *
 * The previous `POST /wallet/topup` and `POST /wallet/deduct` credited or debited
 * an arbitrary caller-specified amount with no payment proof — free money. Credit
 * now enters only through `POST /payments/wallet-topup` (after a verified
 * gateway capture) or a refund; debit happens only inside order creation.
 */
@Controller('wallet')
export class WalletController {
  constructor(@Inject(WalletService) private readonly walletService: WalletService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getWallet(@Req() req: any, @Query() query: WalletQueryDto) {
    return this.walletService.getWallet(req.user.userId, query.limit ?? 25);
  }

  @UseGuards(JwtAuthGuard)
  @Get('balance')
  async getBalance(@Req() req: any) {
    return { balancePaise: await this.walletService.getBalancePaise(req.user.userId) };
  }
}

/** Global so payments and orders can debit/credit without importing this module. */
@Global()
@Module({
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
