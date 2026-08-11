import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatPaise, type CelebrationPackage, type Turf } from '../types';
import {
  ApiClient,
  type CelebrationBookingRequest,
  type CelebrationBookingView,
  type CelebrationQuoteView,
} from '../services/apiClient';
import {
  CheckCircle2,
  Users,
  Mic,
  Award,
  Cake,
  X,
  Wallet,
  Banknote,
  ChevronRight,
  Loader2,
  AlertCircle,
  Plus,
  Minus,
  Star,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AnimatedValue } from '../components/AnimatedValue';

/**
 * Party packages and celebration bookings, against the real `celebrations`
 * module.
 *
 * What this replaces: `MOCK_CELEBRATION_PACKAGES` and `MOCK_TURFS` read straight
 * out of the browser bundle, a `calculateTotal()` that added up the add-ons
 * client-side in rupees with no GST at all, and a 1200 ms `setTimeout` that
 * called `addCelebrationBooking()` and `deductWallet()` — neither of which
 * exists on the context. It invented its own booking id, showed a "Party Slot
 * Confirmed!" modal, and sent nothing anywhere.
 *
 * Now: the catalogue is `GET /celebrations`, every figure in the drawer comes
 * from `POST /celebrations/quote`, and the booking is a row created by
 * `POST /celebrations/bookings` which debits the wallet inside its own
 * transaction. The add-on prices below are labels only — the server prices the
 * party.
 */

/** Head count included in the base price. Mirrors `CELEBRATION_INCLUDED_GUESTS`. */
const INCLUDED_GUESTS = 15;
const GUEST_STEP = 5;
/** `CreateCelebrationBookingDto` bounds. */
const MIN_GUESTS = 5;
const MAX_GUESTS = 500;
const MAX_CAKE_KG = 20;

/** Display labels mirroring `pricing.constants.ts`. The server bills. */
const EXTRA_GUEST_PAISE = 200_00;
const COMMENTARY_PAISE = 800_00;
const TROPHY_PAISE = 1200_00;
const FOOD_MENU_PAISE = 1500_00;
const CAKE_PER_KG_PAISE = 400_00;

/** `timeSlot` is a free-form column the server stores verbatim (max 60 chars). */
const TIME_SLOTS = [
  '11:00 AM - 02:00 PM',
  '03:00 PM - 06:00 PM',
  '07:00 PM - 10:00 PM',
  '09:00 PM - 12:00 AM',
] as const;

/** Likewise free-form (max 80 chars). */
const DECOR_THEMES = [
  'IPL Stadium Lights',
  'Team Jersey Colours',
  'Trophy Night Gold',
  'Classic Dhaba Marigold',
] as const;

/** `YYYY-MM-DD` in IST — the timezone the dhaba and its parties live in. */
const istDate = (d: Date = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/** Day arithmetic at noon UTC, which no IST offset can push across a date line. */
const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return istDate(new Date(Date.UTC(y, m - 1, d + days, 12)));
};

interface CelebrationsViewProps {
  onNavigateHub: () => void;
}

