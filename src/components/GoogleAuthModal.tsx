import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import { useApp } from '../context/AppContext';
import { X, ShieldCheck, CheckCircle2, Smartphone, Trophy, ArrowRight, User as UserIcon } from 'lucide-react';
import { ApiClient } from '../services/apiClient';
import { isGoogleAuthConfigured } from '../services/googleAuthConfig';

const IPL_TEAMS = [
  { code: 'RCB', name: 'Royal Challengers Bengaluru' },
  { code: 'CSK', name: 'Chennai Super Kings' },
  { code: 'MI', name: 'Mumbai Indians' },
  { code: 'KKR', name: 'Kolkata Knight Riders' },
  { code: 'GT', name: 'Gujarat Titans' },
  { code: 'SRH', name: 'Sunrisers Hyderabad' },
];

type AuthStep = 'signin' | 'profile' | 'success';

/**
 * Google OAuth + Profile Completion modal.
 *
 * Screen 1: "Sign in with Google" — 1-click popup via @react-oauth/google.
 * Screen 2: "Complete Your Profile" — phone number + favorite IPL team.
 * Screen 3: "Welcome to IPL Dhaba!" — celebration.
 *
 * The Google ID token is exchanged server-side with `google-auth-library`; the
 * client never sends its own claims, so a forged token cannot mint a session.
 */
