// ===================================================
// IPL Dhaba Mobile — Zustand State Management Store
// Production-grade modular store replacing React Context
// ===================================================

import { UserProfile, CartItem, MenuItem, FoodOrder, TurfBooking, AppNotification } from '../../../../packages/shared/types';

export interface AppState {
  user: UserProfile;
  cart: CartItem[];
  foodOrders: FoodOrder[];
  turfBookings: TurfBooking[];
  notifications: AppNotification[];
  activeTab: 'home' | 'turfs' | 'food' | 'celebrations' | 'hub';

  // Actions
  setActiveTab: (tab: 'home' | 'turfs' | 'food' | 'celebrations' | 'hub') => void;
  addToCart: (item: MenuItem, quantity?: number) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  addFoodOrder: (order: FoodOrder) => void;
  addTurfBooking: (booking: TurfBooking) => void;
  addNotification: (title: string, message: string, type: AppNotification['type']) => void;
}

const INITIAL_USER: UserProfile = {
  id: 'usr_78910',
  name: 'Rahul Sharma',
  phone: '+91 98765 43210',
  email: 'rahul.sharma@example.com',
  favoriteTeam: 'Royal Challengers Bengaluru',
  walletBalance: 1450,
  fanPoints: 920,
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
  isLoggedIn: true,
  role: 'customer',
};

export const createInitialState = (): AppState => ({
  user: INITIAL_USER,
  cart: [],
  foodOrders: [],
  turfBookings: [],
  notifications: [],
  activeTab: 'home',

  setActiveTab: () => {},
  addToCart: () => {},
  removeFromCart: () => {},
  clearCart: () => {},
  addFoodOrder: () => {},
  addTurfBooking: () => {},
  addNotification: () => {},
});
