import { Module, Controller, Post, Body, Headers, Inject } from '@nestjs/common';
import { PaymentGatewayService } from './payment-gateway.service';

@Controller('payment-gateway')
export class PaymentGatewayController {
  constructor(@Inject(PaymentGatewayService) private readonly paymentService: PaymentGatewayService) {}

  @Post('intent')
  createIntent(@Body() body: { amount: number; notes?: any }) {
    return this.paymentService.createPaymentIntent(body.amount, 'INR', body.notes);
  }

  @Post('webhook')
  handleWebhook(@Body() body: any, @Headers('x-razorpay-signature') signature: string) {
    return this.paymentService.handleWebhook(JSON.stringify(body), signature);
  }
}

@Module({
  controllers: [PaymentGatewayController],
  providers: [PaymentGatewayService],
  exports: [PaymentGatewayService],
})
export class PaymentGatewayModule {}