export const CelebrationsView: React.FC<CelebrationsViewProps> = ({ onNavigateHub }) => {
  const shouldReduceMotion = useReducedMotion();
  const {
    user,
    wallet,
    language,
    addNotification,
    refreshCelebrations,
    refreshWallet,
    setIsAuthModalOpen,
  } = useApp();

  const [packages, setPackages] = useState<CelebrationPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [turfs, setTurfs] = useState<Turf[]>([]);

  const [activePackage, setActivePackage] = useState<CelebrationPackage | null>(null);
  const [guestCount, setGuestCount] = useState(INCLUDED_GUESTS);
  const [guestDirection, setGuestDirection] = useState<'up' | 'down'>('up');
  const [eventDate, setEventDate] = useState(() => addDays(istDate(), 7));
  const [timeSlot, setTimeSlot] = useState<string>(TIME_SLOTS[2]);
  const [turfName, setTurfName] = useState('');

  const [decorTheme, setDecorTheme] = useState<string>(DECOR_THEMES[0]);
  const [commentarySetup, setCommentarySetup] = useState(true);
  const [trophyPackage, setTrophyPackage] = useState(true);
  const [specialFoodMenu, setSpecialFoodMenu] = useState(true);
  const [cakeKg, setCakeKg] = useState(2);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'cod'>('wallet');

  const [quote, setQuote] = useState<CelebrationQuoteView | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<CelebrationBookingView | null>(null);

  const minEventDate = istDate();

  // ── Data ──────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([ApiClient.getCelebrationPackages(), ApiClient.getTurfs()]).then(
      ([packagesResult, turfsResult]) => {
        if (cancelled) return;
        if (packagesResult.status === 'fulfilled') {
          setPackages(packagesResult.value);
        } else {
          setPackagesError(
            packagesResult.reason instanceof Error
              ? packagesResult.reason.message
              : 'Could not load celebration packages.',
          );
        }
        if (turfsResult.status === 'fulfilled') {
          setTurfs(turfsResult.value);
        }
        setIsLoadingPackages(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Every option change re-prices through the server, so the running total is
   * the same number the booking will charge. Debounced: the cake slider alone
   * can fire a dozen changes.
   */
  useEffect(() => {
    if (!activePackage) return;
    const input: CelebrationBookingRequest = {
      packageId: activePackage.id,
      eventDate,
      timeSlot,
      guestCount,
      turfName,
      decorTheme,
      commentarySetup,
      trophyPackage,
      specialFoodMenu,
      cakeKg,
    };
    setIsQuoting(true);
    const timer = window.setTimeout(async () => {
      try {
        setQuote(await ApiClient.getCelebrationQuote(input));
        setQuoteError(null);
      } catch (err) {
        setQuote(null);
        setQuoteError(err instanceof Error ? err.message : 'Could not price this party.');
      } finally {
        setIsQuoting(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [
    activePackage,
    eventDate,
    timeSlot,
    guestCount,
    turfName,
    decorTheme,
    commentarySetup,
    trophyPackage,
    specialFoodMenu,
    cakeKg,
  ]);

  const walletBalancePaise = wallet?.balancePaise ?? user.walletBalancePaise ?? 0;
  const walletShortfall =
    paymentMethod === 'wallet' && !!quote && walletBalancePaise < quote.totalAmountPaise;

  const openDrawer = (pkg: CelebrationPackage) => {
    setActivePackage(pkg);
    setQuote(null);
    setQuoteError(null);
    setBookingError(null);
  };

  const closeDrawer = () => {
    setActivePackage(null);
    setQuote(null);
    setQuoteError(null);
    setBookingError(null);
  };

  const adjustGuests = (delta: number) => {
    setGuestDirection(delta > 0 ? 'up' : 'down');
    setGuestCount((current) => Math.min(MAX_GUESTS, Math.max(MIN_GUESTS, current + delta)));
  };

  // ── Booking ───────────────────────────────────────

  const handleConfirmParty = async () => {
    if (!activePackage || !quote) return;
    if (!user.isLoggedIn) {
      closeDrawer();
      setIsAuthModalOpen(true);
      return;
    }

    setIsBooking(true);
    setBookingError(null);
    try {
      const booking = await ApiClient.createCelebrationBooking({
        packageId: activePackage.id,
        eventDate,
        timeSlot,
        guestCount,
        turfName,
        decorTheme,
        commentarySetup,
        trophyPackage,
        specialFoodMenu,
        cakeKg,
        paymentMethod,
      });

      setConfirmed(booking);
      closeDrawer();
      addNotification('🎉 Party Booked!', `Celebration ${booking.bookingNumber} booked for ${eventDate}`, 'booking');
      await Promise.allSettled([refreshCelebrations(), refreshWallet()]);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Could not book this party.');
    } finally {
      setIsBooking(false);
    }
  };

  // ── Package cards ─────────────────────────────────

  if (isLoadingPackages) {
    return (
      <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-white transition-colors">
        <div className="flex items-center gap-3 justify-center py-24 text-slate-500 dark:text-slate-400 font-medium text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading packages…
        </div>
      </div>
    );
  }

  if (packagesError) {
    return (
      <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-white transition-colors">
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl p-4 text-sm font-semibold text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{packagesError}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 pb-28 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-white transition-colors">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <span>🎉</span>
          <span>{language === 'en' ? 'Party & Celebration Packages' : 'टर्फ पार्टी व उत्सव'}</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {language === 'en'
            ? 'Host T10 Birthday Matches with Stadium Floodlights & Unlimited Dhaba Feast!'
            : 'भव्य भारतीय शैली टर्फ पार्टी और असीमित ढाबा दावत उत्सव'}
        </p>
      </div>

      {/* Package List */}
      <div className="space-y-4">
        {packages.map((pkg) => (
          <motion.article
            key={pkg.id}
            whileHover={shouldReduceMotion ? undefined : { y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 330, damping: 27 }}
            className="bg-white border border-slate-200/80 rounded-3xl p-4 shadow-xs hover:shadow-md transition-all space-y-3"
          >
            <div className="relative rounded-2xl overflow-hidden h-40 bg-slate-100 dark:bg-slate-800">
              {/* `image` defaults to '' in the schema and the seeded package has no
                  photograph — the mock's only picture was an Unsplash stock shot of
                  someone else's party. An unguarded src="" makes the browser re-request
                  the page URL and paint a broken-image glyph, so fall through to the
                  slate tile instead. The two badges stay readable either way. */}
              {pkg.image && (
                <img src={pkg.image} alt={pkg.titleEn} className="w-full h-full object-cover" />
              )}
              <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-extrabold text-slate-900 flex items-center gap-1 shadow-xs">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>{pkg.rating}</span>
              </div>
              <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md text-emerald-300 text-xs px-3 py-1 rounded-full font-bold">
                Recommended: {pkg.recommendedFor}
              </div>
            </div>

            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                {language === 'en' ? pkg.titleEn : pkg.titleHi}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {language === 'en' ? pkg.subtitleEn : pkg.subtitleHi}
              </p>
            </div>

            {/* Inclusions List */}
            <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 text-xs">
              <div className="font-bold text-slate-900 dark:text-white text-[11px] uppercase tracking-wider">Package Inclusions</div>
              {(language === 'en' ? pkg.inclusionsEn : pkg.inclusionsHi).map((inc, i) => (
                <div key={i} className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>{inc}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Base Package Price</span>
                <div className="text-lg font-black text-emerald-600">{formatPaise(pkg.basePricePaise)}</div>
              </div>

              <button
                onClick={() => openDrawer(pkg)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs px-5 py-2.5 rounded-full shadow-green-sm active:scale-95 transition-all flex items-center gap-1"
              >
                <span>Customize & Book</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.article>
        ))}
      </div>

      {/* CUSTOMIZATION & CHECKOUT DRAWER MODAL */}
      <AnimatePresence>
        {activePackage && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-xs p-0 sm:p-4">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[90vh] flex flex-col shadow-2xl relative"
            >
              {/* Header */}
              <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">{activePackage.titleEn}</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Configure party options & guest count</p>
                </div>
                <button
                  onClick={closeDrawer}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Customization Options */}
              <div className="p-5 space-y-4 flex-1 overflow-y-auto text-xs">
                {/* Guest Count Stepper */}
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-3.5 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">Estimated Guest Count</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {INCLUDED_GUESTS} included · {formatPaise(EXTRA_GUEST_PAISE)} per guest after
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-full font-bold">
                    <button
                      onClick={() => adjustGuests(-GUEST_STEP)}
                      disabled={guestCount <= MIN_GUESTS}
                      className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold active:scale-95 shadow-green-sm disabled:opacity-40"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <AnimatedValue value={guestCount} direction={guestDirection} className="w-6 text-center font-extrabold text-slate-900 dark:text-white" />
                    <button
                      onClick={() => adjustGuests(GUEST_STEP)}
                      disabled={guestCount >= MAX_GUESTS}
                      className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold active:scale-95 shadow-green-sm disabled:opacity-40"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Event Date Picker */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 dark:text-slate-200">Party Event Date</label>
                  <input
                    type="date"
                    value={eventDate}
                    min={minEventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Time Slot */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 dark:text-slate-200">Time Slot</label>
                  <div className="flex flex-wrap gap-1.5">
                    {TIME_SLOTS.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setTimeSlot(slot)}
                        className={`px-3 py-1.5 rounded-full border font-bold transition-all ${
                          timeSlot === slot
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Turf / Venue */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 dark:text-slate-200">Turf / Venue</label>
                  <select
                    value={turfName}
                    onChange={(e) => setTurfName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Let the dhaba arrange the venue</option>
                    {turfs.map((turf) => (
                      <option key={turf.id} value={turf.name}>
                        {turf.name} — {turf.area}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Decor Theme */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 dark:text-slate-200">Decor Theme</label>
                  <select
                    value={decorTheme}
                    onChange={(e) => setDecorTheme(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-emerald-500"
                  >
                    {DECOR_THEMES.map((theme) => (
                      <option key={theme} value={theme}>
                        {theme}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Toggles */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="font-extrabold text-slate-900 dark:text-white">Add-on Features</h4>

                  <div
                    onClick={() => setCommentarySetup(!commentarySetup)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      commentarySetup ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-bold">
                        Live DJ Commentary Setup (+{formatPaise(COMMENTARY_PAISE)})
                        <motion.span animate={commentarySetup && !shouldReduceMotion ? { scaleY: [0.55, 1, 0.65, 1] } : { scaleY: 1 }} transition={{ duration: 0.75, repeat: commentarySetup ? Infinity : 0, repeatDelay: 0.35 }} className="inline-flex origin-bottom">
                          <Mic className="h-3.5 w-3.5 text-emerald-500" />
                        </motion.span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Stadium mic, music & match commentary</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${commentarySetup ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                      ✓
                    </div>
                  </div>

                  <div
                    onClick={() => setTrophyPackage(!trophyPackage)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      trophyPackage ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="font-bold">Winner Trophy & Medals (+{formatPaise(TROPHY_PAISE)})</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Customized match trophy & 15 medals</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${trophyPackage ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                      ✓
                    </div>
                  </div>

                  <div
                    onClick={() => setSpecialFoodMenu(!specialFoodMenu)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      specialFoodMenu ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="font-bold">Unlimited Dhaba Starters & Drinks (+{formatPaise(FOOD_MENU_PAISE)})</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Unlimited Paneer Tikka, Biryani & Lassi</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${specialFoodMenu ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                      ✓
                    </div>
                  </div>
                </div>

                {/* Cake Weight Slider */}
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between font-bold">
                    <span className="dark:text-white">Cricket Theme Cake</span>
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <motion.span animate={{ scale: shouldReduceMotion ? 1 : 0.72 + cakeKg * 0.1 }} transition={{ type: 'spring', stiffness: 360, damping: 24 }} className="inline-flex">
                        <Cake className="h-5 w-5" />
                      </motion.span>
                      <span>{cakeKg} kg (+{formatPaise(cakeKg * CAKE_PER_KG_PAISE)})</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max={MAX_CAKE_KG}
                    value={cakeKg}
                    onChange={(e) => setCakeKg(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>

                {/* Payment Method */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="font-extrabold text-slate-900 dark:text-white">Pay With</h4>

                  <div
                    onClick={() => setPaymentMethod('wallet')}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      paymentMethod === 'wallet' ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center ${paymentMethod === 'wallet' ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300'}`}>
                        <Wallet className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">Dhaba Wallet</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {walletShortfall
                            ? `Insufficient balance — ${formatPaise(walletBalancePaise)} available`
                            : `Available: ${formatPaise(walletBalancePaise)}`}
                        </div>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${paymentMethod === 'wallet' ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                      ✓
                    </div>
                  </div>

                  <div
                    onClick={() => setPaymentMethod('cod')}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      paymentMethod === 'cod' ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center ${paymentMethod === 'cod' ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300'}`}>
                        <Banknote className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">Pay at Venue</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Settle with the dhaba on party day</div>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${paymentMethod === 'cod' ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                      ✓
                    </div>
                  </div>
                </div>

                {/* Quote Error */}
                {quoteError && (
                  <div
                    role="alert"
                    className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl p-3 text-xs font-semibold text-red-700 dark:text-red-300 flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{quoteError}</span>
                  </div>
                )}

                {bookingError && (
                  <div
                    role="alert"
                    className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl p-3 text-xs font-semibold text-red-700 dark:text-red-300 flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{bookingError}</span>
                  </div>
                )}
              </div>

              {/* Fixed Bottom Bar */}
              <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-sm">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Estimate</span>
                  <div className="text-xl font-black text-emerald-600">
                    {isQuoting || !quote ? (
                      <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                    ) : (
                      formatPaise(quote.totalAmountPaise)
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    incl. {formatPaise(quote?.gstAmountPaise ?? 0)} GST
                  </div>
                </div>

                <button
                  onClick={handleConfirmParty}
                  disabled={isBooking || isQuoting || !quote || (paymentMethod === 'wallet' && walletShortfall)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold px-8 py-3 rounded-full shadow-green-sm active:scale-95 transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isBooking && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isBooking ? 'Booking…' : 'Book Celebration Slot'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRMATION MODAL */}
      <AnimatePresence>
        {confirmed && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 text-center space-y-4 shadow-2xl"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl">
                🎉
              </div>

              <div className="space-y-1">
                <h3 className="font-black text-slate-900 dark:text-white text-lg">Party Slot Confirmed!</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Your Indian Dhaba turf party has been booked successfully</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-xs font-bold text-slate-800 dark:text-slate-200 space-y-1">
                <div>Event Date: {confirmed.eventDate}</div>
                <div>Guest Count: {confirmed.guestCount} Players & Guests</div>
                <div>
                  Paid {formatPaise(confirmed.totalAmountPaise)} · {confirmed.paymentMethod === 'wallet' ? 'Dhaba Wallet' : 'Pay at Venue'}
                </div>
                <div className="text-emerald-600 font-extrabold text-sm pt-1">Booking #{confirmed.bookingNumber}</div>
              </div>

              <button
                onClick={() => {
                  setConfirmed(null);
                  onNavigateHub();
                }}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-3 rounded-full shadow-green-sm text-xs"
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
