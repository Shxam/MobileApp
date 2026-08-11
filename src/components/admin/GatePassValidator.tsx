import React, { useState } from 'react';
import { QrCode, CheckCircle2, AlertOctagon, Scan, Loader2 } from 'lucide-react';
import ApiClient, { type GatePassResult } from '../../services/apiClient';
import { formatPaise } from '../../types';

/**
 * The gate scanner.
 *
 * A real pass is a signed token (`GATEPASS-…`) that only the booking server can
 * produce or verify — the previous version accepted anything containing
 * "TURF_GATE" or "IPL_" and told the gate staff the booking belonged to a
 * hardcoded person. Now the token goes to `POST /bookings/verify-gate-pass`,
 * which checks the signature, the booking's status and whether it was paid.
 */
export const GatePassValidator: React.FC = () => {
  const [qrCodeInput, setQrCodeInput] = useState('');
  const [result, setResult] = useState<GatePassResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = qrCodeInput.trim();
    if (!token) return;

    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await ApiClient.verifyGatePass(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify that pass.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <QrCode className="w-5 h-5 text-emerald-500" />
        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Gate Pass QR Validator</h3>
      </div>

      <form onSubmit={handleValidate} className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Scan or paste the gate pass token (GATEPASS-…)"
            value={qrCodeInput}
            onChange={(e) => setQrCodeInput(e.target.value)}
            disabled={busy}
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy || !qrCodeInput.trim()}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1 shadow-green-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scan className="w-3.5 h-3.5" />}
            <span>Verify Pass</span>
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {result && (
        <div
          className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
            result.valid
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          {result.valid ? (
            <>
              <div className="flex items-center gap-2 font-extrabold">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>VALID GATE PASS — PERMIT ENTRY</span>
              </div>
              <div className="text-[11px] space-y-0.5 pt-1 text-slate-700 dark:text-slate-300 font-medium">
                <div><strong>Booking:</strong> {result.booking.bookingNumber}</div>
                <div><strong>Pitch:</strong> {result.booking.turfName}</div>
                <div><strong>Slot:</strong> {result.booking.date} · {result.booking.timeSlot}</div>
                <div><strong>Amount paid:</strong> {formatPaise(result.booking.totalAmountPaise)}</div>
                <div><strong>Method:</strong> {result.booking.paymentMethod}</div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 font-extrabold">
              <AlertOctagon className="w-4 h-4 text-rose-500" />
              {/* The server's reason verbatim — "cancelled" and "unpaid" call for
                  very different conversations at the gate. */}
              <span>ENTRY DENIED — {result.reason}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
