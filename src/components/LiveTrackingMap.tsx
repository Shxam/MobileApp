import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Bike, Navigation, Clock, ShieldCheck, Loader2, AlertCircle, Phone } from 'lucide-react';
import ApiClient, { type OrderView } from '../services/apiClient';
import { subscribeToOrder } from '../services/realtimeClient';

interface LiveTrackingMapProps {
  orderId: string;
  /** Falls back to the order's own target once it loads. */
  deliveryTarget?: string;
  /** Plotted only when the caller actually knows where the order is going. */
  destination?: { latitude: number; longitude: number };
  className?: string;
}

/**
 * The dhaba kitchen — a real fixed place, so it is configuration rather than
 * data. Overridable for a second outlet without a rebuild of the component.
 */
const KITCHEN_COORDS: [number, number] = [
  Number(import.meta.env.VITE_DHABA_LAT ?? 15.242),
  Number(import.meta.env.VITE_DHABA_LNG ?? 79.982),
];

/** Statuses where a rider is actually carrying food. */
const EN_ROUTE = new Set(['assigned', 'picked_up', 'out_for_delivery']);

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: 'Awaiting payment',
  placed: 'Sent to the kitchen',
  accepted: 'Kitchen accepted',
  preparing: 'Cooking now',
  ready_for_pickup: 'Ready — waiting for a rider',
  assigned: 'Rider assigned',
  picked_up: 'Picked up',
  out_for_delivery: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  payment_failed: 'Payment failed',
};

const markerHtml = (bg: string, ring: string, size: number, svg: string) => `
  <div class="relative flex items-center justify-center rounded-full shadow-lg border-2 border-white ${bg} ${ring}"
       style="width:${size}px;height:${size}px">
    ${svg}
  </div>`;

const BIKE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>';

const CHEF_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 10.58 0A4 4 0 0 1 18 13.87V21H6z"/><line x1="6" y1="17" x2="18" y2="17"/></svg>';

const PIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';

/**
 * Live delivery tracking.
 *
 * Everything on this map is something the server reported. The version it
 * replaces opened an `EventSource` against a JWT-guarded endpoint — which a
 * browser cannot authenticate — and on the guaranteed 401 fell into a
 * `setInterval` that walked a marker between two hardcoded points every 2.5s.
 * The customer was watching a screensaver, and the interval was recreated on
 * every `orderId` change without the state it captured ever updating.
 *
 * Now: one socket subscription for the driver's real GPS pushes, and no rider
 * drawn at all until the server has actually sent a position.
 */
