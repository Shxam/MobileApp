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
  Sun,
  Moon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
    theme,
    toggleTheme,
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
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 border-b border-slate-100 dark:border-slate-800 backdrop-blur-md px-4 py-3 text-slate-800 dark:text-slate-100 flex items-center justify-between shadow-xs transition-colors">
      
      {/* 1. Left: Profile Avatar & Location Dropdown */}
      <div className="flex items-center gap-3">
        <button
          onClick={user.isLoggedIn ? onOpenProfile : () => setIsAuthModalOpen(true)}
          className="w-10 h-10 rounded-full border-2 border-emerald-100 dark:border-slate-700 overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-xs hover:border-emerald-500 transition-all"
        >
          {user.isLoggedIn && user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-5 h-5 text-emerald-500" />
          )}
        </button>

        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Location</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </div>
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-[130px]">
            Singarayakonda, AP
          </span>
        </div>
      </div>

      {/* 2. Right: Action Buttons */}
      <div className="flex items-center gap-2">

        {/* Theme Mode Toggle Button */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-full bg-slate-100/80 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors shadow-xs"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? (
            <Moon className="w-4 h-4 text-slate-700" />
          ) : (
            <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
          )}
        </button>

        {/* Language Switcher */}
        <button
          onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
          className="flex items-center gap-1 text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 px-2.5 py-1.5 rounded-full text-xs font-bold transition-colors"
          title="Switch Language"
        >
          <Globe className="w-3.5 h-3.5 text-emerald-500" />
          <span>{language === 'en' ? 'EN' : 'हिं'}</span>
        </button>

        {/* Phone Frame Toggle */}
        <button
          onClick={() => setIsPhoneFrame(!isPhoneFrame)}
          className={`w-9 h-9 rounded-full border transition-all flex items-center justify-center ${
            isPhoneFrame
              ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
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
              <span className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-ping" />
            )}
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
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
                  <span className="text-[10px] text-emerald-500 font-semibold">Live Push</span>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-600">{n.title}</span>
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
