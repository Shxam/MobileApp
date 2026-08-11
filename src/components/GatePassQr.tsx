import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface GatePassQrProps {
  /** The signed token from the booking response. Never a placeholder. */
  token: string;
  /** Rendered edge length in CSS pixels. */
  size?: number;
  className?: string;
}

/**
 * Renders a scannable QR code for a booking's gate pass.
 *
 * This replaces the lucide `<QrCode />` glyph the booking screens used to show —
 * a decorative icon that encoded nothing, so the gate had nothing to scan and
 * `POST /bookings/verify-gate-pass` could never be reached from a phone screen.
 * The payload here is the HMAC-signed `gatePassToken` the server issued, which
 * is exactly what that endpoint verifies.
 *
 * Encoding happens off the render path in an effect: `QRCode.toDataURL` is
 * async, and the token can change while a pass modal is open (a second booking
 * in the same session), so the result is written through a cancellation flag to
 * avoid a late resolve painting the previous booking's code.
 */
export const GatePassQr: React.FC<GatePassQrProps> = ({ token, size = 176, className }) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setFailed(false);

    QRCode.toDataURL(token, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: size * 2, // 2x so it stays crisp on a retina phone screen
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [token, size]);

  if (failed) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-center dark:border-amber-800 dark:bg-amber-950/40 ${className ?? ''}`}
      >
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
          Could not draw the QR. Show the pass code below at the gate.
        </span>
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-700 ${className ?? ''}`}
      >
        <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt="Gate pass QR code"
      className={`rounded-xl border border-slate-200 bg-white dark:border-slate-700 ${className ?? ''}`}
    />
  );
};
