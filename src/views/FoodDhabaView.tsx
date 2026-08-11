import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MOCK_MENU, FOOD_CATEGORIES } from '../data/mockData';
import { MenuItem } from '../types';
import { PricingEngine } from '../services/pricingEngine';
import { PaymentModal } from '../components/PaymentModal';
import {
  UtensilsCrossed,
  Flame,
  Clock,
  Plus,
  Minus,
  ShoppingBag,
  X,
  Wallet,
  Phone,
  CheckCircle2,
  ChefHat,
  Bike,
  Sparkles,
  Search,
  MessageSquare,
  ChevronRight,
  Heart,
  Tag,
  Star,
  MapPin,
  Ticket,
} from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { AnimatedValue } from '../components/AnimatedValue';

interface FoodDhabaViewProps {
  onNavigateHub: () => void;
}

const pageReveal = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const sectionReveal = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 24 },
  },
};

const sheetTransition = { type: 'spring' as const, damping: 28, stiffness: 300 };

export const FoodDhabaView: React.FC<FoodDhabaViewProps> = ({ onNavigateHub }) => {
  const shouldReduceMotion = useReducedMotion();
  const {
    user,
    cart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    cartTotal,
    addFoodOrder,
    deductWallet,
    foodOrders,
    language,
    addNotification,
  } = useApp();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedItemDetail, setSelectedItemDetail] = useState<MenuItem | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [deliveryType, setDeliveryType] = useState<'turf_slot' | 'home_delivery'>('turf_slot');
  const [deliveryTarget, setDeliveryTarget] = useState('Singarayakonda Turf - Cage 1 (Bench Side)');
  const [cookingInstructions, setCookingInstructions] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isOrdering, setIsOrdering] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const spotlightItem = MOCK_MENU[0];

  // Robust Search & Filter Logic across name, category, and description
  const cleanQuery = searchQuery.trim().toLowerCase();

  const filteredMenu = MOCK_MENU.filter((item) => {
    if (cleanQuery.length > 0) {
      const matchesNameEn = item.nameEn.toLowerCase().includes(cleanQuery);
      const matchesNameHi = item.nameHi.toLowerCase().includes(cleanQuery);
      const matchesCategory = item.category.toLowerCase().includes(cleanQuery);
      const matchesDescEn = item.descriptionEn.toLowerCase().includes(cleanQuery);
      const matchesDescHi = item.descriptionHi.toLowerCase().includes(cleanQuery);
      return matchesNameEn || matchesNameHi || matchesCategory || matchesDescEn || matchesDescHi;
    }

    return selectedCategory === 'all' || item.category === selectedCategory;
  });

  const cartItemCount = cart.reduce((sum, ci) => sum + ci.quantity, 0);

  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleApplyPromo = () => {
    const res = PricingEngine.validateVoucher(promoCode, cartTotal);
    if (res.valid) {
      setDiscountAmount(res.discount);
      addNotification('🎉 Voucher Applied!', res.message, 'reward');
    } else {
      addNotification('⚠️ Invalid Voucher', res.message, 'food');
    }
  };

  const bill = PricingEngine.calculateFoodBill(cart, discountAmount, deliveryType);

  const handleOpenPayment = () => {
    if (cart.length === 0) return;
    setIsPaymentModalOpen(true);
  };

  const handlePaymentCompleted = async (paymentMethod: string) => {
    setIsOrdering(true);
    try {
      const newOrder = await addFoodOrder({
        items: cart,
        totalAmount: bill.grandTotal,
        deliveryType,
        deliveryTarget,
        cookingInstructions,
        estimatedDeliveryMinutes: 15,
        paymentMethod: 'upi',
      });

      setIsCartOpen(false);
      addNotification(
        '🍳 Order Placed!',
        `Order #${newOrder.id.slice(-6)} paid via ${paymentMethod}. Sent to IPL Kitchen!`,
        'food'
      );
      onNavigateHub();
    } catch (err: any) {
      addNotification('⚠️ Order Failed', err?.message || 'Failed to place order. Please try again.', 'food');
    } finally {
      setIsOrdering(false);
    }
  };

  const searchHistoryPills = [
    { label: 'Biryani', cat: 'biryani' },
    { label: 'Tandoori', cat: 'starters' },
    { label: 'Combos', cat: 'combos' },
    { label: 'Lassi', cat: 'drinks' },
    { label: 'Curry', cat: 'curries' },
    { label: 'Chaat', cat: 'snacks' },
    { label: 'Fries', cat: 'starters' },
  ];

  const handlePillClick = (pill: { label: string; cat: string }) => {
    if (searchQuery.toLowerCase() === pill.label.toLowerCase()) {
      setSearchQuery('');
      setSelectedCategory('all');
    } else {
      setSearchQuery(pill.label);
      setSelectedCategory('all');
    }
  };

  return (
    <motion.div
      variants={pageReveal}
      initial="hidden"
      animate="show"
      className="space-y-4 p-4 pb-28 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-white transition-colors"
    >
      
      {/* 1. Spotlight Hero Banner */}
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
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 3.8, repeat: Infinity, repeatDelay: 2.2, ease: 'easeInOut' }}
          className="absolute inset-y-0 w-16 -skew-x-12 bg-white/10 blur-xl"
        />
        <div className="relative min-h-40 p-5 pr-28">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.13em] text-amber-300 backdrop-blur-md">
            <Sparkles className="h-3 w-3" />
            Matchday pick
          </div>
          <h2 className="max-w-52 font-display text-2xl font-black leading-tight text-white">Fuel your next over.</h2>
          <p className="mt-1.5 text-xs font-medium text-slate-300">Fresh from the dhaba kitchen in {spotlightItem.prepTimeMinutes} minutes.</p>
          <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-300">
            Explore chef special <ChevronRight className="h-4 w-4" />
          </div>
        </div>
      </motion.button>

      {/* 2. Delivery Target Toggle Banner */}
      <motion.div variants={sectionReveal} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 shadow-xs space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800 dark:text-slate-200">Delivery Target</span>
          <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
            {deliveryType === 'turf_slot' ? 'Pitch Side (₹30)' : 'Home Address (₹45)'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <motion.button
            onClick={() => setDeliveryType('turf_slot')}
            whileTap={{ scale: 0.97 }}
            className={`relative overflow-hidden py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
              deliveryType === 'turf_slot'
                ? 'text-white border-emerald-500 shadow-green-sm'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
            }`}
          >
            {deliveryType === 'turf_slot' && <motion.span layoutId="delivery-mode" transition={sheetTransition} className="absolute inset-0 bg-emerald-500" />}
            <span className="relative">🏏 Turf Bench</span>
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
            {deliveryType === 'home_delivery' && <motion.span layoutId="delivery-mode" transition={sheetTransition} className="absolute inset-0 bg-amber-500" />}
            <span className="relative">🏠 Home Delivery</span>
          </motion.button>
        </div>
      </motion.div>

      {/* 3. Search Bar Section (Placed Right Above Categories) */}
      <motion.div variants={sectionReveal} className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.length > 0) {
                setSelectedCategory('all');
              }
            }}
            placeholder={
              language === 'en' ? 'Search for food or drinks...' : 'भोजन या पेय खोजें...'
            }
            className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl pl-11 pr-10 py-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-xs transition-all font-medium"
          />

          {/* Clear Search X Button */}
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

        {/* History Search Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {searchHistoryPills.map((pill) => {
            const isActive = searchQuery.toLowerCase() === pill.label.toLowerCase();
            return (
              <motion.button
                key={pill.label}
                onClick={() => handlePillClick(pill)}
                whileTap={{ scale: 0.94 }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all border ${
                  isActive
                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-green-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {pill.label}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* 4. Category Horizontal Slider */}
      <motion.div variants={sectionReveal} className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Categories</h3>
          <span className="text-[11px] text-emerald-500 font-bold">{filteredMenu.length} items</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {FOOD_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id && cleanQuery.length === 0;
            return (
              <motion.button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSearchQuery('');
                }}
                whileTap={{ scale: 0.94 }}
                className={`relative overflow-hidden flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold shrink-0 transition-all border ${
                  isActive
                    ? 'text-white border-emerald-500 shadow-green-sm scale-105'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {isActive && <motion.span layoutId="food-category" transition={sheetTransition} className="absolute inset-0 bg-emerald-500" />}
                <span className="relative">{cat.id === 'all' ? '🍽️' : cat.id === 'combos' ? '🔥' : cat.id === 'biryani' ? '🍲' : cat.id === 'starters' ? '🍗' : '🥟'}</span>
                <span className="relative">{language === 'en' ? cat.nameEn : cat.nameHi}</span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* 4. Menu Items Grid (Matching Screenshot 2 & 3 UI) */}
      {filteredMenu.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-8 text-center space-y-2">
          <UtensilsCrossed className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="font-extrabold text-slate-800 text-sm">No dishes found for "{searchQuery}"</div>
          <p className="text-xs text-slate-500">Try searching for Biryani, Tandoori, Combos, or Lassi!</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="bg-rose-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-pink-sm"
          >
            Show All Menu Items
          </button>
        </div>
      ) : (
        <LayoutGroup>
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {filteredMenu.map((item) => {
            const cartEntry = cart.find((c) => c.menuItem.id === item.id);
            const quantity = cartEntry ? cartEntry.quantity : 0;
            const isFav = favorites.includes(item.id);

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
                className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-2.5 group"
              >
                <div className="relative rounded-xl overflow-hidden h-36 bg-slate-100">
                  <img src={item.image} alt={item.nameEn} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  
                  {/* Favorite Heart */}
                  <motion.button
                    onClick={(e) => toggleFavorite(item.id, e)}
                    whileTap={{ scale: 0.78 }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center shadow-xs text-rose-500 hover:scale-110 transition-transform"
                  >
                    <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
                  </motion.button>

                  {/* Rating Tag */}
                  <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-extrabold text-slate-900 flex items-center gap-1 shadow-xs">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span>{item.rating}</span>
                  </div>

                  {/* Delivery Time */}
                  <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                    <Clock className="w-2.5 h-2.5 text-rose-400" />
                    <span>{item.prepTimeMinutes} mins</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 rounded-xs border ${item.isVeg ? 'border-emerald-600 bg-emerald-50' : 'border-rose-600 bg-rose-50'} flex items-center justify-center shrink-0`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                    </span>
                    <h4 className="font-extrabold text-slate-900 text-sm truncate">
                      {language === 'en' ? item.nameEn : item.nameHi}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                    {language === 'en' ? item.descriptionEn : item.descriptionHi}
                  </p>
                </div>

                {/* Price & Stepper Control */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="font-black text-emerald-600 text-base">₹{item.price}</span>

                  {quantity === 0 ? (
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(item);
                      }}
                      whileTap={{ scale: 0.91 }}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-green-sm transition-all flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
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

      {/* 5. Fixed Floating View Cart Bar */}
      <AnimatePresence>
      {cartItemCount > 0 && (
        <motion.div initial={{ opacity: 0, y: 34, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.96 }} transition={sheetTransition} className="fixed bottom-24 sm:bottom-16 left-0 right-0 z-30 p-3">
          <div className="max-w-md mx-auto bg-slate-900 text-white rounded-full p-3 px-5 shadow-2xl flex items-center justify-between border border-slate-800 backdrop-blur-lg animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white font-extrabold flex items-center justify-center shadow-green-sm">
                {cartItemCount}
              </div>
              <div>
                <div className="text-xs font-black">Total Price: ₹{bill.grandTotal}</div>
                <div className="text-[10px] text-emerald-300 font-medium">Includes taxes & delivery</div>
              </div>
            </div>

            <motion.button
              onClick={() => setIsCartOpen(true)}
              whileTap={{ scale: 0.94 }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold px-5 py-2.5 rounded-full shadow-green-sm active:scale-95 transition-all flex items-center gap-1.5"
            >
              <span>View Cart & Pay</span>
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* 6. ITEM DETAIL MODAL (Matching Screenshot 2 - Details View) */}
      <AnimatePresence>
        {selectedItemDetail && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-xs p-0 sm:p-4">
            <motion.div
              initial={{ y: '100%', scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: '100%', scale: 0.98 }}
              transition={sheetTransition}
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[90vh] flex flex-col shadow-2xl relative"
            >
              {/* Top Hero Image Banner */}
              <div className="relative h-64 bg-slate-100">
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
                  <Heart className={`w-5 h-5 ${favorites.includes(selectedItemDetail.id) ? 'fill-emerald-500 text-emerald-500' : 'text-slate-400'}`} />
                </button>

                <div className="absolute bottom-4 left-4 bg-emerald-500 text-white font-extrabold text-xs px-3 py-1 rounded-full shadow-green-sm flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Free delivery with matchday voucher</span>
                </div>
              </div>

              {/* Detail Content */}
              <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`w-3.5 h-3.5 rounded-xs border ${selectedItemDetail.isVeg ? 'border-emerald-600 bg-emerald-50' : 'border-emerald-600 bg-emerald-50'} flex items-center justify-center shrink-0`}>
                      <span className={`w-2 h-2 rounded-full ${selectedItemDetail.isVeg ? 'bg-emerald-600' : 'bg-emerald-600'}`} />
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

                {/* Ratings & Prep Time Metrics Box */}
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-3.5 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white flex items-center justify-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span>{selectedItemDetail.rating}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">Rating</div>
                  </div>
                  <div className="border-x border-slate-200 dark:border-slate-700">
                    <div className="text-xs font-black text-slate-900 dark:text-white">1.5k</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">Reviews</div>
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white">{selectedItemDetail.prepTimeMinutes} min</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">Delivery</div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Description</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {language === 'en' ? selectedItemDetail.descriptionEn : selectedItemDetail.descriptionHi}
                  </p>
                </div>
              </div>

              {/* Fixed Bottom Checkout Bar */}
              <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Total Amount</div>
                  <div className="text-xl font-black text-emerald-600">₹{selectedItemDetail.price}</div>
                </div>

                <button
                  onClick={() => {
                    addToCart(selectedItemDetail);
                    setSelectedItemDetail(null);
                    setIsCartOpen(true);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold px-8 py-3 rounded-full shadow-green-sm active:scale-95 transition-all text-xs"
                >
                  Order Now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7. SLIDE-OUT CART MODAL */}
      <AnimatePresence>
        {isCartOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-xs p-0 sm:p-4">
            <motion.div
              initial={{ y: '100%', scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: '100%', scale: 0.98 }}
              transition={sheetTransition}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[90vh] flex flex-col shadow-2xl relative"
            >
              {/* Header */}
              <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">My Cart ({cartItemCount})</h3>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Coupon Banner */}
              <div className="p-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-amber-300" />
                  <span className="text-xs font-bold">You will get free delivery using coupons!</span>
                </div>
                <button
                  onClick={() => {
                    setPromoCode('FREEBIRYANI');
                    handleApplyPromo();
                  }}
                  className="bg-white text-emerald-600 font-extrabold text-[11px] px-3 py-1 rounded-full shadow-xs hover:bg-emerald-50"
                >
                  Use Now
                </button>
              </div>

              {/* Cart Item List */}
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
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-xs truncate">{item.menuItem.nameEn}</h4>
                        <div className="text-xs font-black text-emerald-600 mt-0.5">₹{item.menuItem.price}</div>
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

                {/* Instructions Input */}
                {cart.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">Cooking Instructions</label>
                    <input
                      type="text"
                      value={cookingInstructions}
                      onChange={(e) => setCookingInstructions(e.target.value)}
                      placeholder="e.g. Extra spicy biryani, less oil..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}
              </div>

              {/* Itemized Bill Breakdown */}
              {cart.length > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>Subtotal</span>
                    <span className="font-bold text-slate-900 dark:text-white">₹{bill.subtotal}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>Food GST (5%)</span>
                    <span className="font-bold text-slate-900 dark:text-white">₹{bill.foodGst}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>Delivery Charge</span>
                    <span className="font-bold text-slate-900 dark:text-white">₹{bill.deliveryFee}</span>
                  </div>
                  {bill.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Voucher Discount</span>
                      <span>-₹{bill.discount}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Price</span>
                      <div className="text-xl font-black text-emerald-600">₹{bill.grandTotal}</div>
                    </div>

                    <button
                      onClick={handleOpenPayment}
                      disabled={isOrdering}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold px-8 py-3 rounded-full shadow-green-sm active:scale-95 transition-all text-xs"
                    >
                      Checkout ({cartItemCount})
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 8. PAYMENT MODAL INTEGRATION */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        totalAmount={bill.grandTotal}
        onPaymentSuccess={handlePaymentCompleted}
      />
    </motion.div>
  );
};
