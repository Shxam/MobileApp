import React, { useState } from 'react';
import { QrCode, X, Camera, CheckCircle2, CreditCard, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({ isOpen, onClose, onNavigateTab }) => {
  const { addNotification, topUpWallet } = useApp();
  const [scannedPayment, setScannedPayment] = useState<{ merchant: string; upiId: string; amount: number } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  if (!isOpen) return null;

  const handleScanQr = () => {
    setIsScanning(true);
    setScannedPayment(null);

    setTimeout(() => {
      setIsScanning(false);
      setScannedPayment({
        merchant: 'IPL Dhaba Singarayakonda Merchant',
        upiId: 'ipldhaba@upi',
        amount: 350,
      });
      addNotification('💳 UPI Payment QR Scanned!', 'Scan & Pay QR detected for IPL Dhaba.', 'wallet');
    }, 1200);
  };

  const handleConfirmPayment = () => {
    if (!scannedPayment) return;
    setIsPaying(true);

    setTimeout(() => {
      setIsPaying(false);
      topUpWallet(scannedPayment.amount, 'UPI QR Scan Payment');
      addNotification('✅ Payment Successful!', `Paid ₹${scannedPayment.amount} via Scan & Pay.`, 'wallet');
      setScannedPayment(null);
      onClose();
    }, 1000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="w-full max-w-sm bg-white rounded-3xl p-5 text-slate-900 space-y-4 shadow-2xl relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center">
                <QrCode className="w-4 h-4" />
              </div>
              <h3 className="font-black text-slate-900 text-sm">Scan & Pay QR</h3>
            </div>
            <button
              onClick={() => {
                setScannedPayment(null);
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Camera Viewfinder Simulation */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 text-white h-56 flex flex-col items-center justify-center p-4 border-2 border-rose-500/50 shadow-inner">
            {/* Corner Guides */}
            <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-rose-500" />
            <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-rose-500" />
            <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-rose-500" />
            <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-rose-500" />

            {/* Laser Line Animation */}
            {isScanning && (
              <div className="absolute left-4 right-4 h-0.5 bg-rose-500 shadow-pink-glow animate-pulse" style={{ top: '50%' }} />
            )}

            <div className="text-center space-y-1.5 z-10">
              <Camera className="w-8 h-8 text-rose-400 mx-auto animate-bounce" />
              <div className="text-xs font-extrabold text-white">Scan any UPI / Merchant QR Code</div>
              <p className="text-[10px] text-slate-400">Supports GPay, PhonePe, Paytm & BharatPe</p>
            </div>
          </div>

          {/* Scanned Payment Summary Banner */}
          {scannedPayment ? (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-900">{scannedPayment.merchant}</span>
                <span className="text-[10px] font-mono text-rose-600 bg-white px-2 py-0.5 rounded-full border border-rose-200">
                  {scannedPayment.upiId}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-rose-200/60">
                <span className="text-xs font-bold text-slate-700">Amount to Pay</span>
                <span className="text-lg font-black text-rose-600">₹{scannedPayment.amount}</span>
              </div>
            </div>
          ) : (
            <button
              onClick={handleScanQr}
              disabled={isScanning}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3 rounded-full text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4 text-rose-400" />
              <span>{isScanning ? 'Scanning UPI QR...' : 'Simulate Scanning Merchant QR'}</span>
            </button>
          )}

          {/* Confirm Payment Button */}
          {scannedPayment && (
            <button
              onClick={handleConfirmPayment}
              disabled={isPaying}
              className="w-full bg-rose-500 hover:bg-rose-600 text-white font-extrabold py-3 rounded-full shadow-pink-sm text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isPaying ? 'Processing UPI Payment...' : `Pay ₹${scannedPayment.amount} Now`}</span>
            </button>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
