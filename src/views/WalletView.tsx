import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatPaise } from '../types';
import type { WalletTransactionView } from '../services/apiClient';
import {
  Wallet,
  Plus,
  Award,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  History,
  ShieldCheck,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * The wallet.
 *
 * Every number here is the server's. The version this replaces read
 * `user.walletBalance` (a field that does not exist, so it rendered `undefined`),
 * listed transactions from a `transactions` array that was never on the context,
 * and offered a catalogue of `MOCK_FAN_REWARDS` whose "Redeem" button awarded
 * itself points by calling `updateUser({ fanPoints: ... })` — a client-side edit
 * of a server-owned balance. Fan points are shown because the wallet endpoint
 * reports them; there is no redemption catalogue because no endpoint backs one.
 */

/** The categories `wallet.service.ts` actually writes. */
const CATEGORY_FILTERS = ['all', 'topup', 'order', 'booking', 'celebration', 'refund'] as const;

const CATEGORY_LABEL: Record<string, string> = {
  all: 'All',
  topup: 'Top-ups',
  order: 'Food',
  booking: 'Turf',
  celebration: 'Parties',
  refund: 'Refunds',
};

/** Credits move money in; only `deduct` takes it out. */
const isCredit = (tx: WalletTransactionView) => tx.type !== 'deduct';

const PRESET_RUPEES = [200, 500, 1000, 2000];
const MIN_TOPUP_RUPEES = 10;
const MAX_TOPUP_RUPEES = 50_000;

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });

