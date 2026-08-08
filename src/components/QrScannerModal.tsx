import React, { useState } from 'react';
import { QrCode, X, Camera, CheckCircle2, CreditCard, AlertTriangle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [permissionError, setPermissionError] = useState(false);
  const [invalidQrError, setInvalidQrError] = useState(false);

  if (!isOpen) return null;

  const handleScanQr = () => {
    setIsScanning(true);
    setScannedPayment(null);
    setPermissionError(false);
    setInvalidQrError(false);

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
      <div
        className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-scanner-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 text-slate-900 dark:text-white space-y-4 shadow-2xl relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-500 flex items-center justify-center">
                <QrCode className="w-4 h-4" />
              </div>
              <h3 id="qr-scanner-title" className="font-black text-slate-900 dark:text-white text-sm">Scan & Pay QR</h3>
            </div>
            <button
              onClick={() => {
                setScannedPayment(null);
                setPermissionError(false);
                setInvalidQrError(false);
                onClose();
              }}
              aria-label="Close UPI QR Scanner"
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Camera Viewfinder Simulation */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 text-white h-56 flex flex-col items-center justify-center p-4 border-2 border-emerald-500/50 shadow-inner">
            {/* Corner Guides */}
            <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-emerald-500" />
            <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-emerald-500" />
            <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-emerald-500" />
            <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-emerald-500" />

            {/* Laser Line Animation */}
            {isScanning && (
              <div className="absolute left-4 right-4 h-0.5 bg-emerald-500 shadow-green-glow animate-pulse" style={{ top: '50%' }} />
            )}

            {permissionError ? (
              <div className="text-center space-y-2 p-3 text-rose-300">
                <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
                <div className="text-xs font-bold">Camera Access Permission Denied</div>
                <button
                  onClick={() => setPermissionError(false)}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold rounded-lg"
                >
                  Grant Camera Permission
                </button>
              </div>
            ) : (
              <div className="text-center space-y-1.5 z-10">
                <Camera className="w-8 h-8 text-emerald-400 mx-auto animate-bounce" />
                <div className="text-xs font-extrabold text-white">Scan any UPI / Merchant QR Code</div>
                <p className="text-[10px] text-slate-400">Supports GPay, PhonePe, Paytm & BharatPe</p>
              </div>
            )}
          </div>

          {/* Simulated Error Toggles */}
          <div className="flex gap-2 text-[10px] text-slate-400">
            <button onClick={() => setPermissionError(!permissionError)} className="hover:underline">
              [Simulate Cam Error]
            </button>
            <span>•</span>
            <button onClick={() => setInvalidQrError(!invalidQrError)} className="hover:underline">
              [Simulate Invalid QR]
            </button>
          </div>

          {invalidQrError && (
            <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-2xl p-3 text-xs text-rose-800 dark:text-rose-200 font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>Invalid or unreadable QR code scanned. Please retry.</span>
            </div>
          )}

          {/* Scanned Payment Summary Banner */}
          {scannedPayment && !invalidQrError ? (
            <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-900 dark:text-white">{scannedPayment.merchant}</span>
                <span className="text-[10px] font-mono text-emerald-600 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  {scannedPayment.upiId}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Amount to Pay</span>
                <span className="text-lg font-black text-emerald-600">₹{scannedPayment.amount}</span>
              </div>
            </div>
          ) : (
            <button
              onClick={handleScanQr}
              disabled={isScanning}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3 rounded-full text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>{isScanning ? 'Scanning UPI QR...' : 'Simulate Scanning Merchant QR'}</span>
            </button>
          )}

          {/* Confirm Payment Button */}
          {scannedPayment && !invalidQrError && (
            <button
              onClick={handleConfirmPayment}
              disabled={isPaying}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-3 rounded-full shadow-green-sm text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5"
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
