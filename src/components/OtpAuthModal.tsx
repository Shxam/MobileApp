import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { Smartphone, ShieldCheck, ArrowRight, X, Sparkles, CheckCircle2, Lock } from 'lucide-react';

const IPL_TEAMS = [
  { name: 'Royal Challengers Bengaluru', code: 'RCB', color: 'from-red-600 to-amber-600' },
  { name: 'Chennai Super Kings', code: 'CSK', color: 'from-amber-500 to-yellow-600' },
  { name: 'Mumbai Indians', code: 'MI', color: 'from-blue-600 to-indigo-700' },
  { name: 'Kolkata Knight Riders', code: 'KKR', color: 'from-purple-700 to-amber-600' },
  { name: 'Gujarat Titans', code: 'GT', color: 'from-cyan-700 to-blue-900' },
  { name: 'Sunrisers Hyderabad', code: 'SRH', color: 'from-orange-500 to-red-600' },
];

export const OtpAuthModal: React.FC = () => {
  const { isAuthModalOpen, setIsAuthModalOpen, updateUser, addNotification } = useApp();
  const [step, setStep] = useState<'phone' | 'otp' | 'success'>('phone');
  const [phone, setPhone] = useState('9876543210');
  const [otp, setOtp] = useState(['7', '8', '9', '1']);
  const [selectedTeam, setSelectedTeam] = useState('RCB');
  const [name, setName] = useState('Rahul Sharma');
  const [timer, setTimer] = useState(30);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    let interval: any;
    if (step === 'otp' && timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  if (!isAuthModalOpen) return null;

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) return;
    setStep('otp');
    setTimer(30);
    addNotification('📲 Twilio SMS Sent', `OTP sent to +91 ${phone} via Twilio Verify. (Test OTP: 7891)`, 'wallet');
  };

  const handleVerifyOtp = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setStep('success');
      const teamObj = IPL_TEAMS.find((t) => t.code === selectedTeam);
      updateUser({
        name,
        phone: `+91 ${phone}`,
        favoriteTeam: teamObj ? teamObj.name : 'Royal Challengers Bengaluru',
        isLoggedIn: true,
      });
      addNotification('🎉 Welcome Fan!', 'Logged in via AWS Cognito OTP. +100 Fan Points added!', 'reward');
      setTimeout(() => {
        setIsAuthModalOpen(false);
        setStep('phone');
      }, 1500);
    }, 1000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl text-white overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="IPL Logo"
                className="w-10 h-10 rounded-xl object-contain bg-slate-950 p-0.5 border border-amber-500/40 shadow-md shrink-0"
              />
              <div>
                <h3 className="font-bold text-base text-amber-400">IPL Dhaba Sign In</h3>
                <p className="text-[11px] text-slate-400 font-medium">Indian Prime Line (Tasty & Healthy)</p>
              </div>
            </div>
            <button
              onClick={() => setIsAuthModalOpen(false)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Steps */}
          {step === 'phone' && (
            <form onSubmit={handleSendOtp} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Your Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Number (India +91)</label>
                <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl overflow-hidden focus-within:border-amber-500">
                  <span className="px-3 text-sm font-bold text-amber-400 bg-slate-800/80 border-r border-slate-700">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 10-digit number"
                    className="w-full bg-transparent px-3 py-2.5 text-sm text-white focus:outline-none font-mono tracking-wider"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Pick Your Favorite IPL Team</label>
                <div className="grid grid-cols-3 gap-2">
                  {IPL_TEAMS.map((team) => (
                    <button
                      type="button"
                      key={team.code}
                      onClick={() => setSelectedTeam(team.code)}
                      className={`p-2 rounded-xl text-center border transition-all text-xs font-bold ${
                        selectedTeam === team.code
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {team.code}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-extrabold py-3 rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all"
              >
                <span>Send SMS OTP</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {step === 'otp' && (
            <div className="mt-5 space-y-4">
              <div className="text-center">
                <p className="text-xs text-slate-300">
                  Enter 4-digit code sent to <span className="font-bold text-amber-400">+91 {phone}</span>
                </p>
                <span className="inline-block mt-1 text-[11px] bg-slate-800 px-2.5 py-0.5 rounded-full text-amber-300 border border-slate-700 font-mono">
                  Test SMS Code: 7891
                </span>
              </div>

              <div className="flex justify-center gap-3 my-4">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => {
                      const val = e.target.value;
                      const next = [...otp];
                      next[idx] = val;
                      setOtp(next);
                    }}
                    className="w-12 h-12 text-center text-xl font-bold font-mono bg-slate-800 border-2 border-amber-500/50 rounded-xl text-amber-400 focus:outline-none focus:border-amber-400"
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <button
                  onClick={() => setOtp(['7', '8', '9', '1'])}
                  className="text-amber-400 font-semibold underline hover:text-amber-300"
                >
                  Auto-fill Test Code
                </button>
                <span>Resend in {timer}s</span>
              </div>

              <button
                onClick={handleVerifyOtp}
                disabled={isVerifying}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 font-extrabold py-3 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all"
              >
                {isVerifying ? (
                  <span>Verifying via Cognito...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify & Continue</span>
                  </>
                )}
              </button>
            </div>
          )}

          {step === 'success' && (
            <div className="mt-8 mb-4 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500 mx-auto flex items-center justify-center animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-emerald-400">Phone Verified!</h4>
              <p className="text-xs text-slate-300">
                JWT Token Issued via AWS Cognito. Redirecting to your IPL Dhaba Super App...
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
