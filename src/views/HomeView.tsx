import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MOCK_TURFS, MOCK_MENU, MOCK_CELEBRATION_PACKAGES } from '../data/mockData';
import { CricketScoreCarousel } from '../components/CricketScoreCarousel';
import {
  Calendar,
  UtensilsCrossed,
  PartyPopper,
  Star,
  ChevronRight,
  Flame,
  Plus,
  Clock,
  Award,
  Search,
  SlidersHorizontal,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';

interface HomeViewProps {
  onNavigate: (tab: string) => void;
  onSelectTurf: (turfId: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate, onSelectTurf }) => {
  const { user, turfBookings, foodOrders, addToCart, language } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  const activeBooking = turfBookings.find((b) => b.status === 'confirmed' || b.status === 'rescheduled');
  const activeOrder = foodOrders.find((o) => o.status !== 'delivered');

  // Category Pills matching UI Screenshot
  const categoryPills = [
    { id: 'combos', label: language === 'en' ? 'Matchday Combos' : 'कॉम्बो', icon: '🔥', color: 'bg-rose-50 text-rose-600' },
    { id: 'biryani', label: language === 'en' ? 'Rice & Biryani' : 'बिरयानी', icon: '🍲', color: 'bg-amber-50 text-amber-600' },
    { id: 'turf', label: language === 'en' ? 'Box Turf' : 'टर्फ', icon: '🏏', color: 'bg-emerald-50 text-emerald-600' },
    { id: 'starters', label: language === 'en' ? 'Tandoori' : 'स्टार्टर्स', icon: '🍗', color: 'bg-orange-50 text-orange-600' },
    { id: 'celebrations', label: language === 'en' ? 'Party Package' : 'पार्टी', icon: '🎉', color: 'bg-purple-50 text-purple-600' },
    { id: 'drinks', label: language === 'en' ? 'Lassi & Drinks' : 'पेय', icon: '🥤', color: 'bg-blue-50 text-blue-600' },
  ];

  return (
    <div className="space-y-5 p-4 pb-20 bg-slate-50 min-h-screen text-slate-900">
      
      {/* 1. Search Bar with Filter Icon (Matching UI Screenshot) */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === 'en'
                ? 'Search biryani, box turf, party...'
                : 'बिरयानी, टर्फ या पार्टी खोजें...'
            }
            className="w-full bg-white border border-slate-200/80 rounded-2xl pl-11 pr-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 shadow-xs transition-all font-medium"
          />
        </div>
        <button className="w-11 h-11 rounded-2xl bg-white border border-slate-200/80 text-slate-700 flex items-center justify-center shadow-xs hover:bg-slate-100">
          <SlidersHorizontal className="w-4 h-4 text-rose-500" />
        </button>
      </div>

      {/* 2. Active Order / Booking Banner (If present) */}
      {activeOrder && (
        <div
          onClick={() => onNavigate('hub')}
          className="bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-2xl p-3.5 shadow-pink-sm flex items-center justify-between cursor-pointer hover:opacity-95 transition-opacity"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold">
              🚚
            </div>
            <div>
              <div className="text-xs font-black">Order #{activeOrder.id} is {activeOrder.status.replace(/_/g, ' ')}!</div>
              <div className="text-[10px] text-rose-100 font-medium">Tap to track delivery on live GPS map</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-white" />
        </div>
      )}

      {/* 3. Hero Promo Banner (Matching Screenshot 1 & 2) */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white shadow-xl min-h-[160px] flex items-center">
        <img
          src="https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&q=80&w=800"
          alt="IPL Dhaba Special"
          className="absolute inset-0 w-full h-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-transparent" />

        <div className="relative z-10 p-5 space-y-2 max-w-[260px]">
          <span className="bg-rose-500/90 text-white font-extrabold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider shadow-xs">
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
              className="bg-rose-500 hover:bg-rose-600 text-white font-bold px-4 py-2 rounded-full text-xs shadow-pink-sm active:scale-95 transition-all flex items-center gap-1.5"
            >
              <span>{language === 'en' ? 'Shop Now' : 'ऑर्डर करें'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Live Cricket Score Ticker */}
      <CricketScoreCarousel />

      {/* 5. Categories Section (Matching UI Screenshots) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900 text-base">Categories</h3>
          <button
            onClick={() => onNavigate('food')}
            className="text-xs font-bold text-rose-500 hover:text-rose-600"
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
              className="bg-white border border-slate-200/60 rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 shadow-xs hover:border-rose-200 hover:shadow-md transition-all active:scale-95 group"
            >
              <div className={`w-12 h-12 rounded-full ${cat.color} flex items-center justify-center text-xl group-hover:scale-110 transition-transform`}>
                {cat.icon}
              </div>
              <span className="text-xs font-bold text-slate-800 text-center tracking-tight">
                {cat.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 6. Popular Items / Matchday Specials (Matching UI Screenshot) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900 text-base">Popular Items</h3>
          <button
            onClick={() => onNavigate('food')}
            className="text-xs font-bold text-rose-500 hover:text-rose-600"
          >
            See all
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {MOCK_MENU.slice(0, 4).map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200/70 rounded-2xl p-3 shadow-xs hover:shadow-md transition-all space-y-2.5 flex flex-col justify-between"
            >
              <div className="relative rounded-xl overflow-hidden h-36 bg-slate-100">
                <img src={item.image} alt={item.nameEn} className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-900 flex items-center gap-1 shadow-xs">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  <span>{item.rating}</span>
                </div>
                <div className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                  <Clock className="w-2.5 h-2.5 text-rose-400" />
                  <span>{item.prepTimeMinutes} mins</span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded-xs border ${item.isVeg ? 'border-emerald-600 bg-emerald-50' : 'border-rose-600 bg-rose-50'} flex items-center justify-center shrink-0`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm truncate">
                    {language === 'en' ? item.nameEn : item.nameHi}
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                  {language === 'en' ? item.descriptionEn : item.descriptionHi}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <span className="font-black text-rose-600 text-base">₹{item.price}</span>
                <button
                  onClick={() => addToCart(item)}
                  className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-pink-sm active:scale-95 transition-all flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 7. Box Turf Feature Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-base">
              🏏
            </span>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">Singarayakonda Box Turf</h4>
              <p className="text-[11px] text-slate-500">Floodlit 500 Lux Cage Pitch</p>
            </div>
          </div>
          <span className="text-xs font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">
            ₹1,200/hr
          </span>
        </div>

        <div className="rounded-2xl overflow-hidden h-36 relative">
          <img
            src="https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&q=80&w=800"
            alt="Turf"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-3">
            <div className="text-white space-y-0.5">
              <div className="text-xs font-bold">NH-16 Bypass Road, Singarayakonda</div>
              <div className="text-[10px] text-emerald-300 font-medium">Connected to IPL Dhaba Kitchen</div>
            </div>
          </div>
        </div>

        <button
          onClick={() => onNavigate('turfs')}
          className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-2.5 rounded-full text-xs shadow-pink-sm active:scale-95 transition-all flex items-center justify-center gap-1.5"
        >
          <Calendar className="w-4 h-4" />
          <span>Book Turf Slot & Pitch Service</span>
        </button>
      </div>

    </div>
  );
};
