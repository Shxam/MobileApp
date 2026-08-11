import { BadRequestException } from '@nestjs/common';
import type { OrderStatus, Role } from '@prisma/client';

/**
 * The order lifecycle, as a single explicit table.
 *
 * Previously this lived as a partial map inside OrdersService that omitted most
 * statuses, so `allowed[current]` was `undefined` for anything outside the happy
 * path and `.includes` threw a TypeError instead of returning a clean 400.
 *
 * Happy path:
 *   awaiting_payment → placed → accepted → preparing → ready_for_pickup
 *   → assigned → picked_up → delivered
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  awaiting_payment: ['placed', 'payment_failed', 'cancelled'],
  placed: ['accepted', 'cancelled', 'refunded'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['assigned', 'cancelled'],
  assigned: ['picked_up', 'ready_for_pickup', 'cancelled'],
  // `out_for_delivery` is a legacy alias of `picked_up`; both lead to delivered.
  picked_up: ['delivered', 'out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: ['refunded'],
  cancelled: ['refunded'],
  refunded: [],
  payment_failed: ['awaiting_payment', 'cancelled'],
};

/** Statuses from which an order can no longer progress. */
export const TERMINAL_STATUSES: readonly OrderStatus[] = ['delivered', 'refunded'];

/**
 * Which role may drive which transition.
 *
 * `awaiting_payment → placed` is deliberately absent: only the payment service
 * may promote an order, never a staff member marking it paid by hand.
 */
const ROLE_TRANSITIONS: Record<string, readonly OrderStatus[]> = {
  kitchen_staff: ['accepted', 'preparing', 'ready_for_pickup', 'cancelled'],
  delivery_partner: ['picked_up', 'out_for_delivery', 'delivered'],
  partner: ['accepted', 'preparing', 'ready_for_pickup', 'cancelled'],
  admin: [
    'placed',
    'accepted',
    'preparing',
    'ready_for_pickup',
    'assigned',
    'picked_up',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'refunded',
  ],
  customer: ['cancelled'],
};

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Throws unless `current → next` is a legal move for `role`. */
export function assertTransition(current: OrderStatus, next: OrderStatus, role: Role | string): void {
  if (current === next) {
    throw new BadRequestException(`This order is already ${current}.`);
  }

  const allowed = ORDER_TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    throw new BadRequestException(`An order cannot move from "${current}" to "${next}".`);
  }

  const permitted = ROLE_TRANSITIONS[role as string];
  if (!permitted || !permitted.includes(next)) {
    throw new BadRequestException(`Your role cannot set an order to "${next}".`);
  }
}

/** The timestamp column, if any, that a given status stamps. */
export function timestampFieldFor(status: OrderStatus): string | null {
  switch (status) {
    case 'accepted':
      return 'acceptedAt';
    case 'ready_for_pickup':
      return 'readyAt';
    case 'assigned':
      return 'assignedAt';
    case 'picked_up':
    case 'out_for_delivery':
      return 'pickedUpAt';
    case 'delivered':
      return 'deliveredAt';
    case 'cancelled':
      return 'cancelledAt';
    default:
      return null;
  }
}
