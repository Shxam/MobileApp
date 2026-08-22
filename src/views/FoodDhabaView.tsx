import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatPaise, type MenuItem, type PaymentMethod, type DeliveryType, type SavedAddress } from '../types';
import ApiClient, { type OrderView, type QuoteView } from '../services/apiClient';
import { payForOrder, PaymentCancelledError } from '../services/razorpayCheckout';
import { PaymentModal } from '../components/PaymentModal';
import {
  UtensilsCrossed,
  Clock,
  Plus,
  Minus,
  ShoppingBag,
  X,
  Search,
  ChevronRight,
  Heart,
  Star,
  MapPin,
  Ticket,
  Loader2,
  AlertCircle,
  Home,
  BookUser,
  Check,
} from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { AnimatedValue } from '../components/AnimatedValue';
import { FEATURES } from '../config/features';

interface FoodDhabaViewProps {
  onNavigateHub: () => void;
}

const pageReveal = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

const sectionReveal = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 24 } },
};

/**
 * Flattens a saved address into the single line the order carries.
 *
 * `landmark` and `pincode` are optional on the model, so they are filtered out
 * rather than joined blindly — otherwise an address without a landmark reaches
 * the rider as "12 MG Road, , 500081".
 */
const formatAddress = (address: SavedAddress): string =>
  [address.detail, address.landmark, address.pincode].filter(Boolean).join(', ');

const sheetTransition = { type: 'spring' as const, damping: 28, stiffness: 300 };

/** Purely decorative; an unknown category still gets a plate rather than a blank. */
const CATEGORY_ICONS: Record<string, string> = {
  biryani: '🍲',
  curries: '🍛',
  breads: '🫓',
  starters: '🍗',
  combos: '🔥',
  drinks: '🥤',
  snacks: '🥟',
  desserts: '🍮',
};

const categoryIcon = (category: string) => CATEGORY_ICONS[category.toLowerCase()] ?? '🍽️';

/**
 * Order attempts need a key the server can dedupe on, so a double-tap or a
 * retried network call returns the first order instead of creating a second.
 */
const newIdempotencyKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `ord-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

export const FoodDhabaView: React.FC<FoodDhabaViewProps> = ({ onNavigateHub }) => {
  const shouldReduceMotion = useReducedMotion();
  const {
    user,
    cart,
    addToCart,
    updateCartQuantity,
    clearCart,
    cartTotalPaise,
    applyOrderUpdate,
    wallet,
    refreshWallet,
    language,
    addNotification,
  } = useApp();

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedItemDetail, setSelectedItemDetail] = useState<MenuItem | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const [deliveryType, setDeliveryType] = useState<DeliveryType>('turf_bench');
  const [benchLocation, setBenchLocation] = useState('Cage 1 (Bench Side)');
  const [homeAddress, setHomeAddress] = useState('');
  const [cookingInstructions, setCookingInstructions] = useState('');

  /**
   * The customer's saved addresses, offered instead of making them retype a
   * street and pincode on every order. Selecting one copies its text into
   * `homeAddress`, which stays the single value sent to the server — an order
   * keeps its own address snapshot, so editing a saved address later never
   * rewrites where an already-delivered order went.
   */
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [addressesLoaded, setAddressesLoaded] = useState(false);
  const [isAddressListOpen, setIsAddressListOpen] = useState(false);

  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);

  const [quote, setQuote] = useState<QuoteView | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  /**
   * An order created but not yet paid. Razorpay's sheet can be dismissed, and
   * when it is, the order already exists — retrying must resume paying for that
   * order rather than burning the (now spent) quote on a second one.
   */
  const [pendingOrder, setPendingOrder] = useState<OrderView | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);

  const idempotencyKey = useRef(newIdempotencyKey());
  /** Guards against an older quote response landing after a newer one. */
  const quoteSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setMenuLoading(true);
    setMenuError(null);
    Promise.all([ApiClient.getMenu('all'), ApiClient.getMenuCategories()])
      .then(([items, cats]) => {
        if (cancelled) return;
        setMenu(items);
        setCategories(cats);
      })
      .catch((err) => {
        if (!cancelled) setMenuError(errorText(err, 'Could not load the menu.'));
      })
      .finally(() => {
        if (!cancelled) setMenuLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cartItemCount = cart.reduce((sum, ci) => sum + ci.quantity, 0);

  /**
   * Fetched only once the customer actually picks home delivery — most orders
   * are eaten at the turf, and there is no reason to ask the server for a list
   * that screen will never show.
   *
   * The default address is prefilled, but only into an empty box: someone who
   * has already typed something must not have it overwritten underneath them.
   */
  useEffect(() => {
    if (deliveryType !== 'home_delivery' || addressesLoaded) return;
    let cancelled = false;

    ApiClient.getAddresses()
      .then((rows) => {
        if (cancelled) return;
        setSavedAddresses(rows);
        const preferred = rows.find((a) => a.isDefault) ?? rows[0];
        if (preferred) setHomeAddress((current) => (current.trim() ? current : formatAddress(preferred)));
      })
      .catch(() => {
        // Not fatal — the free-text box below still accepts a typed address.
      })
      .finally(() => {
        if (!cancelled) setAddressesLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [deliveryType, addressesLoaded]);

  /** The exact payload `POST /orders/quote` wants: ids and quantities, no prices. */
  const quoteItems = useMemo(
    () => cart.map((ci) => ({ menuItemId: ci.menuItem.id, quantity: ci.quantity })),
    [cart],
  );

  /**
   * Re-quotes whenever the basket, the delivery mode or the voucher changes.
   *
   * The server owns every rupee of this — the client no longer computes GST or a
   * delivery fee, it displays what it was quoted and then redeems that quote at
   * checkout, so the total cannot drift between the two.
   */
  useEffect(() => {
    if (quoteItems.length === 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    const seq = ++quoteSeq.current;
    setQuoting(true);
    const timer = setTimeout(() => {
      ApiClient.quoteOrder(quoteItems, deliveryType, appliedPromo ?? undefined)
        .then((next) => {
          if (seq !== quoteSeq.current) return;
          setQuote(next);
          setQuoteError(null);
        })
        .catch((err) => {
          if (seq !== quoteSeq.current) return;
          setQuote(null);
          setQuoteError(errorText(err, 'Could not price this order.'));
        })
        .finally(() => {
          if (seq === quoteSeq.current) setQuoting(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [quoteItems, deliveryType, appliedPromo]);

  const cleanQuery = searchQuery.trim().toLowerCase();

  const filteredMenu = useMemo(
    () =>
      menu.filter((item) => {
        if (cleanQuery.length > 0) {
          return (
            item.nameEn.toLowerCase().includes(cleanQuery) ||
            item.nameHi.toLowerCase().includes(cleanQuery) ||
            item.category.toLowerCase().includes(cleanQuery) ||
            item.descriptionEn.toLowerCase().includes(cleanQuery) ||
            item.descriptionHi.toLowerCase().includes(cleanQuery)
          );
        }
        return (
          selectedCategory === 'all' ||
          item.category.toLowerCase() === selectedCategory.toLowerCase()
        );
      }),
    [menu, cleanQuery, selectedCategory],
  );

  const spotlightItem = menu[0];

  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  /**
   * Takes the code as an argument rather than reading state.
   *
   * The banner button used to call `setPromoCode(...)` and then apply in the same
   * tick, which validated whatever the *previous* render held — usually an empty
   * string — so the advertised coupon never actually applied.
   */
  const applyPromo = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim().toUpperCase();
      if (!code || quoteItems.length === 0) return;

      setPromoBusy(true);
      try {
        // Quote with the code before committing to it: the server is the only
        // thing that knows whether it is valid, in date, and within its cap.
        const next = await ApiClient.quoteOrder(quoteItems, deliveryType, code);
        setAppliedPromo(code);
        setPromoInput(code);
        setQuote(next);
        setQuoteError(null);
        quoteSeq.current++;
        addNotification(
          '🎉 Voucher applied',
          `${code} took ${formatPaise(next.bill.discountPaise)} off your order.`,
          'reward',
        );
      } catch (err) {
        addNotification('⚠️ Voucher rejected', errorText(err, 'That code is not valid.'), 'food');
      } finally {
        setPromoBusy(false);
      }
    },
    [quoteItems, deliveryType, addNotification],
  );

  const clearPromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
  };

  const walletBalancePaise = wallet?.balancePaise ?? user.walletBalancePaise;
  const needsAddress = deliveryType === 'home_delivery' && homeAddress.trim().length < 10;
  const canCheckout = Boolean(quote) && !quoting && !needsAddress && cart.length > 0;

  const deliveryTarget =
    deliveryType === 'home_delivery'
      ? 'Home delivery'
      : `Singarayakonda Turf — ${benchLocation.trim() || 'Bench side'}`;

  const handleOpenPayment = () => {
    if (!canCheckout) return;
    idempotencyKey.current = newIdempotencyKey();
    setIsPaymentModalOpen(true);
  };

  /**
   * Creates the order, then settles it.
   *
   * COD and wallet are decided server-side inside order creation — the order
   * comes back already `placed`. Razorpay needs a second leg: the order is
   * created `awaiting_payment`, Checkout opens, and the signature is verified
   * before the kitchen ever sees it.
   */
  const handleConfirmPayment = async (method: PaymentMethod) => {
    const active = quote;
    if (!active) throw new Error('Your order needs to be re-priced. Close this and try again.');

    if (pendingOrder && method !== 'razorpay') {
      throw new Error(
        `Order ${pendingOrder.orderNumber} is already waiting on an online payment. ` +
          'Finish or cancel it before switching to another method.',
      );
    }

    const order =
      pendingOrder ??
      (await ApiClient.createOrder({
        quoteId: active.quoteId,
        paymentMethod: method,
        deliveryTarget,
        ...(deliveryType === 'home_delivery' ? { deliveryAddress: homeAddress.trim() } : {}),
        ...(cookingInstructions.trim() ? { cookingInstructions: cookingInstructions.trim() } : {}),
        idempotencyKey: idempotencyKey.current,
      }));

    let settled = order;

    if (method === 'razorpay') {
      setPendingOrder(order);
      try {
        await payForOrder(order.id, {
          description: `IPL Dhaba order ${order.orderNumber}`,
          customerName: user.name,
          customerPhone: user.phone,
        });
        settled = await ApiClient.getOrder(order.id);
      } catch (err) {
        if (err instanceof PaymentCancelledError) {
          // The order is real and unpaid. It stays in the list so it can be paid
          // from here on the next attempt, and the server's reconciliation sweep
          // cancels it if it is simply abandoned.
          applyOrderUpdate(order);
          throw new Error('Payment cancelled. Tap Pay again to finish this order.');
        }
        throw err;
      }
    }

    setPendingOrder(null);
    applyOrderUpdate(settled);
    if (method === 'wallet') void refreshWallet();

    clearCart();
    clearPromo();
    setCookingInstructions('');
    setQuote(null);
    setIsPaymentModalOpen(false);
    setIsCartOpen(false);

    addNotification(
      '🍳 Order placed!',
      method === 'cod'
        ? `Order ${settled.orderNumber} is with the kitchen. Pay ${formatPaise(settled.bill.totalPaise)} on delivery.`
        : `Order ${settled.orderNumber} is paid and with the kitchen.`,
      'food',
    );
    onNavigateHub();
  };

  return (
    <motion.div
      variants={pageReveal}
      initial="hidden"
      animate="show"
      className="space-y-4 p-4 pb-28 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-white transition-colors"
    >
      {/* 1. Spotlight hero */}
      {spotlightItem && (
        <motion.button
          type="button"
          variants={sectionReveal}
          whileTap={{ scale: 0.985 }}
          onClick={() => setSelectedItemDetail(spotlightItem)}
          className="group relative block w-full overflow-hidden rounded-3xl bg-slate-950 text-left shadow-[0_18px_44px_-20px_rgba(15,23,42,0.75)]"
        >
          <img
            src={spotlightItem.image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-55 transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/15" />
          <motion.div
            aria-hidden="true"
            animate={{ x: ['-120%', '210%'] }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 3.8, repeat: Infinity, repeatDelay: 2.2, ease: 'easeInOut' }
            }
            className="absolute inset-y-0 w-16 -skew-x-12 bg-white/10 blur-xl"
          />
          <div className="relative min-h-40 p-5 pr-28">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.13em] text-amber-300 backdrop-blur-md">
              Matchday pick
            </div>
            <h2 className="max-w-52 font-display text-2xl font-black leading-tight text-white">
              Fuel your next over.
            </h2>
            <p className="mt-1.5 text-xs font-medium text-slate-300">
              {language === 'en' ? spotlightItem.nameEn : spotlightItem.nameHi} · ready in{' '}
              {spotlightItem.prepTimeMinutes} minutes.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-300">
              Explore chef special <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </motion.button>
      )}

      {/* 2. Delivery mode */}
      <motion.div
        variants={sectionReveal}
        className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 shadow-xs space-y-2"
      >
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800 dark:text-slate-200">Delivery target</span>
          <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
            {quote ? `Fee ${formatPaise(quote.bill.deliveryFeePaise)}` : 'Fee at checkout'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <motion.button
            onClick={() => setDeliveryType('turf_bench')}
            whileTap={{ scale: 0.97 }}
            className={`relative overflow-hidden py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
              deliveryType === 'turf_bench'
                ? 'text-white border-emerald-500 shadow-green-sm'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
            }`}
          >
            {deliveryType === 'turf_bench' && (
              <motion.span layoutId="delivery-mode" transition={sheetTransition} className="absolute inset-0 bg-emerald-500" />
            )}
            <span className="relative">🏏 Turf bench</span>
          </motion.button>

          <motion.button
            onClick={() => setDeliveryType('home_delivery')}
            whileTap={{ scale: 0.97 }}
            className={`relative overflow-hidden py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
              deliveryType === 'home_delivery'
                ? 'text-white border-amber-500 shadow-green-sm'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
            }`}
          >
            {deliveryType === 'home_delivery' && (
              <motion.span layoutId="delivery-mode" transition={sheetTransition} className="absolute inset-0 bg-amber-500" />
            )}
            <span className="relative">🏠 Home delivery</span>
          </motion.button>
        </div>

        {deliveryType === 'turf_bench' ? (
          <input
            type="text"
            value={benchLocation}
            onChange={(e) => setBenchLocation(e.target.value)}
            placeholder="Which cage or bench? e.g. Cage 2, near dugout"
            maxLength={120}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
        ) : (
          <div className="space-y-1.5">
            {/* Saved addresses, when there are any. The box below still accepts
                a one-off address for an order going somewhere new. */}
            {savedAddresses.length > 0 && (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setIsAddressListOpen((open) => !open)}
                  aria-expanded={isAddressListOpen}
                  className="flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                >
                  <BookUser className="w-3 h-3" />
                  <span>
                    {isAddressListOpen
                      ? 'Hide saved addresses'
                      : `Use a saved address (${savedAddresses.length})`}
                  </span>
                </button>

                {isAddressListOpen && (
                  <div className="grid gap-1.5">
                    {savedAddresses.map((address) => {
                      const line = formatAddress(address);
                      const isSelected = homeAddress.trim() === line;
                      return (
                        <button
                          key={address.id}
                          type="button"
                          onClick={() => {
                            setHomeAddress(line);
                            setIsAddressListOpen(false);
                          }}
                          className={`flex items-start gap-2 text-left rounded-xl border px-3 py-2 transition-colors ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50'
                              : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700'
                          }`}
                        >
                          <span className="mt-0.5 shrink-0 text-emerald-600">
                            {isSelected ? <Check className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className="text-[11px] font-extrabold text-slate-900 dark:text-white">
                                {address.label}
                              </span>
                              {address.isDefault && (
                                <span className="text-[9px] font-extrabold uppercase tracking-wide text-emerald-600 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded-full">
                                  Default
                                </span>
                              )}
                            </span>
                            <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                              {line}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="relative">
              <Home className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400" />
              <textarea
                value={homeAddress}
                onChange={(e) => setHomeAddress(e.target.value)}
                placeholder="Full delivery address with landmark and pincode"
                rows={2}
                maxLength={400}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>
            {needsAddress && (
              <p className="text-[10px] font-bold text-amber-600">
                A rider needs a full address — add at least a street and a landmark.
              </p>
            )}
          </div>
        )}
      </motion.div>

      {/* 3. Search */}
      <motion.div variants={sectionReveal} className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.length > 0) setSelectedCategory('all');
            }}
            placeholder={language === 'en' ? 'Search for food or drinks...' : 'भोजन या पेय खोजें...'}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl pl-11 pr-10 py-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-xs transition-all font-medium"
          />
          {searchQuery.length > 0 && (
            <motion.button
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.86 }}
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* 4. Categories — the dhaba's real menu sections, not a fixed list */}
      {categories.length > 0 && (
        <motion.div variants={sectionReveal} className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Categories</h3>
            <span className="text-[11px] text-emerald-500 font-bold">{filteredMenu.length} items</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            {['all', ...categories].map((cat) => {
              const isActive = selectedCategory === cat && cleanQuery.length === 0;
              return (
                <motion.button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setSearchQuery('');
                  }}
                  whileTap={{ scale: 0.94 }}
                  className={`relative overflow-hidden flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold shrink-0 transition-all border ${
                    isActive
                      ? 'text-white border-emerald-500 shadow-green-sm scale-105'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {isActive && (
                    <motion.span layoutId="food-category" transition={sheetTransition} className="absolute inset-0 bg-emerald-500" />
                  )}
                  <span className="relative">{cat === 'all' ? '🍽️' : categoryIcon(cat)}</span>
                  <span className="relative capitalize">{cat}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* 5. Menu */}
      {menuLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-xs font-bold text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading today's menu…
        </div>
      ) : menuError ? (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 text-xs font-bold text-rose-600 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {menuError}
        </div>
      ) : filteredMenu.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 text-center space-y-2">
          <UtensilsCrossed className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">
            {cleanQuery ? `No dishes found for "${searchQuery}"` : 'Nothing on the menu here yet'}
          </div>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-green-sm"
          >
            Show all menu items
          </button>
        </div>
      ) : (
        <LayoutGroup>
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {filteredMenu.map((item) => {
              const cartEntry = cart.find((c) => c.menuItem.id === item.id);
              const quantity = cartEntry ? cartEntry.quantity : 0;
              const isFav = favorites.includes(item.id);
              const soldOut = item.isAvailable === false;

              return (
                <motion.article
                  layout
                  initial={{ opacity: 0, y: 18, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 330, damping: 28 }}
                  whileHover={{ y: -4 }}
                  key={item.id}
                  onClick={() => setSelectedItemDetail(item)}
                  className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-2.5 group ${
                    soldOut ? 'opacity-60' : ''
                  }`}
                >
                  <div className="relative rounded-xl overflow-hidden h-36 bg-slate-100 dark:bg-slate-800">
                    <img
                      src={item.image}
                      alt={item.nameEn}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <motion.button
                      onClick={(e) => toggleFavorite(item.id, e)}
                      whileTap={{ scale: 0.78 }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center shadow-xs text-rose-500 hover:scale-110 transition-transform"
                    >
                      <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
                    </motion.button>

                    <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-extrabold text-slate-900 flex items-center gap-1 shadow-xs">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span>{item.rating}</span>
                    </div>

                    <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                      <Clock className="w-2.5 h-2.5 text-rose-400" />
                      <span>{item.prepTimeMinutes} mins</span>
                    </div>

                    {soldOut && (
                      <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center">
                        <span className="text-[11px] font-black text-white uppercase tracking-wider">Sold out</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-3 h-3 rounded-xs border ${
                          item.isVeg ? 'border-emerald-600 bg-emerald-50' : 'border-rose-600 bg-rose-50'
                        } flex items-center justify-center shrink-0`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                      </span>
                      <h4 className="font-extrabold text-slate-900 dark:text-white text-sm truncate">
                        {language === 'en' ? item.nameEn : item.nameHi}
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                      {language === 'en' ? item.descriptionEn : item.descriptionHi}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="font-black text-emerald-600 text-base">{formatPaise(item.pricePaise)}</span>

                    {quantity === 0 ? (
                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(item);
                        }}
                        disabled={soldOut}
                        whileTap={{ scale: 0.91 }}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-green-sm transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{soldOut ? 'Unavailable' : 'Add'}</span>
                      </motion.button>
                    ) : (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-2 py-1 rounded-full text-xs font-bold"
                      >
                        <motion.button
                          onClick={() => updateCartQuantity(item.id, quantity - 1)}
                          whileTap={{ scale: 0.82 }}
                          className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold active:scale-95 shadow-green-sm"
                        >
                          <Minus className="w-3 h-3" />
                        </motion.button>
                        <AnimatedValue value={quantity} className="w-4 text-center font-extrabold text-slate-900 dark:text-white" />
                        <motion.button
                          onClick={() => addToCart(item)}
                          whileTap={{ scale: 0.82 }}
                          className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold active:scale-95 shadow-green-sm"
                        >
                          <Plus className="w-3 h-3" />
                        </motion.button>
                      </div>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        </LayoutGroup>
      )}

      {/* 6. Floating cart bar */}
      <AnimatePresence>
        {cartItemCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 34, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={sheetTransition}
            className="fixed bottom-24 sm:bottom-16 left-0 right-0 z-30 p-3"
          >
            <div className="max-w-md mx-auto bg-slate-900 text-white rounded-full p-3 px-5 shadow-2xl flex items-center justify-between border border-slate-800 backdrop-blur-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white font-extrabold flex items-center justify-center shadow-green-sm">
                  {cartItemCount}
                </div>
                <div>
                  <div className="text-xs font-black flex items-center gap-1.5">
                    {quote ? formatPaise(quote.bill.totalPaise) : formatPaise(cartTotalPaise)}
                    {quoting && <Loader2 className="w-3 h-3 animate-spin text-emerald-300" />}
                  </div>
                  <div className="text-[10px] text-emerald-300 font-medium">
                    {quote ? 'Includes taxes & delivery' : 'Items only — taxes at checkout'}
                  </div>
                </div>
              </div>

              <motion.button
                onClick={() => setIsCartOpen(true)}
                whileTap={{ scale: 0.94 }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold px-5 py-2.5 rounded-full shadow-green-sm active:scale-95 transition-all flex items-center gap-1.5"
              >
                <span>View cart & pay</span>
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7. Item detail sheet */}
      <AnimatePresence>
        {selectedItemDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-xs p-0 sm:p-4"
          >
            <motion.div
              initial={{ y: '100%', scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: '100%', scale: 0.98 }}
              transition={sheetTransition}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[90vh] flex flex-col shadow-2xl relative"
            >
              <div className="relative h-64 bg-slate-100 dark:bg-slate-800">
                <img src={selectedItemDetail.image} alt={selectedItemDetail.nameEn} className="w-full h-full object-cover" />
                <button
                  onClick={() => setSelectedItemDetail(null)}
                  className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-slate-700 shadow-md hover:bg-white"
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => toggleFavorite(selectedItemDetail.id, e)}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-emerald-500 shadow-md hover:scale-110"
                >
                  <Heart
                    className={`w-5 h-5 ${
                      favorites.includes(selectedItemDetail.id) ? 'fill-emerald-500 text-emerald-500' : 'text-slate-400'
                    }`}
                  />
                </button>
              </div>

              <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3.5 h-3.5 rounded-xs border ${
                        selectedItemDetail.isVeg ? 'border-emerald-600 bg-emerald-50' : 'border-rose-600 bg-rose-50'
                      } flex items-center justify-center shrink-0`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${selectedItemDetail.isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`}
                      />
                    </span>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">
                      {language === 'en' ? selectedItemDetail.nameEn : selectedItemDetail.nameHi}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                    <span>NH-16 Bypass Road, Singarayakonda, AP</span>
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-3.5 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white flex items-center justify-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span>{selectedItemDetail.rating}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">Rating</div>
                  </div>
                  <div className="border-x border-slate-200 dark:border-slate-700">
                    <div className="text-xs font-black text-slate-900 dark:text-white capitalize">
                      {selectedItemDetail.category}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">Section</div>
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white">
                      {selectedItemDetail.prepTimeMinutes} min
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">Prep</div>
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                    Description
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {language === 'en' ? selectedItemDetail.descriptionEn : selectedItemDetail.descriptionHi}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Price</div>
                  <div className="text-xl font-black text-emerald-600">{formatPaise(selectedItemDetail.pricePaise)}</div>
                </div>

                <button
                  onClick={() => {
                    addToCart(selectedItemDetail);
                    setSelectedItemDetail(null);
                    setIsCartOpen(true);
                  }}
                  disabled={selectedItemDetail.isAvailable === false}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold px-8 py-3 rounded-full shadow-green-sm active:scale-95 transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {selectedItemDetail.isAvailable === false ? 'Sold out' : 'Order now'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 8. Cart sheet */}
      <AnimatePresence>
        {isCartOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-xs p-0 sm:p-4"
          >
            <motion.div
              initial={{ y: '100%', scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: '100%', scale: 0.98 }}
              transition={sheetTransition}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[90vh] flex flex-col shadow-2xl relative"
            >
              <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">My cart ({cartItemCount})</h3>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3.5 flex-1 overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <UtensilsCrossed className="w-12 h-12 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-500">Your cart is empty!</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      key={item.menuItem.id}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-xs"
                    >
                      <img
                        src={item.menuItem.image}
                        alt={item.menuItem.nameEn}
                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-xs truncate">
                          {language === 'en' ? item.menuItem.nameEn : item.menuItem.nameHi}
                        </h4>
                        <div className="text-xs font-black text-emerald-600 mt-0.5">
                          {formatPaise(item.menuItem.pricePaise)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 px-2 py-1 rounded-full text-xs font-bold">
                        <button
                          onClick={() => updateCartQuantity(item.menuItem.id, item.quantity - 1)}
                          className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold active:scale-95 shadow-green-sm"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <AnimatedValue value={item.quantity} className="w-4 text-center font-extrabold text-slate-900 dark:text-white" />
                        <button
                          onClick={() => addToCart(item.menuItem)}
                          className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold active:scale-95 shadow-green-sm"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}

                {cart.length > 0 && (
                  <>
                    {/* Voucher */}
                    {FEATURES.loyaltyAndVouchersEnabled && (
                      <div className="space-y-1.5 pt-2">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Ticket className="w-3.5 h-3.5 text-emerald-500" />
                          Voucher code
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={promoInput}
                            onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                            placeholder="Enter a code"
                            disabled={promoBusy || appliedPromo !== null}
                            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold uppercase text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 disabled:opacity-60"
                          />
                          {appliedPromo ? (
                            <button
                              onClick={clearPromo}
                              className="px-4 py-2 rounded-xl text-xs font-extrabold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                            >
                              Remove
                            </button>
                          ) : (
                            <button
                              onClick={() => void applyPromo(promoInput)}
                              disabled={promoBusy || !promoInput.trim()}
                              className="px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-500 text-white shadow-green-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              {promoBusy && <Loader2 className="w-3 h-3 animate-spin" />}
                              Apply
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200">Cooking instructions</label>
                      <input
                        type="text"
                        value={cookingInstructions}
                        onChange={(e) => setCookingInstructions(e.target.value)}
                        placeholder="e.g. Extra spicy biryani, less oil..."
                        maxLength={500}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Server-quoted bill */}
              {cart.length > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  {quoteError ? (
                    <div className="flex items-start gap-2 text-rose-600 font-bold">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      {quoteError}
                    </div>
                  ) : !quote ? (
                    <div className="flex items-center gap-2 py-2 text-slate-500 font-bold">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Pricing your order…
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>Subtotal</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatPaise(quote.bill.subtotalPaise)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>Food GST ({quote.bill.gstRate}%)</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatPaise(quote.bill.gstAmountPaise)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>Delivery charge</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatPaise(quote.bill.deliveryFeePaise)}
                        </span>
                      </div>
                      {quote.bill.discountPaise > 0 && (
                        <div className="flex justify-between text-emerald-600 font-bold">
                          <span>Voucher {quote.promoCode ?? ''}</span>
                          <span>−{formatPaise(quote.bill.discountPaise)}</span>
                        </div>
                      )}
                    </>
                  )}

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Total payable</span>
                      <div className="text-xl font-black text-emerald-600">
                        {quote ? formatPaise(quote.bill.totalPaise) : '—'}
                      </div>
                    </div>

                    <button
                      onClick={handleOpenPayment}
                      disabled={!canCheckout}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold px-8 py-3 rounded-full shadow-green-sm active:scale-95 transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                    >
                      {needsAddress ? 'Add an address' : `Checkout (${cartItemCount})`}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 9. Payment */}
      {quote && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          amountPaise={quote.bill.totalPaise}
          walletBalancePaise={walletBalancePaise}
          onConfirm={handleConfirmPayment}
        />
      )}
    </motion.div>
  );
};
