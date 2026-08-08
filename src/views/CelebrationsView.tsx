import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MOCK_CELEBRATION_PACKAGES, MOCK_TURFS } from '../data/mockData';
import { CelebrationPackage } from '../types';
import {
  PartyPopper,
  CheckCircle2,
  Calendar,
  Users,
  Mic,
  Award,
  Cake,
  X,
  Wallet,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Flame,
  UtensilsCrossed,
  Plus,
  Minus,
  Star,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AnimatedValue } from '../components/AnimatedValue';

interface CelebrationsViewProps {
  onNavigateHub: () => void;
}

export const CelebrationsView: React.FC<CelebrationsViewProps> = ({ onNavigateHub }) => {
  const shouldReduceMotion = useReducedMotion();
  const { user, addCelebrationBooking, deductWallet, language, addNotification } = useApp();

  const [activePackage, setActivePackage] = useState<CelebrationPackage | null>(null);
  const [guestCount, setGuestCount] = useState<number>(15);
  const [guestDirection, setGuestDirection] = useState<'up' | 'down'>('up');
  const [eventDate, setEventDate] = useState<string>(
    new Date(Date.now() + 604800000).toISOString().split('T')[0] // 7 days ahead
  );
  const [timeSlot, setTimeSlot] = useState('07:00 PM - 10:00 PM');
  const [selectedTurf, setSelectedTurf] = useState(MOCK_TURFS[0].name);

  // Customization Toggles
  const [decorTheme, setDecorTheme] = useState('IPL Stadium Lights');
  const [commentarySetup, setCommentarySetup] = useState(true);
  const [trophyPackage, setTrophyPackage] = useState(true);
  const [specialFoodMenu, setSpecialFoodMenu] = useState(true);
  const [cakeKg, setCakeKg] = useState<number>(2);

  const [isBooking, setIsBooking] = useState(false);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);

  const calculateTotal = (): number => {
    if (!activePackage) return 0;
    let total = activePackage.basePrice;
    if (guestCount > 15) total += (guestCount - 15) * 200;
    if (commentarySetup) total += 800;
    if (trophyPackage) total += 1200;
    if (specialFoodMenu) total += 1500;
    total += cakeKg * 400;
    return total;
  };

  const handleConfirmParty = () => {
    if (!activePackage) return;
    const totalAmount = calculateTotal();

    setIsBooking(true);
    setTimeout(() => {
      const newBooking = addCelebrationBooking({
        packageId: activePackage.id,
        packageName: activePackage.titleEn,
        turfName: selectedTurf,
        eventDate,
        timeSlot,
        guestCount,
        customizations: {
          decorTheme,
          commentarySetup,
          trophyPackage,
          specialFoodMenu,
          cakeKg,
        },
        totalAmount,
      });

      setConfirmedId(newBooking.id);
      addNotification('🎉 Party Booked!', `Grand Indian Turf Party booked for ${eventDate}`, 'booking');
      setIsBooking(false);
    }, 1000);
  };

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
        {MOCK_CELEBRATION_PACKAGES.map((pkg) => (
          <motion.article
            key={pkg.id}
            whileHover={shouldReduceMotion ? undefined : { y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 330, damping: 27 }}
            className="bg-white border border-slate-200/80 rounded-3xl p-4 shadow-xs hover:shadow-md transition-all space-y-3"
          >
            <div className="relative rounded-2xl overflow-hidden h-40 bg-slate-100">
              <img src={pkg.image} alt={pkg.titleEn} className="w-full h-full object-cover" />
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
                <div className="text-lg font-black text-emerald-600">₹{pkg.basePrice}</div>
              </div>

              <button
                onClick={() => setActivePackage(pkg)}
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
                  onClick={() => setActivePackage(null)}
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
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Includes food plates & turf bench seats</div>
                  </div>

                  <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-full font-bold">
                    <button
                      onClick={() => {
                        setGuestDirection('down');
                        setGuestCount(Math.max(5, guestCount - 5));
                      }}
                      className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold active:scale-95 shadow-green-sm"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <AnimatedValue value={guestCount} direction={guestDirection} className="w-6 text-center font-extrabold text-slate-900 dark:text-white" />
                    <button
                      onClick={() => {
                        setGuestDirection('up');
                        setGuestCount(guestCount + 5);
                      }}
                      className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold active:scale-95 shadow-green-sm"
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
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-emerald-500"
                  />
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
                        Live DJ Commentary Setup (+₹800)
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
                      <div className="font-bold">Winner Trophy & Medals (+₹1,200)</div>
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
                      <div className="font-bold">Unlimited Dhaba Starters & Drinks (+₹1,500)</div>
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
                      <span>{cakeKg} kg (+₹{cakeKg * 400})</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={cakeKg}
                    onChange={(e) => setCakeKg(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>
              </div>

              {/* Fixed Bottom Bar */}
              <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-sm">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Estimate</span>
                  <div className="text-xl font-black text-emerald-600">₹{calculateTotal()}</div>
                </div>

                <button
                  onClick={handleConfirmParty}
                  disabled={isBooking}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold px-8 py-3 rounded-full shadow-green-sm active:scale-95 transition-all text-xs"
                >
                  {isBooking ? 'Processing...' : 'Book Celebration Slot'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRMATION MODAL */}
      <AnimatePresence>
        {confirmedId && (
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
                <div>Event Date: {eventDate}</div>
                <div>Guest Count: {guestCount} Players & Guests</div>
                <div className="text-emerald-600 font-extrabold text-sm pt-1">Booking #{confirmedId}</div>
              </div>

              <button
                onClick={() => {
                  setConfirmedId(null);
                  setActivePackage(null);
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