export const WalletView: React.FC = () => {
  const { user, wallet, refreshWallet, topUpWallet, language } = useApp();

  const [showTopupModal, setShowTopupModal] = useState(false);
  const [rupees, setRupees] = useState<number>(500);
  const [isProcessing, setIsProcessing] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [loadError, setLoadError] = useState<string | null>(null);

  // The provider loads the wallet at sign-in; this covers a direct navigation to
  // the tab and a stale balance after a payment made elsewhere in the app.
  useEffect(() => {
    if (!user.isLoggedIn) return;
    refreshWallet().catch((err) =>
      setLoadError(err instanceof Error ? err.message : 'Could not load your wallet.'),
    );
  }, [user.isLoggedIn, refreshWallet]);

  const transactions = wallet?.transactions ?? [];

  const filteredTransactions = useMemo(
    () => (filter === 'all' ? transactions : transactions.filter((tx) => tx.category === filter)),
    [transactions, filter],
  );

  const amountValid = rupees >= MIN_TOPUP_RUPEES && rupees <= MAX_TOPUP_RUPEES;

  const handleConfirmTopup = async () => {
    if (!amountValid) return;
    setIsProcessing(true);
    setTopupError(null);
    try {
      // Opens Razorpay Checkout and resolves only once the server has verified
      // the signature and credited the ledger. No timer, no optimistic balance.
      await topUpWallet(rupees * 100);
      setShowTopupModal(false);
    } catch (err) {
      setTopupError(err instanceof Error ? err.message : 'The top-up could not be completed.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!user.isLoggedIn) {
    return (
      <div className="p-8 text-center space-y-2">
        <Wallet className="w-8 h-8 text-emerald-500 mx-auto" />
        <p className="text-sm font-bold text-slate-900 dark:text-white">Sign in to see your wallet</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Your balance, fan points and every transaction live on your account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-3 pb-8">
      {/* Balance */}
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
              <span className="text-[11px] text-emerald-400 font-semibold">Closed-loop in-app credit</span>
            </div>
          </div>

          <button
            onClick={() => {
              setTopupError(null);
              setShowTopupModal(true);
            }}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Top up</span>
          </button>
        </div>

        <div className="pt-1">
          <span className="text-xs text-slate-400 block">Available balance</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-3xl font-black text-emerald-400">
              {formatPaise(wallet?.balancePaise ?? user.walletBalancePaise)}
            </span>
            <span className="text-xs text-slate-400">INR</span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-amber-400">
            <Award className="w-4 h-4" />
            <span className="font-bold">
              {(wallet?.fanPoints ?? user.fanPoints).toLocaleString('en-IN')} fan points
            </span>
          </div>
          <span className="text-[10px] text-slate-400">Earned on completed orders</span>
        </div>
      </div>

      {loadError && (
        <p className="text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-xl px-3 py-2 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {loadError}
        </p>
      )}

      {/* Ledger */}
      <div className="space-y-3">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
          <History className="w-4 h-4 text-slate-400" />
          <span>{language === 'en' ? 'Transaction log' : 'लेन-देन इतिहास'}</span>
        </h3>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 text-[11px]">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-2.5 py-1 rounded-xl font-bold whitespace-nowrap border transition-colors ${
                filter === cat
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-300'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              {CATEGORY_LABEL[cat]}
            </button>
          ))}
        </div>

        {filteredTransactions.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-6 text-center font-medium">
            {transactions.length === 0
              ? 'No wallet activity yet. Top up to get started.'
              : 'Nothing in this category.'}
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {filteredTransactions.map((tx) => {
              const credit = isCredit(tx);
              return (
                <div
                  key={tx.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                        credit
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500'
                          : 'bg-rose-500/10 border-rose-500/40 text-rose-500'
                      }`}
                    >
                      {credit ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 dark:text-white truncate">
                        {tx.description}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        {formatWhen(tx.createdAt)} · {CATEGORY_LABEL[tx.category] ?? tx.category}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-2">
                    <span
                      className={`font-black text-sm block ${
                        credit ? 'text-emerald-500' : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {credit ? '+' : '−'}
                      {formatPaise(tx.amountPaise)}
                    </span>
                    {/* The running balance is only meaningful when the server
                        recorded one; older rows may not carry it. */}
                    {tx.balanceAfterPaise !== null && (
                      <span className="text-[9px] text-slate-400 font-medium">
                        Balance {formatPaise(tx.balanceAfterPaise)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Top-up */}
      <AnimatePresence>
        {showTopupModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-emerald-500/30 rounded-t-3xl sm:rounded-3xl p-4 text-slate-900 dark:text-white space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-extrabold text-sm">Top up your wallet</h3>
                </div>
                <button
                  onClick={() => setShowTopupModal(false)}
                  disabled={isProcessing}
                  aria-label="Close top-up"
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                    Amount
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_RUPEES.map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setRupees(amt)}
                        disabled={isProcessing}
                        className={`p-2.5 rounded-xl border font-black text-xs transition-all disabled:opacity-60 ${
                          rupees === amt
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-300 shadow-md'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="topup-amount"
                    className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1"
                  >
                    Or enter an amount (₹{MIN_TOPUP_RUPEES}–₹{MAX_TOPUP_RUPEES.toLocaleString('en-IN')})
                  </label>
                  <input
                    id="topup-amount"
                    type="number"
                    inputMode="numeric"
                    min={MIN_TOPUP_RUPEES}
                    max={MAX_TOPUP_RUPEES}
                    value={rupees}
                    disabled={isProcessing}
                    onChange={(e) => setRupees(Math.floor(Number(e.target.value) || 0))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 disabled:opacity-60"
                  />
                  {!amountValid && (
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                      Enter between ₹{MIN_TOPUP_RUPEES} and ₹{MAX_TOPUP_RUPEES.toLocaleString('en-IN')}.
                    </p>
                  )}
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>You pay</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formatPaise(Math.max(rupees, 0) * 100)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Credited to wallet</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatPaise(Math.max(rupees, 0) * 100)}
                    </span>
                  </div>
                </div>

                {topupError && (
                  <p
                    role="alert"
                    className="text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-xl px-3 py-2 flex items-start gap-1.5"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {topupError}
                  </p>
                )}

                <button
                  onClick={() => void handleConfirmTopup()}
                  disabled={isProcessing || !amountValid}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Opening Razorpay…</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Add {formatPaise(Math.max(rupees, 0) * 100)}</span>
                    </>
                  )}
                </button>

                <p className="text-[10px] text-slate-400 text-center font-medium">
                  Your balance updates once Razorpay confirms the payment.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
