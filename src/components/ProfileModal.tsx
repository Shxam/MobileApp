import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  User,
  LogOut,
  X,
  Check,
  Edit3,
  MapPin,
  CreditCard,
  Package,
  Tag,
  HelpCircle,
  ChevronRight,
  ShieldCheck,
  Award,
  ArrowLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSupport?: () => void;
  onOpenAdminPortal?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  onOpenSupport,
  onOpenAdminPortal,
}) => {
  const { user, updateUser, logout, addNotification, language } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [activeToast, setActiveToast] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({ name, email });
    addNotification('Profile Updated 👤', 'Your details were updated successfully.', 'wallet');
    setIsEditing(false);
  };

  const handleOptionClick = (title: string, action?: () => void) => {
    if (action) action();
    else {
      setActiveToast(`${title} clicked`);
      setTimeout(() => setActiveToast(null), 2000);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
        <motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 text-slate-900 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        >
          {/* Header Bar matching Screenshot 4 */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center hover:bg-slate-200">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-extrabold text-slate-900">Profile</h2>
            <div className="w-9" />
          </div>

          {/* User Profile Info Card (Matching Screenshot 4) */}
          <div className="flex flex-col items-center text-center space-y-2 py-2">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-rose-100 overflow-hidden bg-slate-100 shadow-md">
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              </div>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-pink-sm hover:scale-110 transition-transform"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900">{user.name}</h3>
              <div className="flex items-center gap-1.5 justify-center mt-0.5">
                <span className="text-[11px] font-extrabold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                  ₹15k+ Spend
                </span>
                <span className="text-xs font-semibold text-slate-400">@{user.phone.replace(/[^0-9]/g, '')}</span>
              </div>
            </div>
          </div>

          {/* Edit Form Modal Overlay if editing */}
          {isEditing && (
            <form onSubmit={handleSave} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-extrabold py-2 rounded-xl text-xs shadow-pink-sm"
                >
                  Save Profile
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Toast Notification */}
          {activeToast && (
            <div className="bg-slate-900 text-white text-xs font-bold py-2 px-3 rounded-xl text-center shadow-lg animate-fade-in">
              {activeToast}
            </div>
          )}

          {/* Account Options List (Matching Screenshot 4) */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider px-1">My Account</h4>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl overflow-hidden divide-y divide-slate-100">
              <button
                onClick={() => handleOptionClick('Manage Address')}
                className="w-full p-3.5 flex items-center justify-between hover:bg-slate-100/80 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">Manage Address</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => handleOptionClick('Payment Options')}
                className="w-full p-3.5 flex items-center justify-between hover:bg-slate-100/80 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">Payment Options</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => handleOptionClick('Orders')}
                className="w-full p-3.5 flex items-center justify-between hover:bg-slate-100/80 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">My Orders & Turf Bookings</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => handleOptionClick('Offers')}
                className="w-full p-3.5 flex items-center justify-between hover:bg-slate-100/80 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">Offers & Vouchers</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => handleOptionClick('Help Center', onOpenSupport)}
                className="w-full p-3.5 flex items-center justify-between hover:bg-slate-100/80 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">Help Center & Support</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Admin Partner Portal Entry if clicked */}
          {onOpenAdminPortal && (
            <button
              onClick={onOpenAdminPortal}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 rounded-2xl text-xs border border-slate-200 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-rose-500" />
              <span>Open Kitchen Partner & Admin Portal</span>
            </button>
          )}

          {/* Hot Pink Logout Button (Matching Screenshot 4 UI) */}
          <button
            onClick={() => {
              logout();
              onClose();
            }}
            className="w-full bg-rose-500 hover:bg-rose-600 text-white font-extrabold py-3.5 rounded-full shadow-pink-sm text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
