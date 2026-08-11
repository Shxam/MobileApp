import React, { useEffect, useMemo, useState } from 'react';
import { QrCode, X, Calendar, Loader2, Ticket, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { GatePassQr } from './GatePassQr';
import { formatPaise } from '../types';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
}

/**
 * The customer's gate pass, reachable from the centre nav button.
 *
 * This screen used to be a "Scan & Pay" simulator: a 1200 ms `setTimeout`
 * fabricated a merchant and a ₹350 bill, `[Simulate Cam Error]` buttons faked
 * failures, and confirming the "payment" called `topUpWallet` — which *credited*
 * the wallet rather than charging it. Nothing behind it was real: there is no
 * UPI PSP integration in this app, and no camera-decode library, so a customer
 * pointing their phone at a merchant QR could never have paid anyone.
 *
 * What is real is the other direction — the pass the gate scans. Each confirmed
 * booking carries an HMAC-signed `gatePassToken` that only the booking server
 * can produce, and `GatePassValidator` on the staff side verifies it through
 * `POST /bookings/verify-gate-pass`. So the button now shows the customer that
 * token as a scannable code.
 */
export const QrScannerModal: React.FC<QrScannerModalProps> = ({ isOpen, onClose, onNavigateTab }) => {
  const { turfBookings, refreshTurfBookings, user } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /**
   * Only a confirmed booking opens a gate. A cancelled or completed one still
   * holds a token, and showing it would send someone to a gate that will refuse
   * them — the validator checks status server-side and would deny entry.
   *
   * Expired windows are dropped and the rest sorted by kickoff, so `passes[0]` is
   * the next slot the customer is due at. Before this the default was whatever
   * order the API happened to return, which meant someone with several bookings
   * could open the modal at the gate and be shown next month's pass.
   *
   * `endTime`, not `startTime`, is the cutoff: arriving late still needs the code.
   * `Date.now()` is read once per booking change rather than on a timer — the list
   * is refetched every time the modal opens, which is when accuracy matters.
   */
  const passes = useMemo(() => {
    const now = Date.now();
    return turfBookings
      .filter(
        (b) =>
          b.status === 'confirmed' && b.paymentStatus === 'paid' && Date.parse(b.endTime) > now,
      )
      .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  }, [turfBookings]);

  // Refetched on open rather than on mount: a booking made on another device
  // should appear here, and the modal is mounted for the whole session.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    setIsLoading(true);
    setLoadError(null);
    refreshTurfBookings()
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load your passes.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, refreshTurfBookings]);

  const selected = passes.find((b) => b.id === selectedId) ?? passes[0] ?? null;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gate-pass-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 text-slate-900 dark:text-white space-y-4 shadow-2xl relative"
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-500 flex items-center justify-center">
                <QrCode className="w-4 h-4" />
              </div>
              <h3 id="gate-pass-title" className="font-black text-slate-900 dark:text-white text-sm">
                My Gate Pass
              </h3>
            </div>
            <button
              onClick={onClose}
              aria-label="Close gate pass"
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {isLoading && passes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-[11px] font-bold">Loading your passes…</span>
            </div>
          ) : loadError ? (
            <p role="alert" className="text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-xl px-3 py-2">
              {loadError}
            </p>
          ) : !selected ? (
            <div className="text-center space-y-3 py-6">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Ticket className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-extrabold text-slate-900 dark:text-white">No active gate pass</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Book and pay for a turf slot and its pass appears here.
                </p>
              </div>
              <button
                onClick={() => {
                  onNavigateTab('turfs');
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold px-4 py-2.5 rounded-full text-xs shadow-green-sm active:scale-95 transition-all"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Book a Turf Slot</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* The signed token itself, drawn as a scannable code. */}
              <div className="flex justify-center pt-1">
                <GatePassQr token={selected.gatePassToken} size={168} />
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white">{selected.turfName}</span>
                  <span className="text-[10px] font-mono text-emerald-600 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 shrink-0">
                    {selected.bookingNumber}
                  </span>
                </div>
                <div className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>{selected.turfAddress}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-slate-700/70 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  <span>
                    {selected.date} · {selected.timeSlot}
                  </span>
                  <span className="text-emerald-600">{formatPaise(selected.totalAmountPaise)}</span>
                </div>
                {user.name && (
                  <p className="text-[10px] text-slate-400 font-medium">Booked by {user.name}</p>
                )}
              </div>

              {/* Only rendered when there is a choice to make. */}
              {passes.length > 1 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                    Other upcoming passes
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {passes.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => setSelectedId(b.id)}
                        className={`shrink-0 px-3 py-2 rounded-xl border text-left transition-colors ${
                          b.id === selected.id
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className="text-[10px] font-extrabold text-slate-900 dark:text-white">{b.date}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{b.timeSlot}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-center text-slate-400 font-medium">
                Show this code at the gate. Staff scan it to confirm your slot.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
