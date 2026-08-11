import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatPaise } from '../types';
import type { OrderView, TurfBookingView, CelebrationBookingView } from '../services/apiClient';
import { DriverMapTracker } from '../components/DriverMapTracker';
import { ReviewModal } from '../components/ReviewModal';
import { GatePassQr } from '../components/GatePassQr';
import {
  Calendar,
  UtensilsCrossed,
  PartyPopper,
  QrCode,
  MapPin,
  Clock,
  X,
  Phone,
  AlertCircle,
  CheckCircle2,
  Star,
  Loader2,
  Ban,
  ShieldCheck,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * The customer's activity hub: live orders, turf passes, party bookings.
 *
 * What this replaces was largely theatre. It read `order.totalAmount`,
 * `booking.totalAmount` and `booking.slots[0]` — none of which exist on the API
 * types — so every price rendered `₹undefined`. It called `rescheduleTurfBooking`
 * from the context, which has never existed, and it offered a "Mark Order
 * Received" button that drove the order to `delivered` from the customer's
 * phone, bypassing the driver's OTP entirely. Delivery is confirmed by the rider
 * against a one-time code; the customer's job is to *show* that code, which is
 * what the OTP panel below does.
 */

/** The four milestones the progress bar shows, in lifecycle order. */
const MILESTONES = [
  { key: 'accepted', label: 'Accepted', glyph: '✓', reachedBy: ['accepted', 'preparing', 'ready_for_pickup', 'assigned', 'picked_up', 'out_for_delivery', 'delivered'] },
  { key: 'preparing', label: 'Cooking', glyph: '🍳', reachedBy: ['preparing', 'ready_for_pickup', 'assigned', 'picked_up', 'out_for_delivery', 'delivered'] },
  { key: 'picked_up', label: 'Picked up', glyph: '🛵', reachedBy: ['picked_up', 'out_for_delivery', 'delivered'] },
  { key: 'delivered', label: 'Delivered', glyph: '📦', reachedBy: ['delivered'] },
] as const;

/** How far along the rail the filled bar runs, per status. */
const PROGRESS_WIDTH: Record<string, string> = {
  awaiting_payment: '0%',
  placed: '8%',
  accepted: '25%',
  preparing: '40%',
  ready_for_pickup: '55%',
  assigned: '62%',
  picked_up: '78%',
  out_for_delivery: '78%',
  delivered: '100%',
};

/** Human labels; the raw enum values leak implementation detail into the UI. */
const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: 'Awaiting payment',
  placed: 'Placed',
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

const STATUS_TONE: Record<string, string> = {
  delivered: 'text-emerald-600 bg-emerald-50',
  cancelled: 'text-slate-500 bg-slate-100',
  refunded: 'text-slate-500 bg-slate-100',
  payment_failed: 'text-rose-600 bg-rose-50',
  awaiting_payment: 'text-amber-600 bg-amber-50',
};

/** An order the customer may still call off — the server allows it up to accept. */
const CANCELLABLE = new Set(['awaiting_payment', 'placed', 'accepted']);

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });

/** Clock time `minutes` from now, in IST — used for the arrival estimate. */
const arrivalClock = (minutes: number) =>
  new Date(Date.now() + minutes * 60_000).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });

/** What the review modal is currently pointed at. */
type ReviewTarget = { title: string; orderId?: string; bookingId?: string };

