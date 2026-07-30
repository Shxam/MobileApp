// ===================================================
// IPL Dhaba — Shared Domain Types
// Single source of truth for Frontend + Backend
// ===================================================

export type Language = 'en' | 'hi';

// ─── User & Auth ────────────────────────────────────
export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  favoriteTeam: string;
  walletBalance: number;
  fanPoints: number;
  avatar: string;
  isLoggedIn: boolean;
  role: UserRole;
}

export type UserRole = 'customer' | 'driver' | 'partner' | 'admin';

// ─── Turf Domain ────────────────────────────────────
export interface TurfSlot {
  id: string;
  time: string;
  price: number;
  status: 'available' | 'held' | 'booked';
  isFloodlit: boolean;
  category: 'Morning' | 'Afternoon' | 'Prime Evening' | 'Night Floodlit';
}

export interface Turf {
  id: string;
  name: string;
  location: string;
  area: string;
  distance: string;
  rating: number;
  reviewsCount: number;
  pricePerHour: number;
  image: string;
  gallery: string[];
  amenities: string[];
  pitchType: 'AstroTurf Box' | 'Natural Grass' | 'Floodlit Pro Cage' | 'Indoor Nets';
  address: string;
  coordinates: { lat: number; lng: number };
  description: string;
}

export interface TurfBooking {
  id: string;
  turfId: string;
  turfName: string;
  turfAddress: string;
  date: string;
  slots: TurfSlot[];
  totalAmount: number;
  status: 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
  createdAt: string;
  qrCode: string;
  addons: { name: string; price: number }[];
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
  price: number;
  category: string;
  image: string;
  isVeg: boolean;
  isBestseller?: boolean;
  rating: number;
  prepTimeMinutes: number;
  calories?: number;
  spiciness?: 'mild' | 'medium' | 'spicy' | 'fiery';
  isAvailable?: boolean;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  customization?: string;
}

export type OrderStatus = 'placed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';

export interface FoodOrder {
  id: string;
  items: CartItem[];
  totalAmount: number;
  deliveryType: 'turf_slot' | 'home_delivery';
  deliveryTarget: string;
  status: OrderStatus;
  createdAt: string;
  estimatedDeliveryMinutes: number;
  cookingInstructions?: string;
  paymentMethod: 'wallet' | 'upi' | 'card';
  userId?: string;
  driverId?: string;
}

// ─── Celebrations Domain ────────────────────────────
export interface CelebrationPackage {
  id: string;
  titleEn: string;
  titleHi: string;
  subtitleEn: string;
  subtitleHi: string;
  basePrice: number;
  image: string;
  inclusionsEn: string[];
  inclusionsHi: string[];
  recommendedFor: string;
  rating: number;
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
  totalAmount: number;
  status: 'confirmed' | 'in_preparation' | 'completed';
  createdAt: string;
  userId?: string;
}

// ─── Wallet Domain ──────────────────────────────────
export type TransactionCategory = 'topup' | 'booking' | 'food' | 'celebration' | 'reward_cashback' | 'refund';

export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  title: string;
  category: TransactionCategory;
  timestamp: string;
  referenceId: string;
  userId?: string;
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
  discountAmount?: number;
  image: string;
}

// ─── Notifications ──────────────────────────────────
export type NotificationType = 'booking' | 'food' | 'wallet' | 'reward' | 'system' | 'driver';

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
  rating: number; // 1-5
  comment: string;
  createdAt: string;
}

// ─── Driver ─────────────────────────────────────────
export interface DriverProfile {
  id: string;
  name: string;
  phone: string;
  vehicleType: 'bike' | 'auto' | 'car';
  vehicleNumber: string;
  isOnline: boolean;
  currentLocation?: { lat: number; lng: number };
  rating: number;
}

export interface DriverAssignment {
  id: string;
  orderId: string;
  driverId: string;
  status: 'assigned' | 'picked_up' | 'en_route' | 'delivered';
  assignedAt: string;
  deliveredAt?: string;
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

// ─── Bill / Pricing ─────────────────────────────────
export interface BillBreakdown {
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  deliveryFee: number;
  discount: number;
  grandTotal: number;
}
