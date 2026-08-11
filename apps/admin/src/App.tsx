import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ChefHat, LogOut, PackageCheck, RefreshCw, ShoppingBag, UtensilsCrossed, Wifi, WifiOff } from 'lucide-react';
import { useRealtime } from '../../../packages/realtime/useRealtime';

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  bill: { totalPaise: number };
  paymentStatus: string;
  paymentMethod: string;
  deliveryTarget: string | null;
  createdAt: string;
  items: { quantity: number; menuItem: { nameEn: string } }[];
};
type MenuItem = { id: string; nameEn: string; pricePaise: number; category: string; isAvailable: boolean };
type Health = { status: string; uptimeSeconds?: number; timestamp: string };

/** Money is integer paise on the wire; only the render divides. */
const rupees = (paise: number) => `₹${(paise / 100).toFixed(0)}`;

/** Revenue counts money actually collected, not orders that were merely placed. */
const COUNTS_AS_REVENUE = new Set(['delivered', 'picked_up', 'out_for_delivery', 'assigned', 'ready_for_pickup', 'preparing', 'accepted']);

const api = async <T,>(path: string, token?: string, options: RequestInit = {}) => {
  const response = await fetch(`/api/v1${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || 'Request failed.');
  return response.json() as Promise<T>;
};

export default function App() {
  const [employeeId, setEmployeeId] = useState('ADMIN-001');
  const [pin, setPin] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem('ipl_dhaba_admin_token') || '');
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState('');

  /**
   * One fetch on sign-in and on reconnect, not a poll.
   *
   * Menu and health are not socket-backed, so the manual refresh button remains
   * the way to re-read them — order traffic no longer drags them along with it
   * every three seconds.
   */
  const refresh = async () => {
    if (!token) return;
    try {
      // `/menu/manage`, not `/menu`: the public route hides sold-out items, so
      // the console could never switch one back on.
      const [nextOrders, nextMenu, nextHealth] = await Promise.all([api<Order[]>('/orders', token), api<MenuItem[]>('/menu/manage', token), api<Health>('/health')]);
      setOrders(nextOrders); setMenu(nextMenu); setHealth(nextHealth); setError('');
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load operations data.'); }
  };

  const upsertOrder = (incoming: Order | undefined) => {
    if (!incoming?.id) return;
    setOrders((current) => [incoming, ...current.filter((order) => order.id !== incoming.id)]);
  };

  const { state: connection, detail: connectionDetail } = useRealtime(token, {
    onState: (next) => {
      if (next === 'live') void refresh();
      if (next === 'unauthorized') { localStorage.removeItem('ipl_dhaba_admin_token'); setToken(''); }
    },
    onOrderCreated: ({ order }) => upsertOrder(order),
    onOrderUpdated: ({ order, orderId, status }) => {
      if (order) { upsertOrder(order); return; }
      // Status-only payloads still move the card; the totals are unaffected
      // because they are derived from `bill`, which does not change with status.
      setOrders((current) => current.map((existing) => (existing.id === orderId && status ? { ...existing, status } : existing)));
    },
    onPaymentUpdated: ({ orderId }) => {
      // A capture or refund changes what the revenue tile should say, and the
      // event carries no order body — so this one order is re-read.
      void api<Order>(`/orders/${orderId}`, token).then(upsertOrder).catch(() => undefined);
    },
  });

  useEffect(() => { void refresh(); }, [token]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const result = await api<{ accessToken: string }>('/auth/staff-login', undefined, { method: 'POST', body: JSON.stringify({ employeeId, pin }) });
      localStorage.setItem('ipl_dhaba_admin_token', result.accessToken); setToken(result.accessToken); setPin('');
    } catch (loginError) { setError(loginError instanceof Error ? loginError.message : 'Sign in failed.'); }
  };

  const toggleAvailability = async (item: MenuItem) => {
    try { await api(`/menu/${item.id}/availability`, token, { method: 'PATCH', body: JSON.stringify({ isAvailable: !item.isAvailable }) }); await refresh(); }
    catch (updateError) { setError(updateError instanceof Error ? updateError.message : 'Unable to update inventory.'); }
  };

  const revenuePaise = useMemo(
    () => orders.filter((order) => COUNTS_AS_REVENUE.has(order.status)).reduce((total, order) => total + (order.bill?.totalPaise ?? 0), 0),
    [orders],
  );
  const activeOrders = orders.filter((order) => !['delivered', 'cancelled', 'refunded'].includes(order.status));

  if (!token) return <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4"><form onSubmit={login} className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4"><Activity className="w-10 h-10 mx-auto text-emerald-400" /><h1 className="text-center font-black text-xl">Operations Console</h1><input required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} placeholder="Admin employee ID" className="w-full rounded-xl bg-slate-800 border border-slate-700 p-3" /><input required type="password" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="PIN" className="w-full rounded-xl bg-slate-800 border border-slate-700 p-3" />{error && <p className="text-xs text-rose-400">{error}</p>}<button className="w-full rounded-xl bg-emerald-500 py-3 font-black">Sign in</button></form></main>;

  return <main className="min-h-screen bg-slate-950 text-white p-6"><header className="max-w-7xl mx-auto flex justify-between items-center mb-6"><div><h1 className="text-2xl font-black">IPL Dhaba Operations</h1>{connection === 'live' ? <p className="text-xs text-emerald-400 flex items-center gap-1"><Wifi className="w-3 h-3" />Live</p> : <p className="text-xs text-rose-400 flex items-center gap-1"><WifiOff className="w-3 h-3" />{connection === 'connecting' ? 'Connecting…' : `Offline${connectionDetail ? ` — ${connectionDetail}` : ''}. Figures may be stale.`}</p>}</div><div className="flex gap-2"><button onClick={() => void refresh()} className="p-2 rounded-xl bg-slate-800"><RefreshCw className="w-4 h-4" /></button><button onClick={() => { localStorage.removeItem('ipl_dhaba_admin_token'); setToken(''); }} className="p-2 rounded-xl bg-slate-800"><LogOut className="w-4 h-4" /></button></div></header>{error && <p className="max-w-7xl mx-auto mb-4 text-rose-400">{error}</p>}<section className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"><Metric label="Backend" value={health?.status || 'Loading'} icon={<Activity className="text-emerald-400" />} /><Metric label="Orders" value={String(orders.length)} icon={<ShoppingBag className="text-amber-400" />} /><Metric label="Active queue" value={String(activeOrders.length)} icon={<ChefHat className="text-orange-400" />} /><Metric label="Order revenue" value={rupees(revenuePaise)} icon={<PackageCheck className="text-emerald-400" />} /></section><section className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-2 gap-6"><div className="rounded-3xl bg-slate-900 border border-slate-800 p-5"><h2 className="font-black mb-4">Live order management</h2><div className="space-y-3 max-h-[65vh] overflow-y-auto">{orders.map((order) => <article key={order.id} className="rounded-2xl bg-slate-950 border border-slate-800 p-4"><div className="flex justify-between gap-3"><strong>{order.orderNumber || `#${order.id.substring(0, 8)}`}</strong><span className="text-xs rounded-full bg-slate-800 px-2 py-1">{order.status}</span></div><p className="mt-2 text-sm">{order.items.map((item) => `${item.menuItem.nameEn} ×${item.quantity}`).join(', ')}</p><p className="mt-1 text-xs text-slate-400">{order.deliveryTarget}</p><p className="mt-2 text-sm font-black text-emerald-400">{rupees(order.bill?.totalPaise ?? 0)} · <span className="text-slate-400 font-normal">{order.paymentMethod} · {order.paymentStatus}</span></p></article>)}{orders.length === 0 && <p className="text-sm text-slate-400">No orders have been received yet.</p>}</div></div><div className="rounded-3xl bg-slate-900 border border-slate-800 p-5"><h2 className="font-black mb-4 flex gap-2 items-center"><UtensilsCrossed className="w-5 h-5 text-emerald-400" />Menu inventory</h2><div className="space-y-3 max-h-[65vh] overflow-y-auto">{menu.map((item) => <div key={item.id} className="rounded-2xl bg-slate-950 border border-slate-800 p-4 flex justify-between gap-4"><div><strong className="text-sm">{item.nameEn}</strong><p className="text-xs text-slate-400">{rupees(item.pricePaise)} • {item.category}</p></div><button onClick={() => void toggleAvailability(item)} className={`rounded-xl px-3 py-2 text-xs font-black ${item.isAvailable ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'}`}>{item.isAvailable ? 'In stock' : 'Out of stock'}</button></div>)}{menu.length === 0 && <p className="text-sm text-slate-400">No menu items found.</p>}</div></div></section></main>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4"><div className="flex justify-between items-center text-xs text-slate-400">{label}{icon}</div><p className="mt-3 text-2xl font-black">{value}</p></div>;
}
