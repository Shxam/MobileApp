import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { TurfBooking, FoodOrder, CelebrationBooking } from '../types';
import { DriverMapTracker } from '../components/DriverMapTracker';
import { ReviewModal } from '../components/ReviewModal';
import {
  Calendar,
  UtensilsCrossed,
  PartyPopper,
  QrCode,
  MapPin,
  Clock,
  ChevronRight,
  FileText,
  X,
  Phone,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Download,
  Share2,
  Star,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export const MyBookingsView: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const {
    turfBookings,
    foodOrders,
    celebrationBookings,
    rescheduleTurfBooking,
    cancelTurfBooking,
    language,
    addNotification,
    updateOrderStatus,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'food' | 'turf' | 'parties'>('food');
  const [selectedPassBooking, setSelectedPassBooking] = useState<TurfBooking | null>(null);
  const [selectedRescheduleBooking, setSelectedRescheduleBooking] = useState<TurfBooking | null>(null);
  const [newRescheduleDate, setNewRescheduleDate] = useState('');
  const [newRescheduleTime, setNewRescheduleTime] = useState('08:00 PM - 09:00 PM');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedReviewTitle, setSelectedReviewTitle] = useState('IPL Dhaba Experience');

  const activeOrder = foodOrders.find((o) => o.status !== 'delivered') || foodOrders[0];

  const handleConfirmReschedule = () => {
    if (!selectedRescheduleBooking || !newRescheduleDate) return;
    rescheduleTurfBooking(selectedRescheduleBooking.id, newRescheduleDate, newRescheduleTime);
    setSelectedRescheduleBooking(null);
  };

  return (
    <div className="space-y-4 p-4 pb-28 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-white transition-colors">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
          {language === 'en' ? 'My Hub & Activity' : 'मेरी सभी बुकिंग और ऑर्डर'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {language === 'en'
            ? 'Track live food orders, turf passes & party celebrations'
            : 'सभी ४ सेवाओं की एकीकृत जानकारी'}
        </p>
      </div>

      {/* Sub Tabs */}
      <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs font-bold shadow-xs">
        <button
          onClick={() => setActiveSubTab('food')}
          className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeSubTab === 'food'
              ? 'bg-emerald-500 text-white font-extrabold shadow-green-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <UtensilsCrossed className="w-4 h-4" />
          <span>Orders ({foodOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('turf')}
          className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeSubTab === 'turf'
              ? 'bg-rose-500 text-white font-extrabold shadow-pink-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Turfs ({turfBookings.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('parties')}
          className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeSubTab === 'parties'
              ? 'bg-rose-500 text-white font-extrabold shadow-pink-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <PartyPopper className="w-4 h-4" />
          <span>Parties ({celebrationBookings.length})</span>
        </button>
      </div>

      {/* 1. FOOD ORDERS TAB — LIVE TRACKING UI (Matching Screenshot 3 UI) */}
      {activeSubTab === 'food' && (
        <div className="space-y-4">
          {/* Active Live Order Tracking Banner */}
          {activeOrder ? (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-4 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <h3 className="font-extrabold text-slate-900 text-sm">Track Order</h3>
                </div>
                <span className="text-[10px] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
                  #{activeOrder.id.substring(0, 8)}
                </span>
              </div>

              {/* Map Component with Pink Route (Matching Screenshot 3) */}
              <DriverMapTracker
                orderId={activeOrder.id}
                deliveryTarget={activeOrder.deliveryTarget}
                estimatedMinutes={activeOrder.estimatedDeliveryMinutes}
              />

              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-slate-900 text-base">Heading your way</h4>
                    <p className="text-xs text-slate-500 font-medium">Estimated arrival at <span className="font-bold text-slate-900">08:45 AM</span></p>
                  </div>
                  <span className="text-xs font-black text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                    ₹{activeOrder.totalAmount}
                  </span>
                </div>

                {/* 4 Milestones Progress Bar (Matching Screenshot 3 UI) */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/60 space-y-2">
                  <div className="flex items-center justify-between relative px-2">
                    {/* Pink Line Background */}
                    <div className="absolute top-1/2 left-6 right-6 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
                    <motion.div
                      className="absolute top-1/2 left-6 h-0.5 bg-rose-500 -translate-y-1/2 z-0"
                      animate={{
                        width:
                          activeOrder.status === 'placed'
                            ? '10%'
                            : activeOrder.status === 'preparing'
                            ? '40%'
                            : activeOrder.status === 'out_for_delivery'
                            ? '75%'
                            : '100%',
                      }}
                      transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 28 }}
                    />

                    {/* Step 1: Accepted */}
                    <div className="relative z-10 flex flex-col items-center gap-1">
                      <div className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs font-bold shadow-pink-sm">
                        ✓
                      </div>
                      <span className="text-[10px] font-bold text-slate-800">Accepted</span>
                    </div>

                    {/* Step 2: Cooking */}
                    <div className="relative z-10 flex flex-col items-center gap-1">
                      <motion.div key={`cooking-${activeOrder.status}`} initial={shouldReduceMotion ? false : { scale: 0.72 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 25 }} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        ['preparing', 'out_for_delivery', 'delivered'].includes(activeOrder.status)
                          ? 'bg-rose-500 text-white shadow-pink-sm'
                          : 'bg-slate-200 text-slate-500'
                      }`}>
                        🍳
                      </motion.div>
                      <span className="text-[10px] font-bold text-slate-800">Cooking</span>
                    </div>

                    {/* Step 3: Pickup */}
                    <div className="relative z-10 flex flex-col items-center gap-1">
                      <motion.div key={`pickup-${activeOrder.status}`} initial={shouldReduceMotion ? false : { scale: 0.72 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 25 }} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        ['out_for_delivery', 'delivered'].includes(activeOrder.status)
                          ? 'bg-rose-500 text-white shadow-pink-sm'
                          : 'bg-slate-200 text-slate-500'
                      }`}>
                        🛵
                      </motion.div>
                      <span className="text-[10px] font-bold text-slate-800">Pickup</span>
                    </div>

                    {/* Step 4: Delivered */}
                    <div className="relative z-10 flex flex-col items-center gap-1">
                      <motion.div key={`delivered-${activeOrder.status}`} initial={shouldReduceMotion ? false : { scale: 0.72 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 25 }} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        activeOrder.status === 'delivered'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}>
                        📦
                      </motion.div>
                      <span className="text-[10px] font-bold text-slate-800">Delivered</span>
                    </div>
                  </div>
                </div>

                {/* Delivery Boy Info Card (Matching Screenshot 3 UI) */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
                      <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150" alt="Runner" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <div className="font-extrabold text-xs text-slate-900">Rahul Sharma</div>
                      <div className="text-[10px] text-slate-500 font-medium">Delivery Runner • Singarayakonda Hub</div>
                    </div>
                  </div>

                  <a
                    href="tel:+919876543210"
                    className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-100 shadow-xs"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                </div>

                {/* Hot Pink Order Received Button */}
                <button
                  onClick={() => {
                    updateOrderStatus(activeOrder.id, 'delivered');
                    addNotification('✅ Order Delivered!', 'Thank you! Enjoy your Dhaba meal.', 'food');
                    setIsReviewModalOpen(true);
                  }}
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white font-extrabold py-3 rounded-full shadow-pink-sm text-xs active:scale-95 transition-all"
                >
                  Mark Order Received
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-2">
              <UtensilsCrossed className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="font-extrabold text-slate-800 text-sm">No Active Food Orders</div>
              <p className="text-xs text-slate-500">Order biryani & starters from our Dhaba kitchen!</p>
            </div>
          )}

          {/* Past Orders List */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-slate-900 text-sm">Order History</h4>
            {foodOrders.map((order) => (
              <div key={order.id} className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">Order #{order.id}</span>
                  <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                    {order.status}
                  </span>
                </div>
                <div className="text-xs text-slate-600 font-medium">
                  {order.items.map((i) => `${i.menuItem.nameEn} x${i.quantity}`).join(', ')}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="font-black text-rose-600 text-sm">₹{order.totalAmount}</span>
                  <button
                    onClick={() => setIsReviewModalOpen(true)}
                    className="text-xs font-bold text-rose-500 hover:text-rose-600"
                  >
                    Rate & Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. TURF BOOKINGS TAB */}
      {activeSubTab === 'turf' && (
        <div className="space-y-3">
          {turfBookings.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-2">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="font-extrabold text-slate-800 text-sm">No Turf Bookings Yet</div>
              <p className="text-xs text-slate-500">Reserve your Singarayakonda floodlit box pitch slot!</p>
            </div>
          ) : (
            turfBookings.map((b) => (
              <div key={b.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">{b.turfName}</h4>
                    <p className="text-xs text-slate-500 font-medium">{b.date} • {b.slots[0]?.time}</p>
                  </div>
                  <span className="text-xs font-black text-rose-600 bg-rose-50 px-3 py-1 rounded-full">
                    ₹{b.totalAmount}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setSelectedPassBooking(b)}
                    className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 rounded-full text-xs shadow-pink-sm active:scale-95 transition-all flex items-center justify-center gap-1"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>View Gate QR Pass</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 3. CELEBRATIONS TAB */}
      {activeSubTab === 'parties' && (
        <div className="space-y-3">
          {celebrationBookings.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-2">
              <PartyPopper className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="font-extrabold text-slate-800 text-sm">No Party Bookings Yet</div>
              <p className="text-xs text-slate-500">Host your birthday or team party at IPL Dhaba!</p>
            </div>
          ) : (
            celebrationBookings.map((c) => (
              <div key={c.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-slate-900 text-sm">{c.packageName}</h4>
                  <span className="text-xs font-black text-rose-600">₹{c.totalAmount}</span>
                </div>
                <div className="text-xs text-slate-600 font-medium">
                  {c.eventDate} • {c.guestCount} Guests • {c.turfName}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* REVIEW MODAL */}
      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        targetTitle={selectedReviewTitle}
      />
    </div>
  );
};
