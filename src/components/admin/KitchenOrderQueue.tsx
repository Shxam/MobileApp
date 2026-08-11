import React, { useMemo, useState } from 'react';
import { UtensilsCrossed, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { OrderStatus } from '../../types';
import type { OrderView } from '../../services/apiClient';
import { formatPaise } from '../../types';

/**
 * The kitchen's view of the queue.
 *
 * Two things here are not cosmetic. The total comes from `bill.totalPaise` — the
 * previous version rendered `order.totalAmount`, a field that no longer exists,
 * so every card showed "₹undefined". And the action button offers the one
 * transition the backend's state machine actually permits from the current
 * status, rather than a fixed "Set Cooking / Ready" pair that produced a 400 on
 * an order that had not been accepted yet.
 */
interface KitchenOrderQueueProps {
  orders: OrderView[];
  /** Resolves once the server has accepted the transition. */
  onUpdateStatus: (orderId: string, status: OrderStatus) => Promise<void>;
}

/** Statuses the kitchen is responsible for, in the order they occur. */
const KITCHEN_STATUSES: readonly OrderStatus[] = ['placed', 'accepted', 'preparing', 'ready_for_pickup'];

/**
 * The single next step, mirroring `ORDER_TRANSITIONS` on the server.
 *
 * `ready_for_pickup` has no entry: what happens next is a driver claiming the
 * order, which is not the kitchen's to do.
 */
const NEXT_STEP: Partial<Record<OrderStatus, { status: OrderStatus; label: string; tone: string }>> = {
  placed: { status: 'accepted', label: 'Accept', tone: 'bg-sky-500 text-white' },
  accepted: { status: 'preparing', label: 'Start Cooking', tone: 'bg-amber-500 text-slate-950' },
  preparing: { status: 'ready_for_pickup', label: 'Mark Ready', tone: 'bg-emerald-500 text-white' },
};

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: 'Awaiting payment',
  placed: 'New',
  accepted: 'Accepted',
  preparing: 'Cooking',
  ready_for_pickup: 'Ready',
  assigned: 'Rider assigned',
  picked_up: 'On the way',
  out_for_delivery: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  payment_failed: 'Payment failed',
};

export const KitchenOrderQueue: React.FC<KitchenOrderQueueProps> = ({ orders, onUpdateStatus }) => {
  const [filter, setFilter] = useState<'live' | 'placed' | 'preparing'>('live');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * An unpaid order is not the kitchen's problem yet — it is waiting on
   * Razorpay. Showing `awaiting_payment` rows here is how food gets cooked for
   * an order that is never paid for.
   */
  const liveOrders = useMemo(
    () => orders.filter((o) => KITCHEN_STATUSES.includes(o.status)),
    [orders],
  );

  const filteredOrders = useMemo(
    () => (filter === 'live' ? liveOrders : liveOrders.filter((o) => o.status === filter)),
    [liveOrders, filter],
  );

  const advance = async (orderId: string, status: OrderStatus) => {
    setBusyId(orderId);
    setError(null);
    try {
      await onUpdateStatus(orderId, status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update that order.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="w-5 h-5 text-emerald-500" />
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Kitchen Orders Queue</h3>
        </div>
        <div className="flex gap-1 text-[10px] font-bold">
          {(
            [
              ['live', `Live (${liveOrders.length})`],
              ['placed', 'New'],
              ['preparing', 'Cooking'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-2.5 py-1 rounded-full ${
                filter === key
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {filteredOrders.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
          <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">No active kitchen orders</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {filteredOrders.map((order) => {
            const next = NEXT_STEP[order.status];
            const isBusy = busyId === order.id;
            return (
              <div
                key={order.id}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  {/* The order number, not the UUID — it is what the customer reads out. */}
                  <span className="font-extrabold text-slate-900 dark:text-white">{order.orderNumber}</span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    {order.deliveryTarget}
                  </span>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  {order.items.map((i) => `${i.quantity}x ${i.menuItem.nameEn}`).join(', ')}
                </div>

                {order.cookingInstructions && (
                  <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                    Note: {order.cookingInstructions}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-emerald-600">{formatPaise(order.bill.totalPaise)}</span>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                    {order.paymentMethod === 'cod' && (
                      <span className="text-[10px] font-black text-amber-600">COD</span>
                    )}
                  </div>

                  {next ? (
                    <button
                      onClick={() => void advance(order.id, next.status)}
                      disabled={isBusy}
                      className={`px-2.5 py-1 font-bold rounded-lg text-[10px] disabled:opacity-60 flex items-center gap-1 ${next.tone}`}
                    >
                      {isBusy && <Loader2 className="w-3 h-3 animate-spin" />}
                      {next.label}
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      Waiting for a rider
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
