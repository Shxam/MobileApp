// ===================================================
// IPL Dhaba — HTTP client
//
// One rule governs this file: **a failed request fails**. The version this
// replaces caught every error and returned `MOCK_TURFS` / `MOCK_MENU` /
// `MOCK_CELEBRATION_PACKAGES` instead — and it did so on any non-`ok` response,
// not just a network fault. A 401, a 500, a validation error: all of them
// rendered a plausible-looking catalogue of food that does not exist, at prices
// nobody set, which a customer could then try to order. Silence in the console,
// too. This client throws `ApiError` and lets the screen say so.
//
// MONEY: every `*Paise` field is an integer count of paise. Nothing here divides
// by 100 — that belongs in the render.
// ===================================================

import type {
  AppNotification,
  AvailableVoucher,
  BillBreakdown,
  CelebrationPackage,
  DeliveryType,
  MenuItem,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  SavedAddress,
  Turf,
  UserProfile,
} from '../types';

// ─── Configuration ──────────────────────────────────

/**
 * In development the relative path goes through the Vite proxy (see
 * `vite.config.ts`), which keeps the browser same-origin and sidesteps CORS
 * entirely. A production build may be served from a different host than the
 * API, so `VITE_API_URL` takes over there.
 */
const API_ORIGIN = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

const BASE_URL = `${API_ORIGIN}/api/v1`;

const ACCESS_TOKEN_KEY = 'ipl_dhaba_jwt_token';
const REFRESH_TOKEN_KEY = 'ipl_dhaba_refresh_token';

// ─── Errors ─────────────────────────────────────────

/**
 * A failed API call.
 *
 * `status` is what callers branch on: 401 means "sign in", 409 means "someone
 * else got there first, refresh the screen", 0 means the request never reached
 * the server. Collapsing those into one generic `Error` is how the previous
 * client ended up unable to tell an outage from a rejected password.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** The request never got an HTTP response — offline, DNS, CORS, server down. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

// ─── Token storage ──────────────────────────────────

/**
 * Session tokens.
 *
 * Wrapped rather than touched directly at each call site because six files were
 * reading and writing these two keys by hand, and a logout that forgot one of
 * them left a refresh token behind that could mint a new session.
 */
