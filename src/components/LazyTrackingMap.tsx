import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const LazyDriverMapTracker = React.lazy(() =>
  import('./DriverMapTracker').then((mod) => ({ default: mod.DriverMapTracker }))
);

interface LazyTrackingMapProps {
  orderId: string;
  deliveryTarget: string;
  estimatedMinutes?: number;
}

const MapSkeleton = () => (
  <div className="w-full h-64 sm:h-80 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-2 animate-pulse">
    <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Loading live map…</span>
  </div>
);

export const LazyTrackingMap: React.FC<LazyTrackingMapProps> = (props) => (
  <Suspense fallback={<MapSkeleton />}>
    <LazyDriverMapTracker {...props} />
  </Suspense>
);
