import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatPaise, type MenuItem, type Turf } from '../types';
import { ApiClient } from '../services/apiClient';
import { CricketScoreCarousel } from '../components/CricketScoreCarousel';
import {
  Calendar,
  Star,
  ChevronRight,
  Plus,
  Clock,
  Search,
  SlidersHorizontal,
  Loader2,
  ShoppingBag,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface HomeViewProps {
  onNavigate: (tab: string) => void;
  onSelectTurf: (turfId: string) => void;
}

/** How many popular items the home grid shows. */
const POPULAR_LIMIT = 4;

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate, onSelectTurf }) => {
  const { foodOrders, addToCart, cart, cartTotalPaise, language } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * The menu and the featured turf were `MOCK_MENU` and `MOCK_TURFS` — items the
   * kitchen has never heard of, at prices nothing charges. Both are now the real
   * tables, and the search box actually searches them.
   */
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [featuredTurf, setFeaturedTurf] = useState<Turf | null>(null);

  useEffect(() => {
    let cancelled = false;
    ApiClient.getTurfs()
      .then((rows) => {
        if (!cancelled) setFeaturedTurf(rows[0] ?? null);
      })
      // A missing turf just hides the card; it must not blank the home screen.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced so typing does not fire a request per keystroke. The server does
  // the matching, so a search finds items that are not in the first four.
  useEffect(() => {
    let cancelled = false;
    setIsLoadingMenu(true);
    const timer = window.setTimeout(() => {
      ApiClient.getMenu('all', searchQuery)
        .then((rows) => {
          if (cancelled) return;
          setMenu(rows);
          setMenuError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setMenu([]);
          setMenuError(err instanceof Error ? err.message : 'Could not load the menu.');
        })
        .finally(() => {
          if (!cancelled) setIsLoadingMenu(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  /** Bestsellers first, then by rating — "popular" with something behind it. */
  const popularItems = useMemo(
    () =>
      [...menu]
        .sort(
          (a, b) =>
            Number(b.isBestseller ?? false) - Number(a.isBestseller ?? false) ||
            b.rating - a.rating,
        )
        .slice(0, POPULAR_LIMIT),
    [menu],
  );

  // `isTerminal` is the server's own judgement, so the banner does not need a
  // local list of end states that drifts from the backend's.
  const activeOrder = foodOrders.find((o) => !o.isTerminal) ?? null;
  const cartItemCount = cart.reduce((total, cartItem) => total + cartItem.quantity, 0);

  // Category Pills matching UI Screenshot
  const categoryPills = [
    { id: 'combos', label: language === 'en' ? 'Matchday Combos' : 'कॉम्बो', icon: '🔥', color: 'bg-emerald-50 text-emerald-600' },
    { id: 'biryani', label: language === 'en' ? 'Rice & Biryani' : 'बिरयानी', icon: '🍲', color: 'bg-amber-50 text-amber-600' },
    { id: 'turf', label: language === 'en' ? 'Box Turf' : 'टर्फ', icon: '🏏', color: 'bg-emerald-50 text-emerald-600' },
    { id: 'starters', label: language === 'en' ? 'Tandoori' : 'स्टार्टर्स', icon: '🍗', color: 'bg-orange-50 text-orange-600' },
    { id: 'celebrations', label: language === 'en' ? 'Party Package' : 'पार्टी', icon: '🎉', color: 'bg-purple-50 text-purple-600' },
    { id: 'drinks', label: language === 'en' ? 'Lassi & Drinks' : 'पेय', icon: '🥤', color: 'bg-blue-50 text-blue-600' },
  ];

  return (
    <div className="space-y-5 p-4 pb-36 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      
      {/* 1. Search Bar with Filter Icon */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === 'en'
                ? 'Search biryani, box turf, party...'
                : 'बिरयानी, टर्फ या पार्टी खोजें...'
            }
            className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-xs transition-all font-medium"
          />
        </div>

        <button
          onClick={() => onNavigate('food')}
          className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4 text-emerald-500" />
        </button>
      </div>

      {/* 2. Active Order / Booking Banner (If present) */}
      {activeOrder && (
        <div
          onClick={() => onNavigate('hub')}
          className="bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-2xl p-3.5 shadow-green-sm flex items-center justify-between cursor-pointer hover:opacity-95 transition-opacity"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold">
              🚚
            </div>
            <div>
              <div className="text-xs font-black">Order #{activeOrder.orderNumber} is {activeOrder.status.replace(/_/g, ' ')}!</div>
              <div className="text-[10px] text-emerald-100 font-medium">Tap to track delivery on live GPS map</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-white" />
        </div>
      )}

      {/* 3. Hero Promo Banner
          The stock Unsplash photograph that used to sit behind this gradient was
          somebody else's food, fetched from a third-party CDN on every home
          screen render. It carried no licence for this app and sat at opacity-45
          under a near-opaque overlay, so it was barely visible anyway. The
          gradient below was always doing the actual work. */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white shadow-xl min-h-[160px] flex items-center">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-slate-900 to-slate-950" />

        <div className="relative z-10 p-5 space-y-2 max-w-[260px]">
          <span className="bg-emerald-500/90 text-white font-extrabold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider shadow-xs">
            Up to 35% Offer
          </span>
          <h2 className="text-lg font-black leading-tight tracking-tight">
            {language === 'en' ? 'Enjoy Our Matchday Special Dinner Offer!' : 'मैचडे स्पेशल डिनर ऑफर का आनंद लें!'}
          </h2>
          <p className="text-[11px] text-slate-300 font-medium line-clamp-2">
            {language === 'en'
              ? 'Fast delivery, authentic dhaba flavors & floodlit box cricket pitch side dining.'
              : 'तेज़ डिलीवरी और प्रामाणिक ढाबा स्वाद!'}
          </p>
          <div className="pt-1">
            <button
              onClick={() => onNavigate('food')}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-full text-xs shadow-green-sm active:scale-95 transition-all flex items-center gap-1.5"
            >
              <span>{language === 'en' ? 'Shop Now' : 'ऑर्डर करें'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Live Cricket Score Ticker */}
      <CricketScoreCarousel />

      {/* 5. Categories Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Categories</h3>
          <button
            onClick={() => onNavigate('food')}
            className="text-xs font-bold text-emerald-500 hover:text-emerald-600"
          >
            See all
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {categoryPills.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                if (cat.id === 'turf') onNavigate('turfs');
                else if (cat.id === 'celebrations') onNavigate('celebrations');
                else onNavigate('food');
              }}
              className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 shadow-xs hover:border-emerald-200 hover:shadow-md transition-all active:scale-95 group"
            >
              <div className={`w-12 h-12 rounded-full ${cat.color} flex items-center justify-center text-xl group-hover:scale-110 transition-transform`}>
                {cat.icon}
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 text-center tracking-tight">
                {cat.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 6. Popular Items / Matchday Specials */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
            {searchQuery.trim() ? `Results for "${searchQuery.trim()}"` : 'Popular Items'}
          </h3>
          <button
            onClick={() => onNavigate('food')}
            className="text-xs font-bold text-emerald-500 hover:text-emerald-600"
          >
            See all
          </button>
        </div>

        {isLoadingMenu && (
          <div className="flex items-center justify-center gap-2 py-10 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading the kitchen…
          </div>
        )}

        {!isLoadingMenu && menuError && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl p-3 text-xs font-semibold text-red-700 dark:text-red-300">
            {menuError}
          </div>
        )}

        {!isLoadingMenu && !menuError && popularItems.length === 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-6 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
            {searchQuery.trim() ? 'Nothing on the menu matches that.' : 'The kitchen has nothing listed right now.'}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {popularItems.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-3 shadow-xs hover:shadow-md transition-all space-y-2.5 flex flex-col justify-between"
            >
              <div className="relative rounded-xl overflow-hidden h-36 bg-slate-100">
                <img src={item.image} alt={item.nameEn} className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-900 flex items-center gap-1 shadow-xs">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  <span>{item.rating}</span>
                </div>
                <div className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                  <Clock className="w-2.5 h-2.5 text-emerald-400" />
                  <span>{item.prepTimeMinutes} mins</span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded-xs border ${item.isVeg ? 'border-emerald-600 bg-emerald-50' : 'border-rose-600 bg-rose-50'} flex items-center justify-center shrink-0`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                  </span>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                    {language === 'en' ? item.nameEn : item.nameHi}
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                  {language === 'en' ? item.descriptionEn : item.descriptionHi}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="font-black text-emerald-600 text-base">{formatPaise(item.pricePaise)}</span>
                <button
                  onClick={() => addToCart(item)}
                  disabled={item.isAvailable === false}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-green-sm active:scale-95 transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{item.isAvailable === false ? 'Sold out' : 'Add'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 7. Box Turf Feature Card */}
      {featuredTurf && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-base">
                🏏
              </span>
              <div>
                <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">{featuredTurf.name}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{featuredTurf.pitchType}</p>
              </div>
            </div>
            <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
              {formatPaise(featuredTurf.pricePerHourPaise)}/hr
            </span>
          </div>

          <div className="rounded-2xl overflow-hidden h-36 relative">
            <img src={featuredTurf.image} alt={featuredTurf.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-3">
              <div className="text-white space-y-0.5">
                <div className="text-xs font-bold">{featuredTurf.address}</div>
                <div className="text-[10px] text-emerald-300 font-medium flex items-center gap-1">
                  <Star className="w-3 h-3 fill-emerald-300" />
                  {featuredTurf.rating} · {featuredTurf.reviewsCount} reviews
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              onSelectTurf(featuredTurf.id);
              onNavigate('turfs');
            }}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-full text-xs shadow-green-sm active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <Calendar className="w-4 h-4" />
            <span>Book Turf Slot & Pitch Service</span>
          </button>
        </div>
      )}

      <AnimatePresence>
        {cartItemCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            className="fixed bottom-24 left-0 right-0 z-30 px-3"
          >
            <motion.button
              type="button"
              onClick={() => onNavigate('food')}
              whileTap={{ scale: 0.97 }}
              className="mx-auto flex w-full max-w-md items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-3.5 text-left text-white shadow-2xl"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 font-black shadow-green-sm">
                  {cartItemCount}
                </span>
                <span>
                  <span className="block text-xs font-black">{cartItemCount} item{cartItemCount > 1 ? 's' : ''} in your cart</span>
                  <span className="block text-[10px] font-medium text-emerald-300">Total {formatPaise(cartTotalPaise)} · Ready when you are</span>
                </span>
              </span>
              <span className="flex items-center gap-1 text-xs font-extrabold text-emerald-300">
                View cart <ShoppingBag className="h-4 w-4" />
              </span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
