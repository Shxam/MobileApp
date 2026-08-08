import React, { useState } from 'react';
import { QrCode, CheckCircle2, AlertOctagon, Scan } from 'lucide-react';

export const GatePassValidator: React.FC = () => {
  const [qrCodeInput, setQrCodeInput] = useState('');
  const [validationResult, setValidationResult] = useState<{ valid: boolean; holderName?: string; timeSlot?: string } | null>(null);

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrCodeInput.trim()) return;

    if (qrCodeInput.includes('TURF_GATE') || qrCodeInput.includes('IPL_')) {
      setValidationResult({
        valid: true,
        holderName: 'Sham (Singarayakonda Team Captain)',
        timeSlot: '08:00 PM - 09:00 PM (Floodlit Night)',
      });
    } else {
      setValidationResult({ valid: false });
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
            placeholder="Scan or enter Gate Pass QR ID (e.g. IPL_GATE_982)..."
            value={qrCodeInput}
            onChange={(e) => setQrCodeInput(e.target.value)}
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1 shadow-green-sm"
          >
            <Scan className="w-3.5 h-3.5" />
            <span>Verify Pass</span>
          </button>
        </div>
      </form>

      {validationResult && (
        <div
          className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
            validationResult.valid
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2 font-extrabold">
            {validationResult.valid ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertOctagon className="w-4 h-4 text-rose-500" />}
            <span>{validationResult.valid ? 'VALID GATE PASS — PERMIT ENTRY' : 'INVALID GATE PASS — ENTRY DENIED'}</span>
          </div>
          {validationResult.valid && (
            <div className="text-[11px] space-y-0.5 pt-1 text-slate-700 dark:text-slate-300 font-medium">
              <div><strong>Holder:</strong> {validationResult.holderName}</div>
              <div><strong>Booked Slot:</strong> {validationResult.timeSlot}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
