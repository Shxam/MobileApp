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
  Plus,
  Copy,
  Wallet,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSupport?: () => void;
  onOpenAdminPortal?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  onOpenSupport,
  onOpenAdminPortal,
  onNavigateTab,
}) => {
  const { user, updateUser, logout, addNotification, language } = useApp();
  const [subView, setSubView] = useState<'main' | 'addresses' | 'payments' | 'vouchers'>('main');
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Address State
  const [addresses, setAddresses] = useState([
    { id: 'addr_1', label: 'IPL Dhaba Box Turf - Bench 1', type: 'Turf Pitch', detail: 'Singarayakonda NH-16 Bypass, Cage A', isDefault: true },
    { id: 'addr_2', label: 'Home Address', type: 'Residential', detail: 'Door 4-12, Main Road, Singarayakonda, Prakasam Dist', isDefault: false },
  ]);
  const [showAddAddr, setShowAddAddr] = useState(false);
  const [newAddrLabel, setNewAddrLabel] = useState('');
  const [newAddrDetail, setNewAddrDetail] = useState('');

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({ name, email });
    addNotification('Profile Updated 👤', 'Your details were updated successfully.', 'wallet');
    setIsEditing(false);
  };

  const handleCopyVoucher = (code: string) => {
    setCopiedCode(code);
    addNotification('🎟️ Promo Code Copied!', `${code} copied to clipboard. Apply at checkout!`, 'reward');
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddrLabel || !newAddrDetail) return;
    setAddresses((prev) => [
      ...prev,
      { id: `addr_${Date.now()}`, label: newAddrLabel, type: 'Custom', detail: newAddrDetail, isDefault: false },
    ]);
    setNewAddrLabel('');
    setNewAddrDetail('');
    setShowAddAddr(false);
    addNotification('🏠 Address Saved!', 'New delivery address added to your profile.', 'food');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
        <motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 text-slate-900 dark:text-white space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <button
              onClick={() => {
                if (subView !== 'main') setSubView('main');
                else onClose();
              }}
              className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              {subView === 'main' && 'Profile'}
              {subView === 'addresses' && 'Manage Addresses'}
              {subView === 'payments' && 'Payment Options'}
              {subView === 'vouchers' && 'Offers & Vouchers'}
            </h2>
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* MAIN PROFILE VIEW */}
          {subView === 'main' && (
            <div className="space-y-4">
              {/* User Profile Info Card */}
              <div className="flex flex-col items-center text-center space-y-2 py-2">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-emerald-100 dark:border-slate-700 overflow-hidden bg-slate-100 shadow-md">
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  </div>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-green-sm hover:scale-110 transition-transform"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">{user.name}</h3>
                  <div className="flex items-center gap-1.5 justify-center mt-0.5">
                    <span className="text-[11px] font-extrabold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      ₹15k+ Spend
                    </span>
                    <span className="text-xs font-semibold text-slate-400">@{user.phone.replace(/[^0-9]/g, '')}</span>
                  </div>
                </div>
              </div>

              {/* Edit Form Modal Overlay if editing */}
              {isEditing && (
                <form onSubmit={handleSave} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-2 rounded-xl text-xs shadow-green-sm"
                    >
                      Save Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2 rounded-xl text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Account Options List */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider px-1">My Account</h4>

                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                  <button
                    onClick={() => setSubView('addresses')}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Manage Address</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>

                  <button
                    onClick={() => setSubView('payments')}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center shrink-0">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Payment Options</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>

                  <button
                    onClick={() => {
                      if (onNavigateTab) onNavigateTab('hub');
                    }}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">My Orders & Turf Bookings</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>

                  <button
                    onClick={() => setSubView('vouchers')}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center shrink-0">
                        <Tag className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Offers & Vouchers</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>

                  <button
                    onClick={() => {
                      if (onOpenSupport) {
                        onClose();
                        onOpenSupport();
                      }
                    }}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center shrink-0">
                        <HelpCircle className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Help Center & Support</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Admin Partner Portal Entry */}
              {onOpenAdminPortal && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenAdminPortal();
                  }}
                  className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-2.5 rounded-2xl text-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Open Kitchen Partner & Admin Portal</span>
                </button>
              )}

              {/* Logout Button */}
              <button
                onClick={() => {
                  logout();
                  onClose();
                }}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-3.5 rounded-full shadow-green-sm text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          )}

          {/* MANAGE ADDRESSES SUB-VIEW */}
          {subView === 'addresses' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Saved Delivery Locations</span>
                <button
                  onClick={() => setShowAddAddr(!showAddAddr)}
                  className="text-xs font-bold text-emerald-600 flex items-center gap-1 hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New</span>
                </button>
              </div>

              {showAddAddr && (
                <form onSubmit={handleAddAddress} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 space-y-3">
                  <input
                    type="text"
                    placeholder="Address Label (e.g. Office Bench, Hostel 2)"
                    value={newAddrLabel}
                    onChange={(e) => setNewAddrLabel(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white"
                  />
                  <textarea
                    rows={2}
                    placeholder="Full Address / Landmark Details"
                    value={newAddrDetail}
                    onChange={(e) => setNewAddrDetail(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-emerald-500 text-white font-extrabold py-2 rounded-xl text-xs">Save Address</button>
                    <button type="button" onClick={() => setShowAddAddr(false)} className="px-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2 rounded-xl text-xs">Cancel</button>
                  </div>
                </form>
              )}

              <div className="space-y-2.5">
                {addresses.map((addr) => (
                  <div key={addr.id} className="p-3.5 rounded-2xl border bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 flex items-start justify-between">
                    <div className="space-y-1 pr-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="font-extrabold text-xs text-slate-900 dark:text-white">{addr.label}</span>
                        {addr.isDefault && (
                          <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Default</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium pl-6">{addr.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PAYMENT OPTIONS SUB-VIEW */}
          {subView === 'payments' && (
            <div className="space-y-4">
              <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] text-emerald-400 font-bold uppercase">Matchday Wallet</div>
                    <div className="text-lg font-black">₹{user.walletBalance}</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (onNavigateTab) onNavigateTab('home');
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-green-sm"
                >
                  Top Up
                </button>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider px-1">Saved Methods</span>
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700 text-xs">
                  <div className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
                        UPI
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">Google Pay / PhonePe UPI</div>
                        <div className="text-[10px] text-slate-400 font-medium">{user.phone.replace(/[^0-9]/g, '')}@okaxis</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Linked</span>
                  </div>

                  <div className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-slate-400" />
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">Razorpay Test Gateways</div>
                        <div className="text-[10px] text-slate-400 font-medium">Supports All Major Indian Cards & Netbanking</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Active</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* OFFERS & VOUCHERS SUB-VIEW */}
          {subView === 'vouchers' && (
            <div className="space-y-3">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider px-1">Available IPL Matchday Coupons</span>

              {[
                { code: 'POWERPLAY50', title: '50% OFF Powerplay Feast', desc: 'Get 50% discount up to ₹150 on all food combos.', min: 'Min Order: ₹299' },
                { code: 'IPLMATCHDAY', title: '₹100 OFF Turf Booking', desc: 'Flat ₹100 discount on night floodlit turf slots.', min: 'Min Order: ₹900' },
                { code: 'LASSILOVE', title: 'Free Amritsari Lassi', desc: 'Get 1 complimentary Kulhad Lassi with Biryani.', min: 'Min Order: ₹399' },
              ].map((v) => (
                <div key={v.code} className="p-3.5 rounded-2xl border bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-200/60 dark:bg-emerald-900/60 px-2 py-0.5 rounded-lg border border-emerald-300">
                        {v.code}
                      </span>
                      <span className="font-extrabold text-xs text-slate-900 dark:text-white">{v.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{v.desc}</p>
                    <div className="text-[10px] font-bold text-slate-400">{v.min}</div>
                  </div>
                  <button
                    onClick={() => handleCopyVoucher(v.code)}
                    className="shrink-0 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-green-sm flex items-center gap-1 active:scale-95 transition-all"
                  >
                    {copiedCode === v.code ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode === v.code ? 'Copied' : 'Apply'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
