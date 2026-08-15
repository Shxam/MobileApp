import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, Smartphone, Trophy, User as UserIcon } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useApp } from '../context/AppContext';
import { ApiClient } from '../services/apiClient';
import { isGoogleAuthConfigured } from '../services/googleAuthConfig';

interface LoginPageViewProps {
  onLoginSuccess: () => void;
  onBack: () => void;
}

const IPL_TEAMS = ['RCB', 'CSK', 'MI', 'KKR', 'GT', 'SRH'];

type LoginStep = 'google' | 'profile' | 'success';

/**
 * Google OAuth sign-in page.
 *
 * Screen 1: "Sign in with Google" — 1-click Google popup.
 * Screen 2: "Complete Your Profile" — phone + favorite team (only when the
 *           Google identity has no phone yet).
 * Screen 3: "Welcome to IPL Dhaba!" — celebration.
 */
export const LoginPageView: React.FC<LoginPageViewProps> = ({ onBack, onLoginSuccess }) => {
  const { onAuthenticated, completeUserProfile, addNotification } = useApp();
  const [step, setStep] = useState<LoginStep>('google');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [team, setTeam] = useState('RCB');
  const [googleProfile, setGoogleProfile] = useState<{
    email: string;
    name: string;
    avatar?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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

      setGoogleProfile({
        email: auth.user.email ?? '',
        name: auth.user.name,
        avatar: auth.user.avatar,
      });
      setName(auth.user.name);

      // If the profile is missing a phone, prompt for it.
      if (!auth.user.phone) {
        setStep('profile');
      } else {
        setStep('success');
        await onAuthenticated();
        addNotification('🎉 Welcome Fan!', 'Google identity verified & session locked in!', 'reward');
        setTimeout(() => onLoginSuccess(), 1500);
      }
    } catch (signInError: any) {
      console.error('Google Auth Error:', signInError);
      setError(signInError?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await completeUserProfile({
        phone: `+91${phone}`,
        favoriteTeam: team,
        name: name.trim() || googleProfile?.name,
      });
      setStep('success');
      await onAuthenticated();
      addNotification('🎉 Profile Complete!', 'Phone & team saved. Welcome to IPL Dhaba!', 'reward');
      setTimeout(() => onLoginSuccess(), 1500);
    } catch (profileError: any) {
      console.error('Profile completion error:', profileError);
      setError(profileError?.message || 'Could not save your profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0B132B] border border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="text-center space-y-2">
          <img src="/logo.png" alt="IPL Dhaba" className="w-14 h-14 rounded-full mx-auto border-2 border-amber-400 object-cover" />
          <h1 className="font-black text-xl text-amber-400">Sign in to IPL Dhaba</h1>
          <p className="text-xs text-slate-400">
            {step === 'google' ? '1-Click Google Authentication' : step === 'profile' ? 'Complete Your Profile' : 'Success!'}
          </p>
        </div>

        {step === 'google' && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-full bg-white flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                {isGoogleAuthConfigured
                  ? 'One click. Zero SMS. Google identity instantly unlocks Food, Turf, Wallet & Celebrations.'
                  : 'Configure VITE_GOOGLE_CLIENT_ID to enable 1-click Google sign-in.'}
              </p>
            </div>

            {error && <p className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-xl border border-rose-800/50">{error}</p>}

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

            <button
              type="button"
              onClick={onBack}
              className="w-full text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
            >
              Back
            </button>

            <p className="flex items-center justify-center gap-1 text-[10px] text-slate-500">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> Verified server-side with Google Auth Library.
            </p>
          </div>
        )}

        {step === 'profile' && (
          <form onSubmit={handleCompleteProfile} className="space-y-4">
            {/* Google Identity Summary */}
            <div className="flex items-center gap-3 bg-slate-800/50 border border-slate-700/80 rounded-xl p-3">
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

            <label className="block text-xs font-bold text-slate-300">
              Full name
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={googleProfile?.name || 'Rahul Sharma'}
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
              {isLoading ? 'Saving profile…' : 'Complete Profile & Continue'}
              <Trophy className="w-4 h-4" />
            </button>
          </form>
        )}

        {step === 'success' && (
          <div className="my-8 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500 mx-auto flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-black text-emerald-400">Welcome to IPL Dhaba!</h4>
            <p className="text-xs text-slate-300 font-medium">
              Google verified. Profile complete. Enjoy Food, Turf, Wallet & Celebrations!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};