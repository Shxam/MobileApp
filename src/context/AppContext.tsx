import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserProfile,
  TurfBooking,
  FoodOrder,
  CelebrationBooking,
  CartItem,
  MenuItem,
  WalletTransaction,
  AppNotification,
  Language,
} from '../types';
import { INITIAL_USER } from '../data/mockData';
import { StorageEngine } from '../services/storageEngine';
import { EventStream } from '../services/eventStream';

interface AppContextType {
  user: UserProfile;
  updateUser: (fields: Partial<UserProfile>) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  isPhoneFrame: boolean;
  setIsPhoneFrame: (val: boolean) => void;
  
  // Cart State
  cart: CartItem[];
  addToCart: (item: MenuItem, quantity?: number) => void;
  removeFromCart: (itemId: string) => void;
  updateCartQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;

  // Bookings & Orders State
  turfBookings: TurfBooking[];
  addTurfBooking: (booking: Omit<TurfBooking, 'id' | 'createdAt' | 'status' | 'qrCode'>) => TurfBooking;
  rescheduleTurfBooking: (bookingId: string, newDate: string, newTime: string) => void;
  cancelTurfBooking: (bookingId: string) => void;

  foodOrders: FoodOrder[];
  addFoodOrder: (order: Omit<FoodOrder, 'id' | 'createdAt' | 'status'>) => FoodOrder;
  updateOrderStatus: (orderId: string, status: FoodOrder['status']) => void;

  celebrationBookings: CelebrationBooking[];
  addCelebrationBooking: (booking: Omit<CelebrationBooking, 'id' | 'createdAt' | 'status'>) => CelebrationBooking;

  // Wallet
  transactions: WalletTransaction[];
  topUpWallet: (amount: number, paymentMethod: string) => void;
  deductWallet: (amount: number, title: string, category: WalletTransaction['category'], referenceId: string) => boolean;

  // Notifications
  notifications: AppNotification[];
  toast: AppNotification | null;
  addNotification: (title: string, message: string, type: AppNotification['type']) => void;
  clearToast: () => void;
  markNotificationsRead: () => void;

  // Auth Modal
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile>(() => StorageEngine.loadUser(INITIAL_USER));
  const [language, setLanguage] = useState<Language>('en');
  const [isPhoneFrame, setIsPhoneFrame] = useState<boolean>(true);
  const [cart, setCart] = useState<CartItem[]>(() => StorageEngine.loadCart([]));
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Initial Bookings
  const [turfBookings, setTurfBookings] = useState<TurfBooking[]>(() =>
    StorageEngine.loadTurfBookings([
      {
        id: 'tb_1001',
        turfId: 'turf_1',
        turfName: 'IPL Dhaba Box Turf - Singarayakonda',
        turfAddress: 'Main Road, Near Highway Pavilion, Singarayakonda, AP',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        slots: [
          { id: 's7', time: '06:00 PM - 07:00 PM', price: 1200, status: 'booked', isFloodlit: true, category: 'Prime Evening' }
        ],
        totalAmount: 1200,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        qrCode: 'QR_TB1001_SINGARAYAKONDA',
        addons: [{ name: 'GoPro Recording', price: 200 }],
        matchFormat: 'Box Cricket 6v6',
      }
    ])
  );

  const [foodOrders, setFoodOrders] = useState<FoodOrder[]>(() =>
    StorageEngine.loadFoodOrders([
      {
        id: 'ord_2001',
        items: [
          {
            menuItem: {
              id: 'food_1',
              nameEn: 'Chicken Biryani',
              nameHi: 'चिकन बिरयानी',
              descriptionEn: 'Slow-cooked aromatic basmati rice',
              descriptionHi: 'दम पर पकी स्वादिष्ट बिरयानी',
              price: 150,
              category: 'biryani',
              image: '/IPL_DHABA_ITEMS/Chicken Biryani.jpg',
              isVeg: false,
              rating: 4.9,
              prepTimeMinutes: 15
            },
            quantity: 2
          }
        ],
        totalAmount: 300,
        deliveryType: 'turf_slot',
        deliveryTarget: 'Singarayakonda Turf - Cage 1 (Bench 1)',
        status: 'preparing',
        createdAt: new Date(Date.now() - 600000).toISOString(),
        estimatedDeliveryMinutes: 12,
        cookingInstructions: 'Extra spicy please!',
        paymentMethod: 'upi',
      }
    ])
  );

  const [celebrationBookings, setCelebrationBookings] = useState<CelebrationBooking[]>(() =>
    StorageEngine.loadCelebrations([])
  );

