/**
 * Room names and wire event names for the realtime layer.
 *
 * Kept in one file, and built only through these functions, because a room name
 * is an authorization boundary: `user:${id}` assembled by hand at each call site
 * is one typo away from a room nobody is in (silent) or the wrong room (a leak).
 * The gateway is the only place that names rooms, and it names them from here.
 */

/** One customer, driver, or staff member. Everything addressed to a person. */
export const userRoom = (userId: string): string => `user:${userId}`;

/** One order's live feed. Joined on request, after an entitlement check. */
export const orderRoom = (orderId: string): string => `order:${orderId}`;

/** Kitchen display + partner/admin consoles for one dhaba. */
export const kitchenRoom = (dhabaId: string): string => `kitchen:${dhabaId}`;

/** Every online driver at one dhaba — the offer pool. */
export const driversRoom = (dhabaId: string): string => `drivers:${dhabaId}`;

/** Events the server sends to clients. */
export const ClientEvent = {
  Ready: 'realtime:ready',
  Unauthorized: 'realtime:unauthorized',
  OrderCreated: 'order:created',
  OrderUpdated: 'order:updated',
  /** A new order entered the pickup pool. Drivers only. */
  OrderOffered: 'order:offered',
  /** Someone else claimed it; drop it from the offer list. Carries no detail. */
  OrderTaken: 'order:taken',
  /** Customer-only: the code the driver must be given at handover. */
  DeliveryOtpIssued: 'order:delivery_otp',
  DriverLocation: 'driver:location',
  PaymentUpdated: 'payment:updated',
  WalletUpdated: 'wallet:updated',
  BookingUpdated: 'booking:updated',
} as const;

/** Events clients send to the server. */
export const ServerEvent = {
  SubscribeOrder: 'order:subscribe',
  UnsubscribeOrder: 'order:unsubscribe',
} as const;
