// ===================================================
// Browser realtime client.
//
// One implementation shared by the kitchen display, the driver app, the admin
// console, and the customer app. The three staff apps previously each polled
// `GET /orders` every 3 seconds, which is where most of the backend's read load
// came from and which still left a three-second lag on a screen whose whole
// purpose is to be current.
//
// The wire vocabulary lives in `apps/backend/src/modules/realtime/realtime.rooms.ts`
// and is mirrored here rather than imported: the browser bundle must not reach
// into the backend source tree, which pulls in Nest, Prisma, and the rest.
// The two files are small, and the spec in `realtime.integration.spec.ts` fails
// loudly if the server stops emitting what this expects.
// ===================================================

import { io, type Socket } from 'socket.io-client';

export const ClientEvent = {
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

export const ServerEvent = {
  SubscribeOrder: 'order:subscribe',
  UnsubscribeOrder: 'order:unsubscribe',
} as const;

export type ConnectionState = 'connecting' | 'live' | 'offline' | 'unauthorized';

export interface RealtimeHandlers {
  /** Connection state, for the status pill every staff screen shows. */
  onState?: (state: ConnectionState, detail?: string) => void;
  /** A new order arrived for this dhaba (kitchen/admin). */
  onOrderCreated?: (payload: { order: any; timestamp: string }) => void;
  /** Any order moved. Carries the serialized order when the publisher had it. */
  onOrderUpdated?: (payload: { orderId: string; status?: string; order?: any; timestamp: string }) => void;
  /** An order entered the driver offer pool. */
  onOrderOffered?: (payload: { orderId: string; order?: any; timestamp: string }) => void;
  /** Another driver claimed it — drop it from the offer list. */
  onOrderTaken?: (payload: { orderId: string; timestamp: string }) => void;
  /** An order was assigned to a driver. */
  onOrderAssigned?: (payload: { orderId: string; driverId?: string; timestamp?: string }) => void;
  /** An order was released by a driver. */
  onOrderReleased?: (payload?: { orderId?: string; timestamp?: string }) => void;
  /** An order was delivered. */
  onOrderDelivered?: (payload?: { orderId?: string; timestamp?: string }) => void;
  /** Customer only: the handover code. Never delivered to the order room. */
  onDeliveryOtp?: (payload: { orderId: string; orderNumber: string; deliveryOtp: string }) => void;
  onDriverLocation?: (payload: { orderId: string; location: any; timestamp: string }) => void;
  onPaymentUpdated?: (payload: { orderId: string; event: string; amountPaise?: number; reason?: string }) => void;
  onWalletUpdated?: (payload: { amountPaise: number; timestamp: string }) => void;
}

/**
 * Where the socket connects.
 *
 * Same-origin by default, which is what the Vite dev proxy and a single-origin
 * production deployment both want. `VITE_REALTIME_URL` overrides it for the case
 * where the API is on another host.
 */
function realtimeUrl(): string {
  const configured = (import.meta as any).env?.VITE_REALTIME_URL;
  return typeof configured === 'string' && configured.length > 0 ? configured : window.location.origin;
}

export interface RealtimeConnection {
  socket: Socket;
  /** Ask to follow one order's feed. Resolves false when the server refuses. */
  watchOrder: (orderId: string) => Promise<boolean>;
  unwatchOrder: (orderId: string) => void;
  close: () => void;
}

/**
 * Opens an authenticated socket.
 *
 * The token goes in `auth`, not the query string: a query string is written
 * verbatim into access logs, proxy logs, and browser history, and this token is
 * a bearer credential.
 */
export function connectRealtime(token: string, handlers: RealtimeHandlers = {}): RealtimeConnection {
  const socket = io(realtimeUrl(), {
    auth: { token },
    transports: ['websocket', 'polling'],
    // Bounded backoff. The default retries forever at 1 s, which turns a backend
    // restart into a connection storm from every staff screen at once.
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  });

  const state = (next: ConnectionState, detail?: string) => handlers.onState?.(next, detail);
  state('connecting');

  socket.on(ClientEvent.Ready, () => state('live'));
  socket.on('disconnect', (reason: string) => state('offline', reason));
  socket.on('connect_error', (error: Error) => state('offline', error.message));

  socket.on(ClientEvent.Unauthorized, (payload: { message?: string }) => {
    // A bad token will never become good by retrying, so stop — otherwise the
    // client reconnect-loops against it until the tab is closed.
    state('unauthorized', payload?.message);
    socket.disconnect();
  });

  if (handlers.onOrderCreated) socket.on(ClientEvent.OrderCreated, handlers.onOrderCreated);
  if (handlers.onOrderUpdated) socket.on(ClientEvent.OrderUpdated, handlers.onOrderUpdated);
  if (handlers.onOrderOffered) socket.on(ClientEvent.OrderOffered, handlers.onOrderOffered);
  if (handlers.onOrderTaken) socket.on(ClientEvent.OrderTaken, handlers.onOrderTaken);
  if (handlers.onDeliveryOtp) socket.on(ClientEvent.DeliveryOtpIssued, handlers.onDeliveryOtp);
  if (handlers.onDriverLocation) socket.on(ClientEvent.DriverLocation, handlers.onDriverLocation);
  if (handlers.onPaymentUpdated) socket.on(ClientEvent.PaymentUpdated, handlers.onPaymentUpdated);
  if (handlers.onWalletUpdated) socket.on(ClientEvent.WalletUpdated, handlers.onWalletUpdated);

  return {
    socket,
    watchOrder: async (orderId: string) => {
      try {
        const reply = (await socket.timeout(5000).emitWithAck(ServerEvent.SubscribeOrder, { orderId })) as {
          ok?: boolean;
        };
        return reply?.ok === true;
      } catch {
        // A timeout means the server never answered, not that access was denied.
        return false;
      }
    },
    unwatchOrder: (orderId: string) => {
      socket.emit(ServerEvent.UnsubscribeOrder, { orderId });
    },
    close: () => socket.close(),
  };
}
