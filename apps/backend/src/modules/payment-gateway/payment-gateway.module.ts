import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Module,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { RazorpayClient } from './razorpay.client';
import {
  CreatePaymentIntentDto,
  VerifyPaymentDto,
  VerifyWalletTopUpDto,
  WalletTopUpIntentDto,
} from './dto/payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('intent')
  createIntent(@Req() req: any, @Body() body: CreatePaymentIntentDto) {
    return this.payments.createIntentForOrder(req.user.userId, body.orderId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify')
  @HttpCode(200)
  verify(@Req() req: any, @Body() body: VerifyPaymentDto) {
    return this.payments.verifyCallback(req.user.userId, body.orderId, {
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      razorpaySignature: body.razorpaySignature,
    });
  }

  /** Opens a Razorpay order for a wallet top-up; the money is credited on capture. */
  @UseGuards(JwtAuthGuard)
  @Post('wallet-topup')
  createWalletTopUp(@Req() req: any, @Body() body: WalletTopUpIntentDto) {
    return this.payments.createWalletTopUp(req.user.userId, body.amountPaise);
  }

  @UseGuards(JwtAuthGuard)
  @Post('wallet-topup/verify')
  @HttpCode(200)
  verifyWalletTopUp(@Req() req: any, @Body() body: VerifyWalletTopUpDto) {
    return this.payments.verifyWalletTopUp(req.user.userId, {
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      razorpaySignature: body.razorpaySignature,
    });
  }

  /**
   * Razorpay calls this unauthenticated; the HMAC over the raw request bytes is
   * the authentication. `req.rawBody` is populated by `main.ts` via
   * `rawBody: true`.
   */
  @Post('webhook')
  @HttpCode(200)
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
    @Headers('x-razorpay-event-id') eventId?: string,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException('Raw request body unavailable — webhook signature cannot be verified.');
    }
    return this.payments.handleWebhook(req.rawBody, signature, eventId ?? '');
  }
}

/**
 * `WalletService` is injected here without importing `WalletModule` because that
 * module is `@Global()` — importing it would create a cycle, since the wallet's
 * top-up endpoint routes through payments.
 */
@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, RazorpayClient, PaymentReconciliationService],
  exports: [PaymentsService, RazorpayClient],
})
export class PaymentGatewayModule {}
