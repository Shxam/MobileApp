import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatPaise, type Turf } from '../types';
import {
  ApiClient,
  type TurfBookingView as TurfBookingRecord,
  type TurfSlotView,
} from '../services/apiClient';
import { GatePassQr } from '../components/GatePassQr';
import {
  MapPin,
  Star,
  Calendar as CalendarIcon,
  X,
  Wallet,
  Banknote,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Video,
  Mic,
  Award,
  Loader2,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * Turf slot booking, against the real `bookings` module.
 *
 * What this replaces: an eight-slot `generateSlots()` literal with rupee prices,
 * a `MOCK_TURFS` array, add-ons the browser priced itself, `Math.round(total *
 * 0.18)` GST, a 1200 ms `setTimeout` calling a non-existent `addTurfBooking()`
 * on the context, and a decorative lucide `<QrCode />` glyph standing in for a
 * gate pass. Nothing was ever sent to the server, so no slot was ever held.
 *
 * Now: slots come from `GET /bookings/slots?date=`, the booking from
 * `POST /bookings`, and every figure shown after confirmation is the server's
 * own breakdown. The pre-confirmation total is labelled an estimate because it
 * is computed from the mirrored constants below; if those ever drift from the
 * backend, the booking response is what the customer is actually charged.
 */

/** Mirror of `pricing.constants.ts`. Display only — the server bills. */
const TURF_ADDON_FEE_PAISE = 150_00;
const TURF_GST_RATE = 18;

/** `CreateBookingDto` caps the array at 10. */
const MAX_ADDONS = 10;

/**
 * Add-on names are free-form strings the server stores verbatim and charges a
 * flat `TURF_ADDON_FEE_PAISE` for, each. The previous list gave four of them
 * different invented prices (₹200/₹300/₹250/₹150), none of which the backend
 * has any notion of.
 */
const ADDONS = [
  { name: 'GoPro 4K Match Recording', icon: Video },
  { name: 'Professional Box Umpire', icon: ShieldCheck },
  { name: 'Commentary Mic & Sound System', icon: Mic },
  { name: 'Tournament Leather Ball (2x)', icon: Award },
] as const;

/** `YYYY-MM-DD` in IST — the timezone the dhaba and its slots live in. */
const istDate = (d: Date = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/** Day arithmetic at noon UTC, which no IST offset can push across a date line. */
const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return istDate(new Date(Date.UTC(y, m - 1, d + days, 12)));
};

const applyGst = (paise: number) => Math.round((paise * TURF_GST_RATE) / 100);

const formatDayLabel = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d, 12));
  return {
    weekday: at.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    day: at.getUTCDate(),
  };
};

interface TurfBookingViewProps {
  selectedTurfId?: string;
  onNavigateHub: () => void;
}

