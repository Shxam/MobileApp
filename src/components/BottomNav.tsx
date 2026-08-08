import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Home,
  Calendar,
  UtensilsCrossed,
  PartyPopper,
  User,
  QrCode,
  ShoppingBag,
  Compass,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenQuickScan?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab, onOpenQuickScan }) => {
  const { cart, language } = useApp();
  const shouldReduceMotion = useReducedMotion();
  const [rippleTab, setRippleTab] = useState<string | null>(null);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const handleTabChange = (tab: string) => {
    setRippleTab(tab);
    setActiveTab(tab);
    window.setTimeout(() => setRippleTab(null), 340);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 border-t border-slate-100/90 dark:border-slate-800/90 backdrop-blur-md px-3 py-2 shadow-xl transition-colors">
      <div className="max-w-md mx-auto flex items-center justify-between relative px-1">
        
        {/* 1. Home Tab */}
        <motion.button
          initial={shouldReduceMotion ? false : { y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 26, delay: 0.04 }}
          onClick={() => handleTabChange('home')}
          whileTap={{ scale: 0.95 }}
          className={`relative overflow-hidden flex flex-col items-center justify-center transition-all ${
            activeTab === 'home' ? 'text-emerald-500 font-bold scale-105' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
          }`}
        >
          <AnimatePresence>{rippleTab === 'home' && <motion.span initial={{ scale: 0, opacity: 0.4 }} animate={{ scale: 2.1, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.28 }} className="absolute h-7 w-7 rounded-full bg-emerald-400/35" />}</AnimatePresence>
          <Home className={`relative w-5 h-5 ${activeTab === 'home' ? 'text-emerald-500' : ''}`} />
          <span className="text-[10px] mt-0.5 font-sans">
            {language === 'en' ? 'Home' : 'होम'}
          </span>
        </motion.button>

        {/* 2. Turf Booking Tab */}
        <motion.button
          initial={shouldReduceMotion ? false : { y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 26, delay: 0.1 }}
          onClick={() => handleTabChange('turfs')}
          whileTap={{ scale: 0.95 }}
          className={`relative overflow-hidden flex flex-col items-center justify-center transition-all ${
            activeTab === 'turfs' ? 'text-emerald-500 font-bold scale-105' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
          }`}
        >
          <AnimatePresence>{rippleTab === 'turfs' && <motion.span initial={{ scale: 0, opacity: 0.4 }} animate={{ scale: 2.1, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.28 }} className="absolute h-7 w-7 rounded-full bg-emerald-400/35" />}</AnimatePresence>
          <Calendar className={`relative w-5 h-5 ${activeTab === 'turfs' ? 'text-emerald-500' : ''}`} />
          <span className="text-[10px] mt-0.5 font-sans">
            {language === 'en' ? 'Turfs' : 'टर्फ'}
          </span>
        </motion.button>

        {/* 3. CENTER FLOATING GREEN BUTTON */}
        <div className="relative -top-5">
          <motion.button
            onClick={() => {
              setRippleTab('scan');
              if (onOpenQuickScan) onOpenQuickScan();
              else setActiveTab('food');
            }}
            initial={shouldReduceMotion ? false : { y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26, delay: 0.16 }}
            whileTap={{ scale: 0.95 }}
            className="w-13 h-13 rounded-full bg-gradient-to-tr from-emerald-600 to-green-500 text-white flex items-center justify-center shadow-green-glow active:scale-95 transition-transform border-4 border-white dark:border-slate-900"
            title="Scan QR / Fast Action"
          >
            <AnimatePresence>{rippleTab === 'scan' && <motion.span initial={{ scale: 0.8, opacity: 0.6 }} animate={{ scale: 1.65, opacity: 0 }} transition={{ duration: 0.45 }} className="absolute inset-0 rounded-full border-2 border-white" onAnimationComplete={() => setRippleTab(null)} />}</AnimatePresence>
            <QrCode className="w-6 h-6 stroke-[2.2]" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-900 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                {cartCount}
              </span>
            )}
          </motion.button>
        </div>

        {/* 4. Food Dhaba Tab */}
        <motion.button
          initial={shouldReduceMotion ? false : { y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 26, delay: 0.22 }}
          onClick={() => handleTabChange('food')}
          whileTap={{ scale: 0.95 }}
          className={`relative overflow-hidden flex flex-col items-center justify-center transition-all ${
            activeTab === 'food' ? 'text-emerald-500 font-bold scale-105' : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <AnimatePresence>{rippleTab === 'food' && <motion.span initial={{ scale: 0, opacity: 0.4 }} animate={{ scale: 2.1, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.28 }} className="absolute h-7 w-7 rounded-full bg-emerald-400/35" />}</AnimatePresence>
          <div className="relative">
            <UtensilsCrossed className={`w-5 h-5 ${activeTab === 'food' ? 'text-emerald-500' : ''}`} />
            {cartCount > 0 && activeTab !== 'food' && (
              <span className="absolute -top-1.5 -right-2 bg-emerald-500 text-white font-extrabold text-[9px] px-1 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 font-sans">
            {language === 'en' ? 'Dhaba' : 'ढाबा'}
          </span>
        </motion.button>

        {/* 5. Celebrations & Hub Tab */}
        <motion.button
          initial={shouldReduceMotion ? false : { y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 26, delay: 0.28 }}
          onClick={() => handleTabChange('celebrations')}
          whileTap={{ scale: 0.95 }}
          className={`relative overflow-hidden flex flex-col items-center justify-center transition-all ${
            activeTab === 'celebrations' ? 'text-emerald-500 font-bold scale-105' : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <AnimatePresence>{rippleTab === 'celebrations' && <motion.span initial={{ scale: 0, opacity: 0.4 }} animate={{ scale: 2.1, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.28 }} className="absolute h-7 w-7 rounded-full bg-emerald-400/35" />}</AnimatePresence>
          <PartyPopper className={`relative w-5 h-5 ${activeTab === 'celebrations' ? 'text-emerald-500' : ''}`} />
          <span className="text-[10px] mt-0.5 font-sans">
            {language === 'en' ? 'Party' : 'पार्टी'}
          </span>
        </motion.button>

      </div>
    </nav>
  );
};
