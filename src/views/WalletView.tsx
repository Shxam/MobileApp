import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MOCK_FAN_REWARDS } from '../data/mockData';
import { FanReward } from '../types';
import {
  Wallet,
  Plus,
  Award,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  QrCode,
  CheckCircle2,
  X,
  CreditCard,
  History,
  Gift,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const WalletView: React.FC = () => {
  const { user, transactions, topUpWallet, updateUser, addNotification, language } = useApp();

  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState<number>(500);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'razorpay'>('upi');
  const [upiApp, setUpiApp] = useState<'gpay' | 'phonepe' | 'paytm'>('gpay');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedReward, setSelectedReward] = useState<FanReward | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  const handleConfirmTopup = () => {
    setIsProcessing(true);
    setTimeout(() => {
      topUpWallet(topupAmount, paymentMethod === 'upi' ? `UPI (${upiApp.toUpperCase()})` : 'Razorpay Card');
      setIsProcessing(false);
      setShowTopupModal(false);
    }, 1200);
  };

  const handleRedeemReward = (reward: FanReward) => {
    if (user.fanPoints < reward.pointsRequired) {
      addNotification('⚠️ Need More Fan Points', `Earn ${reward.pointsRequired - user.fanPoints} more points by playing turfs & ordering food!`, 'reward');
      return;
    }

    // Deduct Points
    updateUser({ fanPoints: user.fanPoints - reward.pointsRequired });

    if (reward.rewardType === 'wallet_cash' && reward.discountAmount) {
      topUpWallet(reward.discountAmount, 'Fan Reward Cashback');
    }

    addNotification(
      '🎁 Reward Redeemed!',
      `Voucher Code: ${reward.code} generated. Saved to your profile.`,
      'reward'
    );
    setSelectedReward(null);
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (filterType === 'all') return true;
    return tx.category === filterType;
  });

  return (
    <div className="space-y-5 p-3 pb-8">
      {/* Wallet Balance Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-tr from-emerald-950 via-slate-900 to-slate-950 border border-emerald-500/40 p-4 text-white shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                IPL Dhaba Wallet
              </span>
              <span className="text-[11px] text-emerald-400 font-semibold">Closed-Loop In-App Credit</span>
            </div>
          </div>

          <button
            onClick={() => setShowTopupModal(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Top-Up</span>
          </button>
        </div>

        <div className="pt-1">
          <span className="text-xs text-slate-400 block">Available Cash Balance</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-3xl font-black text-emerald-400">₹{user.walletBalance.toLocaleString()}</span>
            <span className="text-xs text-slate-400">INR</span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-amber-400">
            <Award className="w-4 h-4" />
            <span className="font-bold">{user.fanPoints} Fan Loyalty Points</span>
          </div>
          <span className="text-[10px] text-slate-400">Earn 10% Pts on Top-Up</span>
        </div>
      </div>

      {/* Fan Loyalty Rewards Store */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-amber-400 flex items-center gap-1.5">
            <Gift className="w-4 h-4" />
            <span>{language === 'en' ? 'Fan Rewards Catalog' : 'प्रशंसक पुरस्कार स्टोर'}</span>
          </h3>
          <span className="text-[11px] text-slate-400 font-bold">{user.fanPoints} Points Available</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {MOCK_FAN_REWARDS.map((reward) => (
            <div
              key={reward.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 flex flex-col justify-between shadow-md"
            >
              <div>
                <div className="relative h-20 w-full rounded-xl overflow-hidden mb-2">
                  <img src={reward.image} alt={reward.titleEn} className="w-full h-full object-cover" />
                  <span className="absolute top-1 right-1 bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded shadow">
                    {reward.pointsRequired} Pts
                  </span>
                </div>
                <h4 className="font-bold text-xs text-white line-clamp-1">
                  {language === 'en' ? reward.titleEn : reward.titleHi}
                </h4>
                <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">
                  {language === 'en' ? reward.descriptionEn : reward.descriptionHi}
                </p>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[10px] font-mono text-amber-300 font-bold">{reward.code}</span>
                <button
                  onClick={() => setSelectedReward(reward)}
                  className="bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500 hover:text-slate-950 text-amber-300 font-extrabold px-2 py-1 rounded-lg text-[10px] transition-colors"
                >
                  Redeem
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
            <History className="w-4 h-4 text-slate-400" />
            <span>{language === 'en' ? 'Transaction Log' : 'लेन-देन इतिहास'}</span>
          </h3>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 text-[11px]">
          {['all', 'topup', 'booking', 'food', 'celebration'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterType(cat)}
              className={`px-2.5 py-1 rounded-xl font-bold capitalize whitespace-nowrap border ${
                filterType === cat
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {filteredTransactions.map((tx) => (
            <div
              key={tx.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                    tx.type === 'credit'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : 'bg-red-500/20 border-red-500/40 text-red-400'
                  }`}
                >
                  {tx.type === 'credit' ? (
                    <ArrowDownLeft className="w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-white truncate">{tx.title}</h4>
                  <p className="text-[10px] text-slate-400 font-mono">{tx.timestamp}</p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span
                  className={`font-black text-sm block ${
                    tx.type === 'credit' ? 'text-emerald-400' : 'text-slate-200'
                  }`}
                >
                  {tx.type === 'credit' ? '+' : '-'}₹{tx.amount}
                </span>
                <span className="text-[9px] text-slate-500 font-mono">Ref: {tx.referenceId}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Topup Modal */}
      <AnimatePresence>
        {showTopupModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full max-w-lg bg-slate-900 border border-emerald-500/30 rounded-t-3xl sm:rounded-3xl p-4 text-white space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-extrabold text-sm text-white">Top-Up IPL Dhaba Wallet</h3>
                </div>
                <button
                  onClick={() => setShowTopupModal(false)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Preset Chips */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Select Top-Up Amount:
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[200, 500, 1000, 2000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setTopupAmount(amt)}
                        className={`p-2.5 rounded-xl border font-black text-xs transition-all ${
                          topupAmount === amt
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Amount */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Custom Amount (INR):
                  </label>
                  <input
                    type="number"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-emerald-400"
                  />
                </div>

                {/* Payment Gateway Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Select Gateway:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPaymentMethod('upi')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 ${
                        paymentMethod === 'upi'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Instant UPI / QR</span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod('razorpay')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 ${
                        paymentMethod === 'razorpay'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Razorpay SDK</span>
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>You Pay:</span>
                    <span className="font-bold text-white">₹{topupAmount}</span>
                  </div>
                  <div className="flex justify-between text-amber-400 font-bold">
                    <span>Bonus Fan Points Earned:</span>
                    <span>+{Math.floor(topupAmount * 0.1)} Pts</span>
                  </div>
                </div>

                <button
                  onClick={handleConfirmTopup}
                  disabled={isProcessing}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
                >
                  {isProcessing ? (
                    <span>Processing Payment via Gateway...</span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Add ₹{topupAmount} to Wallet</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Redeem Confirmation Modal */}
      <AnimatePresence>
        {selectedReward && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-3xl p-5 text-white space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500 mx-auto flex items-center justify-center">
                <Gift className="w-6 h-6" />
              </div>

              <div>
                <h3 className="font-extrabold text-sm text-amber-400">{selectedReward.titleEn}</h3>
                <p className="text-xs text-slate-300 mt-1">{selectedReward.descriptionEn}</p>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs flex justify-between items-center">
                <span className="text-slate-400">Points Cost:</span>
                <span className="font-black text-amber-400">{selectedReward.pointsRequired} Fan Points</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedReward(null)}
                  className="w-1/2 bg-slate-800 text-slate-300 font-bold py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRedeemReward(selectedReward)}
                  className="w-1/2 bg-amber-500 text-slate-950 font-black py-2.5 rounded-xl text-xs"
                >
                  Confirm Redeem
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