  // Sync to StorageEngine on state changes
  useEffect(() => { StorageEngine.saveUser(user); }, [user]);
  useEffect(() => { StorageEngine.saveCart(cart); }, [cart]);
  useEffect(() => { StorageEngine.saveTurfBookings(turfBookings); }, [turfBookings]);
  useEffect(() => { StorageEngine.saveFoodOrders(foodOrders); }, [foodOrders]);
  useEffect(() => { StorageEngine.saveCelebrations(celebrationBookings); }, [celebrationBookings]);

  // Transactions
  const [transactions, setTransactions] = useState<WalletTransaction[]>([
    {
      id: 'tx_501',
      type: 'credit',
      amount: 2000,
      title: 'UPI Top-Up via Razorpay',
      category: 'topup',
      timestamp: new Date(Date.now() - 172800000).toLocaleString(),
      referenceId: 'pay_RZP881920',
    },
    {
      id: 'tx_502',
      type: 'debit',
      amount: 1200,
      title: 'Turf Slot Booking - Koramangala',
      category: 'booking',
      timestamp: new Date(Date.now() - 86400000).toLocaleString(),
      referenceId: 'tb_1001',
    },
    {
      id: 'tx_503',
      type: 'credit',
      amount: 150,
      title: 'Fan Rewards Cashback Bonus',
      category: 'reward_cashback',
      timestamp: new Date(Date.now() - 43200000).toLocaleString(),
      referenceId: 'CB_FAN150',
    }
  ]);

