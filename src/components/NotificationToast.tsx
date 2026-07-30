import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { Bell, X, CheckCircle2, AlertCircle, ShoppingBag, Wallet, Calendar } from 'lucide-react';

export const NotificationToast: React.FC = () => {
  const { toast, clearToast } = useApp();

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        clearToast();
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [toast, clearToast]);

  if (!toast) return null;

  const getIcon = () => {
    switch (toast.type) {
      case 'booking':
        return <Calendar className="w-5 h-5 text-amber-500" />;
      case 'food':
        return <ShoppingBag className="w-5 h-5 text-orange-500" />;
      case 'wallet':
        return <Wallet className="w-5 h-5 text-emerald-500" />;
      default:
        return <CheckCircle2 className="w-5 h-5 text-indigo-500" />;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -30, scale: 0.9 }}
        className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-2xl border border-amber-500/30 backdrop-blur-md flex items-start gap-3"
      >
        <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 shrink-0">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-amber-400 truncate">{toast.title}</h4>
            <span className="text-[10px] text-slate-400 shrink-0 ml-1">Push Alert</span>
          </div>
          <p className="text-xs text-slate-200 mt-0.5 leading-snug">{toast.message}</p>
        </div>
        <button
          onClick={clearToast}
          className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
