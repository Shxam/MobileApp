import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { Smartphone, ShieldCheck, ArrowRight, X, Sparkles, CheckCircle2, User as UserIcon } from 'lucide-react';
import { ApiClient } from '../services/apiClient';
import { FirebaseAuthService } from '../services/firebaseAuth';
import { ConfirmationResult } from 'firebase/auth';

const IPL_TEAMS = [
  { code: 'RCB', name: 'Royal Challengers' },
  { code: 'CSK', name: 'Chennai Super Kings' },
  { code: 'MI', name: 'Mumbai Indians' },
  { code: 'KKR', name: 'Kolkata Knight Riders' },
  { code: 'GT', name: 'Gujarat Titans' },
  { code: 'SRH', name: 'Sunrisers Hyderabad' },
];

export const OtpAuthModal: React.FC = () => {
  const { isAuthModalOpen, setIsAuthModalOpen, updateUser, addNotification } = useApp();
  const [step, setStep] = useState<'phone' | 'otp' | 'success'>('phone');
  const [phone, setPhone] = useState('9876543210');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [selectedTeam, setSelectedTeam] = useState('RCB');
  const [name, setName] = useState('Rahul Sharma');
  const [timer, setTimer] = useState(30);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  const normalizedPhone = `+91${phone}`;

  useEffect(() => {
    let interval: any;
    if (step === 'otp' && timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  if (!isAuthModalOpen) return null;

  const formatFirebaseError = (err: any): string => {
    const msg = err?.message || err?.code || String(err);
    if (msg.includes('auth/invalid-phone-number')) return 'Invalid mobile number format. Enter 10 digits.';
    if (msg.includes('auth/too-many-requests')) return 'Too many attempts. Wait a few minutes.';
    if (msg.includes('auth/invalid-verification-code')) return 'Invalid 6-digit OTP code.';
    if (msg.includes('auth/code-expired')) return 'OTP code expired. Please resend.';
    return msg.replace('Firebase: ', '');
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length !== 10) return;
    setError('');
    setIsLoading(true);
    try {
      const verifier = FirebaseAuthService.createRecaptchaVerifier('recaptcha-container-modal');
      const result = await FirebaseAuthService.sendPhoneOtp(normalizedPhone, verifier);
      setConfirmationResult(result);
      setStep('otp');
      setTimer(30);
      addNotification('📱 Firebase SMS OTP Sent!', `OTP code dispatched to +91 ${phone} via Firebase Auth.`, 'wallet');
    } catch (err: any) {
      console.error('Firebase Auth Modal Error:', err);
      setError(formatFirebaseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter all 6 digits of the OTP.');
      return;
    }

    setError('');
    setIsVerifying(true);
    try {
      if (!confirmationResult) {
        throw new Error('Verification session expired. Please re-enter phone number.');
      }

      // Step 1: Confirm OTP with Firebase
      const userCredential = await FirebaseAuthService.confirmOtp(confirmationResult, otpCode);

      // Step 2: Get Firebase ID token
      const idToken = await userCredential.user.getIdToken(/* forceRefresh */ true);

      // Step 3: Verify token with backend
      const result = await ApiClient.authenticateWithFirebase(idToken, name, selectedTeam);

      localStorage.setItem('ipl_dhaba_jwt_token', result.accessToken);
      localStorage.setItem('ipl_dhaba_refresh_token', result.refreshToken);

      setIsVerifying(false);
      setStep('success');

      const teamObj = IPL_TEAMS.find((t) => t.code === selectedTeam);
      updateUser({
        id: result.user.id,
        name: result.user.name || name,
        phone: result.user.phone || `+91 ${phone}`,
        favoriteTeam: teamObj ? teamObj.name : 'Royal Challengers Bengaluru',
        isLoggedIn: true,
      });

      addNotification('🎉 Welcome Fan!', 'Firebase Identity verified & Session locked in!', 'reward');

      setTimeout(() => {
        setIsAuthModalOpen(false);
        setStep('phone');
        setOtp(['', '', '', '', '', '']);
      }, 1500);
    } catch (err: any) {
      console.error('Firebase Auth Verification Error:', err);
      setIsVerifying(false);
      setError(formatFirebaseError(err));
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
        {/* Invisible reCAPTCHA container required by Firebase */}
        <div id="recaptcha-container-modal"></div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 15 }}
          className="relative w-full max-w-md bg-[#0B132B] border border-amber-500/40 rounded-3xl p-5 shadow-2xl text-white space-y-4 overflow-hidden"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-amber-400 overflow-hidden bg-slate-900 shrink-0 shadow-sm">
                <img src="/logo.png" alt="IPL Dhaba" className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-amber-400 tracking-wide font-display">
                  IPL Dhaba Sign In
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  Firebase Phone Authentication
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsAuthModalOpen(false)}
              className="w-7 h-7 bg-slate-800/90 text-slate-400 hover:text-white rounded-lg flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Steps */}
          {step === 'phone' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              {/* Field 1: Your Full Name */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-300">Your Full Name</label>
                <div className="flex items-center bg-[#162238] border border-slate-700/80 focus-within:border-amber-500 rounded-2xl px-3.5 py-2.5 transition-all">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Rahul Sharma"
                    required
                    className="w-full bg-transparent text-xs font-bold text-white focus:outline-none placeholder:text-slate-500"
                  />
                  <UserIcon className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
              </div>

              {/* Field 2: Mobile Number (India +91) */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-300">Mobile Number (India +91)</label>
                <div className="flex items-center bg-[#162238] border border-slate-700/80 focus-within:border-amber-500 rounded-2xl px-3.5 py-2.5 transition-all">
                  <span className="text-xs font-black text-amber-400 pr-3 border-r border-slate-700/80">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    className="w-full bg-transparent text-xs font-extrabold text-white pl-3 focus:outline-none placeholder:text-slate-500 tracking-wider font-mono"
                    required
                  />
                  <Smartphone className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
              </div>

              {/* Field 3: Pick Your Favorite IPL Team */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-300">Pick Your Favorite IPL Team</label>
                <div className="grid grid-cols-3 gap-2">
                  {IPL_TEAMS.map((team) => (
                    <button
                      type="button"
                      key={team.code}
                      onClick={() => setSelectedTeam(team.code)}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        selectedTeam === team.code
                          ? 'bg-amber-950/80 border-2 border-amber-500 text-amber-300 shadow-green-sm scale-[1.02]'
                          : 'bg-[#162238] border border-slate-700/80 text-slate-400 hover:text-white hover:border-slate-600'
                      }`}
                    >
                      {team.code}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-xs text-rose-400 bg-rose-950/40 p-2 rounded-xl border border-rose-800/50">{error}</p>}

              {/* Primary CTA Button */}
              <button
                type="submit"
                disabled={isLoading || phone.length !== 10}
                className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 text-slate-950 font-black py-3.5 rounded-2xl text-xs shadow-fiery-glow flex items-center justify-center gap-2 transition-all cursor-pointer mt-2 disabled:opacity-50"
              >
                <span>{isLoading ? 'Sending Firebase SMS OTP…' : 'Send Firebase SMS OTP'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {step === 'otp' && (
            <div className="space-y-4">
              <div className="bg-slate-800/90 border border-slate-700 p-3 rounded-2xl text-xs text-slate-300 font-medium flex items-center justify-between">
                <span>Enter code sent to +91 {phone}</span>
                <button
                  type="button"
                  onClick={() => { setStep('phone'); setError(''); }}
                  className="text-[10px] underline text-amber-400 hover:text-amber-300"
                >
                  Edit Number
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-300">6-Digit Firebase OTP Code</label>
                  <button
                    type="button"
                    onClick={() => setOtp(['', '', '', '', '', ''])}
                    className="text-[10px] font-bold text-rose-400 hover:text-rose-300 underline cursor-pointer"
                  >
                    Clear OTP
                  </button>
                </div>
                <div className="flex justify-between gap-1.5">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`modal-otp-input-${idx}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace') {
                          e.preventDefault();
                          const next = [...otp];
                          if (next[idx]) {
                            next[idx] = '';
                            setOtp(next);
                          } else if (idx > 0) {
                            next[idx - 1] = '';
                            setOtp(next);
                            const prevEl = document.getElementById(`modal-otp-input-${idx - 1}`);
                            if (prevEl) (prevEl as HTMLInputElement).focus();
                          }
                        }
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                        if (pasted.length > 0) {
                          const next = ['', '', '', '', '', ''];
                          for (let i = 0; i < pasted.length; i++) {
                            next[i] = pasted[i];
                          }
                          setOtp(next);
                          const lastIdx = Math.min(pasted.length - 1, 5);
                          const el = document.getElementById(`modal-otp-input-${lastIdx}`);
                          if (el) (el as HTMLInputElement).focus();
                        }
                      }}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        if (!val && !e.target.value) {
                          const next = [...otp];
                          next[idx] = '';
                          setOtp(next);
                          return;
                        }
                        const digitVal = val.slice(-1);
                        const next = [...otp];
                        next[idx] = digitVal;
                        setOtp(next);
                        if (digitVal && idx < 5) {
                          const nextEl = document.getElementById(`modal-otp-input-${idx + 1}`);
                          if (nextEl) (nextEl as HTMLInputElement).focus();
                        }
                      }}
                      className="w-11 h-12 text-center bg-[#162238] border border-slate-700/80 focus:border-amber-500 rounded-xl text-lg font-black text-white focus:outline-none font-mono"
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <button
                  type="button"
                  disabled={timer > 0 || isLoading}
                  onClick={handleSendOtp}
                  className="text-amber-400 font-semibold underline hover:text-amber-300 disabled:opacity-40"
                >
                  {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
                </button>
              </div>

              {error && <p className="text-xs text-rose-400 bg-rose-950/40 p-2 rounded-xl border border-rose-800/50">{error}</p>}

              <button
                onClick={handleVerifyOtp}
                disabled={isVerifying || otp.join('').length !== 6}
                className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 text-slate-950 font-black py-3.5 rounded-2xl text-xs shadow-fiery-glow flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isVerifying ? (
                  <span>Authenticating with Firebase…</span>
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
            <div className="my-6 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500 mx-auto flex items-center justify-center animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-black text-emerald-400">Firebase Phone Verified!</h4>
              <p className="text-xs text-slate-300 font-medium">
                JWT Token Issued. Authenticated as {name} ({selectedTeam} Supporter)...
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
