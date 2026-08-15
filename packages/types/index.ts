// ===================================================
// IPL Dhaba — Canonical Domain Types
//
// Single source of truth for every app (customer, admin, kitchen KDS, driver,
// mobile) and the backend. `src/types.ts` and `packages/shared/types` re-export
// from here; do not add new definitions to either of those.
//
// MONEY: every `*Paise` field is an INTEGER count of paise (₹1 = 100 paise).
// Floats are never used for money — they misround GST and cannot represent
// Razorpay amounts natively.
// ===================================================

export type Language = 'en' | 'hi';

// ─── User & Auth ────────────────────────────────────

export type UserRole = 'customer' | 'kitchen_staff' | 'delivery_partner' | 'partner' | 'admin';

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  favoriteTeam?: string | null;
  /** Wallet balance in paise. */
  walletBalancePaise: number;
  fanPoints: number;
  avatar?: string;
  isLoggedIn?: boolean;
  role: UserRole;
  dhabaId?: string | null;
  employeeId?: string | null;
  createdAt?: string;
}

export interface StaffLoginPayload {
  employeeId: string;
  pin: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface StaffAuthResponse {
  accessToken: string;
  user: UserProfile;
}

// ─── Turf Domain ────────────────────────────────────

export type SlotStatus = 'available' | 'held' | 'booked';

export interface TurfSlot {
  id: string;
  turfId?: string;
  /** Display label, e.g. "06:00 AM - 07:00 AM". */
  time: string;
  /** Slot price in paise. */
  pricePaise: number;
  status: SlotStatus;
  isFloodlit: boolean;
  category: 'Morning' | 'Afternoon' | 'Prime Evening' | 'Night Floodlit';
  date?: string;
}

export interface Turf {
  id: string;
  name: string;
  location: string;
  area: string;
  distance?: string;
  rating: number;
  reviewsCount: number;
  /** Hourly rate in paise. */
  pricePerHourPaise: number;
  image: string;
  gallery: string[];
  amenities: string[];
  pitchType: 'AstroTurf Box' | 'Natural Grass' | 'Floodlit Pro Cage' | 'Indoor Nets';
  address: string;
  /**
   * Null when the turf row has no lat/lng. The map declines to place a pin it
   * does not have rather than dropping one at (0, 0) in the Gulf of Guinea —
   * `turfs.service.ts` returns null for exactly this reason.
   */
  coordinates: { lat: number; lng: number } | null;
  description: string;
  dhabaId?: string;
}

export type BookingStatus = 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';

export interface TurfBooking {
  id: string;
  turfId: string;
  turfName: string;
  turfAddress: string;
  date: string;
  slots: TurfSlot[];
  /** Booking total in paise. */
  totalAmountPaise: number;
  status: BookingStatus;
  createdAt: string;
  qrCode: string;
  addons: { name: string; pricePaise: number }[];
  matchFormat?: string;
  userId?: string;
}

// ─── Food Domain ────────────────────────────────────

export interface FoodCategory {
  id: string;
  nameEn: string;
  nameHi: string;
  icon: string;
}

export interface MenuItem {
  id: string;
  nameEn: string;
  nameHi: string;
  descriptionEn: string;
  descriptionHi: string;
  /** Menu price in paise. */
  pricePaise: number;
  category: string;
  image: string;
  isVeg: boolean;
  isBestseller?: boolean;
  rating: number;
  prepTimeMinutes: number;
  calories?: number;
  spiciness?: 'mild' | 'medium' | 'spicy' | 'fiery';
  isAvailable?: boolean;
  dhabaId?: string;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  customization?: string;
}

/**
 * The order lifecycle.
 *
 * Happy path:
 *   awaiting_payment → placed → accepted → preparing → ready_for_pickup
 *   → assigned → picked_up → delivered
 *
 * `out_for_delivery` is a legacy alias of `picked_up`, retained so the staff
 * apps keep working through the migration.
 */
export type OrderStatus =
  | 'awaiting_payment'
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'assigned'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refunded'
  | 'payment_failed'
  | 'delivery_failed';

/** Statuses after which an order can no longer transition. */
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  'delivered',
  'cancelled',
  'refunded',
] as const;

export type PaymentMethod = 'razorpay' | 'cod' | 'wallet';

export type PaymentStatus =
  | 'pending'
  | 'cod_pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type DeliveryType = 'turf_slot' | 'turf_bench' | 'home_delivery';

