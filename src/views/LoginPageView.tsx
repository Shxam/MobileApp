import React, { useState, useEffect } from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, Smartphone, User as UserIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ApiClient } from '../services/apiClient';
import { FirebaseAuthService } from '../services/firebaseAuth';
import { ConfirmationResult } from 'firebase/auth';

interface LoginPageViewProps {
  onLoginSuccess: () => void;
  onBack: () => void;
}

const IPL_TEAMS = ['RCB', 'CSK', 'MI', 'KKR', 'GT', 'SRH'];

/** Firebase error codes are not customer-readable; these are. */
const formatFirebaseError = (err: unknown): string => {
  const raw = err as { message?: string; code?: string } | undefined;
  const msg = raw?.message || raw?.code || String(err);
  if (msg.includes('auth/invalid-phone-number')) return 'Invalid mobile number format. Please enter a 10-digit number.';
  if (msg.includes('auth/too-many-requests')) return 'Too many SMS attempts. Please wait a few minutes before trying again.';
  if (msg.includes('auth/quota-exceeded')) return 'SMS quota exceeded for today. Try again later.';
  if (msg.includes('auth/invalid-verification-code')) return 'Invalid 6-digit OTP code entered.';
  if (msg.includes('auth/code-expired')) return 'OTP code has expired. Please request a new OTP.';
  return msg.replace('Firebase: ', '');
};

export const LoginPageView: React.FC<LoginPageViewProps> = ({ onBack, onLoginSuccess }) => {
  const { onAuthenticated, addNotification } = useApp();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [team, setTeam] = useState('RCB');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const normalizedPhone = `+91${phone}`;

  useEffect(() => {
    let timer: any;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const sendOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const verifier = FirebaseAuthService.createRecaptchaVerifier('recaptcha-container-page');
      const result = await FirebaseAuthService.sendPhoneOtp(normalizedPhone, verifier);
      setConfirmationResult(result);
      setStep('otp');
      setCooldown(30);
      addNotification('📱 Firebase SMS OTP Sent!', `OTP code dispatched to ${normalizedPhone} via Firebase Auth.`, 'wallet');
    } catch (requestError) {
      console.error('Firebase Auth Error:', requestError);
      setError(formatFirebaseError(requestError));
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (!confirmationResult) {
        throw new Error('No active OTP verification session found. Please re-enter mobile number.');
      }

      // Step 1: Confirm OTP code with Firebase Client SDK
      const userCredential = await FirebaseAuthService.confirmOtp(confirmationResult, otp);

      // Step 2: Obtain cryptographically signed Firebase ID Token
      const idToken = await userCredential.user.getIdToken(/* forceRefresh */ true);

      // Step 3: Exchange the Firebase ID token for an IPL Dhaba session.
      // `authenticateWithFirebase` persists both tokens through `tokenStore`,
      // so there is nothing to write to localStorage by hand here.
      await ApiClient.authenticateWithFirebase(idToken, name, team);

      // Loads the real profile and every collection, and reconnects the socket
      // with the new token. Patching local user state instead would show a
      // signed-in shell with nobody's data in it.
      await onAuthenticated();

      addNotification('🎉 Signed In via Firebase Auth', 'Firebase identity verified & IPL Dhaba session active.', 'reward');
      onLoginSuccess();
    } catch (verifyError) {
      console.error('Firebase Auth Error:', verifyError);
      setError(formatFirebaseError(verifyError));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      {/* Invisible reCAPTCHA container required by Firebase Phone Auth */}
      <div id="recaptcha-container-page"></div>

      <div className="w-full max-w-md bg-[#0B132B] border border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="text-center space-y-2">
          <img src="/logo.png" alt="IPL Dhaba" className="w-14 h-14 rounded-full mx-auto border-2 border-amber-400 object-cover" />
          <h1 className="font-black text-xl text-amber-400">Sign in to IPL Dhaba</h1>
          <p className="text-xs text-slate-400">Firebase Phone Authentication (Secure SMS OTP)</p>
        </div>

        {step === 'phone' ? (
          <form onSubmit={sendOtp} className="space-y-4">
            <label className="block text-xs font-bold text-slate-300">
              Full name
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Rahul Sharma"
                className="mt-1.5 w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-3 text-white outline-none focus:border-amber-500"
              />
            </label>
            <label className="block text-xs font-bold text-slate-300">
              Mobile number (India +91)
              <input
                required
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, ''))}
                placeholder="10-digit mobile number"
                className="mt-1.5 w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-3 text-white outline-none focus:border-amber-500 font-mono tracking-wider"
              />
            </label>
            <div className="space-y-1">
              <span className="block text-xs font-bold text-slate-300">Pick Favorite IPL Team</span>
              <div className="grid grid-cols-3 gap-2">
                {IPL_TEAMS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTeam(item)}
                    className={`rounded-xl py-2 text-xs font-black transition-all cursor-pointer ${
                      team === item ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-xl border border-rose-800/50">{error}</p>}

            <button
              type="submit"
              disabled={isLoading || phone.length !== 10}
              className="w-full rounded-xl bg-amber-500 py-3 font-black text-slate-950 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-all hover:bg-amber-400"
            >
              {isLoading ? 'Sending SMS OTP…' : 'Send Firebase SMS OTP'}
              <ArrowRight className="w-4 h-4" />
            </button>
            <button type="button" onClick={onBack} className="w-full text-xs font-bold text-slate-400 hover:text-white">
              Back
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div className="rounded-xl bg-slate-800 p-3 text-xs text-slate-300 flex items-center justify-between">
              <span>Enter 6-digit OTP sent to <strong>{normalizedPhone}</strong></span>
              <button
                type="button"
                onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
                className="text-[10px] text-amber-400 underline hover:text-amber-300"
              >
                Change Number
              </button>
            </div>

            <input
              required
              autoFocus
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
              placeholder="6-digit OTP"
              className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-3 text-center tracking-[0.5em] font-black text-xl text-white outline-none focus:border-amber-500 font-mono"
            />

            <div className="flex items-center justify-between text-xs text-slate-400">
              <button
                type="button"
                disabled={cooldown > 0 || isLoading}
                onClick={sendOtp}
                className="text-amber-400 font-semibold underline disabled:opacity-40 hover:text-amber-300 cursor-pointer"
              >
                {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
              </button>
            </div>

            {error && <p className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-xl border border-rose-800/50">{error}</p>}

            <button
              type="submit"
              disabled={isLoading || otp.length !== 6}
              className="w-full rounded-xl bg-emerald-500 py-3 font-black text-white disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-all hover:bg-emerald-400"
            >
              {isLoading ? 'Verifying with Firebase…' : 'Verify & Continue'}
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </form>
        )}
        <p className="flex items-center justify-center gap-1 text-[10px] text-slate-500">
          <ShieldCheck className="w-3 h-3 text-emerald-400" /> Firebase Auth protects your phone identity.
        </p>
      </div>
    </div>
  );
};
