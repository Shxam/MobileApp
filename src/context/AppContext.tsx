import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CartItem, MenuItem, Language, OrderStatus, UserProfile } from '../types';
import { StorageEngine } from '../services/storageEngine';
import {
  ApiClient,
  ApiError,
  SESSION_EXPIRED_EVENT,
  tokenStore,
  type CelebrationBookingView,
  type NotificationFeed,
  type OrderView,
  type TurfBookingView,
  type WalletView,
} from '../services/apiClient';
import { subscribeToUserFeed, reconnectSocket, disconnectSocket } from '../services/realtimeClient';
import { topUpWallet as razorpayTopUp, PaymentCancelledError } from '../services/razorpayCheckout';
import { FirebaseAuthService } from '../services/firebaseAuth';

/**
 * A signed-out user.
 *
 * This is not a profile — it is the absence of one, and every field is the empty
 * value rather than a plausible-looking placeholder. The version this replaced
 * seeded a fake customer with ₹2,450 in their wallet and 1,250 fan points from
 * `mockData.INITIAL_USER`, which the wallet screen rendered as a real balance to
 * anyone who opened the app without signing in.
 */
const SIGNED_OUT_USER: UserProfile = {
  id: '',
  name: 'Guest',
  phone: '',
  favoriteTeam: null,
  walletBalancePaise: 0,
  fanPoints: 0,
  role: 'customer',
  isLoggedIn: false,
};

/**
 * A toast that is shown but never persisted.
 *
 * Local toasts ("added to cart") and server notifications share a list, so the
 * bell badge counts both. Only server rows have an id the API will accept for
 * `markRead`, hence the flag: marking a local toast read must not fire a request
 * for an id the server has never seen.
 */
export interface ClientNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: string;
  /** True for rows that came from `GET /notifications` and can be marked read server-side. */
  persisted: boolean;
}

interface AppContextType {
  user: UserProfile;
  /** Re-reads the profile from the server. There is no local mutation path. */
  refreshUser: () => Promise<void>;
  /**
   * Saves a profile edit through `PATCH /auth/me` and stores what came back.
   *
   * Only `name` and `favoriteTeam` are accepted — the wallet balance, fan points
   * and role are server-owned. The previous shape of this function took a
   * `Partial<UserProfile>` and merged it into local state, which is how the app
   * ended up able to award itself fan points.
   */
  updateUser: (changes: { name?: string; favoriteTeam?: string }) => Promise<void>;
  isAuthenticating: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  isPhoneFrame: boolean;
  setIsPhoneFrame: (val: boolean) => void;

  // Cart — the only genuinely client-owned state in this file.
  cart: CartItem[];
  addToCart: (item: MenuItem, quantity?: number) => void;
  removeFromCart: (itemId: string) => void;
  updateCartQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  /** Indicative subtotal in paise. The charged total comes from `POST /orders/quote`. */
  cartTotalPaise: number;

  // Server-owned collections. Mutations go through the API and then refetch.
  turfBookings: TurfBookingView[];
  refreshTurfBookings: () => Promise<void>;
  cancelTurfBooking: (bookingId: string) => Promise<void>;

  foodOrders: OrderView[];
  refreshOrders: () => Promise<void>;
  /** Replaces one order in place — used by the realtime feed and after a payment. */
  applyOrderUpdate: (order: OrderView) => void;
  cancelOrder: (orderId: string, reason?: string) => Promise<void>;
  /**
   * Staff-only lifecycle move, used by the partner console.
   *
   * The server decides which transitions the caller's role may make; a customer
   * calling this gets a 403 rather than a silently ignored click.
   */
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;

  /**
   * The delivery code for the order currently in transit, or `null`.
   *
   * Held rather than toasted: it is issued once over the socket and the rider
   * cannot complete the delivery without it.
   */
  deliveryOtp: DeliveryOtpState | null;

  /**
   * Submits a rating for a delivered order or a turf booking.
   *
   * The server rejects a duplicate (409) and any target that is not reviewable
   * yet, so the UI treats this as a fire-and-forget best effort.
   */
  submitReview: (input: {
    orderId?: string;
    bookingId?: string;
    rating: number;
    comment: string;
  }) => Promise<void>;

  celebrationBookings: CelebrationBookingView[];
  refreshCelebrations: () => Promise<void>;

