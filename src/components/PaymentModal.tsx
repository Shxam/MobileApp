import React, { useState } from 'react';
import { ShieldCheck, CreditCard, Smartphone, Wallet, CheckCircle2, Lock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount?: number;
  amount?: number;
  onPaymentSuccess: (method?: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  totalAmount,
  amount,
  onPaymentSuccess,
}) => {
  const displayAmount = totalAmount ?? amount ?? 0;
  const [selectedMethod, setSelectedMethod] = useState<'gpay' | 'phonepe' | 'paytm' | 'card' | 'cod'>('gpay');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handlePay = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onPaymentSuccess(selectedMethod.toUpperCase());
      onClose();
    }, 1200);
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
          {/* Close Button */}
          <button
            onClick={onClose}
            aria-label="Close Checkout Modal"
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Razorpay Secure Checkout</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">256-Bit Encrypted Payment Gateway</p>
            </div>
          </div>

          {/* Payable Amount Banner */}
          <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 p-3.5 rounded-2xl flex justify-between items-center text-xs">
            <span className="text-slate-700 dark:text-slate-200 font-bold">Total Amount Payable:</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">₹{displayAmount}</span>
          </div>

          {/* Payment Methods Options */}
          <div className="space-y-2 text-xs">
            <span className="font-extrabold text-slate-900 dark:text-white block uppercase tracking-wider text-[11px]">Select Payment Method</span>

            {/* Google Pay / UPI */}
            <button
              onClick={() => setSelectedMethod('gpay')}
              className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all ${
                selectedMethod === 'gpay'
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-green-sm font-bold scale-[1.01]'
                  : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Smartphone className={`w-4 h-4 ${selectedMethod === 'gpay' ? 'text-white' : 'text-emerald-500'}`} />
                <span>Google Pay / UPI</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${selectedMethod === 'gpay' ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'}`}>
                INSTANT
              </span>
            </button>

            {/* PhonePe / Paytm */}
            <button
              onClick={() => setSelectedMethod('phonepe')}
              className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all ${
                selectedMethod === 'phonepe'
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-green-sm font-bold scale-[1.01]'
                  : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Smartphone className={`w-4 h-4 ${selectedMethod === 'phonepe' ? 'text-white' : 'text-purple-500'}`} />
                <span>PhonePe / Paytm</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${selectedMethod === 'phonepe' ? 'bg-white/20 text-white' : 'bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400'}`}>
                UPI
              </span>
            </button>

            {/* Credit / Debit Card */}
            <button
              onClick={() => setSelectedMethod('card')}
              className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all ${
                selectedMethod === 'card'
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-green-sm font-bold scale-[1.01]'
                  : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CreditCard className={`w-4 h-4 ${selectedMethod === 'card' ? 'text-white' : 'text-blue-500'}`} />
                <span>Credit / Debit Card</span>
              </div>
              <span className={`text-[10px] font-mono ${selectedMethod === 'card' ? 'text-white/90' : 'text-slate-400'}`}>
                VISA / Mastercard
              </span>
            </button>

            {/* Cash on Delivery / Pay at Turf */}
            <button
              onClick={() => setSelectedMethod('cod')}
              className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all ${
                selectedMethod === 'cod'
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-green-sm font-bold scale-[1.01]'
                  : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Wallet className={`w-4 h-4 ${selectedMethod === 'cod' ? 'text-white' : 'text-amber-500'}`} />
                <span>Pay at Turf / Cash on Delivery</span>
              </div>
              <span className={`text-[10px] font-bold ${selectedMethod === 'cod' ? 'text-white' : 'text-amber-500'}`}>
                CASH
              </span>
            </button>
          </div>

          {/* Secure Pay Button */}
          <button
            onClick={handlePay}
            disabled={isProcessing}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-3.5 rounded-full text-xs flex items-center justify-center gap-2 shadow-green-sm active:scale-95 transition-all mt-2"
          >
            {isProcessing ? (
              <span>Authorizing Payment...</span>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Pay ₹{displayAmount} Securely</span>
              </>
            )}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
