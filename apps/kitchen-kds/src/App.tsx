import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChefHat, Lock, RefreshCw, Volume2, Wifi, WifiOff } from 'lucide-react';
import { useRealtime } from '../../../packages/realtime/useRealtime';

/**
 * Statuses the kitchen acts on. The board deliberately stops at
 * `ready_for_pickup`: once an order is claimed by a driver it is dispatch's
 * problem, and leaving it on the board invites the kitchen to keep touching it.
 */
type KitchenStatus = 'placed' | 'accepted' | 'preparing' | 'ready_for_pickup';

type KitchenOrder = {
  id: string;
  orderNumber: string;
  status: KitchenStatus | 'assigned' | 'picked_up' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'refunded' | 'awaiting_payment' | 'payment_failed';
  bill: { totalPaise: number };
  paymentStatus: string;
  deliveryTarget: string | null;
  cookingInstructions?: string | null;
  createdAt: string;
  items: { quantity: number; menuItem: { nameEn: string } }[];
};

/** Money is integer paise on the wire; only the render converts. */
const rupees = (paise: number) => `₹${(paise / 100).toFixed(0)}`;

const api = async <T,>(path: string, options: RequestInit = {}) => {
  const response = await fetch(`/api/v1${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || 'Request failed.');
  return response.json() as Promise<T>;
};

/** Orders the board shows, in column order. */
const BOARD: [KitchenStatus, string, string, KitchenStatus | null][] = [
  ['placed', 'New orders', 'ACCEPT', 'accepted'],
  ['accepted', 'Accepted', 'START COOKING', 'preparing'],
  ['preparing', 'Cooking', 'READY FOR PICKUP', 'ready_for_pickup'],
  ['ready_for_pickup', 'Awaiting rider', '', null],
];

const BOARD_STATUSES = new Set<string>(BOARD.map(([status]) => status));

export default function App() {
  const [employeeId, setEmployeeId] = useState('KITCHEN-001');
  const [pin, setPin] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem('ipl_dhaba_kitchen_token') || '');
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const hasLoadedOrders = useRef(false);

  const playNewOrderChime = () => {
    const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.setValueAtTime(1175, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.16, context.currentTime);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.3);
  };

  /**
   * Merges one order into the board.
   *
   * Socket payloads arrive per-order, so this is the only writer of `orders`
   * outside the initial fetch. An order that has left the kitchen's columns is
   * dropped rather than left to accumulate on a screen that runs all day.
   */
  const upsertOrder = (incoming: KitchenOrder | undefined) => {
    if (!incoming?.id) return;
    setOrders((current) => {
      const without = current.filter((order) => order.id !== incoming.id);
      if (!BOARD_STATUSES.has(incoming.status)) return without;
      return [...without, incoming].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  };

  /**
   * One fetch to populate the board, not a poll.
   *
   * Still needed on sign-in and on reconnect: a socket delivers changes from the
   * moment it connects, so without this the board would be empty until the next
   * order happened to move.
   */
  const loadOrders = async () => {
    if (!token) return;
    try {
      const next = await api<KitchenOrder[]>('/orders?scope=active', { headers: { Authorization: `Bearer ${token}` } });
      setOrders(next.filter((order) => BOARD_STATUSES.has(order.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      hasLoadedOrders.current = true;
      setError('');
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load orders.'); }
  };

  const { state: connection, detail: connectionDetail } = useRealtime(token, {
    onState: (next) => {
      // A reconnect means the board may have missed events while it was down,
      // so it is resynced once rather than trusted to be current.
      if (next === 'live') void loadOrders();
      if (next === 'unauthorized') { localStorage.removeItem('ipl_dhaba_kitchen_token'); setToken(''); }
    },
    onOrderCreated: ({ order }) => {
      upsertOrder(order);
      if (hasLoadedOrders.current) playNewOrderChime();
    },
    onOrderUpdated: ({ order, orderId, status }) => {
      if (order) { upsertOrder(order); return; }
      // Some publishers carry only the id and status — enough to move a card
      // between columns or take it off the board.
      setOrders((current) =>
        status && BOARD_STATUSES.has(status)
          ? current.map((existing) => (existing.id === orderId ? { ...existing, status: status as KitchenStatus } : existing))
          : current.filter((existing) => existing.id !== orderId),
      );
    },
  });

  useEffect(() => { void loadOrders(); }, [token]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault(); setIsLoading(true);
    try {
      const result = await api<{ accessToken: string }>('/auth/staff-login', { method: 'POST', body: JSON.stringify({ employeeId, pin }) });
      localStorage.setItem('ipl_dhaba_kitchen_token', result.accessToken); setToken(result.accessToken); setPin('');
    } catch (loginError) { setError(loginError instanceof Error ? loginError.message : 'Sign in failed.'); } finally { setIsLoading(false); }
  };

  /** Optimism is unnecessary — the server echoes the move back over the socket. */
  const transition = async (order: KitchenOrder, status: KitchenStatus) => {
    setIsLoading(true);
    try { await api(`/orders/${order.id}/status`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }) }); }
    catch (transitionError) { setError(transitionError instanceof Error ? transitionError.message : 'Unable to update order.'); }
    finally { setIsLoading(false); }
  };

  const counts = useMemo(() => {
    const byStatus = new Map<string, KitchenOrder[]>();
    for (const order of orders) byStatus.set(order.status, [...(byStatus.get(order.status) ?? []), order]);
    return byStatus;
  }, [orders]);

  if (!token) return <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4"><form onSubmit={signIn} className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4"><ChefHat className="w-10 h-10 text-emerald-400 mx-auto" /><h1 className="text-center font-black text-xl">Kitchen KDS</h1><input required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} placeholder="Employee ID" className="w-full rounded-xl bg-slate-800 border border-slate-700 p-3" /><input required type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="PIN" className="w-full rounded-xl bg-slate-800 border border-slate-700 p-3" />{error && <p className="text-xs text-rose-400">{error}</p>}<button disabled={isLoading} className="w-full rounded-xl bg-emerald-500 py-3 font-black text-white disabled:opacity-50">{isLoading ? 'Signing in…' : 'Sign in'}</button></form></main>;

  return <main className="min-h-screen bg-slate-950 text-white p-6"><header className="max-w-7xl mx-auto flex items-center justify-between mb-6"><div className="flex items-center gap-3"><ChefHat className="w-8 h-8 text-emerald-400" /><div><h1 className="font-black text-xl">IPL Dhaba Kitchen</h1><ConnectionPill state={connection} detail={connectionDetail} /></div></div><div className="flex gap-2"><button onClick={playNewOrderChime} aria-label="Kitchen bell" className="p-2 rounded-xl bg-slate-800"><Volume2 className="w-4 h-4" /></button><button onClick={() => void loadOrders()} aria-label="Resync board" className="p-2 rounded-xl bg-slate-800"><RefreshCw className="w-4 h-4" /></button><button onClick={() => { localStorage.removeItem('ipl_dhaba_kitchen_token'); setToken(''); }} aria-label="Sign out" className="p-2 rounded-xl bg-slate-800"><Lock className="w-4 h-4" /></button></div></header>{error && <p className="max-w-7xl mx-auto mb-4 text-sm text-rose-400">{error}</p>}<section className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-5">{BOARD.map(([status, title, action, next]) => { const column = counts.get(status) ?? []; return <div key={status} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4"><h2 className="font-black text-sm text-emerald-400 mb-4">{title} ({column.length})</h2><div className="space-y-3">{column.map((order) => <article key={order.id} className="rounded-2xl bg-slate-950 border border-slate-800 p-4 space-y-3"><div className="flex justify-between text-xs"><strong>{order.orderNumber || `#${order.id.substring(0, 8)}`}</strong><span className="text-amber-300">{Math.max(0, Math.floor((clock - new Date(order.createdAt).getTime()) / 60000))} min</span></div><p className="text-sm font-bold">{order.items.map((item) => `${item.menuItem.nameEn} ×${item.quantity}`).join(', ')}</p><p className="text-xs text-slate-400">{order.deliveryTarget}</p><p className="text-xs font-black text-emerald-400">{rupees(order.bill?.totalPaise ?? 0)} · {order.paymentStatus}</p>{order.cookingInstructions && <p className="text-xs text-amber-300">Note: {order.cookingInstructions}</p>}{next && <button disabled={isLoading} onClick={() => void transition(order, next)} className="w-full rounded-xl bg-emerald-500 py-2.5 text-xs font-black text-white flex justify-center gap-1">{action}<ArrowRight className="w-4 h-4" /></button>}</article>)}{column.length === 0 && <p className="text-xs text-slate-500">Nothing here.</p>}</div></div>; })}</section></main>;
}

/** Makes a dead socket visible — a silently stale board is worse than no board. */
function ConnectionPill({ state, detail }: { state: string; detail: string }) {
  if (state === 'live') return <p className="text-xs text-emerald-400 flex items-center gap-1"><Wifi className="w-3 h-3" />Live</p>;
  if (state === 'connecting') return <p className="text-xs text-slate-400 flex items-center gap-1"><Wifi className="w-3 h-3" />Connecting…</p>;
  return <p className="text-xs text-rose-400 flex items-center gap-1"><WifiOff className="w-3 h-3" />Offline{detail ? ` — ${detail}` : ''}. Board may be stale.</p>;
}