export const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({
  orderId,
  deliveryTarget,
  destination,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  const [order, setOrder] = useState<OrderView | null>(null);
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const [status, setStatus] = useState<string>('placed');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  // Load the order once for the starting state: its status, its driver, and the
  // last location the server persisted (a reopened screen should not wait for
  // the next GPS push to draw anything).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotice(null);
    ApiClient.getOrder(orderId)
      .then((next) => {
        if (cancelled) return;
        setOrder(next);
        setStatus(next.status);
        if (next.location) setDriverPos([next.location.latitude, next.location.longitude]);
      })
      .catch((err) => {
        if (!cancelled) setNotice(err instanceof Error ? err.message : 'Could not load this order.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  // The live feed. `subscribeToOrder` returns its own teardown, so the socket
  // room is left and the handlers detached whenever the order changes.
  useEffect(() => {
    return subscribeToOrder(orderId, {
      onLocation: (payload) => setDriverPos([payload.location.latitude, payload.location.longitude]),
      onStatus: (payload) => {
        setStatus(payload.status);
        // A status change can also mean a driver was attached; refresh the card
        // rather than guessing at the shape of the socket payload.
        ApiClient.getOrder(orderId)
          .then(setOrder)
          .catch(() => {
            /* the map keeps working on the status alone */
          });
      },
      onRefused: (reason) => setNotice(reason),
    });
  }, [orderId]);

  const destinationCoords = useMemo<[number, number] | null>(
    () => (destination ? [destination.latitude, destination.longitude] : null),
    [destination],
  );

  // Map creation. Runs once — the markers that depend on data are added and
  // moved in the effects below rather than by rebuilding the map.
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: KITCHEN_COORDS,
      zoom: 15,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    L.marker(KITCHEN_COORDS, {
      icon: L.divIcon({
        className: 'custom-kitchen-marker',
        html: markerHtml('bg-amber-500', 'ring-4 ring-amber-500/30', 40, CHEF_SVG),
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      }),
    })
      .addTo(map)
      .bindPopup('<b>IPL Dhaba Kitchen</b><br>Singarayakonda Highway Pavilion');

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      driverMarkerRef.current = null;
      routePolylineRef.current = null;
    };
  }, []);

  // The destination marker, only when a caller supplied real coordinates.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !destinationCoords) return;

    const marker = L.marker(destinationCoords, {
      icon: L.divIcon({
        className: 'custom-dest-marker',
        html: markerHtml('bg-rose-600', 'ring-4 ring-rose-600/30', 40, PIN_SVG),
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      }),
    })
      .addTo(map)
      .bindPopup(`<b>Delivery target</b><br>${deliveryTarget ?? order?.deliveryTarget ?? ''}`);

    return () => {
      marker.remove();
    };
  }, [destinationCoords, deliveryTarget, order?.deliveryTarget]);

  // The rider. Created on the first real position, moved on every one after.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !driverPos) return;

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = L.marker(driverPos, {
        icon: L.divIcon({
          className: 'custom-driver-marker',
          html: markerHtml('bg-emerald-500', 'ring-8 ring-emerald-500/30', 48, BIKE_SVG),
          iconSize: [48, 48],
          iconAnchor: [24, 24],
        }),
      }).addTo(map);
      map.flyTo(driverPos, 16, { duration: 1 });
    } else {
      driverMarkerRef.current.setLatLng(driverPos);
    }

    // The trail is kitchen → rider → target, and only the legs that exist. It is
    // a straight line, not a routed path: it shows where the rider is, and does
    // not pretend to know which streets they will take.
    const legs: [number, number][] = [KITCHEN_COORDS, driverPos];
    if (destinationCoords) legs.push(destinationCoords);

    if (routePolylineRef.current) {
      routePolylineRef.current.setLatLngs(legs);
    } else {
      routePolylineRef.current = L.polyline(legs, {
        color: '#10b981',
        weight: 5,
        opacity: 0.8,
        dashArray: '8, 8',
      }).addTo(map);
    }
  }, [driverPos, destinationCoords]);

  const recenterMap = useCallback(() => {
    const map = mapRef.current;
    if (map) map.flyTo(driverPos ?? KITCHEN_COORDS, 16, { duration: 1.2 });
  }, [driverPos]);

  const target = deliveryTarget ?? order?.deliveryTarget ?? 'Your delivery address';
  const enRoute = EN_ROUTE.has(status);
  const driverName = order?.driver?.name;

  /**
   * The kitchen's own estimate, counted down from when the order was placed.
   * No interpolation: if the estimate has run out the label says so rather than
   * showing a number that keeps ticking to make the wait feel measured.
   */
  const minutesLeft = useMemo(() => {
    if (!order) return null;
    const elapsedMs = Date.now() - new Date(order.createdAt).getTime();
    const remaining = order.estimatedDeliveryMinutes - Math.floor(elapsedMs / 60_000);
    return remaining > 0 ? remaining : null;
  }, [order]);

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md ${className}`}
    >
      <div ref={mapContainerRef} className="w-full h-72 z-0" />

      <div className="absolute top-3 left-3 right-3 z-10 flex items-start justify-between gap-2 pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md text-white px-3.5 py-2 rounded-2xl border border-slate-700/80 shadow-lg flex items-center gap-2 pointer-events-auto">
          <div className={`w-2.5 h-2.5 rounded-full ${enRoute ? 'bg-emerald-500 animate-ping' : 'bg-amber-400'}`} />
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {STATUS_LABEL[status] ?? status.replace(/_/g, ' ')}
            </div>
            <div className="text-xs font-black text-emerald-400 flex items-center gap-1">
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading…</span>
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {minutesLeft !== null ? `About ${minutesLeft} min` : 'Arriving shortly'}
                    {order?.orderNumber ? ` · ${order.orderNumber}` : ''}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={recenterMap}
          className="w-9 h-9 shrink-0 rounded-2xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors pointer-events-auto"
          title="Recenter"
        >
          <Navigation className="w-4 h-4 text-emerald-500" />
        </button>
      </div>

      {notice && (
        <div className="absolute top-20 left-3 right-3 z-10 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-[11px] font-bold px-3 py-2 rounded-xl flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {notice}
        </div>
      )}

      <div className="absolute bottom-3 left-3 right-3 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xl flex items-center justify-between gap-3 text-slate-900 dark:text-white">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black shrink-0 shadow-md">
            <Bike className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-xs truncate flex items-center gap-1.5">
              {/* No rider is named until one is actually assigned — the old card
                  printed a fixed name for every order in the app. */}
              <span>{driverName ?? (enRoute ? 'Rider on the way' : 'Waiting for a rider')}</span>
              {driverName && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
              Target: <span className="font-bold text-slate-700 dark:text-slate-300">{target}</span>
            </div>
          </div>
        </div>

        {order?.driver?.phone ? (
          <a
            href={`tel:${order.driver.phone}`}
            className="shrink-0 flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1.5 rounded-full bg-emerald-500 text-white shadow-green-sm"
          >
            <Phone className="w-3 h-3" />
            Call
          </a>
        ) : (
          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
            {status.replace(/_/g, ' ')}
          </span>
        )}
      </div>
    </div>
  );
};
