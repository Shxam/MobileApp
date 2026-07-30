export type Language = 'en' | 'hi';

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
}

export interface TurfSlot {
  id: string;
  time: string; // e.g. "06:00 AM - 07:00 AM"
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
  matchFormat?: string; // e.g., "Box Cricket T10", "Box Cricket 6v6"
}

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
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  customization?: string;
}

export interface FoodOrder {
  id: string;
  items: CartItem[];
  totalAmount: number;
  deliveryType: 'turf_slot' | 'home_delivery';
  deliveryTarget: string; // e.g. "Koramangala Turf - Cage 2, Slot 7 PM" or Home address
  status: 'placed' | 'preparing' | 'out_for_delivery' | 'delivered';
  createdAt: string;
  estimatedDeliveryMinutes: number;
  cookingInstructions?: string;
  paymentMethod: 'wallet' | 'upi' | 'card';
}

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
}

export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  title: string;
  category: 'topup' | 'booking' | 'food' | 'celebration' | 'reward_cashback';
  timestamp: string;
  referenceId: string;
}

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

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'booking' | 'food' | 'wallet' | 'reward';
}
