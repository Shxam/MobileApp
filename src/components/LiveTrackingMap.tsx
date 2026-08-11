import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Bike, Navigation, MapPin, ChefHat, Clock, ShieldCheck } from 'lucide-react';

interface LiveTrackingMapProps {
  orderId: string;
  deliveryTarget?: string;
  status?: string;
  className?: string;
}

// Coordinates for Singarayakonda DHABA & TURF Arena
const KITCHEN_COORDS: [number, number] = [15.242, 79.982];
const DESTINATION_COORDS: [number, number] = [15.253, 79.992];

export const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({
  orderId,
  deliveryTarget = 'Singarayakonda Turf - Pitch Cage 1',
  status = 'out_for_delivery',
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  const [driverPos, setDriverPos] = useState<[number, number]>([15.245, 79.984]);
  const [driverName, setDriverName] = useState<string>('Ramesh Kumar (IPL Dhaba Express)');
  const [etaMinutes, setEtaMinutes] = useState<number>(12);
  const [currentStatus, setCurrentStatus] = useState<string>(status);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create Map
    const map = L.map(mapContainerRef.current, {
      center: [15.2475, 79.987],
      zoom: 15,
      zoomControl: false,
    });

    // Add CartoDB Dark Matter / Positron Tiles for high-end UI/UX aesthetics
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    // Custom Kitchen Icon
    const kitchenIcon = L.divIcon({
      className: 'custom-kitchen-marker',
      html: `
        <div class="relative flex items-center justify-center w-10 h-10 bg-amber-500 text-white rounded-full shadow-lg border-2 border-white ring-4 ring-amber-500/30">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 10.58 0A4 4 0 0 1 18 13.87V21H6z"/><line x1="6" y1="17" x2="18" y2="17"/></svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    // Custom Destination Icon
    const destIcon = L.divIcon({
      className: 'custom-dest-marker',
      html: `
        <div class="relative flex items-center justify-center w-10 h-10 bg-rose-600 text-white rounded-full shadow-lg border-2 border-white ring-4 ring-rose-600/30">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    // Add Kitchen & Destination Markers
    L.marker(KITCHEN_COORDS, { icon: kitchenIcon })
      .addTo(map)
      .bindPopup('<b>IPL Dhaba Kitchen Hub</b><br>Singarayakonda Highway Pavilion');

    L.marker(DESTINATION_COORDS, { icon: destIcon })
      .addTo(map)
      .bindPopup(`<b>Delivery Target</b><br>${deliveryTarget}`);

    // Create Initial Route Line
    const polyline = L.polyline([KITCHEN_COORDS, KITCHEN_COORDS, DESTINATION_COORDS], {
      color: '#10b981',
      weight: 5,
      opacity: 0.8,
      dashArray: '8, 8',
    }).addTo(map);

    routePolylineRef.current = polyline;

    // Custom Driver Rider Icon
    const driverIcon = L.divIcon({
      className: 'custom-driver-marker',
      html: `
        <div class="relative flex items-center justify-center w-12 h-12 bg-emerald-500 text-white rounded-full shadow-2xl border-2 border-white ring-8 ring-emerald-500/30 animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });

    // Add Driver Marker
    const driverMarker = L.marker(KITCHEN_COORDS, { icon: driverIcon }).addTo(map);
    driverMarkerRef.current = driverMarker;

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Real-Time SSE Stream or Dynamic Simulation
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let simTimer: any = null;

    try {
      // Connect to Server-Sent Events backend stream
      eventSource = new EventSource(`/api/v1/orders/${orderId}/tracking-stream`);

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.lat && payload.lng) {
            const newPos: [number, number] = [payload.lat, payload.lng];
            setDriverPos(newPos);
            if (payload.driverName) setDriverName(payload.driverName);
            if (payload.etaMinutes !== undefined) setEtaMinutes(payload.etaMinutes);
            if (payload.status) setCurrentStatus(payload.status);
          }
        } catch {
          // ignore parse error
        }
      };

      eventSource.onerror = () => {
        // Close broken SSE connection and fallback to local GPS simulation
        if (eventSource) eventSource.close();
        startSimulation();
      };
    } catch {
      startSimulation();
    }

    function startSimulation() {
      let step = 0;
      simTimer = setInterval(() => {
        step = (step + 1) % 100;
        const progress = step / 100;
        const lat = KITCHEN_COORDS[0] + (DESTINATION_COORDS[0] - KITCHEN_COORDS[0]) * progress;
        const lng = KITCHEN_COORDS[1] + (DESTINATION_COORDS[1] - KITCHEN_COORDS[1]) * progress;
        const newPos: [number, number] = [lat, lng];

        setDriverPos(newPos);
        setEtaMinutes(Math.max(1, Math.round(15 * (1 - progress))));
      }, 2500);
    }

    return () => {
      if (eventSource) eventSource.close();
      if (simTimer) clearInterval(simTimer);
    };
  }, [orderId]);

  // Update Driver Marker Position on Map
  useEffect(() => {
    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng(driverPos);
    }
    if (routePolylineRef.current) {
      routePolylineRef.current.setLatLngs([KITCHEN_COORDS, driverPos, DESTINATION_COORDS]);
    }
  }, [driverPos]);

  const recenterMap = () => {
    if (mapRef.current) {
      mapRef.current.flyTo(driverPos, 16, { duration: 1.2 });
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md ${className}`}>
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-72 z-0" />

      {/* Top Floating ETA & Status Overlay */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md text-white px-3.5 py-2 rounded-2xl border border-slate-700/80 shadow-lg flex items-center gap-2 pointer-events-auto">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Estimated Delivery</div>
            <div className="text-xs font-black text-emerald-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{etaMinutes} Mins • Live Runner</span>
            </div>
          </div>
        </div>

        {/* Recenter Button */}
        <button
          onClick={recenterMap}
          className="w-9 h-9 rounded-2xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors pointer-events-auto"
          title="Recenter on Delivery Partner"
        >
          <Navigation className="w-4 h-4 text-emerald-500" />
        </button>
      </div>

      {/* Bottom Floating Driver Details Bar */}
      <div className="absolute bottom-3 left-3 right-3 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xl flex items-center justify-between gap-3 text-slate-900 dark:text-white">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black shrink-0 shadow-md">
            <Bike className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-xs truncate flex items-center gap-1.5">
              <span>{driverName}</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
              Target: <span className="font-bold text-slate-700 dark:text-slate-300">{deliveryTarget}</span>
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            {currentStatus.replace(/_/g, ' ')}
          </span>
        </div>
      </div>
    </div>
  );
};
