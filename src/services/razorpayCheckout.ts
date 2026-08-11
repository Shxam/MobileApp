// ===================================================
// IPL Dhaba — Razorpay Checkout
//
// This is what `PaymentModal`'s `setTimeout(..., 1200)` used to stand in for: a
// 1.2 second spinner under a "256-Bit Encrypted Payment Gateway" label, after
// which the order was treated as paid. No money moved and nothing was verified.
//
// The real flow has four steps and the client is only trusted for one of them:
//   1. server opens a Razorpay order   (POST /payments/intent)
//   2. customer pays in Checkout       (this file)
//   3. server verifies the signature   (POST /payments/verify)
//   4. Razorpay's webhook confirms it independently
// Step 3 is what moves the order to `placed`. Step 4 is what catches a customer
// who closes the tab mid-redirect.
// ===================================================

import { ApiClient, ApiError, type PaymentIntentView } from './apiClient';

const CHECKOUT_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

/** Only the fields this app sets. Razorpay's own options object is far larger. */
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  handler: (response: RazorpayCallbackResponse) => void;
  prefill?: { name?: string; contact?: string; email?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  modal?: { ondismiss?: () => void; escape?: boolean; confirm_close?: boolean };
}

interface RazorpayCallbackResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: string, handler: (payload: unknown) => void): void;
  close(): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

/** Raised when the customer closes Checkout without paying. Not an error state. */
export class PaymentCancelledError extends Error {
  constructor() {
    super('Payment was cancelled.');
    this.name = 'PaymentCancelledError';
  }
}

let scriptPromise: Promise<void> | null = null;

/**
 * Loads Checkout on first use.
 *
 * Deliberately not a `<script>` tag in `index.html`: that would pull a
 * third-party script into every page load, including for the majority of
 * sessions that browse the menu and never reach checkout.
 */
function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Razorpay Checkout failed to load.')));
      return;
    }

    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Cleared so a retry gets a fresh attempt rather than the cached rejection
      // — the usual cause is a dropped connection, which the next tap may not hit.
      scriptPromise = null;
      reject(new Error('Razorpay Checkout could not be loaded. Check your connection.'));
    };
    document.body.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Opens Checkout for a server-created intent and resolves with what Razorpay
 * handed back. Resolving does **not** mean paid — the signature in this payload
 * is unverified until the server checks it.
 */
async function openCheckout(
  intent: PaymentIntentView,
  meta: { description: string; customerName?: string; customerPhone?: string },
): Promise<RazorpayCallbackResponse> {
  await loadCheckoutScript();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error('Razorpay Checkout is unavailable.');

  return new Promise<RazorpayCallbackResponse>((resolve, reject) => {
    let settled = false;

    const instance = new Razorpay({
      key: intent.keyId,
      // Razorpay's unit is paise, which is the unit the whole app already uses —
      // so there is no conversion here, and no rounding to get wrong.
      amount: intent.amountPaise,
      currency: intent.currency,
      name: 'IPL Dhaba Super App',
      description: meta.description,
      order_id: intent.providerOrderId,
      prefill: { name: meta.customerName, contact: meta.customerPhone },
      notes: { orderId: intent.orderId },
      theme: { color: '#10b981' },
      handler: (response) => {
        settled = true;
        resolve(response);
      },
      modal: {
        confirm_close: true,
        ondismiss: () => {
          // `ondismiss` also fires after a successful payment on some flows, so
          // the guard matters: without it a paid order would report as cancelled.
          if (!settled) {
            settled = true;
            reject(new PaymentCancelledError());
          }
        },
      },
    });

    instance.on('payment.failed', (payload: unknown) => {
      if (settled) return;
      settled = true;
      const description = (payload as { error?: { description?: string } })?.error?.description;
      reject(new Error(description || 'The payment was declined. Try another method.'));
    });

    instance.open();
  });
}

/**
 * Pays for a food order end to end.
 *
 * Verification failure is reported as its own message because it is not the
 * customer's problem to solve by paying again — the money is captured, and the
 * reconciliation sweep will settle the order within a few minutes.
 */
export async function payForOrder(
  orderId: string,
  meta: { description: string; customerName?: string; customerPhone?: string },
): Promise<{ orderId: string; status: string; paymentStatus: string }> {
  const intent = await ApiClient.createPaymentIntent(orderId);
  const response = await openCheckout(intent, meta);

  try {
    return await ApiClient.verifyPayment({
      orderId,
      razorpayOrderId: response.razorpay_order_id,
      razorpayPaymentId: response.razorpay_payment_id,
      razorpaySignature: response.razorpay_signature,
    });
  } catch (error) {
    if (error instanceof ApiError && !error.isNetworkError) throw error;
    throw new Error(
      'Your payment went through, but we could not confirm it just yet. ' +
        'It will appear in your orders shortly — please do not pay again.',
    );
  }
}

/** Tops up the wallet. Same shape, different pair of endpoints. */
export async function topUpWallet(
  amountPaise: number,
  meta: { customerName?: string; customerPhone?: string } = {},
) {
  const intent = await ApiClient.createWalletTopUp(amountPaise);
  const response = await openCheckout(intent, {
    description: `Wallet top-up of ₹${(amountPaise / 100).toLocaleString('en-IN')}`,
    ...meta,
  });

  return ApiClient.verifyWalletTopUp({
    razorpayOrderId: response.razorpay_order_id,
    razorpayPaymentId: response.razorpay_payment_id,
    razorpaySignature: response.razorpay_signature,
  });
}
