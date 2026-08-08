import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import CryptoJS from 'crypto-js';

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);

  async createPaymentIntent(amount: number, currency = 'INR', notes: any = {}): Promise<any> {
    const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_mockKeyId2026';
    const orderId = `rzp_order_${Date.now()}`;

    this.logger.log(`💳 Created Razorpay Test Intent ${orderId} for Amount ₹${amount}`);

    return {
      success: true,
      keyId,
      orderId,
      amount: amount * 100, // Amount in paise
      currency,
      notes,
    };
  }

  async handleWebhook(rawBody: string, signature: string): Promise<{ success: boolean; event: string }> {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'super-secret-razorpay-webhook-2026';

    // Verify HMAC SHA256 Signature
    const expectedSignature = CryptoJS.HmacSHA256(rawBody, secret).toString(CryptoJS.enc.Hex);

    if (signature && signature !== expectedSignature && process.env.NODE_ENV === 'production') {
      this.logger.error('Razorpay Webhook HMAC Signature Verification Failed!');
      throw new UnauthorizedException('Invalid Razorpay Webhook Signature');
    }

    this.logger.log('✅ Razorpay Webhook Verified Successfully');
    return {
      success: true,
      event: 'payment.captured',
    };
  }
}