export const MyBookingsView: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const {
    user,
    turfBookings,
    foodOrders,
    celebrationBookings,
    cancelTurfBooking,
    cancelOrder,
    submitReview,
    language,
    deliveryOtp,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'food' | 'turf' | 'parties'>('food');
  const [selectedPassBooking, setSelectedPassBooking] = useState<TurfBookingView | null>(null);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /**
   * The order worth putting a map on top of: the newest one still in flight.
   * `isTerminal` is the server's own judgement, so the UI does not have to keep
   * its own list of end states in sync with the backend's.
   */
  const activeOrder = useMemo(
    () => foodOrders.find((o) => !o.isTerminal) ?? null,
    [foodOrders],
  );

  const handleCancelOrder = async (order: OrderView) => {
    setBusyId(order.id);
    setActionError(null);
    try {
      await cancelOrder(order.id, 'Cancelled by customer');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'The order could not be cancelled.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelBooking = async (booking: TurfBookingView) => {
    setBusyId(booking.id);
    setActionError(null);
    try {
      await cancelTurfBooking(booking.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'The booking could not be cancelled.');
    } finally {
      setBusyId(null);
    }
  };

  if (!user.isLoggedIn) {
    return (
      <div className="p-8 text-center space-y-2">
        <UtensilsCrossed className="w-8 h-8 text-emerald-500 mx-auto" />
        <p className="text-sm font-bold text-slate-900 dark:text-white">Sign in to see your activity</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Orders, turf passes and party bookings live on your account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 pb-28 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-white transition-colors">
      <div>
        <h2 className="text-xl font-black tracking-tight">
          {language === 'en' ? 'My hub & activity' : 'मेरी सभी बुकिंग और ऑर्डर'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {language === 'en'
            ? 'Live food orders, turf passes and celebrations'
            : 'सभी सेवाओं की एकीकृत जानकारी'}
        </p>
      </div>

      {actionError && (
        <p
          role="alert"
          className="text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-xl px-3 py-2 flex items-start gap-1.5"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {actionError}
        </p>
      )}

      {/* Sub tabs */}
      <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs font-bold">
        {([
          { key: 'food', icon: UtensilsCrossed, label: 'Orders', count: foodOrders.length },
          { key: 'turf', icon: Calendar, label: 'Turfs', count: turfBookings.length },
          { key: 'parties', icon: PartyPopper, label: 'Parties', count: celebrationBookings.length },
        ] as const).map(({ key, icon: Icon, label, count }) => (
          <button
            key={key}
            onClick={() => setActiveSubTab(key)}
            className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeSubTab === key
                ? 'bg-emerald-500 text-white font-extrabold shadow-md'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>
              {label} ({count})
            </span>
          </button>
        ))}
      </div>

      {/* ── FOOD ORDERS ───────────────────────────────── */}
      {activeSubTab === 'food' && (
        <div className="space-y-4">
          {activeOrder ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <h3 className="font-extrabold text-sm">Track order</h3>
                </div>
                <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-300">
                  {activeOrder.orderNumber}
                </span>
              </div>

              {/* Real socket-fed map; no interpolated fake route. */}
              <DriverMapTracker
                orderId={activeOrder.id}
                deliveryTarget={activeOrder.deliveryTarget}
                estimatedMinutes={activeOrder.estimatedDeliveryMinutes}
              />

              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-black text-base truncate">
                      {STATUS_LABEL[activeOrder.status] ?? activeOrder.status}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {activeOrder.status === 'delivered' ? (
                        'Delivered'
                      ) : (
                        <>
                          Estimated arrival{' '}
                          <span className="font-bold text-slate-900 dark:text-white">
                            {arrivalClock(activeOrder.estimatedDeliveryMinutes)}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <span className="text-xs font-black text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-3 py-1 rounded-full border border-rose-200 dark:border-rose-900 shrink-0">
                    {formatPaise(activeOrder.bill.totalPaise)}
                  </span>
                </div>

                {/* Milestones */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center justify-between relative px-2">
                    <div className="absolute top-3.5 left-6 right-6 h-0.5 bg-slate-200 dark:bg-slate-700 -translate-y-1/2 z-0" />
                    <motion.div
                      className="absolute top-3.5 left-6 h-0.5 bg-rose-500 -translate-y-1/2 z-0"
                      animate={{ width: PROGRESS_WIDTH[activeOrder.status] ?? '0%' }}
                      transition={
                        shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 28 }
                      }
                    />

                    {MILESTONES.map((m) => {
                      const reached = (m.reachedBy as readonly string[]).includes(activeOrder.status);
                      const done = m.key === 'delivered' && reached;
                      return (
                        <div key={m.key} className="relative z-10 flex flex-col items-center gap-1">
                          <motion.div
                            key={`${m.key}-${activeOrder.status}`}
                            initial={shouldReduceMotion ? false : { scale: 0.72 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 380, damping: 25 }}
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              done
                                ? 'bg-emerald-500 text-white'
                                : reached
                                ? 'bg-rose-500 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {m.glyph}
                          </motion.div>
                          <span className="text-[10px] font-bold">{m.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/*
                 * The delivery OTP. It arrives on the customer's private socket
                 * room when the rider picks the order up, and is the only thing
                 * that closes the order — hence it is shown, never submitted
                 * from here.
                 */}
                {deliveryOtp?.orderId === activeOrder.id && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        <span className="text-xs font-extrabold">Delivery code</span>
                      </div>
                      <p className="text-[10px] text-emerald-800/80 dark:text-emerald-400/80 font-medium mt-0.5">
                        Read this out to your rider. Never share it before the food is in your hands.
                      </p>
                    </div>
                    <span className="font-mono font-black text-xl tracking-[0.2em] text-emerald-700 dark:text-emerald-300 shrink-0">
                      {deliveryOtp.deliveryOtp}
                    </span>
                  </div>
                )}

                {/* The real rider, when one has been assigned. */}
                {activeOrder.driver ? (
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-extrabold text-xs truncate">{activeOrder.driver.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                        Delivery rider · {activeOrder.driver.vehicleNumber}
                      </div>
                    </div>
                    {activeOrder.driver.phone && (
                      <a
                        href={`tel:${activeOrder.driver.phone}`}
                        aria-label="Call the rider"
                        className="w-9 h-9 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center hover:bg-rose-100 shrink-0"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3">
                    No rider assigned yet. You will see their name and number here the moment one accepts.
                  </p>
                )}

                {CANCELLABLE.has(activeOrder.status) && (
                  <button
                    onClick={() => void handleCancelOrder(activeOrder)}
                    disabled={busyId === activeOrder.id}
                    className="w-full border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold py-2.5 rounded-full text-xs flex items-center justify-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
                  >
                    {busyId === activeOrder.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Ban className="w-3.5 h-3.5" />
                    )}
                    <span>Cancel this order</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-2">
              <UtensilsCrossed className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="font-extrabold text-sm">No active food orders</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Order biryani and starters from the dhaba kitchen.
              </p>
            </div>
          )}

          {/* History */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-sm">Order history</h4>
            {foodOrders.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-6 text-center font-medium">
                Nothing here yet.
              </p>
            ) : (
              foodOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="font-bold font-mono truncate">{order.orderNumber}</span>
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shrink-0 ${
                        STATUS_TONE[order.status] ?? 'text-rose-600 bg-rose-50'
                      }`}
                    >
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    {order.items.map((i) => `${i.menuItem.nameEn} ×${i.quantity}`).join(', ')}
                  </div>

                  <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatWhen(order.createdAt)}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="font-black text-rose-600 text-sm">
                      {formatPaise(order.bill.totalPaise)}
                    </span>

                    {/* Only a delivered order can be reviewed — the server says so too. */}
                    {order.status === 'delivered' && (
                      <button
                        onClick={() =>
                          setReviewTarget({ title: `Order ${order.orderNumber}`, orderId: order.id })
                        }
                        className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1"
                      >
                        <Star className="w-3.5 h-3.5" />
                        <span>Rate &amp; review</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── TURF BOOKINGS ─────────────────────────────── */}
      {activeSubTab === 'turf' && (
        <div className="space-y-3">
          {turfBookings.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-2">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="font-extrabold text-sm">No turf bookings yet</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Reserve a floodlit box pitch slot.
              </p>
            </div>
          ) : (
            turfBookings.map((b) => {
              const cancelled = b.status === 'cancelled';
              return (
                <div
                  key={b.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-sm truncate">{b.turfName}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {b.date} · {b.timeSlot}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{b.bookingNumber}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-3 py-1 rounded-full block">
                        {formatPaise(b.totalAmountPaise)}
                      </span>
                      <span
                        className={`text-[10px] font-bold mt-1 inline-block ${
                          cancelled ? 'text-slate-400' : 'text-emerald-600'
                        }`}
                      >
                        {cancelled ? 'Cancelled' : b.status}
                      </span>
                    </div>
                  </div>

                  {b.addons.length > 0 && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Add-ons: {b.addons.join(', ')}
                    </p>
                  )}

                  {!cancelled && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => setSelectedPassBooking(b)}
                        className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 rounded-full text-xs active:scale-95 transition-all flex items-center justify-center gap-1"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Gate pass</span>
                      </button>

                      {b.status === 'confirmed' && (
                        <button
                          onClick={() => void handleCancelBooking(b)}
                          disabled={busyId === b.id}
                          className="px-3 py-2 rounded-full text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 flex items-center gap-1"
                        >
                          {busyId === b.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Ban className="w-3.5 h-3.5" />
                          )}
                          <span>Cancel</span>
                        </button>
                      )}

                      <button
                        onClick={() => setReviewTarget({ title: b.turfName, bookingId: b.id })}
                        aria-label="Rate this turf"
                        className="px-3 py-2 rounded-full text-xs font-bold border border-amber-300 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── CELEBRATIONS ──────────────────────────────── */}
      {activeSubTab === 'parties' && (
        <div className="space-y-3">
          {celebrationBookings.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-2">
              <PartyPopper className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="font-extrabold text-sm">No party bookings yet</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Host a birthday or a team party at the dhaba.
              </p>
            </div>
          ) : (
            celebrationBookings.map((c: CelebrationBookingView) => (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-sm truncate">{c.packageName}</h4>
                    <p className="text-[10px] text-slate-400 font-mono">{c.bookingNumber}</p>
                  </div>
                  <span className="text-xs font-black text-rose-600 shrink-0">
                    {formatPaise(c.totalAmountPaise)}
                  </span>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1.5 flex-wrap">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{c.eventDate}</span>
                  <span className="text-slate-300">·</span>
                  <span>{c.timeSlot}</span>
                  <span className="text-slate-300">·</span>
                  <span>{c.guestCount} guests</span>
                  <span className="text-slate-300">·</span>
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{c.turfName}</span>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-bold">
                  {c.status === 'cancelled' ? (
                    <span className="text-slate-400">Cancelled</span>
                  ) : (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {c.status}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── GATE PASS ─────────────────────────────────── */}
      {selectedPassBooking && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4 relative"
          >
            <button
              onClick={() => setSelectedPassBooking(null)}
              aria-label="Close gate pass"
              className="absolute top-3 right-3 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-1">
              <span className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-wider">
                Gate pass
              </span>
              <h3 className="font-extrabold text-sm">{selectedPassBooking.turfName}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {selectedPassBooking.date} · {selectedPassBooking.timeSlot}
              </p>
            </div>

            <div className="flex justify-center">
              {selectedPassBooking.gatePassToken ? (
                <GatePassQr token={selectedPassBooking.gatePassToken} size={192} />
              ) : (
                <p className="text-[11px] text-amber-600 font-bold text-center px-4 py-6">
                  This booking has no gate pass. Show {selectedPassBooking.bookingNumber} at the gate.
                </p>
              )}
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-center space-y-0.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Booking</span>
              <p className="font-mono font-black text-sm">{selectedPassBooking.bookingNumber}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {selectedPassBooking.turfAddress}
              </p>
            </div>

            <p className="text-[10px] text-slate-400 text-center font-medium">
              Staff scan this at the gate. It works offline — take a screenshot if the signal is poor.
            </p>
          </motion.div>
        </div>
      )}

      {/* ── REVIEW ────────────────────────────────────── */}
      <ReviewModal
        isOpen={reviewTarget !== null}
        onClose={() => setReviewTarget(null)}
        title={reviewTarget?.title ?? ''}
        onSubmit={async (rating, comment) => {
          if (!reviewTarget) return;
          await submitReview({
            orderId: reviewTarget.orderId,
            bookingId: reviewTarget.bookingId,
            rating,
            comment,
          });
        }}
      />
    </div>
  );
};
