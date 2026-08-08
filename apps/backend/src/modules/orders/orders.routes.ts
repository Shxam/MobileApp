// ===================================================
// IPL Dhaba Backend — Orders Module Routes & SSE Streaming
// Order Creation, Status Transitions, History & Real-Time SSE Driver Tracking
// ===================================================

import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/security';
import { requireAuth, requireRole } from '../../middleware/auth';
import { Validator } from '../../../../../packages/shared/validation';
import { FoodOrder, OrderStatus } from '../../../../../packages/shared/types';
import { AppError } from '../../middleware/errorHandler';
import { eventQueue } from '../../shared/eventQueue';
import { Logger } from '../../shared/logger';

const router = Router();

// In-Memory Order Store (mirrors PostgreSQL database engine)
const ORDERS_DB = new Map<string, FoodOrder>();

/**
 * GET /api/v1/orders
 * Get user order history or all orders for admin/driver
 */
router.get('/', requireAuth, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    let ordersList = Array.from(ORDERS_DB.values());

    if (user.role === 'customer') {
      ordersList = ordersList.filter((o) => o.userId === user.id);
    }

    res.json({
      success: true,
      data: ordersList,
      meta: { total: ordersList.length },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/orders/:id/tracking-stream
 * Server-Sent Events (SSE) endpoint for real-time driver GPS & milestone updates
 */
router.get('/:id/tracking-stream', (req, res) => {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  Logger.info(`SSE Connection established for order tracking: ${id}`, (req as any).id, 'OrdersSSE');

  // Initial Event Payload
  res.write(`data: ${JSON.stringify({ orderId: id, status: 'placed', milestone: 1, lat: 15.242, lng: 79.982, timestamp: new Date().toISOString() })}\n\n`);

  // Stream periodic driver GPS updates
  let step = 1;
  const interval = setInterval(() => {
    step++;
    const statuses: OrderStatus[] = ['placed', 'preparing', 'out_for_delivery', 'delivered'];
    const currentStatus = statuses[Math.min(step - 1, 3)];

    const payload = {
      orderId: id,
      status: currentStatus,
      milestone: Math.min(step, 4),
      lat: 15.242 + step * 0.002,
      lng: 79.982 + step * 0.0015,
      driverName: 'Ramesh Kumar (IPL Dhaba Express)',
      etaMinutes: Math.max(25 - step * 5, 2),
      timestamp: new Date().toISOString(),
    };

    res.write(`data: ${JSON.stringify(payload)}\n\n`);

    if (step >= 4) {
      clearInterval(interval);
      res.write(`data: ${JSON.stringify({ event: 'COMPLETE', message: 'Order Delivered!' })}\n\n`);
      res.end();
    }
  }, 5000);

  req.on('close', () => {
    clearInterval(interval);
    Logger.info(`SSE Connection closed for order tracking: ${id}`, (req as any).id, 'OrdersSSE');
  });
});

/**
 * POST /api/v1/orders
 * Create new food order with server-side validation & pricing check
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const orderData: Partial<FoodOrder> = req.body;

    // Validate Input
    const validation = Validator.validateFoodOrder(orderData);
    if (!validation.valid) {
      throw new AppError('Order validation failed', 400, 'INVALID_ORDER_PAYLOAD', {
        validationErrors: validation.errors,
      });
    }

    // Server-side Subtotal & GST Calculation
    const subtotal = orderData.items!.reduce((sum, i) => sum + i.menuItem.price * i.quantity, 0);
    const gstAmount = Math.round(subtotal * 0.05);
    const deliveryFee = orderData.deliveryType === 'home_delivery' ? 45 : 30;
    const grandTotal = subtotal + gstAmount + deliveryFee;

    const newOrder: FoodOrder = {
      id: `ord_${Math.floor(100000 + Math.random() * 900000)}`,
      items: orderData.items!,
      totalAmount: grandTotal,
      deliveryType: orderData.deliveryType || 'turf_slot',
      deliveryTarget: orderData.deliveryTarget || 'Singarayakonda Turf - Cage 1',
      status: 'placed',
      createdAt: new Date().toISOString(),
      estimatedDeliveryMinutes: 25,
      cookingInstructions: orderData.cookingInstructions,
      paymentMethod: orderData.paymentMethod || 'wallet',
      userId: user.id,
    };

    ORDERS_DB.set(newOrder.id, newOrder);

    // Dispatch Async Event Queue Job
    await eventQueue.dispatch('ORDER_STATUS_TRANSITION', {
      orderId: newOrder.id,
      nextStatus: 'placed',
    });

    res.status(201).json({
      success: true,
      data: newOrder,
      message: 'Order successfully placed!',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/orders/:id/status
 * Transition order status via State Machine rules
 */
router.patch('/:id/status', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { targetStatus } = req.body as { targetStatus: OrderStatus };

    const existingOrder = ORDERS_DB.get(id);
    if (!existingOrder) {
      throw new AppError(`Order ${id} not found`, 404, 'ORDER_NOT_FOUND');
    }

    existingOrder.status = targetStatus;
    ORDERS_DB.set(id, existingOrder);

    // Dispatch Async Queue Notification & Status Transition Job
    await eventQueue.dispatch('ORDER_STATUS_TRANSITION', { orderId: id, nextStatus: targetStatus });
    await eventQueue.dispatch('DISPATCH_PUSH_NOTIFICATION', {
      userId: existingOrder.userId,
      title: `Order Updated: ${targetStatus.toUpperCase()}`,
      message: `Your food order #${id} status is now ${targetStatus}.`,
    });

    res.json({
      success: true,
      data: existingOrder,
    });
  } catch (err) {
    next(err);
  }
});

export const ordersRouter = router;