  // Wallet
  wallet: WalletView | null;
  refreshWallet: () => Promise<void>;
  /** Opens Razorpay Checkout for a top-up. Resolves once the credit is confirmed. */
  topUpWallet: (amountPaise: number) => Promise<void>;

  // Notifications
  notifications: ClientNotification[];
  unreadCount: number;
  toast: ClientNotification | null;
  /** Local, ephemeral toast. Server notifications arrive via `refreshNotifications`. */
  addNotification: (title: string, message: string, type?: string) => void;
  clearToast: () => void;
  markNotificationsRead: () => void;
  refreshNotifications: () => Promise<void>;

  // Auth
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  /** Called after a successful sign-in; loads the profile and every collection. */
  onAuthenticated: () => Promise<void>;
  logout: () => Promise<void>;
}

/** The one-time code the customer reads out to the rider. */
export interface DeliveryOtpState {
  orderId: string;
  orderNumber: string;
  deliveryOtp: string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
/** Local toasts get a client id that can never collide with a server UUID. */
let toastSequence = 0;
const nextToastId = () => `local_${Date.now()}_${(toastSequence += 1)}`;

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile>(SIGNED_OUT_USER);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(() => tokenStore.isAuthenticated);
  const [language, setLanguage] = useState<Language>('en');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isPhoneFrame, setIsPhoneFrame] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  /**
   * The cart survives a reload; nothing else does.
   *
   * Orders, bookings and the wallet were persisted here too, which meant a
   * cancelled booking stayed "confirmed" in localStorage until the user cleared
   * their browser. Server-owned data is now fetched, never cached.
   */
  const [cart, setCart] = useState<CartItem[]>(() => StorageEngine.loadCart([]));

  const [turfBookings, setTurfBookings] = useState<TurfBookingView[]>([]);
  const [foodOrders, setFoodOrders] = useState<OrderView[]>([]);
  const [celebrationBookings, setCelebrationBookings] = useState<CelebrationBookingView[]>([]);
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [serverUnread, setServerUnread] = useState(0);
  const [toast, setToast] = useState<ClientNotification | null>(null);

  /**
   * The live delivery code for the order currently out for delivery.
   *
   * It arrives once, on the customer's private socket room, at the moment the
   * rider picks the order up — so it has to be held rather than shown as a
   * passing toast: a customer who misses the toast has no other way to get the
   * code, and the rider cannot close the order without it. Cleared when that
   * order reaches a terminal state.
   */
  const [deliveryOtp, setDeliveryOtp] = useState<DeliveryOtpState | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    StorageEngine.saveCart(cart);
  }, [cart]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // ─── Notifications ────────────────────────────────

  const addNotification = useCallback((title: string, message: string, type = 'general') => {
    const notif: ClientNotification = {
      id: nextToastId(),
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
      type,
      persisted: false,
    };
    setNotifications((prev) => [notif, ...prev].slice(0, 60));
    setToast(notif);
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  const refreshNotifications = useCallback(async () => {
    if (!tokenStore.isAuthenticated) return;
    try {
      const feed: NotificationFeed = await ApiClient.getNotifications(30);
      const serverRows: ClientNotification[] = feed.items.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        timestamp: n.timestamp,
        read: n.read,
        type: n.type,
        persisted: true,
      }));
      // Local toasts from this session are kept above the server page; they are
      // not in the feed and would otherwise vanish on every poll.
      setNotifications((prev) => [...prev.filter((n) => !n.persisted), ...serverRows]);
      setServerUnread(feed.unreadCount);
    } catch {
      /* The bell simply shows what it already has. */
    }
  }, []);

  /**
   * Marks everything read.
   *
   * The optimistic local update comes first so the badge clears on tap; if the
   * request fails the next `refreshNotifications` restores the true count rather
   * than leaving the user staring at a badge that will not clear.
   */
  const markNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setServerUnread(0);
    if (!tokenStore.isAuthenticated) return;
    ApiClient.markAllNotificationsRead().catch(() => refreshNotifications());
  }, [refreshNotifications]);

  const unreadCount = useMemo(
    () => serverUnread + notifications.filter((n) => !n.persisted && !n.read).length,
    [serverUnread, notifications],
  );

  // ─── Server-owned collections ─────────────────────

  const refreshUser = useCallback(async () => {
    if (!tokenStore.isAuthenticated) {
      setUser(SIGNED_OUT_USER);
      return;
    }
    const { user: profile } = await ApiClient.getMe();
    setUser({ ...profile, isLoggedIn: true });
  }, []);

  /**
   * Saves a profile edit.
   *
   * The response is written to state rather than the values that were sent —
   * the server trims, rejects and normalises, and echoing the request back would
   * show the user an edit that did not actually happen.
   */
  const updateUser = useCallback(async (changes: { name?: string; favoriteTeam?: string }) => {
    const { user: profile } = await ApiClient.updateProfile(changes);
    setUser({ ...profile, isLoggedIn: true });
  }, []);

  const refreshOrders = useCallback(async () => {
    if (!tokenStore.isAuthenticated) return;
    setFoodOrders(await ApiClient.getOrders('all', 50));
  }, []);

  const refreshTurfBookings = useCallback(async () => {
    if (!tokenStore.isAuthenticated) return;
    setTurfBookings(await ApiClient.getMyTurfBookings());
  }, []);

  const refreshCelebrations = useCallback(async () => {
    if (!tokenStore.isAuthenticated) return;
    setCelebrationBookings(await ApiClient.getCelebrationBookings());
  }, []);

  /**
   * Reloads the wallet and folds the balance back into `user`.
   *
   * `walletBalancePaise` lives on the profile because that is what the header
   * renders, but the wallet endpoint is the authority. Keeping them in step here
   * is what lets every other screen read one number.
   */
  const refreshWallet = useCallback(async () => {
    if (!tokenStore.isAuthenticated) return;
    const next = await ApiClient.getWallet(30);
    setWallet(next);
    setUser((prev) =>
      prev.walletBalancePaise === next.balancePaise && prev.fanPoints === next.fanPoints
        ? prev
        : { ...prev, walletBalancePaise: next.balancePaise, fanPoints: next.fanPoints },
    );
  }, []);

  /**
   * Loads everything a signed-in session needs.
   *
   * `allSettled`, not `all`: a failing celebrations endpoint must not leave the
   * user with no orders and no wallet. Each collection is independent, and the
   * ones that load are worth showing.
   */
  const loadSession = useCallback(async () => {
    setIsAuthenticating(true);
    try {
      await refreshUser();
      await Promise.allSettled([
        refreshOrders(),
        refreshTurfBookings(),
        refreshCelebrations(),
        refreshWallet(),
        refreshNotifications(),
      ]);
    } catch (error) {
      // A failed profile read means the session is not usable. `ApiClient` has
      // already dispatched SESSION_EXPIRED_EVENT for a 401; anything else is a
      // network problem and the app stays signed out until the next attempt.
      if (!(error instanceof ApiError) || !error.isAuthError) {
        setUser(SIGNED_OUT_USER);
      }
    } finally {
      setIsAuthenticating(false);
    }
  }, [refreshUser, refreshOrders, refreshTurfBookings, refreshCelebrations, refreshWallet, refreshNotifications]);

  const onAuthenticated = useCallback(async () => {
    reconnectSocket();
    await loadSession();
  }, [loadSession]);

  // Boot: if a token survived the reload, restore the session from the server.
  useEffect(() => {
    if (tokenStore.isAuthenticated) {
      void loadSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = useCallback(async () => {
    // Local state is cleared regardless of what the network does — a logout that
    // leaves the previous user's orders on screen because the request timed out
    // is worse than one the server learns about late.
    try {
      await ApiClient.logout();
    } finally {
      await FirebaseAuthService.signOut().catch(() => undefined);
      disconnectSocket();
      setUser(SIGNED_OUT_USER);
      setFoodOrders([]);
      setTurfBookings([]);
      setCelebrationBookings([]);
      setWallet(null);
      setNotifications([]);
      setServerUnread(0);
      setCart([]);
      setIsAuthModalOpen(true);
    }
  }, []);

  /**
   * Forced sign-out, raised by `ApiClient` when the refresh token is gone.
   *
   * Without this the UI stays in its signed-in shape while every request 401s,
   * which reads to the user as "the app is broken" rather than "you were signed
   * out".
   */
  useEffect(() => {
    const onExpired = () => {
      disconnectSocket();
      setUser(SIGNED_OUT_USER);
      setFoodOrders([]);
      setTurfBookings([]);
      setCelebrationBookings([]);
      setWallet(null);
      setIsAuthModalOpen(true);
      addNotification('Session expired', 'Please sign in again to continue.', 'general');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [addNotification]);

  // ─── Realtime ─────────────────────────────────────

  /**
   * Handlers are held in a ref so the subscription is established once per
   * session rather than being torn down and rebuilt on every state change. A
   * resubscribe per render drops events in the gap between the two.
   */
  const handlersRef = useRef({ refreshOrders, refreshWallet, refreshTurfBookings, refreshNotifications, addNotification });
  handlersRef.current = { refreshOrders, refreshWallet, refreshTurfBookings, refreshNotifications, addNotification };

  useEffect(() => {
    if (!user.isLoggedIn) return;
    const unsubscribe = subscribeToUserFeed({
      onOrderCreated: () => void handlersRef.current.refreshOrders(),
      onOrderUpdated: () => {
        void handlersRef.current.refreshOrders();
        void handlersRef.current.refreshNotifications();
      },
      onWalletUpdated: () => void handlersRef.current.refreshWallet(),
      onPaymentUpdated: () => {
        void handlersRef.current.refreshOrders();
        void handlersRef.current.refreshWallet();
      },
      onBookingUpdated: () => void handlersRef.current.refreshTurfBookings(),
      onDeliveryOtp: (payload) => {
        // Kept in state as well as toasted: the toast is gone in seconds and
        // the code is the only way the delivery can be closed.
        setDeliveryOtp({
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
          deliveryOtp: payload.deliveryOtp,
        });
        handlersRef.current.addNotification(
          'Delivery OTP',
          `Share ${payload.deliveryOtp} with your rider to confirm delivery.`,
          'order',
        );
      },
    });
    return unsubscribe;
  }, [user.isLoggedIn]);

  /**
   * Drops the delivery code once its order is finished.
   *
   * A live code left on screen after delivery is at best confusing and at worst
   * an invitation to read it out to the next person who asks.
   */
  useEffect(() => {
    if (!deliveryOtp) return;
    const order = foodOrders.find((o) => o.id === deliveryOtp.orderId);
    if (order && order.isTerminal) setDeliveryOtp(null);
  }, [foodOrders, deliveryOtp]);

  // ─── Cart ─────────────────────────────────────────

  const addToCart = useCallback(
    (item: MenuItem, quantity = 1) => {
      setCart((prev) => {
        const existing = prev.find((ci) => ci.menuItem.id === item.id);
        if (existing) {
          return prev.map((ci) =>
            ci.menuItem.id === item.id ? { ...ci, quantity: ci.quantity + quantity } : ci,
          );
        }
        return [...prev, { menuItem: item, quantity }];
      });
      addNotification('Added to cart', `${item.nameEn} is in your order.`, 'general');
    },
    [addNotification],
  );

  const removeFromCart = useCallback((itemId: string) => {
    setCart((prev) => prev.filter((ci) => ci.menuItem.id !== itemId));
  }, []);

  const updateCartQuantity = useCallback((itemId: string, quantity: number) => {
    setCart((prev) =>
      quantity <= 0
        ? prev.filter((ci) => ci.menuItem.id !== itemId)
        : prev.map((ci) => (ci.menuItem.id === itemId ? { ...ci, quantity } : ci)),
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  /**
   * Indicative only — GST, delivery and any voucher are added by the server.
   *
   * This is deliberately not the number the customer is charged. The old
   * implementation multiplied a float rupee price here and passed the result to
   * order creation as the total.
   */
  const cartTotalPaise = useMemo(
    () => cart.reduce((sum, ci) => sum + ci.menuItem.pricePaise * ci.quantity, 0),
    [cart],
  );

  // ─── Mutations ────────────────────────────────────

  const applyOrderUpdate = useCallback((order: OrderView) => {
    setFoodOrders((prev) => {
      const index = prev.findIndex((o) => o.id === order.id);
      if (index === -1) return [order, ...prev];
      const next = [...prev];
      next[index] = order;
      return next;
    });
  }, []);

  const cancelOrder = useCallback(
    async (orderId: string, reason?: string) => {
      const updated = await ApiClient.cancelOrder(orderId, reason);
      applyOrderUpdate(updated);
      // Cancellation may refund to the wallet; the balance the header shows must
      // reflect that without a reload.
      await refreshWallet().catch(() => undefined);
    },
    [applyOrderUpdate, refreshWallet],
  );

  /**
   * The partner console's status button.
   *
   * The returned order is written straight into the list rather than triggering
   * a refetch: the staff member needs the card to move the moment the server
   * agrees, and the realtime feed will deliver the same update again anyway.
   */
  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      applyOrderUpdate(await ApiClient.updateOrderStatus(orderId, status));
    },
    [applyOrderUpdate],
  );

  /**
   * Posts a rating. Turf reviews move the turf's average on the server, so the
   * turf list is refreshed to pick up the new figure.
   */
  const submitReview = useCallback(
    async (input: { orderId?: string; bookingId?: string; rating: number; comment: string }) => {
      await ApiClient.submitReview(input);
      addNotification('Thanks for the review', 'Your rating helps the dhaba improve.', 'system');
    },
    [addNotification],
  );

  const cancelTurfBooking = useCallback(
    async (bookingId: string) => {
      const result = await ApiClient.cancelTurfBooking(bookingId);
      await Promise.allSettled([refreshTurfBookings(), refreshWallet()]);
      addNotification(
        'Booking cancelled',
        result.refundedPaise > 0
          ? `₹${(result.refundedPaise / 100).toLocaleString('en-IN')} has been refunded to your wallet.`
          : 'Your booking has been cancelled.',
        'booking',
      );
    },
    [refreshTurfBookings, refreshWallet, addNotification],
  );

  /**
   * Tops up the wallet through Razorpay.
   *
   * The balance is never adjusted here. `verifyWalletTopUp` returns the wallet
   * as the server sees it after the credit, and `refreshWallet` writes that
   * through — so a payment that is captured but not yet verified shows the old
   * balance rather than an invented one.
   */
  const topUpWallet = useCallback(
    async (amountPaise: number) => {
      try {
        const updated = await razorpayTopUp(amountPaise, {
          customerName: user.name,
          customerPhone: user.phone,
        });
        setWallet(updated);
        setUser((prev) => ({
          ...prev,
          walletBalancePaise: updated.balancePaise,
          fanPoints: updated.fanPoints,
        }));
        addNotification(
          'Wallet topped up',
          `₹${(amountPaise / 100).toLocaleString('en-IN')} added to your wallet.`,
          'wallet',
        );
      } catch (error) {
        if (error instanceof PaymentCancelledError) return;
        throw error;
      }
    },
    [user.name, user.phone, addNotification],
  );

  const value = useMemo<AppContextType>(
    () => ({
      user,
      refreshUser,
      updateUser,
      isAuthenticating,
      language,
      setLanguage,
      theme,
      setTheme,
      toggleTheme,
      isPhoneFrame,
      setIsPhoneFrame,
      cart,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      clearCart,
      cartTotalPaise,
      turfBookings,
      refreshTurfBookings,
      cancelTurfBooking,
      foodOrders,
      refreshOrders,
      applyOrderUpdate,
      cancelOrder,
      updateOrderStatus,
      deliveryOtp,
      submitReview,
      celebrationBookings,
      refreshCelebrations,
      wallet,
      refreshWallet,
      topUpWallet,
      notifications,
      unreadCount,
      toast,
      addNotification,
      clearToast,
      markNotificationsRead,
      refreshNotifications,
      isAuthModalOpen,
      setIsAuthModalOpen,
      onAuthenticated,
      logout,
    }),
    [
      user, refreshUser, updateUser, isAuthenticating, language, theme, toggleTheme, isPhoneFrame,
      cart, addToCart, removeFromCart, updateCartQuantity, clearCart, cartTotalPaise,
      turfBookings, refreshTurfBookings, cancelTurfBooking,
      foodOrders, refreshOrders, applyOrderUpdate, cancelOrder, updateOrderStatus, submitReview, deliveryOtp,
      celebrationBookings, refreshCelebrations,
      wallet, refreshWallet, topUpWallet,
      notifications, unreadCount, toast, addNotification, clearToast, markNotificationsRead,
      refreshNotifications, isAuthModalOpen, onAuthenticated, logout,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