export const TurfBookingView: React.FC<TurfBookingViewProps> = ({
  selectedTurfId,
  onNavigateHub,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const {
    user,
    wallet,
    refreshWallet,
    refreshTurfBookings,
    addNotification,
    setIsAuthModalOpen,
  } = useApp();

  const [turfs, setTurfs] = useState<Turf[]>([]);
  const [activeTurfId, setActiveTurfId] = useState<string | null>(selectedTurfId ?? null);
  const [turfsError, setTurfsError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(() => addDays(istDate(), 1));
  const [slots, setSlots] = useState<TurfSlotView[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'cod'>('wallet');

  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<TurfBookingRecord | null>(null);

  // ── Data ──────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    ApiClient.getTurfs()
      .then((rows) => {
        if (cancelled) return;
        setTurfs(rows);
        setActiveTurfId((current) =>
          current && rows.some((t) => t.id === current) ? current : rows[0]?.id ?? null,
        );
      })
      .catch((err) => {
        if (!cancelled) setTurfsError(err instanceof Error ? err.message : 'Could not load turfs.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSlots = useCallback(async (date: string) => {
    setIsLoadingSlots(true);
    setSlotsError(null);
    try {
      setSlots(await ApiClient.getTurfSlots(date));
    } catch (err) {
      setSlots([]);
      setSlotsError(err instanceof Error ? err.message : 'Could not load slots for this date.');
    } finally {
      setIsLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    setSelectedSlotId(null);
    void loadSlots(selectedDate);
  }, [selectedDate, loadSlots]);

  const activeTurf = useMemo(
    () => turfs.find((t) => t.id === activeTurfId) ?? null,
    [turfs, activeTurfId],
  );

  /**
   * Slots with no `turfId` are standalone pitches the dhaba sells directly, so
   * they stay visible whichever turf card is open.
   */
  const turfSlots = useMemo(
    () => slots.filter((s) => !activeTurfId || s.turfId === activeTurfId || s.turfId === null),
    [slots, activeTurfId],
  );

  /** Built from the rows, not hardcoded — `category` is a free-form column. */
  const categories = useMemo(
    () => ['All', ...Array.from(new Set(turfSlots.map((s) => s.category)))],
    [turfSlots],
  );

  const visibleSlots = useMemo(
    () => turfSlots.filter((s) => activeCategory === 'All' || s.category === activeCategory),
    [turfSlots, activeCategory],
  );

  const selectedSlot = useMemo(
    () => turfSlots.find((s) => s.id === selectedSlotId) ?? null,
    [turfSlots, selectedSlotId],
  );

  // ── Estimated price (server is authoritative) ─────

  const estimate = useMemo(() => {
    if (!selectedSlot) return { subtotalPaise: 0, gstPaise: 0, totalPaise: 0 };
    const subtotalPaise = selectedSlot.pricePaise + selectedAddons.length * TURF_ADDON_FEE_PAISE;
    const gstPaise = applyGst(subtotalPaise);
    return { subtotalPaise, gstPaise, totalPaise: subtotalPaise + gstPaise };
  }, [selectedSlot, selectedAddons]);

  const walletBalancePaise = wallet?.balancePaise ?? user.walletBalancePaise ?? 0;
  const walletShortfall = paymentMethod === 'wallet' && walletBalancePaise < estimate.totalPaise;

  const toggleAddon = (name: string) => {
    setSelectedAddons((current) => {
      if (current.includes(name)) return current.filter((a) => a !== name);
      if (current.length >= MAX_ADDONS) return current;
      return [...current, name];
    });
  };

  // ── Booking ───────────────────────────────────────

  const handleConfirmBooking = async () => {
    if (!selectedSlot) return;
    if (!user.isLoggedIn) {
      setShowConfirmModal(false);
      setIsAuthModalOpen(true);
      return;
    }

    setIsProcessing(true);
    setBookingError(null);
    try {
      const booking = await ApiClient.createTurfBooking(
        selectedSlot.id,
        selectedAddons,
        paymentMethod,
      );

      setConfirmedBooking(booking);
      setShowConfirmModal(false);
      setSelectedSlotId(null);
      setSelectedAddons([]);

      // The slot the customer just took is now `isBooked` for everyone; refetch
      // rather than patching local state so a slot someone else claimed in the
      // meantime also disappears.
      await Promise.allSettled([loadSlots(selectedDate), refreshTurfBookings(), refreshWallet()]);

      addNotification(
        'Slot booked',
        `${booking.bookingNumber} — ${booking.turfName}, ${booking.date} ${booking.timeSlot}.`,
        'booking',
      );
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'The booking could not be completed.');
      // A conflict means someone else took it between render and tap; the fresh
      // list is what tells the customer that, so pull it either way.
      void loadSlots(selectedDate);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Calendar ──────────────────────────────────────

  const currentYear = calendarViewDate.getFullYear();
  const currentMonth = calendarViewDate.getMonth();
  const monthName = calendarViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const today = istDate();

  const handleSelectCalendarDate = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (dateStr < today) return; // The server rejects a slot that has already started.
    setSelectedDate(dateStr);
    setShowCalendarModal(false);
  };

  return (
    <div className="space-y-4 p-4 pb-28 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-white transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight">Box Turf Booking</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {activeTurf ? activeTurf.area : 'Singarayakonda, AP'} · Floodlit cage
          </p>
        </div>
        {activeTurf && (
          <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-extrabold text-xs px-3 py-1 rounded-full">
            {formatPaise(activeTurf.pricePerHourPaise)}/hr
          </span>
        )}
      </div>

      {turfsError && (
        <p className="text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-xl px-3 py-2 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {turfsError}
        </p>
      )}

      {/* Turf switcher — only when there is a real choice */}
      {turfs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {turfs.map((turf) => (
            <button
              key={turf.id}
              onClick={() => setActiveTurfId(turf.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 border transition-all ${
                activeTurfId === turf.id
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
              }`}
            >
              {turf.name}
            </button>
          ))}
        </div>
      )}

      {activeTurf && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-4">
          {activeTurf.image && (
            <div className="relative rounded-2xl overflow-hidden h-44 bg-slate-100 dark:bg-slate-800">
              <img
                src={activeTurf.image}
                alt={activeTurf.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-extrabold text-slate-900 flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>
                  {activeTurf.rating.toFixed(1)} ({activeTurf.reviewsCount} reviews)
                </span>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <h3 className="font-extrabold text-base">{activeTurf.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{activeTurf.address}</span>
            </p>
          </div>

          {activeTurf.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeTurf.amenities.map((amenity) => (
                <span
                  key={amenity}
                  className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-slate-200/60 dark:border-slate-700"
                >
                  {amenity}
                </span>
              ))}
            </div>
          )}

          {/* Date */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <button
                onClick={() => setShowCalendarModal(true)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-extrabold active:scale-95 transition-all"
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Pick a date</span>
              </button>
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                {selectedDate}
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((offset) => {
                const dateStr = addDays(today, offset);
                const { weekday, day } = formatDayLabel(dateStr);
                const isSelected = selectedDate === dateStr;
                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`flex flex-col items-center justify-center min-w-[56px] py-2.5 rounded-2xl border transition-all shrink-0 ${
                      isSelected
                        ? 'bg-emerald-500 text-white border-emerald-500 scale-105 font-bold'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700'
                    }`}
                  >
                    <span className="text-[10px] uppercase opacity-80">{weekday}</span>
                    <span className="text-sm font-extrabold">{day}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slots */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold">Available time slots</h4>
              <span className="text-[11px] font-bold text-emerald-500">
                {isLoadingSlots ? '…' : `${visibleSlots.filter((s) => !s.isBooked).length} open`}
              </span>
            </div>

            {categories.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all border ${
                      activeCategory === cat
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {slotsError && (
              <p className="text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-xl px-3 py-2 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {slotsError}
              </p>
            )}

            {isLoadingSlots ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs font-bold text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading slots…</span>
              </div>
            ) : visibleSlots.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-6 text-center font-medium">
                No slots published for {selectedDate}. Try another date.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {visibleSlots.map((slot) => {
                  const isSelected = selectedSlotId === slot.id;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={slot.isBooked}
                      onClick={() => setSelectedSlotId(isSelected ? null : slot.id)}
                      className={`p-3 rounded-2xl border transition-all text-left flex flex-col justify-between relative ${
                        slot.isBooked
                          ? 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                          : isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/30'
                            : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          {slot.category}
                        </span>
                        <span
                          className={`font-black text-xs px-2.5 py-0.5 rounded-md border shrink-0 ${
                            isSelected
                              ? 'bg-emerald-500 text-white border-emerald-400'
                              : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                          }`}
                        >
                          {formatPaise(slot.pricePaise)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 py-1">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                            isSelected
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          🏏
                        </div>
                        <div className="font-black text-xs tracking-tight whitespace-nowrap min-w-0">
                          {slot.timeSlot}
                        </div>
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] font-extrabold">
                        <span className="text-slate-500 dark:text-slate-400">{slot.pitchName}</span>
                        {slot.isBooked ? (
                          <span className="text-slate-400 flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Booked
                          </span>
                        ) : slot.isFloodlit ? (
                          <span className="text-emerald-600 dark:text-emerald-400">⚡ Floodlit</span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add-ons */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold">Matchday add-ons</h4>
              <span className="text-[10px] font-bold text-slate-400">
                {formatPaise(TURF_ADDON_FEE_PAISE)} each
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ADDONS.map((addon) => {
                const Icon = addon.icon;
                const isChecked = selectedAddons.includes(addon.name);
                return (
                  <motion.button
                    type="button"
                    key={addon.name}
                    onClick={() => toggleAddon(addon.name)}
                    whileTap={{ scale: 0.98 }}
                    className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                      isChecked
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${isChecked ? 'text-emerald-600' : 'text-slate-400'}`}
                      />
                      <span className="text-xs font-bold truncate">{addon.name}</span>
                    </div>
                    <span className="text-xs font-extrabold text-emerald-600 shrink-0">
                      +{formatPaise(TURF_ADDON_FEE_PAISE)}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Sticky total */}
      {selectedSlot && (
        <div className="fixed bottom-16 left-0 right-0 z-30 p-3">
          <div className="max-w-md mx-auto bg-slate-900 text-white rounded-full p-3 px-5 shadow-2xl flex items-center justify-between border border-slate-800 backdrop-blur-lg">
            <div>
              <div className="text-[10px] text-emerald-300 font-semibold uppercase">
                Estimated total
              </div>
              <div className="text-xl font-black">{formatPaise(estimate.totalPaise)}</div>
            </div>
            <button
              onClick={() => {
                setBookingError(null);
                setShowConfirmModal(true);
              }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold px-6 py-2.5 rounded-full active:scale-95 transition-all flex items-center gap-1.5"
            >
              <span>Review &amp; book</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Calendar */}
      <AnimatePresence>
        {showCalendarModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-extrabold text-sm">Select a booking date</h3>
                </div>
                <button
                  onClick={() => setShowCalendarModal(false)}
                  aria-label="Close calendar"
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-700">
                <button
                  onClick={() => setCalendarViewDate(new Date(currentYear, currentMonth - 1, 1))}
                  aria-label="Previous month"
                  className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-extrabold text-sm">{monthName}</span>
                <button
                  onClick={() => setCalendarViewDate(new Date(currentYear, currentMonth + 1, 1))}
                  aria-label="Next month"
                  className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 text-center font-extrabold text-[11px] text-slate-400 uppercase pb-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty_${i}`} className="h-9" />
                ))}
                {Array.from({ length: totalDays }).map((_, i) => {
                  const day = i + 1;
                  const thisDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isPast = thisDateStr < today;
                  const isToday = thisDateStr === today;
                  const isSelected = selectedDate === thisDateStr;

                  return (
                    <motion.button
                      key={day}
                      onClick={() => handleSelectCalendarDate(day)}
                      disabled={isPast}
                      whileTap={isPast ? undefined : { scale: 0.92 }}
                      className={`relative overflow-hidden h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-all ${
                        isPast
                          ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                          : isSelected
                            ? 'text-white font-extrabold z-10'
                            : isToday
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {isSelected && (
                        <motion.span
                          layoutId="booking-date"
                          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                          className="absolute inset-0 rounded-xl bg-emerald-500"
                        />
                      )}
                      <span className="relative">{day}</span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm */}
      <AnimatePresence>
        {showConfirmModal && selectedSlot && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-xs p-0 sm:p-4">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl overflow-hidden p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-extrabold text-base">Booking summary</h3>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isProcessing}
                  aria-label="Close summary"
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>
                    {selectedSlot.pitchName} · {selectedSlot.timeSlot}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatPaise(selectedSlot.pricePaise)}
                  </span>
                </div>
                {selectedAddons.map((name) => (
                  <div key={name} className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="truncate pr-2">{name}</span>
                    <span className="font-bold text-slate-900 dark:text-white shrink-0">
                      {formatPaise(TURF_ADDON_FEE_PAISE)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Turf GST ({TURF_GST_RATE}%)</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatPaise(estimate.gstPaise)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-sm font-black text-emerald-600">
                  <span>Estimated total</span>
                  <span>{formatPaise(estimate.totalPaise)}</span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  The dhaba confirms the final amount when the slot is held.
                </p>
              </div>

              {/* Payment — turf bookings settle at the wallet or the gate */}
              <div className="space-y-2">
                <span className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  Payment
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('wallet')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      paymentMethod === 'wallet'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Wallet className="w-4 h-4 text-emerald-500 mb-1" />
                    <span className="block text-xs font-extrabold">Wallet</span>
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      {formatPaise(walletBalancePaise)} available
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cod')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      paymentMethod === 'cod'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-emerald-500 mb-1" />
                    <span className="block text-xs font-extrabold">Pay at venue</span>
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      Settle at the gate
                    </span>
                  </button>
                </div>
                {walletShortfall && (
                  <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    Your wallet is short by {formatPaise(estimate.totalPaise - walletBalancePaise)}.
                    Top up from the wallet tab, or pay at the venue.
                  </p>
                )}
              </div>

              {bookingError && (
                <p
                  role="alert"
                  className="text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-xl px-3 py-2 flex items-start gap-1.5"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {bookingError}
                </p>
              )}

              <button
                onClick={() => void handleConfirmBooking()}
                disabled={isProcessing || walletShortfall}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-3 rounded-full active:scale-95 transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Holding your slot…</span>
                  </>
                ) : (
                  <span>
                    {user.isLoggedIn ? 'Confirm booking' : 'Sign in to book'} ·{' '}
                    {formatPaise(estimate.totalPaise)}
                  </span>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Gate pass */}
      <AnimatePresence>
        {confirmedBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 text-center space-y-4 shadow-2xl"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto text-2xl">
                ✓
              </div>

              <div className="space-y-1">
                <h3 className="font-black text-lg">Slot reserved</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {confirmedBooking.turfName} · {confirmedBooking.date} ·{' '}
                  {confirmedBooking.timeSlot}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-2">
                {confirmedBooking.gatePassToken ? (
                  <motion.div
                    initial={shouldReduceMotion ? false : { clipPath: 'inset(0 0 100% 0)', opacity: 0 }}
                    animate={{ clipPath: 'inset(0 0 0% 0)', opacity: 1 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="mx-auto w-fit"
                  >
                    {/* The signed token itself — this is what the gate scanner
                        posts to /bookings/verify-gate-pass. */}
                    <GatePassQr token={confirmedBooking.gatePassToken} size={168} />
                  </motion.div>
                ) : (
                  <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 py-6">
                    No gate pass was issued for this booking. Show your booking number at the gate.
                  </p>
                )}
                <div className="text-[10px] text-slate-400 font-mono break-all">
                  {confirmedBooking.bookingNumber}
                </div>
              </div>

              <div className="text-xs space-y-1 text-left bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Subtotal</span>
                  <span className="font-bold">{formatPaise(confirmedBooking.subtotalPaise)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>GST</span>
                  <span className="font-bold">{formatPaise(confirmedBooking.gstAmountPaise)}</span>
                </div>
                <div className="flex justify-between font-black text-emerald-600 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>Paid ({confirmedBooking.paymentMethod})</span>
                  <span>{formatPaise(confirmedBooking.totalAmountPaise)}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setConfirmedBooking(null);
                  onNavigateHub();
                }}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-3 rounded-full text-xs"
              >
                View in My Hub
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
