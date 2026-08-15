import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bike,
  CheckCircle2,
  KeyRound,
  LocateFixed,
  LogOut,
  MapPin,
  MapPinned,
  Navigation,
  PackageCheck,
  Power,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Undo2,
  Wallet,
  Wifi,
  WifiOff,
  AlertCircle,
  PhoneCall,
  DollarSign,
  ChevronRight,
} from 'lucide-react';
import { useRealtime } from '../../../packages/realtime/useRealtime';
import './styles.css';

declare global {
  interface Window {
    L?: any;
  }
}

type Offer = {
  id: string;
  orderNumber: string;
  deliveryType: string;
  deliveryTarget: string | null;
  deliveryAddress: string | null;
  totalPaise: number;
  collectCashPaise: number;
  itemCount: number;
  readyAt: string | null;
};

type ActiveDelivery = {
  id: string;
  orderNumber: string;
  status: 'assigned' | 'picked_up' | 'out_for_delivery' | 'delivered';
  deliveryTarget: string | null;
  deliveryAddress: string | null;
  paymentMethod: string;
  totalAmountPaise: number;
  items: { quantity: number; nameSnapshot: string | null }[];
};

type Position = { latitude: number; longitude: number; heading?: number };
type DriverStatus = { driverId: string; isOnline: boolean; activeOrderId: string | null };

const destination = { latitude: 15.2422, longitude: 79.9819 };
const rupees = (paise: number) => `₹${(paise / 100).toFixed(0)}`;

const api = async <T,>(path: string, options: RequestInit = {}) => {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const rawText = await response.text();
  let parsed: any = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    throw new Error(parsed?.message || `Request failed (${response.status})`);
  }
  return parsed as T;
};

function DeliveryMap({ position, destinationLabel }: { position: Position | null; destinationLabel: string }) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const riderMarker = useRef<any>(null);
  const destinationMarker = useRef<any>(null);

  useEffect(() => {
    if (!mapElement.current || !window.L || map.current) return;
    map.current = window.L.map(mapElement.current).setView([destination.latitude, destination.longitude], 14);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map.current);

    return () => {
      map.current?.remove();
      map.current = null;
      riderMarker.current = null;
      destinationMarker.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !window.L) return;
    if (!destinationMarker.current) {
      destinationMarker.current = window.L.marker([destination.latitude, destination.longitude]).addTo(map.current);
    }
    destinationMarker.current.bindPopup(destinationLabel || 'Delivery Target');
  }, [destinationLabel]);

  useEffect(() => {
    if (!map.current || !position || !window.L) return;
    const coordinates = [position.latitude, position.longitude];
    if (!riderMarker.current) {
      riderMarker.current = window.L.marker(coordinates).addTo(map.current).bindPopup('Rider Live Location');
    } else {
      riderMarker.current.setLatLng(coordinates);
    }
    map.current.fitBounds([coordinates, [destination.latitude, destination.longitude]], { padding: [35, 35] });
  }, [position]);

  return <div ref={mapElement} className="w-full h-64 sm:h-80 rounded-2xl overflow-hidden shadow-2xl border border-slate-800" aria-label="Live delivery map" />;
}