export const tokenStore = {
  getAccessToken(): string | null {
    try {
      return localStorage.getItem(ACCESS_TOKEN_KEY);
    } catch {
      // Safari private mode throws on localStorage access.
      return null;
    }
  },

  getRefreshToken(): string | null {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  set(accessToken: string, refreshToken?: string): void {
    try {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } catch {
      /* storage unavailable; the session lives for this tab only */
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch {
      /* nothing to clear */
    }
  },

  get isAuthenticated(): boolean {
    return Boolean(this.getAccessToken());
  },
};

/**
 * Fired when the session is gone for good — refresh token missing, expired, or
 * rejected. `AppContext` listens and drops the user back to signed-out rather
 * than leaving the UI in a state where every action silently 401s.
 */
export const SESSION_EXPIRED_EVENT = 'ipl-dhaba:session-expired';

function announceSessionExpired(): void {
  tokenStore.clear();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
}

// ─── Response payload types ─────────────────────────

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

/**
 * What `GET /notifications` returns.
 *
 * The unread count comes down with the page rather than being derived from
 * `items` — the feed is capped at 50, so counting the array would report "50
 * unread" forever once a user let them pile up.
 */
export interface NotificationFeed {
  items: AppNotification[];
  unreadCount: number;
}

export interface TurfSlotView {
  id: string;
  turfId: string | null;
  pitchName: string;
  pitchType: string;
  category: string;
  timeSlot: string;
  startTime: string;
  endTime: string;
  pricePaise: number;
  isFloodlit: boolean;
  isBooked: boolean;
}

export interface OrderLineView {
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
  menuItem: MenuItem;
}

export interface OrderView {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  isTerminal: boolean;
  bill: BillBreakdown;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  deliveryType: DeliveryType;
  deliveryTarget: string;
  deliveryAddress: string | null;
  cookingInstructions: string | null;
  estimatedDeliveryMinutes: number;
  promoCode: string | null;
  createdAt: string;
  acceptedAt: string | null;
  readyAt: string | null;
  assignedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  driver: { id: string; name: string; phone: string | null; vehicleNumber: string } | null;
  location: { latitude: number; longitude: number; heading: number | null; updatedAt: string } | null;
  items: OrderLineView[];
}

export interface QuoteView {
  quoteId: string;
  bill: BillBreakdown;
  lines: { menuItemId: string; name: string; quantity: number; unitPricePaise: number; lineTotalPaise: number }[];
  deliveryType: DeliveryType;
  promoCode: string | null;
  expiresAt: string;
}

/** One customer rating, against either an order or a turf booking. */
export interface ReviewView {
  id: string;
  rating: number;
  comment: string;
  orderId: string | null;
  bookingId: string | null;
  createdAt: string;
}

export interface WalletTransactionView {
  id: string;
  amountPaise: number;
  balanceAfterPaise: number | null;
  type: 'topup' | 'deduct' | 'refund' | 'reward';
  category: string;
  description: string;
  referenceId: string | null;
  createdAt: string;
}

export interface WalletView {
  userId: string;
  balancePaise: number;
  fanPoints: number;
  transactions: WalletTransactionView[];
}

export interface PaymentIntentView {
  orderId: string;
  providerOrderId: string;
  amountPaise: number;
  currency: 'INR';
  keyId: string;
}

export interface CelebrationQuoteView {
  basePricePaise: number;
  extraGuestPaise: number;
  commentaryPaise: number;
  trophyPaise: number;
  foodMenuPaise: number;
  cakePaise: number;
  addonsPaise: number;
  subtotalPaise: number;
  gstAmountPaise: number;
  totalAmountPaise: number;
}

export interface CelebrationBookingView extends CelebrationQuoteView {
  id: string;
  bookingNumber: string;
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
  status: 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: string;
  cancelledAt: string | null;
}

export interface CelebrationBookingRequest {
  packageId: string;
  eventDate: string;
  timeSlot: string;
  guestCount: number;
  turfName?: string;
  decorTheme?: string;
  commentarySetup?: boolean;
  trophyPackage?: boolean;
  specialFoodMenu?: boolean;
  cakeKg?: number;
  paymentMethod?: 'wallet' | 'cod';
}

export interface TurfBookingView {
  id: string;
  bookingNumber: string;
  turfId: string | null;
  turfName: string;
  turfAddress: string;
  date: string;
  timeSlot: string;
  /** ISO instants; the pass shows the window, the list shows `timeSlot`. */
  startTime: string;
  endTime: string;
  slotId: string;
  addons: string[];
  subtotalPaise: number;
  gstAmountPaise: number;
  totalAmountPaise: number;
  status: 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  gatePassToken: string;
  createdAt: string;
  cancelledAt: string | null;
}

/**
 * A gate scan either lets someone in or says why not.
 *
 * The failure arm carries a reason rather than an exception: an unknown pass, a
 * cancelled booking and an unpaid one are all normal outcomes at a gate, and the
 * person holding the scanner needs to be told which.
 */
export type GatePassResult =
  | { valid: true; booking: TurfBookingView }
  | { valid: false; reason: string };

/**
 * This used to declare CricAPI's raw upstream shape (`name`, `teams[]`, numeric
 * innings), which is not what our endpoint returns — the backend already flattens
 * it into carousel cards, so the response never matched the state it fed.
 *
 * Imported as well as re-exported: `export ... from` forwards the name without
 * binding it locally, and `getLiveCricketScores` below refers to it.
 */
import type { LiveMatchItem } from '../types';
export type { LiveMatchItem };

// ─── Request plumbing ───────────────────────────────

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Skips the refresh-and-retry dance. Used by the refresh call itself. */
  skipAuthRetry?: boolean;
  signal?: AbortSignal;
}

/**
 * In flight refresh, shared by every 401 that arrives while it is running.
 *
 * Without this, a screen that fires five parallel requests on mount burns five
 * refresh tokens on the first expiry — and since each rotation invalidates the
 * last, four of them lose the race and log the user out.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = tokenStore.getRefreshToken();
    if (!refreshToken) {
      announceSessionExpired();
      return false;
    }

    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        announceSessionExpired();
        return false;
      }
      const payload = await res.json();
      const data = payload?.data ?? payload;
      if (!data?.accessToken) {
        announceSessionExpired();
        return false;
      }
      tokenStore.set(data.accessToken, data.refreshToken);
      return true;
    } catch {
      // A network fault is not proof the session is dead, so the tokens stay put
      // and the original request surfaces its own error. Clearing them here
      // would sign the user out every time their train enters a tunnel.
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function buildHeaders(hasBody: boolean): Record<string, string> {
  const token = tokenStore.getAccessToken();
  return {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    // Correlates a browser action with its server log line.
    'X-Request-ID': `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
  };
}

/**
 * Pulls the message out of whatever the server sent.
 *
 * Nest's exception filter emits `{ message }` for a single failure and
 * `{ message: string[] }` for a `ValidationPipe` rejection; the app's own filter
 * wraps some of those in `{ error: { message } }`. All three shapes reach here.
 */
function extractMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const body = payload as Record<string, any>;
  const raw = body.error?.message ?? body.message ?? body.error;
  if (Array.isArray(raw)) return raw.filter(Boolean).join(' ') || fallback;
  if (typeof raw === 'string' && raw.trim()) return raw;
  return fallback;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, skipAuthRetry = false, signal } = options;
  const hasBody = body !== undefined;

  const send = (): Promise<Response> =>
    fetch(`${BASE_URL}${path}`, {
      method,
      headers: buildHeaders(hasBody),
      ...(hasBody ? { body: JSON.stringify(body) } : {}),
      signal,
    });

  let response: Response;
  try {
    response = await send();
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new ApiError(
      'Cannot reach IPL Dhaba right now. Check your connection and try again.',
      0,
      'NETWORK_ERROR',
    );
  }

  // One retry, and only after a refresh actually succeeded. Retrying a 401 with
  // the same dead token just doubles the load on the way to the same failure.
  if (response.status === 401 && !skipAuthRetry && tokenStore.getRefreshToken()) {
    if (await attemptRefresh()) {
      try {
        response = await send();
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') throw error;
        throw new ApiError('Cannot reach IPL Dhaba right now.', 0, 'NETWORK_ERROR');
      }
    }
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    if (response.status === 401) announceSessionExpired();
    const failure = payload as Record<string, any> | null;
    throw new ApiError(
      extractMessage(payload, `Request failed (${response.status}).`),
      response.status,
      failure?.error?.code ?? failure?.code,
      failure?.error?.details ?? failure?.details,
    );
  }

  // Some controllers return the value directly, others wrap it as
  // `{ success, data }`. Unwrapping here keeps that inconsistency from leaking
  // into every caller.
  const envelope = payload as Record<string, any> | null;
  if (
    envelope &&
    typeof envelope === 'object' &&
    !Array.isArray(envelope) &&
    'data' in envelope &&
    'success' in envelope
  ) {
    return envelope.data as T;
  }
  return payload as T;
}

