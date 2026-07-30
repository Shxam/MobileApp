import React, { useState, useEffect } from 'react';
import { Wifi, Signal, Battery } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface PhoneFrameProps {
  children: React.ReactNode;
}

export const PhoneFrame: React.FC<PhoneFrameProps> = ({ children }) => {
  const { isPhoneFrame } = useApp();
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!isPhoneFrame) {
    return <div className="min-h-screen bg-slate-950 text-slate-100">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 py-4 px-2 sm:px-4 flex items-center justify-center font-sans antialiased">
      <div className="relative w-full max-w-[430px] h-[880px] bg-slate-900 rounded-[48px] p-3 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] border-[10px] border-slate-800 flex flex-col overflow-hidden ring-1 ring-slate-700/50">
        
        {/* Phone Notch / Dynamic Island */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-6 bg-slate-950 rounded-b-2xl z-50 flex items-center justify-center gap-2 border-b border-slate-800/50">
          <div className="w-3 h-3 rounded-full bg-slate-900 border border-slate-800" />
          <div className="w-10 h-1.5 rounded-full bg-slate-800" />
        </div>

        {/* Status Bar */}
        <div className="w-full bg-slate-900 px-6 pt-2 pb-1 flex items-center justify-between text-xs text-slate-300 font-semibold z-40 shrink-0 select-none">
          <span>{time || '19:42'}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-extrabold text-amber-400 bg-amber-500/20 px-1 rounded border border-amber-500/30">5G</span>
            <Signal className="w-3.5 h-3.5" />
            <Wifi className="w-3.5 h-3.5" />
            <Battery className="w-4 h-4 text-emerald-400 fill-emerald-400" />
          </div>
        </div>

        {/* Content Container */}
        <div className="relative flex-1 w-full overflow-y-auto bg-slate-950 text-slate-100 scrollbar-none flex flex-col pb-20">
          {children}
        </div>

        {/* Home Indicator Bar */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-600 rounded-full z-50 opacity-60" />
      </div>
    </div>
  );
};