function DriverApp() {
  const [employeeId, setEmployeeId] = useState('DELIVERY-001');
  const [pin, setPin] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem('ipl_dhaba_driver_token') || '');
  const [status, setStatus] = useState<DriverStatus | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [active, setActive] = useState<ActiveDelivery | null>(null);
  const [earningsPaise, setEarningsPaise] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);
  const [otp, setOtp] = useState('');
  const [position, setPosition] = useState<Position | null>(null);
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const lastPosition = useRef<Position | null>(null);

  const authed = (options: RequestInit = {}) => ({
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  });
  const fail = (error: unknown, fallback: string) =>
    setMessage(error instanceof Error ? error.message : fallback);

  const loadOffers = async () => {
    if (!token) return;
    try {
      setOffers(await api<Offer[]>('/dispatch/available', authed()));
    } catch (error) {
      fail(error, 'Unable to load available deliveries.');
    }
  };

  const loadActive = async () => {
    if (!token) return;
    try {
      setActive(await api<ActiveDelivery | null>('/dispatch/current', authed()));
    } catch (error) {
      fail(error, 'Unable to load current delivery.');
    }
  };

  const loadStatus = async () => {
    if (!token) return;
    try {
      setStatus(await api<DriverStatus>('/dispatch/status', authed()));
    } catch (error) {
      fail(error, 'Unable to read driver status.');
    }
  };

  const loadEarnings = async () => {
    if (!token) return;
    try {
      const history = await api<{ status: string; deliveredAt: string | null; bill: { totalPaise: number } }[]>(
        '/orders?scope=history&limit=100',
        authed(),
      );
      const today = new Date().toDateString();
      const delivered = history.filter(
        (order) =>
          order.status === 'delivered' &&
          order.deliveredAt &&
          new Date(order.deliveredAt).toDateString() === today,
      );
      setCompletedToday(delivered.length);
      setEarningsPaise(
        delivered.reduce(
          (total, order) => total + Math.max(20_00, Math.round((order.bill?.totalPaise ?? 0) * 0.08)),
          0,
        ),
      );
    } catch (error) {
      fail(error, 'Unable to load earnings.');
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadStatus(), loadOffers(), loadActive(), loadEarnings()]);
  };

  const { state: connection, detail: connectionDetail } = useRealtime(token, {
    onState: (next) => {
      if (next === 'live') void refreshAll();
      if (next === 'unauthorized') {
        localStorage.removeItem('ipl_dhaba_driver_token');
        setToken('');
      }
    },
    onOrderOffered: ({ orderId }) => {
      void loadOffers();
      setMessage(`📦 New delivery offer #${orderId.substring(0, 8)} available!`);
    },
    onOrderAssigned: ({ orderId, driverId }) => {
      void loadOffers();
      if (status?.driverId === driverId) void loadActive();
    },
    onOrderReleased: () => void refreshAll(),
    onOrderDelivered: () => void refreshAll(),
    onOrderUpdated: ({ status }) => {
      if (status === 'cancelled' || status === 'refunded' || status === 'delivery_failed') {
        void refreshAll();
      }
    },
  });

  useEffect(() => {
    void refreshAll();
  }, [token]);

  useEffect(() => {
    if (!token || !status?.isOnline || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) =>
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          heading: pos.coords.heading || 0,
        }),
      (err) => setMessage(`GPS location error: ${err.message}`),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [token, status?.isOnline]);

  useEffect(() => {
    if (!token || !active || !position) return;
    const previous = lastPosition.current;
    if (previous && previous.latitude === position.latitude && previous.longitude === position.longitude)
      return;
    lastPosition.current = position;
    void api(`/orders/${active.id}/location`, {
      method: 'PATCH',
      ...authed({ body: JSON.stringify({ latitude: position.latitude, longitude: position.longitude }) }),
    }).catch(() => null);
  }, [active, position, token]);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsBusy(true);
    setMessage('');
    try {
      const result = await api<{ accessToken: string }>('/auth/staff-login', {
        method: 'POST',
        body: JSON.stringify({ employeeId, pin }),
      });
      localStorage.setItem('ipl_dhaba_driver_token', result.accessToken);
      setToken(result.accessToken);
      setPin('');
    } catch (error) {
      fail(error, 'Sign in failed. Check Employee ID & PIN.');
    } finally {
      setIsBusy(false);
    }
  };

  const toggleOnline = async () => {
    if (!token || !status) return;
    setIsBusy(true);
    try {
      const next = await api<DriverStatus>(
        '/dispatch/status',
        authed({ method: 'PATCH', body: JSON.stringify({ isOnline: !status.isOnline }) }),
      );
      setStatus(next);
      setMessage(next.isOnline ? '🟢 You are now ONLINE & ready for delivery duty.' : '⚪ You are now OFFLINE.');
      await loadOffers();
    } catch (error) {
      fail(error, 'Unable to update online status.');
    } finally {
      setIsBusy(false);
    }
  };

  const claimOrder = async (orderId: string) => {
    setIsBusy(true);
    setMessage('');
    try {
      await api('/dispatch/claim', authed({ method: 'POST', body: JSON.stringify({ orderId }) }));
      setMessage('✅ Order claimed! Proceed to kitchen for pickup.');
      await refreshAll();
    } catch (error) {
      fail(error, 'Could not claim order. Another rider may have taken it.');
    } finally {
      setIsBusy(false);
    }
  };

  const pickupOrder = async () => {
    if (!active) return;
    setIsBusy(true);
    try {
      await api(`/dispatch/${active.id}/pickup`, authed({ method: 'POST' }));
      setMessage('🚴 Order picked up! Out for delivery.');
      await refreshAll();
    } catch (error) {
      fail(error, 'Pickup failed.');
    } finally {
      setIsBusy(false);
    }
  };

  const deliverOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!active || otp.length !== 6) return;
    setIsBusy(true);
    try {
      await api(`/dispatch/${active.id}/deliver`, authed({ method: 'POST', body: JSON.stringify({ otp }) }));
      setMessage('🎉 Delivery completed! Great job.');
      setOtp('');
      await refreshAll();
    } catch (error) {
      fail(error, 'Delivery verification failed. Verify 6-digit customer OTP.');
    } finally {
      setIsBusy(false);
    }
  };

  const releaseOrder = async () => {
    if (!active) return;
    setIsBusy(true);
    try {
      await api(`/dispatch/${active.id}/release`, authed({ method: 'POST' }));
      setMessage('Order released back to available pool.');
      await refreshAll();
    } catch (error) {
      fail(error, 'Could not release order.');
    } finally {
      setIsBusy(false);
    }
  };

  const reportIssue = async (reason: string) => {
    if (!active) return;
    setIsBusy(true);
    try {
      await api(`/dispatch/${active.id}/issue`, authed({ method: 'POST', body: JSON.stringify({ reason }) }));
      setMessage('🚨 Delivery problem reported to Admin. Active order flagged for review.');
      await refreshAll();
    } catch (error) {
      fail(error, 'Could not report issue.');
    } finally {
      setIsBusy(false);
    }
  };

  if (!token) {
    return (
      <main className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-4 selection:bg-emerald-500 selection:text-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-emerald-950/40 via-slate-950 to-slate-950 pointer-events-none" />
        <form
          onSubmit={signIn}
          className="relative w-full max-w-sm bg-[#0B132B]/90 backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-7 space-y-6 shadow-2xl shadow-emerald-950/60"
        >
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Bike className="w-8 h-8 text-emerald-400" />
              </div>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white font-display">Rider Cockpit</h1>
            <p className="text-xs text-slate-400 font-medium">IPL Dhaba Delivery Partner Portal</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300">Rider Employee ID</label>
              <input
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                placeholder="DELIVERY-001"
                className="w-full rounded-2xl bg-slate-900/90 border border-slate-800 focus:border-emerald-500 px-4 py-3 text-sm font-bold text-white tracking-wider focus:outline-none transition-all placeholder:text-slate-600"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300">Security PIN</label>
              <input
                required
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full rounded-2xl bg-slate-900/90 border border-slate-800 focus:border-emerald-500 px-4 py-3 text-sm font-bold text-white tracking-widest focus:outline-none transition-all placeholder:text-slate-600"
              />
            </div>
          </div>

          {message && (
            <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          <button
            disabled={isBusy}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-95 text-slate-950 font-black py-3.5 text-sm shadow-fiery-glow transition-all cursor-pointer disabled:opacity-50"
          >
            {isBusy ? 'Authenticating…' : 'Start Duty'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white p-4 max-w-xl mx-auto space-y-5 selection:bg-emerald-500 selection:text-black">
      {/* Header Cockpit */}
      <header className="bg-[#0B132B]/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-4 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Bike className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="font-black text-sm text-white tracking-wide font-display">IPL Dhaba Rider</h1>
            <ConnectionPill state={connection} detail={connectionDetail} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status && (
            <button
              onClick={toggleOnline}
              disabled={isBusy}
              className={`px-3 py-2 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                status.isOnline
                  ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30 shadow-lg'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{status.isOnline ? 'ONLINE' : 'OFFLINE'}</span>
            </button>
          )}

          <button
            onClick={() => {
              localStorage.removeItem('ipl_dhaba_driver_token');
              setToken('');
            }}
            className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Driver Status Banner */}
      {message && (
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 shadow-lg">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Earnings & Performance Cards */}
      <section className="grid grid-cols-2 gap-3">
        <div className="bg-[#0B132B]/80 border border-slate-800 rounded-3xl p-4 space-y-1 shadow-lg">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Today Earnings</span>
          <p className="font-mono font-black text-xl text-emerald-400">{rupees(earningsPaise)}</p>
        </div>
        <div className="bg-[#0B132B]/80 border border-slate-800 rounded-3xl p-4 space-y-1 shadow-lg">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Completed Today</span>
          <p className="font-mono font-black text-xl text-white">{completedToday} Orders</p>
        </div>
      </section>

      {/* Active Delivery Section */}
      {active ? (
        <section className="bg-[#0B132B]/90 border border-emerald-500/40 rounded-3xl p-5 space-y-4 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-mono font-black text-sm text-white">Order {active.orderNumber}</span>
            </div>
            <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-950/60 border border-amber-800/50 px-2 py-0.5 rounded-full">
              {active.status.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Delivery Location Target */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-slate-400">Destination</span>
            <p className="font-bold text-sm text-cyan-300">{active.deliveryTarget || active.deliveryAddress || 'Dhaba Customer'}</p>
          </div>

          {/* Map View */}
          <DeliveryMap position={position} destinationLabel={active.deliveryTarget || 'Customer Location'} />

          {/* Order Items Summary */}
          <div className="space-y-1 text-xs">
            <span className="font-bold text-slate-400 block text-[10px] uppercase">Order Contents:</span>
            {active.items.map((item, idx) => (
              <div key={idx} className="flex justify-between font-semibold text-slate-200">
                <span>{item.nameSnapshot || 'Food Item'}</span>
                <span className="font-mono font-bold text-amber-400">×{item.quantity}</span>
              </div>
            ))}
          </div>

          {/* Delivery Actions & OTP Form */}
          {active.status === 'assigned' && (
            <button
              onClick={pickupOrder}
              disabled={isBusy}
              className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black py-3.5 text-xs shadow-fiery-glow flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <PackageCheck className="w-4 h-4" />
              <span>Confirm Kitchen Pickup</span>
            </button>
          )}

          {(active.status === 'picked_up' || active.status === 'out_for_delivery') && (
            <form onSubmit={deliverOrder} className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">Enter Customer 6-Digit Delivery OTP</label>
                <div className="flex items-center bg-slate-900 border border-slate-800 focus-within:border-emerald-500 rounded-2xl px-3.5 py-2.5">
                  <KeyRound className="w-4 h-4 text-emerald-400 shrink-0 mr-2" />
                  <input
                    required
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full bg-transparent font-mono font-black text-sm text-white focus:outline-none tracking-widest placeholder:text-slate-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isBusy || otp.length !== 6}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black py-3.5 text-xs shadow-fiery-glow flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Verify OTP & Complete Delivery</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const input = window.prompt(
                    'Report delivery problem to Dhaba Admin (e.g. Accident, Unreachable customer, Wrong address):',
                    'Unreachable customer',
                  );
                  if (input) void reportIssue(input);
                }}
                disabled={isBusy}
                className="w-full py-2.5 rounded-xl bg-amber-950/70 hover:bg-amber-900 border border-amber-800/80 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer mt-2"
              >
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>Report Problem / Flag Issue</span>
              </button>
            </form>
          )}

          <button
            onClick={releaseOrder}
            disabled={isBusy}
            className="w-full text-center text-xs text-rose-400 hover:text-rose-300 font-semibold pt-1 transition-colors cursor-pointer"
          >
            Release delivery back to pool
          </button>
        </section>
      ) : (
        /* Available Delivery Offers Pool */
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-sm text-white tracking-wide font-display">Available Deliveries ({offers.length})</h2>
            <button
              onClick={() => void loadOffers()}
              className="text-xs text-emerald-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Refresh Pool
            </button>
          </div>

          {offers.length === 0 ? (
            <div className="bg-[#0B132B]/60 border border-slate-800 rounded-3xl p-8 text-center space-y-2">
              <Bike className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400 font-semibold">No available delivery offers right now.</p>
              <p className="text-[11px] text-slate-500">New orders will appear here automatically.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="bg-[#0B132B]/90 border border-slate-800 hover:border-emerald-500/50 rounded-3xl p-4 space-y-3 shadow-xl transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-xs text-white bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-800">
                      {offer.orderNumber}
                    </span>
                    <span className="font-mono font-black text-xs text-emerald-400">
                      {rupees(offer.totalPaise)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-cyan-300">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="font-bold truncate">{offer.deliveryTarget || offer.deliveryAddress || 'Dhaba Customer'}</span>
                  </div>

                  {offer.collectCashPaise > 0 && (
                    <div className="text-xs font-bold text-amber-300 bg-amber-950/50 border border-amber-800/50 px-2.5 py-1 rounded-xl flex items-center justify-between">
                      <span>Collect Cash (COD):</span>
                      <span className="font-mono font-black">{rupees(offer.collectCashPaise)}</span>
                    </div>
                  )}

                  <button
                    onClick={() => claimOrder(offer.id)}
                    disabled={isBusy || !status?.isOnline}
                    className="w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black py-3 text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span>{status?.isOnline ? 'CLAIM DELIVERY' : 'GO ONLINE TO CLAIM'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function ConnectionPill({ state, detail }: { state: string; detail: string }) {
  if (state === 'live') {
    return (
      <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
        <span>Connected</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-[11px] text-rose-400 font-bold">
      <WifiOff className="w-3 h-3" />
      <span>Disconnected</span>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<DriverApp />);
}