// ─── The client ─────────────────────────────────────

export class ApiClient {
  // ── Auth ──────────────────────────────────────────

  /** Exchanges a verified Firebase ID token for an IPL Dhaba session. */
  static async authenticateWithFirebase(
    idToken: string,
    name?: string,
    favoriteTeam?: string,
  ): Promise<AuthResponse> {
    const auth = await request<AuthResponse>('/auth/firebase', {
      method: 'POST',
      body: { idToken, name, favoriteTeam },
      skipAuthRetry: true,
    });
    tokenStore.set(auth.accessToken, auth.refreshToken);
    return auth;
  }

  /**
   * Exchanges a verified Google ID token for an IPL Dhaba session.
   *
   * The token is obtained from `@react-oauth/google`'s `useGoogleLogin` /
   * `GoogleLogin` and verified server-side with `google-auth-library`. The
   * returned user may have an empty `phone` when the profile is incomplete —
   * the caller should then show the profile-completion onboarding step.
   */
  static async authenticateWithGoogle(idToken: string): Promise<AuthResponse> {
    const auth = await request<AuthResponse>('/auth/google', {
      method: 'POST',
      body: { idToken },
      skipAuthRetry: true,
    });
    tokenStore.set(auth.accessToken, auth.refreshToken);
    return auth;
  }

