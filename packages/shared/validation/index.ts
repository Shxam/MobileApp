// ===================================================
// IPL Dhaba — Shared Validation Utilities
// Server & Client input validation helpers
// ===================================================

import {
  FoodOrder,
  TurfBooking,
  CelebrationBooking,
  OrderStatus,
  TERMINAL_ORDER_STATUSES,
} from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class Validator {
  public static validatePhone(phone: string): boolean {
    const cleaned = phone.replace(/[\s\-\+\(\)]/g, '');
    return /^[0-9]{10,12}$/.test(cleaned);
  }

  public static validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  public static validateFoodOrder(order: Partial<FoodOrder>): ValidationResult {
    const errors: string[] = [];

    if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
      errors.push('Order must contain at least one item');
    }

    if (order.items) {
      for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i];
        // `pricePaise`, not `price`: money is integer paise everywhere.
        if (!item.menuItem || !item.menuItem.id || item.menuItem.pricePaise <= 0) {
          errors.push(`Item at position ${i + 1} is invalid`);
        }
        if (!item.quantity || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
          errors.push(`Item quantity for ${item.menuItem?.nameEn || i + 1} must be a positive integer`);
        }
      }
    }

    // `turf_bench` was missing, so a bench order failed a check the server
    // accepts.
    if (
      !order.deliveryType ||
      !['turf_slot', 'turf_bench', 'home_delivery'].includes(order.deliveryType)
    ) {
      errors.push('Invalid delivery type specified');
    }

    if (!order.deliveryTarget || order.deliveryTarget.trim().length === 0) {
      errors.push('Delivery location target is required');
    }

    // The real methods are razorpay / cod / wallet. `upi` and `card` were never
    // payment methods in this system — they are Razorpay instruments.
    if (!order.paymentMethod || !['razorpay', 'cod', 'wallet'].includes(order.paymentMethod)) {
      errors.push('Invalid payment method specified');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  public static validateTurfBooking(booking: Partial<TurfBooking>): ValidationResult {
    const errors: string[] = [];

    if (!booking.turfId || booking.turfId.trim().length === 0) {
      errors.push('Turf ID is required');
    }

    if (!booking.date || isNaN(Date.parse(booking.date))) {
      errors.push('Valid booking date is required');
    }

    if (!booking.slots || !Array.isArray(booking.slots) || booking.slots.length === 0) {
      errors.push('At least one turf slot must be selected');
    }

    // Integer paise, like every other money field.
    if (booking.totalAmountPaise === undefined || booking.totalAmountPaise < 0) {
      errors.push('Total amount must be greater than or equal to 0');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  public static validateCelebrationBooking(booking: Partial<CelebrationBooking>): ValidationResult {
    const errors: string[] = [];

    if (!booking.packageId) errors.push('Package ID is required');
    if (!booking.eventDate || isNaN(Date.parse(booking.eventDate))) errors.push('Valid event date is required');
    if (!booking.guestCount || booking.guestCount < 1) errors.push('Guest count must be at least 1');

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Mirror of `ORDER_TRANSITIONS` in
   * `apps/backend/src/modules/orders/order-state-machine.ts`, which is the
   * authoritative table — the server rejects anything this map would allow but
   * that one does not.
   *
   * The previous version listed only 5 of the 12 statuses, so every status the
   * real lifecycle added (`awaiting_payment`, `accepted`, `ready_for_pickup`,
   * `assigned`, `picked_up`, `refunded`, `payment_failed`) fell through to
   * `false` and a legitimate transition read as invalid.
   */
  private static readonly TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
    awaiting_payment: ['placed', 'payment_failed', 'cancelled'],
    placed: ['accepted', 'cancelled', 'refunded'],
    accepted: ['preparing', 'cancelled'],
    preparing: ['ready_for_pickup', 'cancelled'],
    ready_for_pickup: ['assigned', 'cancelled'],
    assigned: ['picked_up', 'ready_for_pickup', 'cancelled'],
    // `out_for_delivery` is a legacy alias of `picked_up`; both reach delivered.
    picked_up: ['delivered', 'out_for_delivery', 'delivery_failed'],
    out_for_delivery: ['delivered', 'delivery_failed'],
    delivered: ['refunded'],
    cancelled: ['refunded'],
    refunded: [],
    payment_failed: ['awaiting_payment', 'cancelled'],
    delivery_failed: ['refunded'],
  };

  public static isValidOrderStatusTransition(current: OrderStatus, target: OrderStatus): boolean {
    return Validator.TRANSITIONS[current]?.includes(target) ?? false;
  }

  /**
   * Whether an order has stopped moving forward. A refund can still be issued
   * against a terminal order, so this is not the same as "no transitions left".
   */
  public static isTerminalOrderStatus(status: OrderStatus): boolean {
    return TERMINAL_ORDER_STATUSES.includes(status);
  }
}