export interface OrderItem {
  menuItemId: string;
  name?: string;
  quantity: number;
  /** Unit price in paise, captured at order time. */
  unitPricePaise: number;
}

/** Server-computed money breakdown. All fields are paise. */
export interface BillBreakdown {
  subtotalPaise: number;
  /** GST rate as a percentage, e.g. 5 for food, 18 for turf. */
  gstRate: number;
  gstAmountPaise: number;
  deliveryFeePaise: number;
  discountPaise: number;
  totalPaise: number;
}

export interface FoodOrder {
  id: string;
  orderNumber?: string;
  userId?: string;
  dhabaId?: string;
  items: CartItem[];
  bill: BillBreakdown;
  deliveryType: DeliveryType;
  deliveryTarget: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  createdAt: string;
  estimatedDeliveryMinutes: number;
  cookingInstructions?: string;
  driverId?: string | null;
  acceptedAt?: string | null;
  readyAt?: string | null;
  assignedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
}

/** Order shape used by the kitchen display, which does not need cart nesting. */
export interface KitchenOrder {
  id: string;
  orderNumber?: string;
  userId: string;
  dhabaId?: string;
  items: OrderItem[];
  /** Order total in paise. */
  totalAmountPaise: number;
  deliveryType: DeliveryType;
  deliveryTarget?: string;
  cookingInstructions?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
}

// ─── Pricing quotes ─────────────────────────────────

export interface QuoteLineItem {
  menuItemId: string;
  quantity: number;
}

export interface QuoteRequest {
  items: QuoteLineItem[];
  deliveryType: DeliveryType;
  promoCode?: string;
}

export interface Quote {
  quoteId: string;
  bill: BillBreakdown;
  items: OrderItem[];
  deliveryType: DeliveryType;
  promoCode?: string | null;
  /** ISO timestamp after which the quote is no longer honoured. */
  expiresAt: string;
}

// ─── Celebrations Domain ────────────────────────────

export interface CelebrationPackage {
  id: string;
  titleEn: string;
  titleHi: string;
  subtitleEn: string;
  subtitleHi: string;
  /** Base package price in paise. */
  basePricePaise: number;
  image: string;
  inclusionsEn: string[];
  inclusionsHi: string[];
  recommendedFor: string;
  rating: number;
  isActive?: boolean;
}

export interface CelebrationBooking {
  id: string;
  packageId: string;
  packageName: string;
  turfName: string;
  eventDate: string;
  timeSlot: string;
  guestCount: number;
  customizations: {
    decorTheme: string;
    commentarySetup: boolean;
    trophyPackage: boolean;
    specialFoodMenu: boolean;
    cakeKg: number;
  };
  /** Booking total in paise. */
  totalAmountPaise: number;
  status: 'confirmed' | 'in_preparation' | 'completed' | 'cancelled';
  createdAt: string;
  userId?: string;
}

// ─── Wallet Domain ──────────────────────────────────

export type TransactionCategory =
  | 'topup'
  | 'booking'
  | 'food'
  | 'celebration'
  | 'reward_cashback'
  | 'refund';

export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  /** Transaction amount in paise; always positive — direction is in `type`. */
  amountPaise: number;
  /** Wallet balance in paise immediately after this entry. */
  balanceAfterPaise?: number;
  title: string;
  category: TransactionCategory;
  timestamp: string;
  referenceId: string;
  userId?: string;
}

// ─── Payments ───────────────────────────────────────

export interface PaymentIntent {
  orderId: string;
  providerOrderId: string;
  /** Amount in paise — the unit Razorpay itself uses. */
  amountPaise: number;
  currency: 'INR';
  keyId: string;
}

export interface PaymentVerification {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

// ─── Fan Rewards ────────────────────────────────────

export interface FanReward {
  id: string;
  titleEn: string;
  titleHi: string;
  descriptionEn: string;
  descriptionHi: string;
  pointsRequired: number;
  code: string;
  rewardType: 'turf_discount' | 'free_food' | 'wallet_cash' | 'merchandise';
  /** Discount value in paise, when the reward is monetary. */
  discountAmountPaise?: number;
  image: string;
}

// ─── Notifications ──────────────────────────────────

/**
 * The kinds the server writes to the `notifications` table. Anything persisted
 * and re-fetched is one of these — see `notifications.service.ts`.
 */
export type ServerNotificationType = 'order' | 'booking' | 'payment' | 'wallet' | 'general';

/**
 * Server kinds plus the client-only ones.
 *
 * The extra four exist for toasts that are genuinely local and never persisted —
 * "added to cart", "voucher applied", "copied to clipboard". They are UI events,
 * not records, so the server has no opinion about them and never returns one.
 */
export type NotificationType = ServerNotificationType | 'food' | 'reward' | 'system' | 'driver';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: NotificationType;
  userId?: string;
}

