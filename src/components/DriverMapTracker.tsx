import React, { useEffect, useState } from 'react';
import { Bike, Clock, MapPin, Navigation, Phone, Radio } from 'lucide-react';
import { ApiClient } from '../services/apiClient';

interface DriverMapTrackerProps {
  orderId: string;
  deliveryTarget: string;
  estimatedMinutes: number;
}

type TrackingOrder = Awaited<ReturnType<typeof ApiClient.getFoodOrder>>;

export const DriverMapTracker: React.FC<DriverMapTrackerProps> = ({ orderId, deliveryTarget, estimatedMinutes }) => {
  const [order, setOrder] = useState<TrackingOrder | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await ApiClient.getFoodOrder(orderId);
        if (active) { setOrder(next); setError(''); }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Live location is unavailable.');
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, [orderId]);

  const location = order?.location;
  const driverName = order?.driverName || 'Delivery partner not assigned';

  return (
    <div className="bg-slate-900 border border-orange-500/40 rounded-3xl p-4 space-y-3 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2"><Radio className="w-4 h-4 text-orange-400" /><h3 className="font-extrabold text-xs text-white">Live delivery location</h3></div>
        <span className="text-[10px] font-mono text-amber-400">#{orderId.substring(0, 8)}</span>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center space-y-2">
        {location ? <><Navigation className="w-9 h-9 text-emerald-400 mx-auto" /><p className="text-sm font-black text-white">Rider location received</p><p className="text-[11px] font-mono text-slate-400">{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p><p className="text-[10px] text-slate-500">Updated {new Date(location.updatedAt).toLocaleTimeString()}</p></> : <><MapPin className="w-9 h-9 text-amber-400 mx-auto" /><p className="text-sm font-black text-white">Waiting for rider location</p><p className="text-[11px] text-slate-400">The rider’s live position appears after pickup and location permission.</p></>}
      </div>
      <div className="flex items-center justify-between rounded-2xl bg-slate-950 border border-slate-800 p-3">
        <div className="flex items-center gap-2"><Bike className="w-5 h-5 text-orange-400" /><div><p className="text-xs font-bold text-white">{driverName}</p><p className="text-[10px] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />About {estimatedMinutes} minutes</p></div></div>
        {order?.driverPhone && <a href={`tel:${order.driverPhone}`} className="p-2 rounded-xl bg-orange-500 text-slate-950"><Phone className="w-4 h-4" /></a>}
      </div>
      {error && <p className="text-[10px] text-rose-300">{error}</p>}
      <p className="text-[10px] text-slate-500">Destination: {deliveryTarget}</p>
    </div>
  );
};