  /**
   * Completes the profile after a Google sign-in: phone + favorite team.
   *
   * The server owns the profile — this is the only way to set the phone after
   * a Google OAuth sign-in created the user. Returns the complete profile so
   * context can store what the server actually accepted.
   */
  static completeUserProfile(input: {
    phone?: string;
    name?: string;
    favoriteTeam?: string;
  }): Promise<{ success: boolean; user: UserProfile }> {
    return request('/auth/complete-profile', { method: 'PATCH', body: input });
  }

  static async staffLogin(employeeId: string, pin: string): Promise<AuthResponse> {
    const auth = await request<AuthResponse>('/auth/staff-login', {
      method: 'POST',
      body: { employeeId, pin },
      skipAuthRetry: true,
    });
    tokenStore.set(auth.accessToken, auth.refreshToken);
    return auth;
  }

  static getMe(): Promise<{ success: boolean; user: UserProfile }> {
    return request('/auth/me');
  }

  /**
   * Edits the signed-in user's own name / favourite team.
   *
   * The server ignores anything else in the body, so this is deliberately the
   * only mutation path for the profile — the app has no local "set the user"
   * action, and the response is what context stores.
   */
  static updateProfile(input: {
    name?: string;
    favoriteTeam?: string;
  }): Promise<{ success: boolean; user: UserProfile }> {
    return request('/auth/me', { method: 'PATCH', body: input });
  }

  /**
   * Ends the session server-side, then locally.
   *
   * The local clear runs even when the server call fails: a user who taps Log
   * Out on a flaky connection must not be left holding a live token because the
   * request timed out.
   */
  static async logout(): Promise<void> {
    const refreshToken = tokenStore.getRefreshToken();
    try {
      await request('/auth/logout', { method: 'POST', body: { refreshToken }, skipAuthRetry: true });
    } catch {
      /* best effort */
    } finally {
      tokenStore.clear();
    }
  }

  // ── Menu ──────────────────────────────────────────

  static getMenu(category: string = 'all', search?: string): Promise<MenuItem[]> {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (search?.trim()) params.set('search', search.trim());
    const query = params.toString();
    return request<MenuItem[]>(`/menu${query ? `?${query}` : ''}`);
  }

  /** The categories that actually have items, straight from the menu table. */
  static getMenuCategories(): Promise<string[]> {
    return request<string[]>('/menu/categories');
  }

  // ── Turfs ─────────────────────────────────────────

  static getTurfs(searchQuery: string = ''): Promise<Turf[]> {
    const query = searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : '';
    return request<Turf[]>(`/turfs${query}`);
  }

  static getTurf(id: string): Promise<Turf> {
    return request<Turf>(`/turfs/${id}`);
  }

  /** Slot availability for one day; `date` is `YYYY-MM-DD`. */
  static getTurfSlots(date?: string): Promise<TurfSlotView[]> {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return request<TurfSlotView[]>(`/bookings/slots${query}`);
  }

  // ── Turf bookings ─────────────────────────────────

  static createTurfBooking(
    slotId: string,
    addons: string[] = [],
    paymentMethod: 'wallet' | 'cod' = 'wallet',
  ): Promise<TurfBookingView> {
    return request<TurfBookingView>('/bookings', {
      method: 'POST',
      body: { slotId, addons, paymentMethod },
    });
  }

