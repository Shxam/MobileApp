import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Globe,
  Smartphone,
  Maximize2,
  Bell,
  User,
  MapPin,
  ChevronDown,
  Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HeaderBarProps {
  onOpenProfile: () => void;
  onOpenNotifications?: () => void;
  onOpenSearch?: () => void;
  activeTab: string;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({ onOpenProfile, onOpenNotifications, onOpenSearch, activeTab }) => {
  const {
    user,
    language,
    setLanguage,
    isPhoneFrame,
    setIsPhoneFrame,
    notifications,
    markNotificationsRead,
    setIsAuthModalOpen,
  } = useApp();

  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotifClick = () => {
    if (onOpenNotifications) {
      onOpenNotifications();
    } else {
      setShowNotifDropdown(!showNotifDropdown);
    }
    markNotificationsRead();
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 border-b border-slate-100 backdrop-blur-md px-4 py-3 text-slate-800 flex items-center justify-between shadow-xs">
      
      {/* 1. Left: Profile Avatar & Location Dropdown (Matching UI Screenshot) */}
      <div className="flex items-center gap-3">
        <button
          onClick={user.isLoggedIn ? onOpenProfile : () => setIsAuthModalOpen(true)}
          className="w-10 h-10 rounded-full border-2 border-rose-100 overflow-hidden shrink-0 bg-slate-100 flex items-center justify-center shadow-xs hover:border-rose-500 transition-all"
        >
          {user.isLoggedIn && user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-5 h-5 text-rose-500" />
          )}
        </button>

        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Location</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </div>
          <span className="text-xs font-bold text-slate-900 truncate max-w-[130px]">
            Singarayakonda, AP
          </span>
        </div>
      </div>

      {/* 2. Right: Action Buttons (Search & Notifications - Matching UI Screenshot) */}
      <div className="flex items-center gap-2">

        {/* Search Icon Button */}
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            className="w-9 h-9 rounded-full bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200/60 text-slate-700 flex items-center justify-center transition-colors"
            title="Search"
          >
            <Search className="w-4 h-4" />
          </button>
        )}

        {/* Language Switcher */}
        <button
          onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
          className="flex items-center gap-1 text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 px-2.5 py-1.5 rounded-full text-xs font-bold transition-colors"
          title="Switch Language"
        >
          <Globe className="w-3.5 h-3.5 text-rose-500" />
          <span>{language === 'en' ? 'EN' : 'हिं'}</span>
        </button>

        {/* Phone Frame Toggle */}
        <button
          onClick={() => setIsPhoneFrame(!isPhoneFrame)}
          className={`w-9 h-9 rounded-full border transition-all flex items-center justify-center ${
            isPhoneFrame
              ? 'bg-rose-50 border-rose-200 text-rose-600'
              : 'bg-slate-100 border-slate-200/80 text-slate-700 hover:bg-slate-200'
          }`}
          title={isPhoneFrame ? 'Full View' : 'Phone View'}
        >
          {isPhoneFrame ? <Maximize2 className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={handleNotifClick}
            className="w-9 h-9 rounded-full bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200/60 text-slate-700 flex items-center justify-center transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 w-3 h-3 bg-rose-500 rounded-full border-2 border-white animate-ping" />
            )}
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 w-3 h-3 bg-rose-500 rounded-full border-2 border-white" />
            )}
          </button>

          {/* Dropdown */}
          <AnimatePresence>
            {showNotifDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-3.5 text-xs text-slate-800"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                  <span className="font-bold text-slate-900">Notifications</span>
                  <span className="text-[10px] text-rose-500 font-semibold">Live Push</span>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-rose-600">{n.title}</span>
                        <span className="text-[9px] text-slate-400">{n.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-slate-600">{n.message}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </header>
  );
};
