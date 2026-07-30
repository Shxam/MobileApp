import React from 'react';
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
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 border-t border-slate-100/90 backdrop-blur-md px-3 py-2 shadow-xl">
      <div className="max-w-md mx-auto flex items-center justify-between relative px-1">
        
        {/* 1. Home Tab */}
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center transition-all ${
            activeTab === 'home' ? 'text-rose-500 font-bold scale-105' : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <Home className={`w-5 h-5 ${activeTab === 'home' ? 'text-rose-500' : ''}`} />
          <span className="text-[10px] mt-0.5 font-sans">
            {language === 'en' ? 'Home' : 'होम'}
          </span>
        </button>

        {/* 2. Turf Booking Tab */}
        <button
          onClick={() => setActiveTab('turfs')}
          className={`flex flex-col items-center justify-center transition-all ${
            activeTab === 'turfs' ? 'text-rose-500 font-bold scale-105' : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <Calendar className={`w-5 h-5 ${activeTab === 'turfs' ? 'text-rose-500' : ''}`} />
          <span className="text-[10px] mt-0.5 font-sans">
            {language === 'en' ? 'Turfs' : 'टर्फ'}
          </span>
        </button>

        {/* 3. CENTER FLOATING PINK BUTTON (Matching Screenshot FAB) */}
        <div className="relative -top-5">
          <button
            onClick={() => {
              if (onOpenQuickScan) onOpenQuickScan();
              else setActiveTab('food');
            }}
            className="w-13 h-13 rounded-full bg-gradient-to-tr from-rose-600 to-pink-500 text-white flex items-center justify-center shadow-pink-glow active:scale-95 transition-transform border-4 border-white"
            title="Scan QR / Fast Action"
          >
            <QrCode className="w-6 h-6 stroke-[2.2]" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-900 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* 4. Food Dhaba Tab */}
        <button
          onClick={() => setActiveTab('food')}
          className={`relative flex flex-col items-center justify-center transition-all ${
            activeTab === 'food' ? 'text-rose-500 font-bold scale-105' : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <div className="relative">
            <UtensilsCrossed className={`w-5 h-5 ${activeTab === 'food' ? 'text-rose-500' : ''}`} />
            {cartCount > 0 && activeTab !== 'food' && (
              <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white font-extrabold text-[9px] px-1 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 font-sans">
            {language === 'en' ? 'Dhaba' : 'ढाबा'}
          </span>
        </button>

        {/* 5. Celebrations & Hub Tab */}
        <button
          onClick={() => setActiveTab('celebrations')}
          className={`flex flex-col items-center justify-center transition-all ${
            activeTab === 'celebrations' ? 'text-rose-500 font-bold scale-105' : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <PartyPopper className={`w-5 h-5 ${activeTab === 'celebrations' ? 'text-rose-500' : ''}`} />
          <span className="text-[10px] mt-0.5 font-sans">
            {language === 'en' ? 'Party' : 'पार्टी'}
          </span>
        </button>

      </div>
    </nav>
  );
};
