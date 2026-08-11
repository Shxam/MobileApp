import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Loader2, AlertCircle } from 'lucide-react';
import ApiClient, { TurfSlotView } from '../../services/apiClient';

/**
 * The turf's slot board for one day.
 *
 * The server owns the inventory: slots are either bookable or not, and there is
 * no "held" state to toggle client-side. The previous version rendered a
 * `slot.time` / `slot.status` / `slot.price` that no API returns, and offered a
 * Lock/Unlock button that hit nothing — a booking made from another device
 * would simply not appear.
 */
interface TurfReservationGridProps {
  /** `YYYY-MM-DD` in IST — the same key `GET /bookings/slots` expects. */
  date?: string;
}

export const TurfReservationGrid: React.FC<TurfReservationGridProps> = ({ date }) => {
  const [slots, setSlots] = useState<TurfSlotView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => {
    // IST, not the device clock — a phone in UTC would otherwise ask for
    // yesterday's slots. `en-CA` is the closest thing to a fixed ISO layout.
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  }, []);

  const day = date ?? today;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    ApiClient.getTurfSlots(day)
      .then((rows) => {
        if (!cancelled) setSlots(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load slot availability.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [day]);

  const bookedCount = slots.filter((s) => s.isBooked).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-500" />
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Turf Reservation Grid</h3>
        </div>
        <span className="text-[10px] font-bold text-slate-500">
          {bookedCount}/{slots.length} booked · {day}
        </span>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-xs font-bold text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading availability…
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-600 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1">
          {slots.map((slot) => (
            <div
              key={slot.id}
              className={`p-3 rounded-2xl border flex flex-col justify-between space-y-2 text-xs ${
                slot.isBooked
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 opacity-80'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
              }`}
            >
              <div className="flex justify-between items-start gap-1">
                <span className="font-extrabold text-slate-900 dark:text-white">{slot.timeSlot}</span>
                <span
                  className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                    slot.isBooked ? 'bg-rose-200 text-rose-800' : 'bg-emerald-200 text-emerald-800'
                  }`}
                >
                  {slot.isBooked ? 'Booked' : 'Open'}
                </span>
              </div>
              {slot.isFloodlit && (
                <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase">Floodlit</span>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                <span className="font-black text-slate-900 dark:text-white">
                  ₹{(slot.pricePaise / 100).toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{slot.pitchName}</span>
              </div>
            </div>
          ))}
          {slots.length === 0 && (
            <p className="col-span-2 text-center text-xs font-bold text-slate-500 py-8">
              No slots listed for {day}. Try a different day.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
