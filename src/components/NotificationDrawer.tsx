import React from 'react';
import { useApp } from '../context/AppContext';
import { Bell, X, CheckCheck, Calendar, Utensils, Wallet, Award, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose }) => {
  const { notifications, markNotificationsRead } = useApp();

  if (!isOpen) return null;

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'booking':
        return <Calendar className="w-4 h-4 text-emerald-500" />;
      case 'food':
        return <Utensils className="w-4 h-4 text-rose-500" />;
      case 'wallet':
        return <Wallet className="w-4 h-4 text-amber-500" />;
      default:
        return <Award className="w-4 h-4 text-purple-500" />;
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex justify-end">
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-full max-w-sm bg-white border-l border-slate-200 h-full p-4 flex flex-col text-slate-900 shadow-2xl relative"
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-rose-500" />
              <h3 className="font-extrabold text-sm text-slate-900">Notifications</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={markNotificationsRead}
                className="text-[10px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200"
              >
                <CheckCheck className="w-3 h-3" />
                <span>Mark Read</span>
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {notifications.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <Bell className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-500">No new notifications</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 rounded-2xl border transition-all ${
                    n.read
                      ? 'bg-slate-50 border-slate-200/60 opacity-80'
                      : 'bg-white border-rose-200 shadow-xs ring-1 ring-rose-500/10'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 rounded-xl bg-slate-100 shrink-0 mt-0.5">
                      {getNotifIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <h4 className="font-extrabold text-xs text-slate-900 truncate">{n.title}</h4>
                        <span className="text-[9px] text-slate-400 font-medium">{n.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-snug">{n.message}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