  static getMyTurfBookings(): Promise<TurfBookingView[]> {
    return request<TurfBookingView[]>('/bookings/my');
  }

  static cancelTurfBooking(id: string): Promise<{ bookingId: string; status: string; refundedPaise: number }> {
    return request(`/bookings/${id}/cancel`, { method: 'POST' });
  }

  // ── Celebrations ──────────────────────────────────

  static getCelebrationPackages(): Promise<CelebrationPackage[]> {
    return request<CelebrationPackage[]>('/celebrations');
  }

  /**
   * Prices a party without booking it.
   *
   * The customisation drawer calls this on every change instead of doing the
   * arithmetic itself, so the running total is the same number the booking will
   * charge — the client no longer prices its own party.
   */
  static getCelebrationQuote(input: CelebrationBookingRequest): Promise<CelebrationQuoteView> {
    return request<CelebrationQuoteView>('/celebrations/quote', { method: 'POST', body: input });
  }

  static createCelebrationBooking(input: CelebrationBookingRequest): Promise<CelebrationBookingView> {
    return request<CelebrationBookingView>('/celebrations/bookings', { method: 'POST', body: input });
  }

  static getCelebrationBookings(): Promise<CelebrationBookingView[]> {
    return request<CelebrationBookingView[]>('/celebrations/bookings');
  }

  static cancelCelebrationBooking(
    id: string,
  ): Promise<{ bookingId: string; status: string; refundedPaise: number }> {
    return request(`/celebrations/bookings/${id}/cancel`, { method: 'POST' });
  }

  // ── Reviews ───────────────────────────────────────

  /**
   * Rates a delivered order or a turf booking.
   *
   * Exactly one target id may be supplied; the server rejects both or neither.
   * It also enforces one review per target, so a second submission returns a
   * 409 rather than silently stacking ratings.
   */
  static submitReview(input: {
    orderId?: string;
    bookingId?: string;
    rating: number;
    comment: string;
  }): Promise<ReviewView> {
    return request<ReviewView>('/reviews', { method: 'POST', body: input });
  }

  static getMyReviews(limit = 25): Promise<ReviewView[]> {
    return request<ReviewView[]>(`/reviews/my?limit=${limit}`);
  }

  // ── Saved addresses ───────────────────────────────

  /**
   * The profile address book. Every route is scoped server-side to the caller,
   * so there is no user id to pass — and no way to ask for someone else's.
   */
  static getAddresses(): Promise<SavedAddress[]> {
    return request<SavedAddress[]>('/addresses');
  }

  static createAddress(input: {
    label: string;
    detail: string;
    landmark?: string;
    pincode?: string;
    isDefault?: boolean;
  }): Promise<SavedAddress> {
    return request<SavedAddress>('/addresses', { method: 'POST', body: input });
  }

  static updateAddress(
    id: string,
    input: { label?: string; detail?: string; landmark?: string; pincode?: string; isDefault?: boolean },
  ): Promise<SavedAddress> {
    return request<SavedAddress>(`/addresses/${id}`, { method: 'PATCH', body: input });
  }

  /** Deleting the default promotes the next-newest address server-side. */
  static deleteAddress(id: string): Promise<{ success: boolean; promotedId: string | null }> {
    return request(`/addresses/${id}`, { method: 'DELETE' });
  }

  // ── Vouchers ──────────────────────────────────────

  /**
   * Offers this customer can still redeem — expiry, global cap and their own
   * per-user limit are all applied server-side, so nothing listed here is a code
   * the checkout will turn down.
   */
  static getVouchers(): Promise<AvailableVoucher[]> {
    return request<AvailableVoucher[]>('/vouchers');
  }

  // ── Orders ────────────────────────────────────────

