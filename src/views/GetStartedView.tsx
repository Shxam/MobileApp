import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Trophy, Utensils, ShieldCheck, ArrowRight, Zap, Flame } from 'lucide-react';

interface GetStartedViewProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export const GetStartedView: React.FC<GetStartedViewProps> = ({ onGetStarted, onLogin }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 relative overflow-hidden font-sans select-none">
      {/* Background Animated Fiery Gradient Orbs */}
      <motion.div
        animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0.65, 0.35] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-16 -left-16 w-80 h-80 bg-orange-600/30 rounded-full blur-3xl pointer-events-none"
      />
      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [0.25, 0.55, 0.25] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="absolute -bottom-16 -right-16 w-80 h-80 bg-emerald-500/25 rounded-full blur-3xl pointer-events-none"
      />

      {/* Floating Ember Particles Simulation */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-amber-400/80 blur-[1px] animate-ember-float"
            style={{
              left: `${15 + i * 11}%`,
              bottom: `${10 + (i % 3) * 15}%`,
              animationDelay: `${i * 0.7}s`,
              animationDuration: `${3.5 + (i % 2)}s`,
            }}
          />
        ))}
      </div>

      {/* Top Header Navigation */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex items-center justify-between z-10 pt-2"
      >
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="IPL Logo"
            className="w-10 h-10 object-contain drop-shadow-[0_0_12px_rgba(249,115,22,0.6)]"
          />
          <div>
            <h1 className="font-display font-black text-sm tracking-wider text-white flex items-center gap-1.5">
              IPL <span className="text-amber-400 text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-800/80">INDIAN PRIME LINE</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold">Tasty & Healthy • Pitch Dining</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onLogin}
            aria-label="Sign in to your account"
            className="text-xs font-black text-amber-400 bg-amber-950/80 border border-amber-800/80 hover:bg-amber-900/80 px-3 py-1.5 rounded-full transition-all active:scale-95 shadow-md"
          >
            Sign In
          </button>
        </div>
      </motion.div>

      {/* Main Hero Section featuring 3D Animated Circular Badge Logo */}
      <div className="my-auto z-10 py-4 space-y-6 flex flex-col items-center text-center">
        {/* 3D Animated Circular Badge Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, rotateX: 20 }}
          animate={{ opacity: 1, scale: 1, rotateX: 0 }}
          transition={{ duration: 0.8, type: 'spring', bounce: 0.3 }}
          className="relative group cursor-pointer perspective-1000"
        >
          {/* Rotating Outer Fiery Metallic Ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            className="absolute -inset-4 rounded-full border-2 border-dashed border-amber-500/50 p-3 scale-110 pointer-events-none"
          />

          {/* Pulsing Fiery Aura Glow */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-500/30 via-orange-600/40 to-emerald-500/30 blur-2xl group-hover:scale-110 transition-transform duration-500" />

          {/* Main 3D Circular Logo Badge Wrapper */}
          <div className="relative w-56 h-56 rounded-full overflow-hidden border-4 border-amber-400/80 shadow-fiery-glow transform-gpu group-hover:scale-105 transition-transform duration-300 bg-slate-900 flex items-center justify-center">
            {/* Shimmer Metallic Light Sweep Line Overlay */}
            <div className="absolute inset-0 z-20 pointer-events-none opacity-40">
              <div className="w-12 h-full bg-gradient-to-r from-transparent via-white to-transparent animate-metallic-sweep" />
            </div>

            {/* High-Res 3D Badge Image (Batsman + Fire + Indian Feast + Golden Banners) */}
            <img
              src="/logo.png"
              alt="IPL Indian Prime Line 3D Badge Logo"
              className="w-full h-full object-cover relative z-10 group-hover:scale-110 transition-transform duration-500"
            />
          </div>
        </motion.div>

        {/* Hero Title & Subtitle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-2 max-w-sm"
        >
          <div className="inline-flex items-center gap-1.5 text-xs font-black text-amber-400 bg-amber-950/90 border border-amber-800/80 px-3.5 py-1 rounded-full shadow-green-sm">
            <Flame className="w-3.5 h-3.5 text-orange-500 animate-bounce" />
            <span>IPL • Indian Prime Line • Tasty & Healthy</span>
          </div>

          <h2 className="text-3xl font-black font-display text-white tracking-tight leading-tight">
            Stadium Turfs. <br />
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-emerald-400 bg-clip-text text-transparent">
              Authentic Dhaba Feast.
            </span>
          </h2>
          <p className="text-xs text-slate-300 font-medium leading-relaxed max-w-xs mx-auto">
            Book floodlit Box Turfs in seconds, order piping-hot authentic Indian Dhaba curries delivered right to your pitch bench, and scan UPI QR codes effortlessly!
          </p>
        </motion.div>

        {/* 3 Feature Highlights Cards */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="grid grid-cols-3 gap-2.5 w-full max-w-sm"
        >
          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl text-center space-y-1.5 shadow-md">
            <div className="w-8 h-8 rounded-xl bg-amber-950/80 text-amber-400 flex items-center justify-center mx-auto border border-amber-800/60">
              <Trophy className="w-4 h-4" />
            </div>
            <div className="text-[11px] font-extrabold text-white">Box Turfs</div>
            <p className="text-[9px] text-slate-400 leading-tight">Floodlit pitch reservation</p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl text-center space-y-1.5 shadow-md">
            <div className="w-8 h-8 rounded-xl bg-orange-950/80 text-orange-400 flex items-center justify-center mx-auto border border-orange-800/60">
              <Utensils className="w-4 h-4" />
            </div>
            <div className="text-[11px] font-extrabold text-white">Dhaba Eats</div>
            <p className="text-[9px] text-slate-400 leading-tight">Benchside meal delivery</p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl text-center space-y-1.5 shadow-md">
            <div className="w-8 h-8 rounded-xl bg-emerald-950/80 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-800/60">
              <Zap className="w-4 h-4" />
            </div>
            <div className="text-[11px] font-extrabold text-white">Scan & Pay</div>
            <p className="text-[9px] text-slate-400 leading-tight">UPI merchant payment</p>
          </div>
        </motion.div>
      </div>

      {/* Bottom CTA Action Button */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="z-10 pt-2 space-y-3 max-w-sm mx-auto w-full"
      >
        <button
          onClick={onLogin}
          aria-label="Get started now"
          className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 text-slate-950 font-black py-4 rounded-2xl text-sm shadow-fiery-glow flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <span>Get Started Now</span>
          <ArrowRight className="w-4.5 h-4.5" />
        </button>

        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>256-Bit Encrypted Payments • Singarayakonda, AP</span>
        </div>
      </motion.div>
    </div>
  );
};
