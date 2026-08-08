import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MOCK_TURFS } from '../data/mockData';
import { Turf, TurfSlot } from '../types';
import {
  MapPin,
  Star,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  X,
  Wallet,
  QrCode,
  Map as MapIcon,
  Filter,
  Check,
  Zap,
  Radio,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Video,
  Mic,
  Award,
  Plus,
  Minus,
  Sparkles,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AnimatedValue } from '../components/AnimatedValue';

interface TurfBookingViewProps {
  selectedTurfId?: string;
  onNavigateHub: () => void;
}

export const TurfBookingView: React.FC<TurfBookingViewProps> = ({
  selectedTurfId,
  onNavigateHub,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const { user, addTurfBooking, deductWallet, topUpWallet, addNotification, language } = useApp();

  const [activeTurf, setActiveTurf] = useState<Turf | null>(
    MOCK_TURFS.find((t) => t.id === selectedTurfId) || MOCK_TURFS[0]
  );
  const [showModal, setShowModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string>('All');
  const [activeSlotCategory, setActiveSlotCategory] = useState<'All' | 'Morning' | 'Afternoon' | 'Prime Evening' | 'Night Floodlit'>('All');

  // Booking Flow State
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0] // Tomorrow
  );

  // Month Calendar Navigation State
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());

  const [selectedSlot, setSelectedSlot] = useState<TurfSlot | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<{ name: string; price: number }[]>([]);
  const [matchFormat, setMatchFormat] = useState('Box Cricket 7v7');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);

  // Generate 8 Full Matchday Slots Across 4 Categories
  const generateSlots = (turf: Turf): TurfSlot[] => {
    return [
      { id: 's1', time: '6:00 - 7:00', price: 900, status: 'available', isFloodlit: false, category: 'Morning' },
      { id: 's2', time: '7:00 - 8:00', price: 900, status: 'available', isFloodlit: false, category: 'Morning' },
      { id: 's3', time: '3:00 - 4:00', price: 1000, status: 'available', isFloodlit: false, category: 'Afternoon' },
      { id: 's4', time: '4:00 - 5:00', price: 1000, status: 'available', isFloodlit: false, category: 'Afternoon' },
      { id: 's5', time: '6:00 - 7:00', price: 1200, status: 'available', isFloodlit: true, category: 'Prime Evening' },
      { id: 's6', time: '7:00 - 8:00', price: 1200, status: 'available', isFloodlit: true, category: 'Prime Evening' },
      { id: 's7', time: '8:00 - 9:00', price: 1300, status: 'available', isFloodlit: true, category: 'Night Floodlit' },
      { id: 's8', time: '9:00 - 10:00', price: 1300, status: 'available', isFloodlit: true, category: 'Night Floodlit' },
    ];
  };

  const allSlots = activeTurf ? generateSlots(activeTurf) : [];
  const filteredSlots = allSlots.filter((s) => activeSlotCategory === 'All' || s.category === activeSlotCategory);

  const ADDONS_LIST = [
    { name: 'GoPro 4K Match Recording', price: 200, icon: Video },
    { name: 'Professional Box Umpire', price: 300, icon: ShieldCheck },
    { name: 'Commentary Mic & Sound System', price: 250, icon: Mic },
    { name: 'Tournament Leather Ball (2x)', price: 150, icon: Award },
  ];

  const calculateTotal = (): number => {
    let total = selectedSlot ? selectedSlot.price : 0;
    selectedAddons.forEach((a) => (total += a.price));
    return total;
  };

  const handleConfirmBooking = () => {
    if (!activeTurf || !selectedSlot) return;

    const totalAmount = calculateTotal();

    setIsProcessing(true);
    setTimeout(() => {
      const newBooking = addTurfBooking({
        turfId: activeTurf.id,
        turfName: activeTurf.name,
        turfAddress: activeTurf.address,
        date: selectedDate,
        slots: [selectedSlot],
        totalAmount,
        addons: selectedAddons,
        matchFormat,
      });

      setIsProcessing(false);
      setShowModal(false);
      setConfirmedBookingId(newBooking.id);
      addNotification(
        '🏏 Booking Confirmed!',
        `Your slot at ${activeTurf.name} for ${selectedDate} is confirmed. Gate pass generated!`,
        'booking'
      );
    }, 1200);
  };

  const toggleAddon = (addon: { name: string; price: number }) => {
    if (selectedAddons.some((a) => a.name === addon.name)) {
      setSelectedAddons(selectedAddons.filter((a) => a.name !== addon.name));
    } else {
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  // Helper to generate full month grid days
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const currentYear = calendarViewDate.getFullYear();
  const currentMonth = calendarViewDate.getMonth();
  const monthName = calendarViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const totalDays = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const prevMonth = () => {
    setCalendarViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const nextMonth = () => {
    setCalendarViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleSelectCalendarDate = (day: number) => {
    const monthFormatted = String(currentMonth + 1).padStart(2, '0');
    const dayFormatted = String(day).padStart(2, '0');
    const dateStr = `${currentYear}-${monthFormatted}-${dayFormatted}`;
    setSelectedDate(dateStr);
    setShowCalendarModal(false);
    addNotification('📅 Date Selected', `Turf slots loaded for ${dateStr}`, 'booking');
  };

  // Generate date pills starting from selectedDate
  const startDateObj = new Date(selectedDate || Date.now());

  return (
    <div className="space-y-4 p-4 pb-28 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-white transition-colors">
      
      {/* 1. Header Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Box Turf Booking</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Floodlit 500 Lux Cage • Singarayakonda, AP</p>
        </div>
        <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-extrabold text-xs px-3 py-1 rounded-full shadow-xs">
          From ₹900/hr
        </span>
      </div>

      {/* 2. Turf Main Feature Card */}
      {activeTurf && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-4">
          <div className="relative rounded-2xl overflow-hidden h-44 bg-slate-100">
            <img src={activeTurf.image} alt={activeTurf.name} className="w-full h-full object-cover" />
            <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-extrabold text-slate-900 flex items-center gap-1 shadow-xs">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>{activeTurf.rating} ({activeTurf.reviewsCount} reviews)</span>
            </div>
            <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md text-emerald-300 text-xs px-3 py-1 rounded-full font-bold">
              ⚡ 500 Lux Floodlights
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">{activeTurf.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-500" />
              <span>{activeTurf.address}</span>
            </p>
          </div>

          {/* Amenities Chips */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {activeTurf.amenities.map((amenity, idx) => (
              <span key={idx} className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-slate-200/60 dark:border-slate-700">
                {amenity}
              </span>
            ))}
          </div>

          {/* 3. CALENDAR PICKER & DATE SELECTOR BAR */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 dark:text-white">Select Date</span>
                
                {/* Visual Interactive Month Calendar Button */}
                <button
                  onClick={() => setShowCalendarModal(true)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-extrabold shadow-green-sm active:scale-95 transition-all"
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  <span>Pick Future Date 📅</span>
                </button>
              </div>

              {/* Selected Date Tag */}
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 text-xs">
                {selectedDate}
              </span>
            </div>

            {/* Quick Date Strip */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((offset) => {
                const dateObj = new Date(startDateObj.getTime() + offset * 86400000);
                const dateStr = dateObj.toISOString().split('T')[0];
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum = dateObj.getDate();
                const isSelected = selectedDate === dateStr;

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`flex flex-col items-center justify-center min-w-[56px] py-2.5 rounded-2xl border transition-all shrink-0 ${
                      isSelected
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-green-sm scale-105 font-bold'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-[10px] uppercase opacity-80">{dayName}</span>
                    <span className="text-sm font-extrabold">{dayNum}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Slot Category Filter Tabs */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">Available Time Slots</h4>
              <span className="text-[11px] font-bold text-emerald-500">{filteredSlots.length} slots</span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {(['All', 'Morning', 'Afternoon', 'Prime Evening', 'Night Floodlit'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveSlotCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all border ${
                    activeSlotCategory === cat
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Slots Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {filteredSlots.map((slot) => {
                const isSelected = selectedSlot?.id === slot.id;
                return (
                  <div
                    key={slot.id}
                    onClick={() => setSelectedSlot(isSelected ? null : slot)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between overflow-hidden relative ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-950 dark:text-emerald-100 shadow-md ring-2 ring-emerald-500/30'
                        : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 shadow-xs'
                    }`}
                  >
                    {/* Tier 1: Header Category Label + Top Right Price Badge */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {slot.category}
                      </span>
                      <span className={`font-black text-xs px-2.5 py-0.5 rounded-md border shrink-0 ${
                        isSelected
                          ? 'bg-emerald-500 text-white border-emerald-400 shadow-xs'
                          : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                      }`}>
                        ₹{slot.price}
                      </span>
                    </div>

                    {/* Tier 2: Dedicated Time Display (Full Card Width - Cannot Overlap) */}
                    <div className="flex items-center gap-2 py-1">
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${isSelected ? 'bg-emerald-500 text-white shadow-green-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>
                        🏏
                      </div>
                      <div className="font-black text-xs text-slate-900 dark:text-white tracking-tight whitespace-nowrap min-w-0">
                        {slot.time}
                      </div>
                    </div>

                    {/* Tier 3: Floodlit Tag Footer */}
                    {slot.isFloodlit && (
                      <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                          ⚡ Floodlit Arena
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Match Format Options */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">Match Format</h4>
            <div className="grid grid-cols-2 gap-2">
              {['Box Cricket T10', 'Box Cricket 6v6'].map((fmt) => (
                <motion.button
                  key={fmt}
                  type="button"
                  onClick={() => setMatchFormat(fmt)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                    matchFormat === fmt
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-green-sm'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {fmt}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Add-ons List */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">Matchday Add-ons</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ADDONS_LIST.map((addon) => {
                const Icon = addon.icon;
                const isChecked = selectedAddons.some((a) => a.name === addon.name);
                return (
                  <motion.button
                    type="button"
                    key={addon.name}
                    onClick={() => toggleAddon(addon)}
                    whileTap={{ scale: 0.98 }}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isChecked
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${isChecked ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="text-xs font-bold">{addon.name}</span>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-600">
                      +₹{addon.price}
                      <AnimatePresence initial={false}>
                        {isChecked && (
                          <motion.svg viewBox="0 0 20 20" className="h-4 w-4 rounded-full bg-emerald-500 p-0.5 text-white" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} exit={{ pathLength: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                            <motion.path d="M4 10.5 8 14l8-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </motion.svg>
                        )}
                      </AnimatePresence>
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Booking Bar */}
      {selectedSlot && (
        <div className="fixed bottom-16 left-0 right-0 z-30 p-3">
          <div className="max-w-md mx-auto bg-slate-900 text-white rounded-full p-3 px-5 shadow-2xl flex items-center justify-between border border-slate-800 backdrop-blur-lg animate-slide-up">
            <div>
              <div className="text-[10px] text-emerald-300 font-semibold uppercase">Total Amount</div>
              <div className="text-xl font-black text-white">₹{calculateTotal()}</div>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold px-6 py-2.5 rounded-full shadow-green-sm active:scale-95 transition-all flex items-center gap-1.5"
            >
              <span>Confirm & Book Slot</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 5. VISUAL INTERACTIVE MONTHLY CALENDAR MODAL */}
      <AnimatePresence>
        {showCalendarModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 space-y-4 shadow-2xl relative"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Select Future Booking Date</h3>
                </div>
                <button
                  onClick={() => setShowCalendarModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Month Navigation */}
              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
                <button
                  onClick={prevMonth}
                  className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-100"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-extrabold text-sm text-slate-900">{monthName}</span>
                <button
                  onClick={nextMonth}
                  className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-100"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 text-center font-extrabold text-[11px] text-slate-400 uppercase pb-1">
                <span>Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
              </div>

              {/* Month Grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {/* Empty Offset Slots */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty_${i}`} className="h-9" />
                ))}

                {/* Days of Month */}
                {Array.from({ length: totalDays }).map((_, i) => {
                  const day = i + 1;
                  const monthFormatted = String(currentMonth + 1).padStart(2, '0');
                  const dayFormatted = String(day).padStart(2, '0');
                  const thisDateStr = `${currentYear}-${monthFormatted}-${dayFormatted}`;
                  const isToday = new Date().toISOString().split('T')[0] === thisDateStr;
                  const isSelected = selectedDate === thisDateStr;

                  return (
                    <motion.button
                      key={day}
                      onClick={() => handleSelectCalendarDate(day)}
                      whileTap={{ scale: 0.92 }}
                      className={`relative overflow-hidden h-9.5 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition-all ${
                        isSelected
                          ? 'text-white shadow-green-sm scale-110 font-extrabold z-10'
                          : isToday
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-emerald-50 hover:text-emerald-600'
                      }`}
                    >
                      {isSelected && <motion.span layoutId="booking-date" transition={{ type: 'spring', stiffness: 380, damping: 28 }} className="absolute inset-0 rounded-xl bg-emerald-500" />}
                      <span className="relative">{day}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Manual Date Input Picker Backup */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-300">Specific Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                      setShowCalendarModal(false);
                    }
                  }}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-extrabold focus:outline-none focus:border-emerald-500"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL CHECKOUT CONFIRMATION */}
      <AnimatePresence>
        {showModal && selectedSlot && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-xs p-0 sm:p-4">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl overflow-hidden p-5 space-y-4 shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Booking Summary</h3>
                <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Pitch Slot ({selectedSlot.time})</span>
                  <span className="font-bold text-slate-900 dark:text-white">₹{selectedSlot.price}</span>
                </div>
                {selectedAddons.map((a) => (
                  <div key={a.name} className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>{a.name}</span>
                    <span className="font-bold text-slate-900 dark:text-white">₹{a.price}</span>
                  </div>
                ))}
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Turf GST (18%)</span>
                  <span className="font-bold text-slate-900 dark:text-white">₹{Math.round(calculateTotal() * 0.18)}</span>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-sm font-black text-emerald-600">
                  <span>Grand Total</span>
                  <span>₹<AnimatedValue value={Math.round(calculateTotal() * 1.18)} /></span>
                </div>
              </div>

              <button
                onClick={handleConfirmBooking}
                disabled={isProcessing}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-3 rounded-full shadow-green-sm active:scale-95 transition-all text-xs"
              >
                {isProcessing ? 'Generating QR Pass...' : 'Pay & Confirm Booking'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR GATE PASS CONFIRMATION MODAL */}
      <AnimatePresence>
        {confirmedBookingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 text-center space-y-4 shadow-2xl"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl">
                ✓
              </div>

              <div className="space-y-1">
                <h3 className="font-black text-slate-900 dark:text-white text-lg">Slot Reserved!</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Show this QR pass at Singarayakonda Pitch gate</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-2">
                <motion.div
                  initial={shouldReduceMotion ? false : { clipPath: 'inset(0 0 100% 0)', opacity: 0 }}
                  animate={{ clipPath: 'inset(0 0 0% 0)', opacity: 1 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="w-40 h-40 bg-white p-2 mx-auto rounded-xl shadow-inner flex items-center justify-center border border-slate-200"
                >
                  <QrCode className="w-32 h-32 text-slate-900" />
                </motion.div>
                <div className="text-[10px] text-slate-400 font-mono">PASS #{confirmedBookingId}</div>
              </div>

              <button
                onClick={() => {
                  setConfirmedBookingId(null);
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