export const GoogleAuthModal: React.FC = () => {
  const { isAuthModalOpen, setIsAuthModalOpen, onAuthenticated, completeUserProfile, addNotification } = useApp();
  const [step, setStep] = useState<AuthStep>('signin');
  const [phone, setPhone] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('RCB');
  const [googleProfile, setGoogleProfile] = useState<{
    email: string;
    name: string;
    avatar?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [error, setError] = useState('');

  const resetModal = () => {
    setStep('signin');
    setPhone('');
    setSelectedTeam('RCB');
    setGoogleProfile(null);
    setError('');
  };

  const closeModal = () => {
    resetModal();
    setIsAuthModalOpen(false);
  };

  /**
   * 1-Click Google Sign-In.
   *
   * The `GoogleLogin` component from @react-oauth/google uses Google Identity
   * Services (GIS) and returns a `CredentialResponse` whose `credential` is the
   * JWT ID token — sent to the backend for server-side verification and JWT
   * exchange.
   */
  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    const idToken = credentialResponse.credential;
    if (!idToken) {
      setError('Google did not return an identity token. Please try again.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const auth = await ApiClient.authenticateWithGoogle(idToken);

      // Store the Google profile so the onboarding screen can pre-fill the
      // name and show the avatar.
      setGoogleProfile({
        email: auth.user.email ?? '',
        name: auth.user.name,
        avatar: auth.user.avatar,
      });

      // If the profile is incomplete (no phone yet), show the completion step.
      if (!auth.user.phone) {
        setStep('profile');
      } else {
        setStep('success');
        await onAuthenticated();
        addNotification('🎉 Welcome Fan!', 'Google identity verified & session locked in!', 'reward');
        setTimeout(() => {
          closeModal();
        }, 1500);
      }
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      setError(err?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Completes the onboarding step: phone number + favorite team.
   */
  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setError('');
    setIsSavingProfile(true);
    try {
      const teamObj = IPL_TEAMS.find((t) => t.code === selectedTeam);
      await completeUserProfile({
        phone: `+91${phone}`,
        favoriteTeam: teamObj?.name ?? selectedTeam,
        name: googleProfile?.name,
      });
      setStep('success');
      await onAuthenticated();
      addNotification('🎉 Profile Complete!', 'Phone & team saved. Welcome to IPL Dhaba!', 'reward');
      setTimeout(() => {
        closeModal();
      }, 1500);
    } catch (err: any) {
      console.error('Profile completion error:', err);
      setError(err?.message || 'Could not save your profile. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (!isAuthModalOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
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
                {googleProfile?.avatar ? (
                  <img src={googleProfile.avatar} alt="Google avatar" className="w-full h-full object-cover" />
                ) : (
                  <img src="/logo.png" alt="IPL Dhaba" className="w-full h-full object-cover" />
                )}
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-amber-400 tracking-wide font-display">
                  IPL Dhaba Sign In
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  {step === 'signin' ? '1-Click Google Authentication' : step === 'profile' ? 'Complete Your Profile' : 'Welcome to IPL Dhaba'}
                </p>
              </div>
            </div>
            <button
              onClick={closeModal}
              className="w-7 h-7 bg-slate-800/90 text-slate-400 hover:text-white rounded-lg flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Steps */}
          {step === 'signin' && (
            <div className="space-y-4">
              {/* Google Logo + CTA */}
              <div className="text-center space-y-3 pt-2">
                <div className="w-14 h-14 mx-auto rounded-full bg-white flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </div>
                <h2 className="text-lg font-black text-white">
                  {isGoogleAuthConfigured ? 'Sign in with Google' : 'Google Sign-In'}
                </h2>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  {isGoogleAuthConfigured
                    ? 'One click. Zero SMS. Your Google identity instantly unlocks Food, Turf, Wallet & Celebrations.'
                    : 'Configure VITE_GOOGLE_CLIENT_ID to enable 1-click Google sign-in.'}
                </p>
              </div>

              {error && <p className="text-xs text-rose-400 bg-rose-950/40 p-2 rounded-xl border border-rose-800/50">{error}</p>}

              <div className={isGoogleAuthConfigured ? '' : 'opacity-40 pointer-events-none'}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google sign-in was cancelled or failed. Please try again.')}
                  useOneTap
                  theme="filled_black"
                  shape="pill"
                  text="continue_with"
                  width="100%"
                />
              </div>
              {isLoading && (
                <p className="text-center text-xs text-amber-400 font-bold animate-pulse">
                  Verifying with Google & establishing your session…
                </p>
              )}

              <p className="flex items-center justify-center gap-1 text-[10px] text-slate-500">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Verified server-side with Google Auth Library.
              </p>
            </div>
          )}

          {step === 'profile' && (
            <form onSubmit={handleCompleteProfile} className="space-y-4">
              {/* Google Identity Summary */}
              <div className="flex items-center gap-3 bg-slate-800/50 border border-slate-700/80 rounded-2xl p-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-900 shrink-0 border border-amber-500/40">
                  {googleProfile?.avatar ? (
                    <img src={googleProfile.avatar} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-5 h-5 text-slate-400 mx-auto mt-2.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{googleProfile?.name || 'IPL Dhaba Fan'}</p>
                  <p className="text-[10px] text-slate-400 truncate">{googleProfile?.email || 'Google verified'}</p>
                </div>
                <span className="ml-auto shrink-0 text-[9px] font-black text-emerald-400 bg-emerald-950/50 border border-emerald-800/50 px-2 py-1 rounded-full">
                  VERIFIED
                </span>
              </div>

              {/* Phone Number */}
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
                    autoFocus
                  />
                  <Smartphone className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
              </div>

              {/* Favorite IPL Team */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-300">Pick Your Favorite IPL Team</label>
                <div className="grid grid-cols-3 gap-2">
                  {IPL_TEAMS.map((team) => (
                    <button
                      type="button"
                      key={team.code}
                      onClick={() => setSelectedTeam(team.code)}
                      className={`py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
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

              <button
                type="submit"
                disabled={isSavingProfile || phone.length !== 10}
                className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 text-slate-950 font-black py-3.5 rounded-2xl text-xs shadow-fiery-glow flex items-center justify-center gap-2 transition-all cursor-pointer mt-2 disabled:opacity-50"
              >
                <Trophy className="w-4 h-4" />
                <span>{isSavingProfile ? 'Saving your profile…' : 'Complete Profile & Continue'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {step === 'success' && (
            <div className="my-6 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500 mx-auto flex items-center justify-center animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-black text-emerald-400">Welcome to IPL Dhaba!</h4>
              <p className="text-xs text-slate-300 font-medium">
                Google verified. Profile complete. Enjoy Food, Turf, Wallet & Celebrations!
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};