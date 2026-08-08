import React from 'react';
import { Calendar, Lock, Unlock, CheckCircle2 } from 'lucide-react';
import { TurfSlot } from '../../../packages/shared/types';

interface TurfReservationGridProps {
  slots: TurfSlot[];
  onToggleHold: (slotId: string) => void;
}

export const TurfReservationGrid: React.FC<TurfReservationGridProps> = ({ slots, onToggleHold }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-500" />
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Turf Reservation Grid</h3>
        </div>
        <span className="text-[10px] font-bold text-slate-500">Live Pitch Availability</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1">
        {slots.map((slot) => (
          <div
            key={slot.id}
            className={`p-3 rounded-2xl border flex flex-col justify-between space-y-2 text-xs ${
              slot.status === 'booked'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 opacity-80'
                : slot.status === 'held'
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className="font-extrabold text-slate-900 dark:text-white">{slot.time}</span>
              <span
                className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                  slot.status === 'booked'
                    ? 'bg-rose-200 text-rose-800'
                    : slot.status === 'held'
                    ? 'bg-amber-200 text-amber-800'
                    : 'bg-emerald-200 text-emerald-800'
                }`}
              >
                {slot.status}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
              <span className="font-black text-slate-900 dark:text-white">₹{slot.price}</span>
              <button
                onClick={() => onToggleHold(slot.id)}
                disabled={slot.status === 'booked'}
                className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                title={slot.status === 'held' ? 'Unlock Slot' : 'Lock Slot'}
              >
                {slot.status === 'held' ? <Unlock className="w-3.5 h-3.5 text-emerald-500" /> : <Lock className="w-3.5 h-3.5 text-amber-500" />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