// ─── Reviews ────────────────────────────────────────

export interface Review {
  id: string;
  userId: string;
  targetType: 'food_order' | 'turf_booking' | 'celebration';
  targetId: string;
  /** 1–5. */
  rating: number;
  comment: string;
  createdAt: string;
}

// ─── Saved addresses ────────────────────────────────

/**
 * A delivery address the customer saved for reuse.
 *
 * Orders keep their own `deliveryAddress` string snapshot, so editing one of
 * these never rewrites where an already-delivered order was sent.
 */
export interface SavedAddress {
  id: string;
  label: string;
  detail: string;
  landmark: string | null;
  pincode: string | null;
  isDefault: boolean;
  createdAt: string;
}

// ─── Vouchers ───────────────────────────────────────

/** An offer the signed-in customer can still redeem. */
export interface AvailableVoucher {
  code: string;
  description: string;
  /** `'percent'` or `'flat'`. */
  discountType: string;
  /** Percentage points when `percent`; paise when `flat`. */
  discountValue: number;
  maxDiscountPaise: number | null;
  minSubtotalPaise: number;
  perUserLimit: number;
  remainingForUser: number;
}

// ─── Live cricket ───────────────────────────────────

/**
 * One card in the live-score carousel, exactly as `GET /cricket/live-scores`
 * returns it.
 *
 * The backend does the shaping — CricAPI's raw innings arrays are turned into
 * display strings server-side, once, rather than in every client. The frontend
 * previously declared its own unrelated `LiveMatch` for this endpoint, so the
 * response never matched the state it was assigned to.
 */
export interface LiveMatchItem {
  id: string;
  matchTitle: string;
  series: string;
  team1: { name: string; code: string; score: string; overs: string; flagBg: string };
  team2: { name: string; code: string; score: string; overs: string; flagBg: string };
  statusText: string;
  isLive: boolean;
  scorecardDetails?: {
    team1Batter: string;
    team1Bowler: string;
    target?: string;
    crr: string;
    rrr?: string;
  };
}

// ─── Driver / Dispatch ──────────────────────────────

export interface DriverProfile {
  id: string;
  userId: string;
  name: string;
  phone: string;
  vehicleType: 'bike' | 'auto' | 'car';
  vehicleNumber: string;
  isOnline: boolean;
  currentLocation?: { lat: number; lng: number };
  activeOrderId?: string | null;
  rating: number;
  dhabaId?: string;
}

export interface DriverAssignment {
  id: string;
  orderId: string;
  driverId: string;
  status: 'assigned' | 'picked_up' | 'en_route' | 'delivered';
  assignedAt: string;
  deliveredAt?: string;
}

export interface DriverLocationUpdate {
  orderId: string;
  driverId: string;
  lat: number;
  lng: number;
  recordedAt: string;
}

// ─── Admin ──────────────────────────────────────────

export interface AdminSummaryReport {
  /** Revenue in paise. */
  todayRevenuePaise: number;
  todayOrderCount: number;
  activeTurfUtilizationPercent: number;
  activeStaffCount: number;
  timestamp: string;
}

// ─── Realtime ───────────────────────────────────────

export type RealtimeEventName =
  | 'order.created'
  | 'order.status_updated'
  | 'order.assigned'
  | 'driver.location'
  | 'slot.booked';

export interface RealtimeEvent<TPayload = unknown> {
  event: RealtimeEventName;
  dhabaId: string;
  payload: TPayload;
}

// ─── API Response Wrappers ──────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Money helpers ──────────────────────────────────

/** Rupees (possibly fractional, e.g. from user input) → integer paise. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Integer paise → rupees as a number. Display only; never for arithmetic. */
export function toRupees(paise: number): number {
  return paise / 100;
}

/** Integer paise → "₹1,234.50". */
export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
