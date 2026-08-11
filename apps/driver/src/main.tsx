import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bike, CheckCircle2, KeyRound, LocateFixed, LogOut, MapPinned, Navigation, PackageCheck,
  Power, RefreshCw, Undo2, Wallet, Wifi, WifiOff,
} from 'lucide-react';
import { useRealtime } from '../../../packages/realtime/useRealtime';
import './styles.css';

declare global { interface Window { L?: any } }

/** An unclaimed order in the pickup pool, as `GET /dispatch/available` returns it. */
type Offer = {
  id: string;
  orderNumber: string;
  deliveryType: string;
  deliveryTarget: string | null;
  deliveryAddress: string | null;
  totalPaise: number;
  /** Non-zero only for COD — the driver must know to collect cash. */
  collectCashPaise: number;
  itemCount: number;
  readyAt: string | null;
};

/** The order this driver is carrying, as `GET /dispatch/current` returns it. */
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

/** Money is integer paise on the wire; only the render divides. */
const rupees = (paise: number) => `₹${(paise / 100).toFixed(0)}`;

const api = async <T,>(path: string, options: RequestInit = {}) => {
  const response = await fetch(`/api/v1${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || 'Request failed.');
  return response.status === 204 ? (null as T) : (response.json() as Promise<T>);
};

function DeliveryMap({ position, destinationLabel }: { position: Position | null; destinationLabel: string }) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const riderMarker = useRef<any>(null);
  const destinationMarker = useRef<any>(null);

  // Created once and torn down on unmount. Leaflet keeps a handle on the DOM
  // node plus its own listeners; without `remove()` the node stays referenced
  // after React discards it, and re-mounting throws "container is already
  // initialized" — which is exactly what happens each time a delivery ends.
  useEffect(() => {
    if (!mapElement.current || !window.L || map.current) return;
    map.current = window.L.map(mapElement.current).setView([destination.latitude, destination.longitude], 14);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
      riderMarker.current = null;
      destinationMarker.current = null;
    };
  }, []);

  // Separate from creation so a new delivery relabels the pin instead of
  // silently keeping the previous customer's.
  useEffect(() => {
    if (!map.current || !window.L) return;
    if (!destinationMarker.current) destinationMarker.current = window.L.marker([destination.latitude, destination.longitude]).addTo(map.current);
    destinationMarker.current.bindPopup(destinationLabel || 'Delivery destination');
  }, [destinationLabel]);

  useEffect(() => {
    if (!map.current || !position || !window.L) return;
    const coordinates = [position.latitude, position.longitude];
    if (!riderMarker.current) riderMarker.current = window.L.marker(coordinates).addTo(map.current).bindPopup('Your live location');
    else riderMarker.current.setLatLng(coordinates);
    map.current.fitBounds([coordinates, [destination.latitude, destination.longitude]], { padding: [35, 35] });
  }, [position]);

  return <div ref={mapElement} className="delivery-map" aria-label="Live delivery map" />;
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

  const authed = (options: RequestInit = {}) => ({ ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` } });
  const fail = (error: unknown, fallback: string) => setMessage(error instanceof Error ? error.message : fallback);

  /** The offer pool. Fetched on demand — on sign-in and when an event says it moved. */
  const loadOffers = async () => {
    if (!token) return;
    try { setOffers(await api<Offer[]>('/dispatch/available', authed())); }
    catch (error) { fail(error, 'Unable to load available deliveries.'); }
  };

  const loadActive = async () => {
    if (!token) return;
    try { setActive(await api<ActiveDelivery | null>('/dispatch/current', authed())); }
    catch (error) { fail(error, 'Unable to load your current delivery.'); }
  };

  const loadStatus = async () => {
    if (!token) return;
    try { setStatus(await api<DriverStatus>('/dispatch/status', authed())); }
    catch (error) { fail(error, 'Unable to read your driver status.'); }
  };

  /**
   * Today's completed deliveries.
   *
   * The fee is what the driver is actually paid, so it is derived from the
   * integer paise total rather than a float — a rounding drift here is a
   * payroll dispute.
   */
  const loadEarnings = async () => {
    if (!token) return;
    try {
      const history = await api<{ status: string; deliveredAt: string | null; bill: { totalPaise: number } }[]>(
        '/orders?scope=history&limit=100', authed(),
      );
      const today = new Date().toDateString();
      const delivered = history.filter((order) => order.status === 'delivered' && order.deliveredAt && new Date(order.deliveredAt).toDateString() === today);
      setCompletedToday(delivered.length);
      setEarningsPaise(delivered.reduce((total, order) => total + Math.max(20_00, Math.round((order.bill?.totalPaise ?? 0) * 0.08)), 0));
    } catch (error) { fail(error, 'Unable to load earnings.'); }
  };

  const refreshAll = async () => { await Promise.all([loadStatus(), loadOffers(), loadActive(), loadEarnings()]); };

  const { state: connection, detail: connectionDetail } = useRealtime(token, {
    onState: (next) => {
      // A reconnect may have missed offers, so the pool is resynced once rather
      // than trusted. This is the only place a full refetch happens on a timer-
      // like trigger, and it fires on reconnect — not every three seconds.
      if (next === 'live') void refreshAll();
      if (next === 'unauthorized') { localStorage.removeItem('ipl_dhaba_driver_token'); setToken(''); }
    },
    // `order:offered` carries no address — a driver who has not claimed the order
    // is not entitled to it — so the pool is refetched rather than patched.
    onOrderOffered: () => { void loadOffers(); },
    onOrderTaken: ({ orderId }) => setOffers((current) => current.filter((offer) => offer.id !== orderId)),
    onOrderUpdated: ({ orderId, status: nextStatus }) => {
      setOffers((current) => (nextStatus === 'ready_for_pickup' ? current : current.filter((offer) => offer.id !== orderId)));
      // Someone else moved this order — a kitchen cancel, a sweep reassignment.
      // Re-read rather than guess which of the two it was.
      if (active?.id === orderId) { void loadActive(); void loadStatus(); }
    },
  });

  useEffect(() => { if (token) void refreshAll(); }, [token]);

  /**
   * Publishes GPS while carrying an order.
   *
   * This interval is a data feed, not a poll: each tick sends one reading the
   * device already has, and it is what makes the customer's map move.
   */
  useEffect(() => {
    if (!token || !active || !navigator.geolocation) return;
    const orderId = active.id;
    const watchId = navigator.geolocation.watchPosition(
      (next) => {
        const heading = next.coords.heading;
        const current: Position = {
          latitude: next.coords.latitude,
          longitude: next.coords.longitude,
          // Stationary devices report NaN or null here, and the DTO rejects
          // both — so it is omitted rather than sent and 400'd every tick.
          ...(typeof heading === 'number' && Number.isFinite(heading) ? { heading } : {}),
        };
        lastPosition.current = current;
        setPosition(current);
      },
      (error) => setMessage(`Location permission is required: ${error.message}`),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    const upload = () => {
      if (!lastPosition.current) return;
      void api(`/orders/${orderId}/location`, authed({ method: 'PATCH', body: JSON.stringify(lastPosition.current) }))
        .catch((error) => fail(error, 'Location update failed.'));
    };
    upload();
    const interval = window.setInterval(upload, 3000);
    return () => { navigator.geolocation.clearWatch(watchId); window.clearInterval(interval); };
  }, [token, active?.id]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const result = await api<{ accessToken: string }>('/auth/staff-login', { method: 'POST', body: JSON.stringify({ employeeId, pin }) });
      localStorage.setItem('ipl_dhaba_driver_token', result.accessToken); setToken(result.accessToken); setPin('');
    } catch (error) { fail(error, 'Sign in failed.'); }
  };

  /** Every dispatch action funnels through here so none of them can forget to resync. */
  const act = async (run: () => Promise<unknown>, success: string) => {
    setIsBusy(true);
    try { await run(); setMessage(success); await refreshAll(); }
    catch (error) { fail(error, 'That action could not be completed.'); await refreshAll(); }
    finally { setIsBusy(false); }
  };

  const toggleOnline = () => act(
    () => api<DriverStatus>('/dispatch/status', authed({ method: 'PATCH', body: JSON.stringify({ isOnline: !status?.isOnline }) })),
    status?.isOnline ? 'You are offline.' : 'You are online and receiving offers.',
  );

  // A losing claim returns 409 from the atomic update, which `act` surfaces as
  // "That order has already been assigned" — the honest answer, not a silent
  // no-op that leaves two drivers believing they won.
  const claim = (orderId: string) => act(() => api('/dispatch/claim', authed({ method: 'POST', body: JSON.stringify({ orderId }) })), 'Delivery accepted. Collect it from the kitchen.');
  const pickUp = (orderId: string) => act(() => api(`/dispatch/${orderId}/pickup`, authed({ method: 'POST' })), 'Picked up. The customer now has the delivery code.');
  const release = (orderId: string) => act(() => api(`/dispatch/${orderId}/release`, authed({ method: 'POST', body: JSON.stringify({ reason: 'Returned by the rider.' }) })), 'Delivery returned to the pool.');

  const deliver = async (orderId: string) => {
    if (!/^\d{6}$/.test(otp.trim())) { setMessage('Ask the customer for their six-digit delivery code.'); return; }
    await act(() => api(`/dispatch/${orderId}/deliver`, authed({ method: 'POST', body: JSON.stringify({ otp: otp.trim() }) })), 'Delivered. Great work!');
    setOtp(''); setPosition(null);
  };

  const carrying = active && (active.status === 'picked_up' || active.status === 'out_for_delivery');
  const itemLine = useMemo(
    () => (active?.items ?? []).map((item) => `${item.nameSnapshot ?? 'Item'} ×${item.quantity}`).join(', '),
    [active],
  );

  if (!token) return <main className="driver-page"><form onSubmit={login} className="login-card"><Bike className="brand-icon" /><h1>IPL Dhaba Rider</h1><p>Sign in to receive dispatched deliveries and share live location.</p><input required placeholder="Employee ID" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} /><input required type="password" inputMode="numeric" placeholder="PIN" value={pin} onChange={(event) => setPin(event.target.value)} /><button>Sign in</button>{message && <p className="notice">{message}</p>}</form></main>;

  return <main className="driver-page"><section className="driver-shell">
    <header>
      <div><p className="eyebrow">IPL DHABA EXPRESS</p><h1>Delivery partner</h1>
        {connection === 'live'
          ? <p className="live-pill"><Wifi /> Live</p>
          : <p className="live-pill" style={{ color: '#fca5a5' }}><WifiOff /> {connection === 'connecting' ? 'Connecting…' : `Offline${connectionDetail ? ` — ${connectionDetail}` : ''}`}</p>}
      </div>
      <div className="header-actions">
        <button onClick={() => void toggleOnline()} disabled={isBusy} aria-label={status?.isOnline ? 'Go offline' : 'Go online'} style={status?.isOnline ? { background: '#065f46', color: '#6ee7b7' } : undefined}><Power /></button>
        <button onClick={() => void refreshAll()} aria-label="Refresh deliveries"><RefreshCw /></button>
        <button onClick={() => { localStorage.removeItem('ipl_dhaba_driver_token'); setToken(''); }} aria-label="Sign out"><LogOut /></button>
      </div>
    </header>

    <section className="earnings"><Wallet /><div><p>Today’s earnings</p><strong>{rupees(earningsPaise)}</strong></div><span>{completedToday} completed</span></section>
    {message && <p className="notice">{message}</p>}

    {!status?.isOnline && !active && <section className="queue"><p className="empty">You are offline. Tap the power button to start receiving delivery offers.</p></section>}

    {active ? <section className="active-delivery">
      <div className="section-heading">
        <div><p className="eyebrow">{carrying ? 'ON THE WAY' : 'COLLECT FROM KITCHEN'}</p><h2>{active.orderNumber}</h2></div>
        {carrying && <span className="live-pill"><LocateFixed /> GPS live</span>}
      </div>
      {carrying && <DeliveryMap position={position} destinationLabel={active.deliveryTarget || 'Delivery destination'} />}
      <p className="destination"><MapPinned /> {active.deliveryAddress || active.deliveryTarget}</p>
      <p className="items">{itemLine}</p>
      {active.paymentMethod === 'cod' && <p className="notice"><PackageCheck style={{ width: 14, verticalAlign: '-2px' }} /> Collect {rupees(active.totalAmountPaise)} in cash on handover.</p>}

      {carrying ? <>
        {/* The code is the only thing separating "the rider has the food" from
            "the rider can close the order without handing it over", so it is
            typed here from what the customer reads out — never auto-filled. */}
        <label className="destination" htmlFor="delivery-otp"><KeyRound /> Ask the customer for their 6-digit code</label>
        <input id="delivery-otp" inputMode="numeric" maxLength={6} placeholder="● ● ● ● ● ●" value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
          style={{ width: '100%', border: '1px solid #334155', background: '#1e293b', borderRadius: 13, padding: 13, color: '#fff', letterSpacing: '.4em', textAlign: 'center' }} />
        <button className="complete-button" disabled={isBusy} onClick={() => void deliver(active.id)}><CheckCircle2 /> Complete delivery</button>
      </> : <button className="complete-button" disabled={isBusy} onClick={() => void pickUp(active.id)}><PackageCheck /> Confirm pickup</button>}

      <button disabled={isBusy} onClick={() => void release(active.id)} style={{ width: '100%', marginTop: 10, background: '#1e293b', color: '#fca5a5', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}><Undo2 style={{ width: 16 }} /> Return to pool</button>
    </section> : status?.isOnline && <section className="queue">
      <div className="section-heading"><div><p className="eyebrow">AVAILABLE</p><h2>Ready for pickup</h2></div><span>{offers.length}</span></div>
      {offers.length === 0 ? <p className="empty">No deliveries waiting. New ones appear here the moment the kitchen marks them ready.</p> : offers.map((offer) => <article key={offer.id}>
        <div>
          <strong>{offer.orderNumber}</strong>
          <p>{offer.itemCount} item{offer.itemCount === 1 ? '' : 's'} · {rupees(offer.totalPaise)}{offer.collectCashPaise > 0 ? ` · collect ${rupees(offer.collectCashPaise)} cash` : ''}</p>
          <p className="muted"><Navigation /> {offer.deliveryAddress || offer.deliveryTarget}</p>
        </div>
        <button disabled={isBusy} onClick={() => void claim(offer.id)}>Accept</button>
      </article>)}
    </section>}
  </section></main>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><DriverApp /></React.StrictMode>);
