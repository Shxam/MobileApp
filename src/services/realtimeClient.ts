// ===================================================
// IPL Dhaba — realtime client (socket.io)
//
// Replaces the browser `EventSource` the tracking screen used to open against
// `/orders/:id/tracking-stream`. That endpoint sat behind `JwtAuthGuard`, and an
// `EventSource` cannot send an Authorization header — so it 401'd on every
// connection, `onerror` fired, and the map fell back to interpolating a fake
// rider between two hardcoded points. The customer watched an animation.
//
// socket.io authenticates in the handshake (`auth.token`), which is why the
// server moved to it in Phase 7.
// ===================================================

import { io, type Socket } from 'socket.io-client';
import { tokenStore } from './apiClient';

/** Events the server sends. Mirrors `realtime.rooms.ts` on the backend. */
export const RealtimeEvent = {
  Ready: 'realtime:ready',
  Unauthorized: 'realtime:unauthorized',
  OrderCreated: 'order:created',
  OrderUpdated: 'order:updated',
  OrderOffered: 'order:offered',
  OrderTaken: 'order:taken',
  DeliveryOtpIssued: 'order:delivery_otp',
  DriverLocation: 'driver:location',
  PaymentUpdated: 'payment:updated',
  WalletUpdated: 'wallet:updated',
  BookingUpdated: 'booking:updated',
} as const;

export interface DriverLocationPayload {
  orderId: string;
  location: { latitude: number; longitude: number; heading?: number | null; updatedAt: string };
  timestamp: string;
}

export interface OrderUpdatedPayload {
  orderId: string;
  orderNumber?: string;
  status: string;
  order?: unknown;
  driverId?: string;
  reason?: string | null;
  timestamp: string;
}

export interface DeliveryOtpPayload {
  orderId: string;
  orderNumber: string;
  deliveryOtp: string;
  timestamp: string;
}

/**
 * The socket URL.
 *
 * socket.io needs a real origin — a relative path is not enough for the
 * WebSocket upgrade — so in development it points straight at the API port
 * rather than through the Vite proxy.
 */
const SOCKET_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL ?? 'http://localhost:3001')
  : (import.meta.env.VITE_API_URL ?? window.location.origin);

let socket: Socket | null = null;

/**
 * The shared connection.
 *
 * One socket per tab, not one per component. The tracking map, the order list
 * and the wallet badge all want live updates; opening three sockets would
 * triple the server's connection count and each would re-authenticate the same
 * token.
 */
export function getSocket(): Socket | null {
  const token = tokenStore.getAccessToken();
  if (!token) return null;

  if (socket) {
    // A refreshed token must reach the handshake, or the next reconnect
    // authenticates with a credential that has since expired.
    if (socket.auth && (socket.auth as Record<string, unknown>).token !== token) {
      socket.auth = { token };
    }
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    timeout: 20_000,
  });

  // The server emits this and then disconnects. Reconnecting against a token it
  // has already rejected is a loop that never terminates, so stop trying and let
  // the HTTP layer's refresh flow produce a usable token first.
  socket.on(RealtimeEvent.Unauthorized, () => {
    if (socket) socket.io.opts.reconnection = false;
  });

  return socket;
}

/** Re-handshakes with the current token. Call after a refresh or a fresh login. */
export function reconnectSocket(): void {
  disconnectSocket();
  getSocket();
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

/**
 * Subscribes to one order's live feed.
 *
 * The returned function unsubscribes and detaches the listeners — React effects
 * must return it, or a customer who opens five orders in a session ends up with
 * five sets of handlers all firing on the same event.
 */
export function subscribeToOrder(
  orderId: string,
  handlers: {
    onLocation?: (payload: DriverLocationPayload) => void;
    onStatus?: (payload: OrderUpdatedPayload) => void;
    onDeliveryOtp?: (payload: DeliveryOtpPayload) => void;
    onRefused?: (reason: string) => void;
  },
): () => void {
  const active = getSocket();
  if (!active) {
    handlers.onRefused?.('Sign in to follow this delivery live.');
    return () => {};
  }

  const location = (payload: DriverLocationPayload) => {
    if (payload.orderId === orderId) handlers.onLocation?.(payload);
  };
  const status = (payload: OrderUpdatedPayload) => {
    if (payload.orderId === orderId) handlers.onStatus?.(payload);
  };
  const otp = (payload: DeliveryOtpPayload) => {
    if (payload.orderId === orderId) handlers.onDeliveryOtp?.(payload);
  };

  active.on(RealtimeEvent.DriverLocation, location);
  active.on(RealtimeEvent.OrderUpdated, status);
  active.on(RealtimeEvent.DeliveryOtpIssued, otp);

  // Sent on every connect, not just the first: after a reconnect the server has
  // no memory of which rooms this socket was in.
  const join = () => {
    active.emit('order:subscribe', { orderId }, (ack: { ok: boolean; reason?: string }) => {
      if (ack && !ack.ok) handlers.onRefused?.(ack.reason ?? 'This delivery is not available to follow.');
    });
  };
  join();
  active.on('connect', join);

  return () => {
    active.emit('order:unsubscribe', { orderId });
    active.off(RealtimeEvent.DriverLocation, location);
    active.off(RealtimeEvent.OrderUpdated, status);
    active.off(RealtimeEvent.DeliveryOtpIssued, otp);
    active.off('connect', join);
  };
}

/**
 * Subscribes to the signed-in user's own feed — every order they placed, their
 * wallet, their bookings. No join call: the server puts each socket in its
 * owner's room at handshake time.
 */
export function subscribeToUserFeed(handlers: {
  onOrderCreated?: (payload: { order: unknown; timestamp: string }) => void;
  onOrderUpdated?: (payload: OrderUpdatedPayload) => void;
  onWalletUpdated?: (payload: { amountPaise: number; timestamp: string }) => void;
  onPaymentUpdated?: (payload: { orderId: string; event: string; timestamp: string }) => void;
  onBookingUpdated?: (payload: { bookingId: string; event: string; timestamp: string }) => void;
  onDeliveryOtp?: (payload: DeliveryOtpPayload) => void;
}): () => void {
  const active = getSocket();
  if (!active) return () => {};

  const bindings: [string, (payload: any) => void][] = [];
  const bind = (event: string, handler?: (payload: any) => void) => {
    if (!handler) return;
    active.on(event, handler);
    bindings.push([event, handler]);
  };

  bind(RealtimeEvent.OrderCreated, handlers.onOrderCreated);
  bind(RealtimeEvent.OrderUpdated, handlers.onOrderUpdated);
  bind(RealtimeEvent.WalletUpdated, handlers.onWalletUpdated);
  bind(RealtimeEvent.PaymentUpdated, handlers.onPaymentUpdated);
  bind(RealtimeEvent.BookingUpdated, handlers.onBookingUpdated);
  bind(RealtimeEvent.DeliveryOtpIssued, handlers.onDeliveryOtp);

  return () => {
    for (const [event, handler] of bindings) active.off(event, handler);
  };
}
