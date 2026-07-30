// ===================================================
// IPL Dhaba Backend — Orders Module Routes & Controller
// Order Creation, Status Transitions, History & State Machine
// ===================================================

import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/security';
import { requireAuth, requireRole } from '../../middleware/auth';
import { Validator } from '../../../../../packages/shared/validation';
import { FoodOrder, OrderStatus } from '../../../../../packages/shared/types';
import { AppError } from '../../middleware/errorHandler';

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
 * POST /api/v1/orders
 * Create new food order with server-side validation & pricing check
 */
router.post('/', requireAuth, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
    const gstAmount = Math.round(subtotal * 0.05); // 5% GST
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
router.patch('/:id/status', requireAuth, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { targetStatus } = req.body as { targetStatus: OrderStatus };

    const existingOrder = ORDERS_DB.get(id);
    if (!existingOrder) {
      throw new AppError(`Order with ID ${id} not found`, 404, 'ORDER_NOT_FOUND');
    }

    // State Machine Transition Check
    const isValid = Validator.isValidOrderStatusTransition(existingOrder.status, targetStatus);
    if (!isValid) {
      throw new AppError(
        `Invalid status transition from "${existingOrder.status}" to "${targetStatus}"`,
        400,
        'INVALID_STATE_TRANSITION'
      );
    }

    existingOrder.status = targetStatus;
    ORDERS_DB.set(id, existingOrder);

    res.json({
      success: true,
      data: existingOrder,
      message: `Order status updated to ${targetStatus}`,
    });
  } catch (err) {
    next(err);
  }
});

export const ordersRouter = router;
