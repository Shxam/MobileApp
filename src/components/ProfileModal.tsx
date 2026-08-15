import React, { useCallback, useEffect, useState } from 'react';
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
  Loader2,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatPaise, type AvailableVoucher, type SavedAddress } from '../types';
import { ApiClient } from '../services/apiClient';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSupport?: () => void;
  onOpenAdminPortal?: () => void;
  onNavigateTab?: (tab: string) => void;
}

/** The six teams the sign-in screens offer, so an edit cannot invent a team. */
const IPL_TEAMS = [
  'Royal Challengers',
  'Chennai Super Kings',
  'Mumbai Indians',
  'Kolkata Knight Riders',
  'Gujarat Titans',
  'Sunrisers Hyderabad',
];

/** What a rider needs to actually find the door; mirrored by the server DTO. */
const MIN_ADDRESS_LENGTH = 10;

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
  // `email` was edited here and sent to a server that has no email column — the
  // User table has never had one. Favourite team is the field that does persist.
  const [favoriteTeam, setFavoriteTeam] = useState(user.favoriteTeam ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  /**
   * Addresses were two invented rows in `useState`, and "Add New" appended to
   * that array: the toast said saved, the reload said otherwise, and checkout
   * never saw any of it. These are now rows in the `addresses` table.
   */
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [showAddAddr, setShowAddAddr] = useState(false);
  const [isSavingAddr, setIsSavingAddr] = useState(false);
  const [newAddrLabel, setNewAddrLabel] = useState('');
  const [newAddrDetail, setNewAddrDetail] = useState('');
  const [newAddrLandmark, setNewAddrLandmark] = useState('');
  const [newAddrPincode, setNewAddrPincode] = useState('');

  /** Offers came from a hardcoded list whose codes no voucher row ever matched. */
  const [vouchers, setVouchers] = useState<AvailableVoucher[]>([]);
  const [isLoadingVouchers, setIsLoadingVouchers] = useState(false);
  const [voucherError, setVoucherError] = useState<string | null>(null);

  // Re-sync when the server profile changes under us (a sibling edit, a refresh
  // of the session) so the form does not reopen holding a stale name.
  useEffect(() => {
    setName(user.name);
    setFavoriteTeam(user.favoriteTeam ?? '');
  }, [user.name, user.favoriteTeam]);

  const loadAddresses = useCallback(() => {
    setIsLoadingAddresses(true);
    setAddressError(null);
    ApiClient.getAddresses()
      .then(setAddresses)
      .catch((err) =>
        setAddressError(err instanceof Error ? err.message : 'Could not load your addresses.'),
      )
      .finally(() => setIsLoadingAddresses(false));
  }, []);

  // Fetched when the sub-view is opened rather than on mount: the modal is
  // mounted for every screen, and most sessions never open either list.
  useEffect(() => {
    if (!isOpen || subView !== 'addresses') return;
    loadAddresses();
  }, [isOpen, subView, loadAddresses]);

  useEffect(() => {
    if (!isOpen || subView !== 'vouchers') return;
    let cancelled = false;
    setIsLoadingVouchers(true);
    setVoucherError(null);
    ApiClient.getVouchers()
      .then((rows) => {
        if (!cancelled) setVouchers(rows);
      })
      .catch((err) => {
        if (!cancelled) setVoucherError(err instanceof Error ? err.message : 'Could not load offers.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingVouchers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, subView]);

  if (!isOpen) return null;

  /**
   * `updateUser` PATCHes the server and stores the response, so the screen shows
   * what was actually saved rather than what was typed.
   */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await updateUser({ name: name.trim(), favoriteTeam: favoriteTeam || undefined });
      addNotification('Profile Updated 👤', 'Your details were saved.', 'wallet');
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * The old handler only claimed to copy. `navigator.clipboard` is unavailable
   * on insecure origins, so a failure has to say so rather than show "Copied".
   */
  const handleCopyVoucher = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      addNotification('🎟️ Promo Code Copied!', `${code} copied. Apply it at checkout.`, 'reward');
      setTimeout(() => setCopiedCode(null), 2500);
    } catch {
      addNotification('Copy Failed', `Type the code manually: ${code}`, 'system');
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingAddr) return;
    const label = newAddrLabel.trim();
    const detail = newAddrDetail.trim();
    if (label.length < 2 || detail.length < MIN_ADDRESS_LENGTH) {
      setAddressError('Give the address a name and a full street, landmark and pincode.');
      return;
    }

    setIsSavingAddr(true);
    setAddressError(null);
    try {
      const saved = await ApiClient.createAddress({
        label,
        detail,
        ...(newAddrLandmark.trim() ? { landmark: newAddrLandmark.trim() } : {}),
        ...(newAddrPincode.trim() ? { pincode: newAddrPincode.trim() } : {}),
      });
      // Saving a default clears the flag on every other row server-side, so the
      // local list has to clear it too or two rows both claim to be the default.
      setAddresses((prev) => [saved, ...prev.map((a) => (saved.isDefault ? { ...a, isDefault: false } : a))]);
      setNewAddrLabel('');
      setNewAddrDetail('');
      setNewAddrLandmark('');
      setNewAddrPincode('');
      setShowAddAddr(false);
      addNotification('🏠 Address Saved!', 'It will be offered at checkout for home delivery.', 'food');
    } catch (err) {
      setAddressError(err instanceof Error ? err.message : 'Could not save that address.');
    } finally {
      setIsSavingAddr(false);
    }
  };

  const handleMakeDefault = async (id: string) => {
    setAddressError(null);
    try {
      await ApiClient.updateAddress(id, { isDefault: true });
      setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
    } catch (err) {
      setAddressError(err instanceof Error ? err.message : 'Could not update that address.');
    }
  };

  const handleDeleteAddress = async (id: string) => {
    setAddressError(null);
    try {
      const { promotedId } = await ApiClient.deleteAddress(id);
      setAddresses((prev) =>
        prev
          .filter((a) => a.id !== id)
          // The server promotes the next-newest when the default is removed;
          // mirroring it here keeps the badge honest without a second round trip.
          .map((a) => (promotedId && a.id === promotedId ? { ...a, isDefault: true } : a)),
      );
    } catch (err) {
      setAddressError(err instanceof Error ? err.message : 'Could not delete that address.');
    }
  };

  /** "50% up to ₹150" / "₹100 off" — built from the row, not written by hand. */
  const describeDiscount = (v: AvailableVoucher): string => {
    if (v.discountType === 'percent') {
      const cap = v.maxDiscountPaise ? ` up to ${formatPaise(v.maxDiscountPaise)}` : '';
      return `${v.discountValue}% off${cap}`;
    }
    return `${formatPaise(v.discountValue)} off`;
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
                    {/* Was a hardcoded "₹15k+ Spend" shown to every customer. Fan
                        points are a number the server actually keeps. */}
                    <span className="text-[11px] font-extrabold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      {user.fanPoints.toLocaleString('en-IN')} Fan Points
                    </span>
                    <span className="text-xs font-semibold text-slate-400">@{user.phone.replace(/[^0-9]/g, '')}</span>
                  </div>
                  {user.favoriteTeam && (
                    <div className="text-[11px] font-bold text-slate-400 mt-1">{user.favoriteTeam}</div>
                  )}
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
                      maxLength={60}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">Favourite Team</label>
                    <select
                      value={favoriteTeam}
                      onChange={(e) => setFavoriteTeam(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">No team picked</option>
                      {IPL_TEAMS.map((team) => (
                        <option key={team} value={team}>
                          {team}
                        </option>
                      ))}
                    </select>
                  </div>

                  {saveError && (
                    <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">{saveError}</p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isSaving || name.trim().length < 2}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold py-2 rounded-xl text-xs shadow-green-sm flex items-center justify-center gap-1.5"
                    >
                      {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{isSaving ? 'Saving…' : 'Save Profile'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setSaveError(null);
                        setName(user.name);
                        setFavoriteTeam(user.favoriteTeam ?? '');
                      }}
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
                    maxLength={60}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white"
                  />
                  <textarea
                    rows={2}
                    placeholder="Full address — door number, street and area"
                    value={newAddrDetail}
                    onChange={(e) => setNewAddrDetail(e.target.value)}
                    maxLength={400}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white resize-none"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Landmark (optional)"
                      value={newAddrLandmark}
                      onChange={(e) => setNewAddrLandmark(e.target.value)}
                      maxLength={120}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Pincode"
                      value={newAddrPincode}
                      onChange={(e) => setNewAddrPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isSavingAddr}
                      className="flex-1 bg-emerald-500 disabled:opacity-50 text-white font-extrabold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5"
                    >
                      {isSavingAddr && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{isSavingAddr ? 'Saving…' : 'Save Address'}</span>
                    </button>
                    <button type="button" onClick={() => setShowAddAddr(false)} className="px-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2 rounded-xl text-xs">Cancel</button>
                  </div>
                </form>
              )}

              {addressError && (
                <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-2.5">
                  {addressError}
                </p>
              )}

              {isLoadingAddresses && (
                <div className="flex items-center justify-center gap-2 py-8 text-xs font-medium text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading your addresses…
                </div>
              )}

              {!isLoadingAddresses && addresses.length === 0 && !addressError && (
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                  No saved addresses yet. Add one and it will be offered at checkout.
                </div>
              )}

              <div className="space-y-2.5">
                {addresses.map((addr) => (
                  <div key={addr.id} className="p-3.5 rounded-2xl border bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 flex items-start justify-between">
                    <div className="space-y-1 pr-2 min-w-0">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate">{addr.label}</span>
                        {addr.isDefault && (
                          <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full shrink-0">Default</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium pl-6">{addr.detail}</p>
                      {(addr.landmark || addr.pincode) && (
                        <p className="text-[10px] text-slate-400 font-medium pl-6">
                          {[addr.landmark, addr.pincode].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {!addr.isDefault && (
                        <button
                          onClick={() => handleMakeDefault(addr.id)}
                          className="ml-6 text-[10px] font-bold text-emerald-600 hover:underline"
                        >
                          Make default
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteAddress(addr.id)}
                      aria-label={`Delete ${addr.label}`}
                      className="shrink-0 w-7 h-7 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
                    <div className="text-lg font-black">{formatPaise(user.walletBalancePaise)}</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (onNavigateTab) onNavigateTab('wallet');
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-green-sm"
                >
                  Top Up
                </button>
              </div>

              {/*
                This was a "Saved Methods" list with an invented UPI VPA marked
                "Linked" and a gateway marked "Active". The app stores no payment
                instruments — Razorpay holds those inside its own checkout — so
                what is honest to show is which methods checkout actually offers.
              */}
              <div className="space-y-2">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider px-1">Ways To Pay At Checkout</span>
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700 text-xs">
                  <div className="p-3.5 flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-slate-400 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">UPI, Cards & Netbanking</div>
                      <div className="text-[10px] text-slate-400 font-medium">Handled by Razorpay. Your card details never reach our servers.</div>
                    </div>
                  </div>

                  <div className="p-3.5 flex items-center gap-3">
                    <Wallet className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">Matchday Wallet</div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {user.walletBalancePaise > 0
                          ? `${formatPaise(user.walletBalancePaise)} available to spend now.`
                          : 'Top up first — an empty wallet cannot cover an order.'}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 flex items-center gap-3">
                    <Package className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">Cash On Delivery</div>
                      <div className="text-[10px] text-slate-400 font-medium">Pay the rider. Settled when your delivery OTP is confirmed.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* OFFERS & VOUCHERS SUB-VIEW */}
          {subView === 'vouchers' && (
            <div className="space-y-3">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider px-1">Available IPL Matchday Coupons</span>

              {voucherError && (
                <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-2.5">
                  {voucherError}
                </p>
              )}

              {isLoadingVouchers && (
                <div className="flex items-center justify-center gap-2 py-8 text-xs font-medium text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking which offers you can still use…
                </div>
              )}

              {!isLoadingVouchers && vouchers.length === 0 && !voucherError && (
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                  No offers running right now. New matchday coupons drop through the season.
                </div>
              )}

              {/*
                Was three hardcoded codes that matched no voucher row, so every
                one of them was rejected at checkout. The server returns only
                what this user can still redeem, caps and expiry included.
              */}
              {vouchers.map((v) => (
                <div key={v.code} className="p-3.5 rounded-2xl border bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-200/60 dark:bg-emerald-900/60 px-2 py-0.5 rounded-lg border border-emerald-300">
                        {v.code}
                      </span>
                      <span className="font-extrabold text-xs text-slate-900 dark:text-white">{describeDiscount(v)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{v.description}</p>
                    <div className="text-[10px] font-bold text-slate-400">
                      {v.minSubtotalPaise > 0 ? `Min order ${formatPaise(v.minSubtotalPaise)}` : 'No minimum order'}
                      {v.remainingForUser > 1 && ` · ${v.remainingForUser} uses left`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopyVoucher(v.code)}
                    className="shrink-0 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-green-sm flex items-center gap-1 active:scale-95 transition-all"
                  >
                    {copiedCode === v.code ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode === v.code ? 'Copied' : 'Copy'}</span>
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
