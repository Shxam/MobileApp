import { Module, Controller, Get, Post, Body, Req, UseGuards, Inject } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('wallet')
export class WalletController {
  constructor(@Inject(WalletService) private readonly walletService: WalletService) {}

  @UseGuards(JwtAuthGuard)
  @Get('balance')
  getBalance(@Req() req: any) {
    return this.walletService.getWalletBalance(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('topup')
  topUp(@Req() req: any, @Body() body: { amount: number; description?: string }) {
    return this.walletService.topUpWallet(req.user.userId, body.amount, body.description || 'UPI Wallet Top-Up');
  }

  @UseGuards(JwtAuthGuard)
  @Post('deduct')
  deduct(@Req() req: any, @Body() body: { amount: number; description?: string }) {
    return this.walletService.deductWallet(req.user.userId, body.amount, body.description || 'Payment');
  }
}

@Module({
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