  // Notifications
  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: 'notif_1',
      title: '🏏 Slot Confirmed!',
      message: 'Your Koramangala Box Turf booking for tomorrow at 7 PM is locked in!',
      timestamp: '10 mins ago',
      read: false,
      type: 'booking',
    },
    {
      id: 'notif_2',
      title: '🍲 Dhaba Kitchen Update',
      message: 'Order #ORD2001 (Biryani) is now being prepared in the tandoor.',
      timestamp: '5 mins ago',
      read: false,
      type: 'food',
    }
  ]);
  const [toast, setToast] = useState<AppNotification | null>(null);

  const addNotification = (title: string, message: string, type: AppNotification['type']) => {
    const newNotif: AppNotification = {
      id: `notif_${Date.now()}`,
      title,
      message,
      timestamp: 'Just now',
      read: false,
      type,
    };
    setNotifications((prev) => [newNotif, ...prev]);
    setToast(newNotif);
  };

  const clearToast = () => setToast(null);

  const markNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const updateUser = (fields: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...fields }));
  };

  // Cart Handlers
  const addToCart = (item: MenuItem, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.menuItem.id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.menuItem.id === item.id ? { ...ci, quantity: ci.quantity + quantity } : ci
        );
      }
      return [...prev, { menuItem: item, quantity }];
    });
    addNotification('Added to Dhaba Cart 🍲', `${item.nameEn} added to your food order.`, 'food');
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((ci) => ci.menuItem.id !== itemId));
  };

  const updateCartQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart((prev) =>
      prev.map((ci) => (ci.menuItem.id === itemId ? { ...ci, quantity } : ci))
    );
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((sum, ci) => sum + ci.menuItem.price * ci.quantity, 0);

  // Wallet Handlers
  const topUpWallet = (amount: number, paymentMethod: string) => {
    const earnedPoints = Math.floor(amount * 0.1); // 10% fan points on topup
    setUser((prev) => ({
      ...prev,
      walletBalance: prev.walletBalance + amount,
      fanPoints: prev.fanPoints + earnedPoints,
    }));

    const tx: WalletTransaction = {
      id: `tx_${Date.now()}`,
      type: 'credit',
      amount,
      title: `Wallet Top-Up (${paymentMethod})`,
      category: 'topup',
      timestamp: new Date().toLocaleString(),
      referenceId: `pay_${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    };

    setTransactions((prev) => [tx, ...prev]);
    addNotification(
      '💰 Wallet Credited!',
      `₹${amount} added successfully. You earned +${earnedPoints} Fan Points!`,
      'wallet'
    );
  };

  const deductWallet = (
    amount: number,
    title: string,
    category: WalletTransaction['category'],
    referenceId: string
  ): boolean => {
    if (user.walletBalance < amount) {
      return false;
    }

    const earnedPoints = Math.floor(amount * 0.05); // 5% points on spend
    setUser((prev) => ({
      ...prev,
      walletBalance: prev.walletBalance - amount,
      fanPoints: prev.fanPoints + earnedPoints,
    }));

    const tx: WalletTransaction = {
      id: `tx_${Date.now()}`,
      type: 'debit',
      amount,
      title,
      category,
      timestamp: new Date().toLocaleString(),
      referenceId,
    };

    setTransactions((prev) => [tx, ...prev]);
    return true;
  };

  // Booking Handlers
  const addTurfBooking = (
    bookingData: Omit<TurfBooking, 'id' | 'createdAt' | 'status' | 'qrCode'>
  ): TurfBooking => {
    const newBooking: TurfBooking = {
      ...bookingData,
      id: `tb_${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'confirmed',
      qrCode: `QR_TB_${Date.now()}`,
    };
    setTurfBookings((prev) => [newBooking, ...prev]);
    addNotification(
      '🏏 Turf Booked!',
      `Slot confirmed at ${bookingData.turfName} for ${bookingData.date}.`,
      'booking'
    );
    return newBooking;
  };

  const rescheduleTurfBooking = (bookingId: string, newDate: string, newTime: string) => {
    setTurfBookings((prev) =>
      prev.map((tb) =>
        tb.id === bookingId
          ? {
              ...tb,
              date: newDate,
              status: 'rescheduled',
              slots: tb.slots.map((s) => ({ ...s, time: newTime })),
            }
          : tb
      )
    );
    addNotification('📅 Slot Rescheduled', `Your turf booking has been moved to ${newDate} (${newTime}).`, 'booking');
  };

  const cancelTurfBooking = (bookingId: string) => {
    const booking = turfBookings.find((tb) => tb.id === bookingId);
    if (!booking) return;

    // Refund 90%
    const refundAmount = Math.floor(booking.totalAmount * 0.9);
    setUser((prev) => ({ ...prev, walletBalance: prev.walletBalance + refundAmount }));

    setTurfBookings((prev) =>
      prev.map((tb) => (tb.id === bookingId ? { ...tb, status: 'cancelled' } : tb))
    );

    const tx: WalletTransaction = {
      id: `tx_${Date.now()}`,
      type: 'credit',
      amount: refundAmount,
      title: `Refund: Cancelled Turf Booking #${bookingId.substring(0, 8)}`,
      category: 'reward_cashback',
      timestamp: new Date().toLocaleString(),
      referenceId: bookingId,
    };
    setTransactions((prev) => [tx, ...prev]);

    addNotification('❌ Booking Cancelled', `₹${refundAmount} refunded to your IPL Dhaba Wallet.`, 'wallet');
  };

  // Food Order Handler
  const addFoodOrder = (
    orderData: Omit<FoodOrder, 'id' | 'createdAt' | 'status'>
  ): FoodOrder => {
    const newOrder: FoodOrder = {
      ...orderData,
      id: `ord_${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'placed',
    };
    setFoodOrders((prev) => [newOrder, ...prev]);
    clearCart();

    addNotification(
      '🍲 Order Placed!',
      `IPL Dhaba kitchen has received your order (#${newOrder.id.substring(4, 10)}).`,
      'food'
    );

    // Simulate progress pipeline after delay
    setTimeout(() => {
      updateOrderStatus(newOrder.id, 'preparing');
      addNotification('👨‍🍳 Order Preparing', 'Your food is sizzling on the dhaba tandoor!', 'food');
    }, 6000);

    setTimeout(() => {
      updateOrderStatus(newOrder.id, 'out_for_delivery');
      addNotification('🚀 Out for Delivery', 'Runner is carrying your food pitch-side!', 'food');
    }, 15000);

    return newOrder;
  };

  const updateOrderStatus = (orderId: string, status: FoodOrder['status']) => {
    setFoodOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status } : o))
    );
  };

  // Celebration Booking Handler
  const addCelebrationBooking = (
    bookingData: Omit<CelebrationBooking, 'id' | 'createdAt' | 'status'>
  ): CelebrationBooking => {
    const newBooking: CelebrationBooking = {
      ...bookingData,
      id: `cel_${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'confirmed',
    };
    setCelebrationBookings((prev) => [newBooking, ...prev]);
    addNotification(
      '🎉 Party Package Booked!',
      `Celebration confirmed at ${bookingData.turfName} for ${bookingData.eventDate}.`,
      'booking'
    );
    return newBooking;
  };

  const logout = () => {
    setUser((prev) => ({ ...prev, isLoggedIn: false }));
    setIsAuthModalOpen(true);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        updateUser,
        language,
        setLanguage,
        isPhoneFrame,
        setIsPhoneFrame,
        cart,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        cartTotal,
        turfBookings,
        addTurfBooking,
        rescheduleTurfBooking,
        cancelTurfBooking,
        foodOrders,
        addFoodOrder,
        updateOrderStatus,
        celebrationBookings,
        addCelebrationBooking,
        transactions,
        topUpWallet,
        deductWallet,
        notifications,
        toast,
        addNotification,
        clearToast,
        markNotificationsRead,
        isAuthModalOpen,
        setIsAuthModalOpen,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
