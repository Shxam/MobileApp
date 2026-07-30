// ===================================================
// IPL Dhaba — Shared Validation Utilities
// Server & Client input validation helpers
// ===================================================

import { FoodOrder, TurfBooking, CelebrationBooking, OrderStatus } from '../types';

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
        if (!item.menuItem || !item.menuItem.id || item.menuItem.price <= 0) {
          errors.push(`Item at position ${i + 1} is invalid`);
        }
        if (!item.quantity || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
          errors.push(`Item quantity for ${item.menuItem?.nameEn || i + 1} must be a positive integer`);
        }
      }
    }

    if (!order.deliveryType || !['turf_slot', 'home_delivery'].includes(order.deliveryType)) {
      errors.push('Invalid delivery type specified');
    }

    if (!order.deliveryTarget || order.deliveryTarget.trim().length === 0) {
      errors.push('Delivery location target is required');
    }

    if (!order.paymentMethod || !['wallet', 'upi', 'card'].includes(order.paymentMethod)) {
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

    if (booking.totalAmount === undefined || booking.totalAmount < 0) {
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

  public static isValidOrderStatusTransition(current: OrderStatus, target: OrderStatus): boolean {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      placed: ['preparing', 'cancelled'],
      preparing: ['out_for_delivery', 'cancelled'],
      out_for_delivery: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: [],
    };

    return validTransitions[current]?.includes(target) ?? false;
  }
}
