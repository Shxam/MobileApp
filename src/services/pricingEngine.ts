import { CartItem } from '../types';

export interface BillBreakdown {
  subtotal: number;
  foodGst: number; // 5% GST
  deliveryFee: number;
  discount: number;
  grandTotal: number;
}

export interface TurfBillBreakdown {
  subtotal: number;
  turfGst: number; // 18% GST
  floodlightSurge: number;
  discount: number;
  grandTotal: number;
}

export class PricingEngine {
  private static FOOD_GST_RATE = 0.05; // 5% GST on food
  private static TURF_GST_RATE = 0.18; // 18% GST on turf services
  private static DEFAULT_DELIVERY_FEE = 30; // ₹30 bench delivery

  /**
   * Calculate full food order bill breakdown
   */
  public static calculateFoodBill(
    cart: CartItem[],
    discountAmount: number = 0,
    deliveryType: 'turf_slot' | 'home_delivery' = 'turf_slot'
  ): BillBreakdown {
    const subtotal = cart.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);
    const foodGst = Math.round(subtotal * this.FOOD_GST_RATE);
    const deliveryFee = subtotal > 0 ? (deliveryType === 'home_delivery' ? 45 : this.DEFAULT_DELIVERY_FEE) : 0;
    const effectiveDiscount = Math.min(discountAmount, subtotal + foodGst + deliveryFee);
    const grandTotal = Math.max(0, subtotal + foodGst + deliveryFee - effectiveDiscount);

    return {
      subtotal,
      foodGst,
      deliveryFee,
      discount: effectiveDiscount,
      grandTotal,
    };
  }

  /**
   * Calculate turf slot booking bill breakdown
   */
  public static calculateTurfBill(
    slotPrices: number[],
    isFloodlit: boolean = true,
    discountAmount: number = 0
  ): TurfBillBreakdown {
    const subtotal = slotPrices.reduce((sum, price) => sum + price, 0);
    const floodlightSurge = isFloodlit ? 100 : 0; // ₹100 floodlight operational surcharge
    const totalBeforeGst = subtotal + floodlightSurge;
    const turfGst = Math.round(totalBeforeGst * this.TURF_GST_RATE);
    const effectiveDiscount = Math.min(discountAmount, totalBeforeGst + turfGst);
    const grandTotal = Math.max(0, totalBeforeGst + turfGst - effectiveDiscount);

    return {
      subtotal,
      turfGst,
      floodlightSurge,
      discount: effectiveDiscount,
      grandTotal,
    };
  }

  /**
   * Validate promo vouchers
   */
  public static validateVoucher(code: string, currentTotal: number): { valid: boolean; discount: number; message: string } {
    const cleanCode = code.trim().toUpperCase();

    if (cleanCode === 'FREEBIRYANI') {
      return { valid: true, discount: 100, message: '₹100 Dhaba Biryani Special Discount Applied!' };
    }
    if (cleanCode === 'TURFFREE60') {
      return { valid: true, discount: 60, message: '₹60 Pitch Match Voucher Applied!' };
    }
    if (cleanCode === 'IPLWINNER20') {
      const discount = Math.round(currentTotal * 0.2);
      return { valid: true, discount, message: '20% IPL Fan Discount Applied!' };
    }

    return { valid: false, discount: 0, message: 'Invalid or Expired Voucher Code.' };
  }
}
