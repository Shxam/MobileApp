import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import Razorpay from 'razorpay';
import { env } from '../../common/config/env';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string;
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  error_description?: string;
}

export interface RazorpayRefund {
  id: string;
  payment_id: string;
  amount: number;
  status: string;
}

/**
 * Thin wrapper around the official Razorpay SDK.
 *
 * Exists so the rest of the codebase never touches the SDK directly: it keeps
 * configuration checks in one place and gives the payments service an interface
 * that is straightforward to fake in tests.
 */
@Injectable()
export class RazorpayClient {
  private readonly logger = new Logger(RazorpayClient.name);
  private client: Razorpay | null = null;

  /** True when live API calls are possible. */
  get isConfigured(): boolean {
    return Boolean(env.razorpayKeyId && env.razorpayKeySecret);
  }

  get keyId(): string {
    if (!env.razorpayKeyId) {
      throw new ServiceUnavailableException('Payment gateway is not configured.');
    }
    return env.razorpayKeyId;
  }

  private get sdk(): Razorpay {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException('Payment gateway is not configured.');
    }
    if (!this.client) {
      this.client = new Razorpay({
        key_id: env.razorpayKeyId!,
        key_secret: env.razorpayKeySecret!,
      });
      this.logger.log(`Razorpay client initialised (key ${env.razorpayKeyId!.slice(0, 12)}…).`);
    }
    return this.client;
  }

  /** `amountPaise` goes to Razorpay verbatim — its API is denominated in paise. */
  async createOrder(params: {
    amountPaise: number;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<RazorpayOrder> {
    const order = await this.sdk.orders.create({
      amount: params.amountPaise,
      currency: 'INR',
      receipt: params.receipt,
      notes: params.notes ?? {},
      payment_capture: true,
    });
    return order as unknown as RazorpayOrder;
  }

  async fetchPayment(paymentId: string): Promise<RazorpayPayment> {
    const payment = await this.sdk.payments.fetch(paymentId);
    return payment as unknown as RazorpayPayment;
  }

  async fetchOrder(orderId: string): Promise<RazorpayOrder> {
    const order = await this.sdk.orders.fetch(orderId);
    return order as unknown as RazorpayOrder;
  }

  /** Payments attached to a Razorpay order — used by the reconciliation sweep. */
  async fetchPaymentsForOrder(orderId: string): Promise<RazorpayPayment[]> {
    const result = await this.sdk.orders.fetchPayments(orderId);
    return ((result as unknown as { items?: RazorpayPayment[] }).items ?? []) as RazorpayPayment[];
  }

  async refund(paymentId: string, amountPaise: number, notes?: Record<string, string>): Promise<RazorpayRefund> {
    const refund = await this.sdk.payments.refund(paymentId, {
      amount: amountPaise,
      notes: notes ?? {},
    });
    return refund as unknown as RazorpayRefund;
  }
}
