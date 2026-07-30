import { UserProfile, TurfBooking, FoodOrder, CelebrationBooking, CartItem } from '../types';

const STORAGE_KEYS = {
  USER: 'ipl_dhaba_user_profile',
  CART: 'ipl_dhaba_cart_items',
  TURF_BOOKINGS: 'ipl_dhaba_turf_bookings',
  FOOD_ORDERS: 'ipl_dhaba_food_orders',
  CELEBRATION_BOOKINGS: 'ipl_dhaba_celebration_bookings',
  LANGUAGE: 'ipl_dhaba_app_language',
};

export class StorageEngine {
  /**
   * Save item safely to LocalStorage
   */
  public static save<T>(key: string, data: T): void {
    try {
      const json = JSON.stringify(data);
      localStorage.setItem(key, json);
    } catch (err) {
      console.warn(`[StorageEngine] Failed to save key "${key}":`, err);
    }
  }

  /**
   * Load item safely from LocalStorage
   */
  public static load<T>(key: string, fallback: T): T {
    try {
      const item = localStorage.getItem(key);
      if (!item) return fallback;
      return JSON.parse(item) as T;
    } catch (err) {
      console.warn(`[StorageEngine] Failed to load key "${key}":`, err);
      return fallback;
    }
  }

  /**
   * Domain-specific persistent storage helpers
   */
  public static saveUser(user: UserProfile): void {
    this.save(STORAGE_KEYS.USER, user);
  }

  public static loadUser(fallback: UserProfile): UserProfile {
    return this.load(STORAGE_KEYS.USER, fallback);
  }

  public static saveCart(cart: CartItem[]): void {
    this.save(STORAGE_KEYS.CART, cart);
  }

  public static loadCart(fallback: CartItem[] = []): CartItem[] {
    return this.load(STORAGE_KEYS.CART, fallback);
  }

  public static saveTurfBookings(bookings: TurfBooking[]): void {
    this.save(STORAGE_KEYS.TURF_BOOKINGS, bookings);
  }

  public static loadTurfBookings(fallback: TurfBooking[]): TurfBooking[] {
    return this.load(STORAGE_KEYS.TURF_BOOKINGS, fallback);
  }

  public static saveFoodOrders(orders: FoodOrder[]): void {
    this.save(STORAGE_KEYS.FOOD_ORDERS, orders);
  }

  public static loadFoodOrders(fallback: FoodOrder[]): FoodOrder[] {
    return this.load(STORAGE_KEYS.FOOD_ORDERS, fallback);
  }

  public static saveCelebrations(bookings: CelebrationBooking[]): void {
    this.save(STORAGE_KEYS.CELEBRATION_BOOKINGS, bookings);
  }

  public static loadCelebrations(fallback: CelebrationBooking[]): CelebrationBooking[] {
    return this.load(STORAGE_KEYS.CELEBRATION_BOOKINGS, fallback);
  }
}
