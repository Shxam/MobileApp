import React, { useState, useEffect } from 'react';
import { Phone, Navigation, Clock, ShieldCheck, MapPin, Bike } from 'lucide-react';
import { motion } from 'motion/react';

interface DriverMapTrackerProps {
  orderId: string;
  deliveryTarget: string;
  estimatedMinutes: number;
}

export const DriverMapTracker: React.FC<DriverMapTrackerProps> = ({
  orderId,
  deliveryTarget,
  estimatedMinutes,
}) => {
  const [progress, setProgress] = useState(35); // 0 to 100% route progress

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 95 ? 100 : prev + 5));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-slate-900 border border-orange-500/40 rounded-3xl p-4 space-y-3 shadow-2xl relative overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping" />
          <h3 className="font-extrabold text-xs text-white">Live Pitch-Side Delivery Runner</h3>
        </div>
        <span className="text-[10px] text-amber-400 font-mono font-bold">
          #{orderId.substring(4, 10)}
        </span>
      </div>

      {/* Simulated Animated GPS Map Canvas */}
      <div className="relative w-full h-36 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
        {/* Map Grid Pattern Background */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* Route Line Path */}
        <div className="absolute top-1/2 left-8 right-8 h-1 bg-slate-800 -translate-y-1/2 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-emerald-400 transition-all duration-1000 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Start Landmark: IPL Kitchen */}
        <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col items-center">
          <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500 text-orange-400 flex items-center justify-center font-bold text-[10px] shadow-md">
            🍳
          </div>
          <span className="text-[9px] font-bold text-slate-400 mt-1">Dhaba</span>
        </div>

        {/* Moving Delivery Runner Bike Icon */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
          style={{ left: `calc(2rem + (${progress} / 100) * (100% - 4rem))` }}
          animate={{ y: [0, -3, 0] }}
          transition={{ repeat: Infinity, duration: 0.6 }}
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 flex items-center justify-center shadow-lg border border-white/20">
            <Bike className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Destination Landmark: Pitch / Home Target */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center">
          <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 flex items-center justify-center font-bold text-[10px] shadow-md">
            🏏
          </div>
          <span className="text-[9px] font-bold text-slate-400 mt-1">Bench 1</span>
        </div>
      </div>

      {/* Runner Info & Call Controls */}
      <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
            R
          </div>
          <div>
            <div className="font-extrabold text-white text-xs flex items-center gap-1">
              <span>Runner Ramesh</span>
              <span className="text-[9px] text-emerald-400 font-normal">★ 4.9</span>
            </div>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>~{Math.max(1, Math.round(estimatedMinutes * (1 - progress / 100)))} mins away</span>
            </p>
          </div>
        </div>

        <button
          onClick={() => alert('Calling Runner Ramesh (+91 98765 43210)...')}
          className="bg-orange-500/20 border border-orange-500/40 hover:bg-orange-500 text-orange-300 hover:text-slate-950 font-extrabold px-3 py-2 rounded-xl text-xs flex items-center gap-1 transition-all"
        >
          <Phone className="w-3.5 h-3.5" />
          <span>Call Runner</span>
        </button>
      </div>
    </div>
  );
};
