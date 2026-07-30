import React, { useState } from 'react';
import { ShieldCheck, CreditCard, Smartphone, Wallet, CheckCircle2, Lock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  onPaymentSuccess: (method: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  amount,
  onPaymentSuccess,
}) => {
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
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white space-y-4 shadow-2xl relative"
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Razorpay Secure Checkout</h3>
              <p className="text-[10px] text-slate-400">256-Bit Encrypted Payment Gateway</p>
            </div>
          </div>

          {/* Payable Amount Box */}
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">Total Amount Payable:</span>
            <span className="text-lg font-black text-amber-400">₹{amount}</span>
          </div>

          {/* Payment Methods */}
          <div className="space-y-2 text-xs">
            <span className="font-bold text-slate-300 block">Select Payment Method:</span>

            <button
              onClick={() => setSelectedMethod('gpay')}
              className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all ${
                selectedMethod === 'gpay'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>Google Pay / UPI</span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">INSTANT</span>
            </button>

            <button
              onClick={() => setSelectedMethod('phonepe')}
              className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all ${
                selectedMethod === 'phonepe'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-purple-400" />
                <span>PhonePe / Paytm</span>
              </div>
              <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-bold">UPI</span>
            </button>

            <button
              onClick={() => setSelectedMethod('card')}
              className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all ${
                selectedMethod === 'card'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-4 h-4 text-blue-400" />
                <span>Credit / Debit Card</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">VISA / Mastercard</span>
            </button>

            <button
              onClick={() => setSelectedMethod('cod')}
              className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all ${
                selectedMethod === 'cod'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Wallet className="w-4 h-4 text-amber-400" />
                <span>Pay at Turf / Cash on Delivery</span>
              </div>
              <span className="text-[10px] text-amber-400 font-bold">CASH</span>
            </button>
          </div>

          {/* Pay Button */}
          <button
            onClick={handlePay}
            disabled={isProcessing}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-extrabold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 active:scale-95 transition-all"
          >
            {isProcessing ? (
              <span>Authorizing Payment...</span>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Pay ₹{amount} Securely</span>
              </>
            )}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
