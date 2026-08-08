// ===================================================
// IPL Dhaba Backend — External Payment Gateway Module
// Razorpay / UPI Intent Creation & Gateway Webhooks
// ===================================================

import { Router } from 'express';
import { Logger } from '../../shared/logger';
import { eventQueue } from '../../shared/eventQueue';

export const paymentGatewayRouter = Router();

// Create Payment Intent (Razorpay / UPI)
paymentGatewayRouter.post('/create-intent', async (req, res) => {
  const { amount, currency = 'INR', orderId } = req.body;

  if (!amount) {
    return res.status(400).json({ success: false, error: 'Payment amount is required' });
  }

  const razorpayOrder = {
    id: `rzp_order_${Date.now()}`,
    entity: 'order',
    amount: amount * 100, // convert to paise
    currency,
    receipt: `rcpt_${orderId || Date.now()}`,
    status: 'created',
  };

  Logger.info(`Razorpay Intent Created: ${razorpayOrder.id} for amount ₹${amount}`, (req as any).id, 'PaymentGateway');

  res.json({
    success: true,
    data: razorpayOrder,
  });
});

// Razorpay Gateway Webhook Endpoint
paymentGatewayRouter.post('/webhook', async (req, res) => {
  const event = req.body.event || 'payment.captured';
  const paymentId = req.body.payload?.payment?.entity?.id || `pay_${Date.now()}`;

  Logger.info(`Gateway Webhook Received: ${event} [${paymentId}]`, (req as any).id, 'PaymentGateway');

  // Enqueue notification & order state update asynchronously
  await eventQueue.dispatch('DISPATCH_PUSH_NOTIFICATION', {
    userId: 'usr_1',
    title: '✅ Payment Captured',
    message: `Payment ${paymentId} verified by Razorpay.`,
  });

  res.json({ status: 'ok', received: true });
});