  /**
   * Prices a cart. Nothing is reserved and no money moves.
   *
   * The client sends ids and quantities only; the returned `quoteId` is what
   * `createOrder` submits, so the total cannot move between the two.
   */
  static quoteOrder(
    items: { menuItemId: string; quantity: number }[],
    deliveryType: DeliveryType = 'turf_bench',
    promoCode?: string,
  ): Promise<QuoteView> {
    return request<QuoteView>('/orders/quote', {
      method: 'POST',
      body: { items, deliveryType, ...(promoCode?.trim() ? { promoCode: promoCode.trim() } : {}) },
    });
  }

  static createOrder(input: {
    quoteId: string;
    paymentMethod: PaymentMethod;
    deliveryTarget: string;
    deliveryAddress?: string;
    cookingInstructions?: string;
    idempotencyKey?: string;
  }): Promise<OrderView> {
    return request<OrderView>('/orders', { method: 'POST', body: input });
  }

  static getOrders(scope: 'active' | 'history' | 'all' = 'all', limit = 50): Promise<OrderView[]> {
    return request<OrderView[]>(`/orders?scope=${scope}&limit=${limit}`);
  }

  static getOrder(id: string): Promise<OrderView> {
    return request<OrderView>(`/orders/${id}`);
  }

  static cancelOrder(id: string, reason?: string): Promise<OrderView> {
    return request<OrderView>(`/orders/${id}/cancel`, { method: 'PATCH', body: { reason } });
  }

  /**
   * Moves an order along the lifecycle. Staff only.
   *
   * The server decides which transitions each role may make — this is a thin
   * wrapper, not a rule engine. A customer calling it gets a 403, which is why
   * the portal that uses it is behind a role check of its own.
   */
  static updateOrderStatus(id: string, status: OrderStatus, reason?: string): Promise<OrderView> {
    return request<OrderView>(`/orders/${id}/status`, { method: 'PATCH', body: { status, reason } });
  }

  /** Validates a scanned gate pass at the turf gate. Staff only. */
  static verifyGatePass(token: string): Promise<GatePassResult> {
    return request<GatePassResult>('/bookings/verify-gate-pass', {
      method: 'POST',
      body: { token },
    });
  }

  // ── Payments ──────────────────────────────────────

  /** Opens a Razorpay order for an existing `awaiting_payment` food order. */
  static createPaymentIntent(orderId: string): Promise<PaymentIntentView> {
    return request<PaymentIntentView>('/payments/intent', { method: 'POST', body: { orderId } });
  }

  static verifyPayment(input: {
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): Promise<{ orderId: string; status: string; paymentStatus: string }> {
    return request('/payments/verify', { method: 'POST', body: input });
  }

  static createWalletTopUp(amountPaise: number): Promise<PaymentIntentView> {
    return request<PaymentIntentView>('/payments/wallet-topup', { method: 'POST', body: { amountPaise } });
  }

  static verifyWalletTopUp(input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): Promise<WalletView> {
    return request<WalletView>('/payments/wallet-topup/verify', { method: 'POST', body: input });
  }

  // ── Wallet ────────────────────────────────────────

  static getWallet(limit = 25): Promise<WalletView> {
    return request<WalletView>(`/wallet?limit=${limit}`);
  }

  static getWalletBalance(): Promise<{ balancePaise: number }> {
    return request('/wallet/balance');
  }

  // ── Notifications ─────────────────────────────────

  static getNotifications(limit = 25, unreadOnly = false): Promise<NotificationFeed> {
    return request<NotificationFeed>(
      `/notifications?limit=${limit}${unreadOnly ? '&unreadOnly=true' : ''}`,
    );
  }

  static markNotificationRead(id: string): Promise<{ success: boolean }> {
    return request(`/notifications/${id}/read`, { method: 'PATCH' });
  }

  static markAllNotificationsRead(): Promise<{ success: boolean; markedRead: number }> {
    return request('/notifications/read-all', { method: 'PATCH' });
  }

  // ── Cricket ───────────────────────────────────────

  static getLiveCricketScores(): Promise<LiveMatchItem[]> {
    return request<LiveMatchItem[]>('/cricket/live-scores');
  }
}

export default ApiClient;
