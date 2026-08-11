import React, { useMemo, useState } from 'react';
import { ShieldCheck, Smartphone, Wallet, Banknote, Lock, X, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PaymentMethod } from '../types';
import { formatPaise } from '../types';

/**
 * Payment method selection.
 *
 * This modal no longer *takes* a payment — it chooses how one will be taken.
 * The version it replaces ran `setTimeout(…, 1200)` under a "256-Bit Encrypted
 * Payment Gateway" heading and then called `onPaymentSuccess`, so every order in
 * the app was treated as paid without a rupee moving. Card and UPI now both mean
 * "Razorpay", because Razorpay Checkout is what presents those options, and the
 * app has no business collecting card details itself.
 */
interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The amount to be charged, in paise, as quoted by the server. */
  amountPaise: number;
  /** Current wallet balance in paise; used to disable the wallet option. */
  walletBalancePaise: number;
  /**
   * Runs the real payment. Resolves when the server confirms; rejects with a
   * message worth showing. The modal stays open and shows the error on failure.
   */
  onConfirm: (method: PaymentMethod) => Promise<void>;
  /** Wallet and COD are unavailable for some flows; omit to allow all three. */
  allowedMethods?: PaymentMethod[];
}

const METHOD_COPY: Record<PaymentMethod, { title: string; caption: string; badge: string }> = {
  razorpay: {
    title: 'UPI, Card or Netbanking',
    caption: 'Secure checkout by Razorpay',
    badge: 'INSTANT',
  },
  wallet: {
    title: 'IPL Dhaba Wallet',
    caption: 'Debited the moment the order is placed',
    badge: 'FASTEST',
  },
  cod: {
    title: 'Cash on Delivery / Pay at Turf',
    caption: 'Pay the rider or at the counter',
    badge: 'CASH',
  },
};

const METHOD_ICON: Record<PaymentMethod, React.ComponentType<{ className?: string }>> = {
  razorpay: Smartphone,
  wallet: Wallet,
  cod: Banknote,
};

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  amountPaise,
  walletBalancePaise,
  onConfirm,
  allowedMethods = ['razorpay', 'wallet', 'cod'],
}) => {
  const walletCovers = walletBalancePaise >= amountPaise;

  /**
   * The default is the first method that can actually pay. Defaulting to the
   * wallet when it is short of the total puts the customer one tap from a
   * rejection they cannot see coming.
   */
  const defaultMethod = useMemo<PaymentMethod>(() => {
    if (allowedMethods.includes('wallet') && walletCovers) return 'wallet';
    if (allowedMethods.includes('razorpay')) return 'razorpay';
    return allowedMethods[0] ?? 'cod';
  }, [allowedMethods, walletCovers]);

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(defaultMethod);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const walletDisabled = selectedMethod === 'wallet' && !walletCovers;

  const handlePay = async () => {
    if (walletDisabled) return;
    setIsProcessing(true);
    setError(null);
    try {
      await onConfirm(selectedMethod);
    } catch (err) {
      // The modal deliberately stays open: the customer needs to be able to pick
      // a different method without rebuilding their cart.
      setError(err instanceof Error ? err.message : 'The payment could not be completed.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 text-slate-900 dark:text-white space-y-4 shadow-2xl relative"
        >
          <button
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Close checkout"
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 id="payment-modal-title" className="font-extrabold text-sm text-slate-900 dark:text-white">
                Choose how to pay
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Card and UPI are handled by Razorpay
              </p>
            </div>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 p-3.5 rounded-2xl flex justify-between items-center text-xs">
            <span className="text-slate-700 dark:text-slate-200 font-bold">Total payable</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {formatPaise(amountPaise)}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <span className="font-extrabold text-slate-900 dark:text-white block uppercase tracking-wider text-[11px]">
              Payment method
            </span>

            {allowedMethods.map((method) => {
              const Icon = METHOD_ICON[method];
              const copy = METHOD_COPY[method];
              const isSelected = selectedMethod === method;
              const isShort = method === 'wallet' && !walletCovers;

              return (
                <button
                  key={method}
                  onClick={() => setSelectedMethod(method)}
                  disabled={isProcessing}
                  className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all text-left disabled:opacity-60 ${
                    isSelected
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-green-sm font-bold'
                      : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-emerald-500'}`} />
                    <div>
                      <div>{copy.title}</div>
                      <div className={`text-[10px] font-medium ${isSelected ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                        {method === 'wallet'
                          ? `Balance ${formatPaise(walletBalancePaise)}${isShort ? ' — not enough' : ''}`
                          : copy.caption}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold shrink-0 ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {copy.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {error && (
            <p
              role="alert"
              className="text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-xl px-3 py-2 flex items-start gap-1.5"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {error}
            </p>
          )}

          <button
            onClick={() => void handlePay()}
            disabled={isProcessing || walletDisabled}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-3.5 rounded-full text-xs flex items-center justify-center gap-2 shadow-green-sm active:scale-95 transition-all mt-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{selectedMethod === 'razorpay' ? 'Opening Razorpay…' : 'Placing your order…'}</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>
                  {selectedMethod === 'cod'
                    ? `Place order · ${formatPaise(amountPaise)} on delivery`
                    : `Pay ${formatPaise(amountPaise)}`}
                </span>
              </>
            )}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
