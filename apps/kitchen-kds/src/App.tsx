import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ChefHat,
  Clock,
  Flame,
  CheckCircle2,
  Lock,
  RefreshCw,
  Volume2,
  Wifi,
  WifiOff,
  AlertCircle,
  MapPin,
  Utensils,
  BellRing,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useRealtime } from '../../../packages/realtime/useRealtime';

type KitchenStatus = 'placed' | 'accepted' | 'preparing' | 'ready_for_pickup';

type KitchenOrder = {
  id: string;
  orderNumber: string;
  status:
    | KitchenStatus
    | 'assigned'
    | 'picked_up'
    | 'out_for_delivery'
    | 'delivered'
    | 'cancelled'
    | 'refunded'
    | 'awaiting_payment'
    | 'payment_failed';
  bill: { totalPaise: number };
  paymentStatus: string;
  deliveryTarget: string | null;
  cookingInstructions?: string | null;
  createdAt: string;
  items: { quantity: number; menuItem: { nameEn: string } }[];
};

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

const BOARD: Array<{
  status: KitchenStatus;
  title: string;
  action: string;
  next: KitchenStatus | null;
  accent: string;
  border: string;
  bgHeader: string;
}> = [
  {
    status: 'placed',
    title: 'New Orders',
    action: 'ACCEPT ORDER',
    next: 'accepted',
    accent: 'text-amber-400',
    border: 'border-amber-500/40',
    bgHeader: 'bg-amber-950/40',
  },
  {
    status: 'accepted',
    title: 'Accepted',
    action: 'START COOKING',
    next: 'preparing',
    accent: 'text-cyan-400',
    border: 'border-cyan-500/40',
    bgHeader: 'bg-cyan-950/40',
  },
  {
    status: 'preparing',
    title: 'Cooking',
    action: 'READY FOR DISPATCH',
    next: 'ready_for_pickup',
    accent: 'text-orange-400',
    border: 'border-orange-500/40',
    bgHeader: 'bg-orange-950/40',
  },
  {
    status: 'ready_for_pickup',
    title: 'Awaiting Rider',
    action: '',
    next: null,
    accent: 'text-emerald-400',
    border: 'border-emerald-500/40',
    bgHeader: 'bg-emerald-950/40',
  },
];

const BOARD_STATUSES = new Set<string>(BOARD.map((b) => b.status));

export default function App() {
  const [employeeId, setEmployeeId] = useState('KITCHEN-001');
  const [pin, setPin] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem('ipl_dhaba_kitchen_token') || '');
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const hasLoadedOrders = useRef(false);

  const [cancelledAlert, setCancelledAlert] = useState<string | null>(null);

  const playCancellationBuzzer = () => {
    const AudioContextConstructor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(300, context.currentTime);
    oscillator.frequency.setValueAtTime(200, context.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.5);
  };

  const playNewOrderChime = () => {
    const AudioContextConstructor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.setValueAtTime(1175, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.2, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.35);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.35);
  };

  const upsertOrder = (incoming: KitchenOrder | undefined) => {
    if (!incoming?.id) return;
    setOrders((current) => {
      const without = current.filter((order) => order.id !== incoming.id);
      if (!BOARD_STATUSES.has(incoming.status)) {
        if (incoming.status === 'cancelled' || incoming.status === 'refunded') {
          setCancelledAlert(`🚨 ORDER ${incoming.orderNumber || `#${incoming.id.substring(0, 8)}`} CANCELLED BY CUSTOMER! STOP PREPARING.`);
          playCancellationBuzzer();
        }
        return without;
      }
      return [...without, incoming].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  };

  const loadOrders = async () => {
    if (!token) return;
    try {
      const next = await api<KitchenOrder[]>('/orders?scope=active', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders(
        next
          .filter((order) => BOARD_STATUSES.has(order.status))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      );
      hasLoadedOrders.current = true;
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load orders.');
    }
  };

  const { state: connection, detail: connectionDetail } = useRealtime(token, {
    onState: (next) => {
      if (next === 'live') void loadOrders();
      if (next === 'unauthorized') {
        localStorage.removeItem('ipl_dhaba_kitchen_token');
        setToken('');
      }
    },
    onOrderCreated: ({ order }) => {
      upsertOrder(order);
      if (hasLoadedOrders.current) playNewOrderChime();
    },
    onOrderUpdated: ({ order, orderId, status }) => {
      if (order) {
        upsertOrder(order);
        return;
      }
      setOrders((current) =>
        status && BOARD_STATUSES.has(status)
          ? current.map((existing) =>
              existing.id === orderId ? { ...existing, status: status as KitchenStatus } : existing,
            )
          : current.filter((existing) => existing.id !== orderId),
      );
    },
  });

  useEffect(() => {
    void loadOrders();
  }, [token]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 5000);
    return () => window.clearInterval(interval);
  }, []);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const result = await api<{ accessToken: string }>('/auth/staff-login', {
        method: 'POST',
        body: JSON.stringify({ employeeId, pin }),
      });
      localStorage.setItem('ipl_dhaba_kitchen_token', result.accessToken);
      setToken(result.accessToken);
      setPin('');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Sign in failed. Check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const transition = async (order: KitchenOrder, status: KitchenStatus) => {
    setIsLoading(true);
    try {
      await api(`/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : 'Unable to update order.');
    } finally {
      setIsLoading(false);
    }
  };

  const rejectOrder = async (order: KitchenOrder, reason = 'Out of stock') => {
    setIsLoading(true);
    try {
      await api(`/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'cancelled', reason }),
      });
      setOrders((current) => current.filter((o) => o.id !== order.id));
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : 'Unable to reject order.');
    } finally {
      setIsLoading(false);
    }
  };

  const counts = useMemo(() => {
    const byStatus = new Map<string, KitchenOrder[]>();
    for (const order of orders) {
      byStatus.set(order.status, [...(byStatus.get(order.status) ?? []), order]);
    }
    return byStatus;
  }, [orders]);

  if (!token) {
    return (
      <main className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-4 selection:bg-emerald-500 selection:text-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-emerald-950/30 via-slate-950 to-slate-950 pointer-events-none" />
        <form
          onSubmit={signIn}
          className="relative w-full max-w-md bg-[#0B132B]/90 backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-8 space-y-6 shadow-2xl shadow-emerald-950/50"
        >
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <ChefHat className="w-8 h-8 text-emerald-400" />
              </div>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white font-display">Kitchen KDS</h1>
            <p className="text-xs text-slate-400 font-medium">IPL Dhaba Realtime Kitchen Operations</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300">Staff Employee ID</label>
              <input
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                placeholder="KITCHEN-001"
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

          {error && (
            <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            disabled={isLoading}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-95 text-slate-950 font-black py-3.5 text-sm shadow-fiery-glow transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoading ? 'Authenticating…' : 'Sign In to Kitchen KDS'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white p-4 md:p-6 select-none font-sans">
      {/* KDS Header Bar */}
      <header className="max-w-[1700px] mx-auto bg-[#0B132B]/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <ChefHat className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-lg text-white font-display tracking-wide">IPL Dhaba Kitchen Display</h1>
              <span className="text-[10px] font-extrabold text-amber-400 bg-amber-950/60 border border-amber-800/50 px-2 py-0.5 rounded-full">
                KDS v2.0
              </span>
            </div>
            <ConnectionPill state={connection} detail={connectionDetail} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={playNewOrderChime}
            title="Test Bell Chime"
            className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <BellRing className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Test Bell</span>
          </button>

          <button
            onClick={() => void loadOrders()}
            title="Resync KDS Board"
            className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Sync</span>
          </button>

          <button
            onClick={() => {
              localStorage.removeItem('ipl_dhaba_kitchen_token');
              setToken('');
            }}
            title="Sign Out"
            className="p-2.5 rounded-2xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <Lock className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {cancelledAlert && (
        <div className="max-w-[1700px] mx-auto mb-4 p-4 rounded-2xl bg-rose-950/90 border border-rose-500 text-rose-200 text-sm font-black flex items-center justify-between shadow-2xl shadow-rose-950/80 animate-bounce">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
            <span>{cancelledAlert}</span>
          </div>
          <button
            onClick={() => setCancelledAlert(null)}
            className="px-3 py-1 bg-rose-900 hover:bg-rose-800 border border-rose-700 text-white rounded-xl text-xs cursor-pointer"
          >
            DISMISS
          </button>
        </div>
      )}

      {error && (
        <div className="max-w-[1700px] mx-auto mb-4 p-3 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KDS 4-Column Board */}
      <section className="max-w-[1700px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {BOARD.map(({ status, title, action, next, accent, border, bgHeader }) => {
          const columnOrders = counts.get(status) ?? [];
          return (
            <div
              key={status}
              className={`rounded-3xl border ${border} bg-[#0B132B]/60 backdrop-blur-md p-4 flex flex-col min-h-[750px] shadow-2xl`}
            >
              {/* Column Header */}
              <div className={`rounded-2xl ${bgHeader} border ${border} p-3.5 mb-4 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  {status === 'placed' && <BellRing className="w-4 h-4 text-amber-400 animate-bounce" />}
                  {status === 'accepted' && <Utensils className="w-4 h-4 text-cyan-400" />}
                  {status === 'preparing' && <Flame className="w-4 h-4 text-orange-400 animate-pulse" />}
                  {status === 'ready_for_pickup' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  <h2 className={`font-black text-sm tracking-wide ${accent}`}>{title}</h2>
                </div>
                <span className="w-7 h-7 rounded-xl bg-slate-900/90 border border-slate-700/60 font-mono font-black text-xs text-white flex items-center justify-center">
                  {columnOrders.length}
                </span>
              </div>

              {/* Order Cards List */}
              <div className="space-y-3.5 flex-1 overflow-y-auto pr-1">
                {columnOrders.map((order) => {
                  const elapsedMinutes = Math.max(
                    0,
                    Math.floor((clock - new Date(order.createdAt).getTime()) / 60000),
                  );
                  const isUrgent = elapsedMinutes >= 15;

                  return (
                    <article
                      key={order.id}
                      className={`relative rounded-2xl bg-[#0F172A] border ${
                        isUrgent ? 'border-rose-500/70 shadow-rose-950/50' : 'border-slate-800'
                      } p-4 space-y-3 shadow-xl transition-all hover:border-slate-700`}
                    >
                      {/* Order Header Info */}
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                        <span className="font-mono font-black text-sm text-white tracking-wider bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-800">
                          {order.orderNumber || `#${order.id.substring(0, 8)}`}
                        </span>

                        <div
                          className={`flex items-center gap-1 text-xs font-mono font-bold px-2.5 py-1 rounded-xl border ${
                            isUrgent
                              ? 'bg-rose-950/80 text-rose-300 border-rose-800 animate-pulse'
                              : 'bg-slate-900 text-amber-300 border-slate-800'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{elapsedMinutes}m elapsed</span>
                        </div>
                      </div>

                      {/* Items List */}
                      <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-200">{item.menuItem.nameEn}</span>
                            <span className="font-mono font-black text-amber-400 bg-amber-950/50 border border-amber-800/40 px-2 py-0.5 rounded-lg shrink-0">
                              ×{item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Delivery Target Location */}
                      {order.deliveryTarget && (
                        <div className="flex items-center gap-1.5 text-xs text-cyan-300 bg-cyan-950/40 border border-cyan-900/50 px-2.5 py-1.5 rounded-xl">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                          <span className="font-semibold truncate">{order.deliveryTarget}</span>
                        </div>
                      )}

                      {/* Cooking Instructions */}
                      {order.cookingInstructions && (
                        <div className="text-xs text-amber-300 bg-amber-950/50 border border-amber-800/50 p-2.5 rounded-xl space-y-0.5">
                          <span className="font-extrabold text-[10px] text-amber-400 uppercase tracking-wider block">
                            Note from Customer:
                          </span>
                          <p className="font-medium italic">{order.cookingInstructions}</p>
                        </div>
                      )}

                      {/* Bill & Payment Badge */}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                        <span className="font-black text-emerald-400 font-mono">
                          {rupees(order.bill?.totalPaise ?? 0)}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
                          {order.paymentStatus}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-2">
                        {next && (
                          <button
                            disabled={isLoading}
                            onClick={() => void transition(order, next)}
                            className={`flex-1 rounded-xl py-3 text-xs font-black text-slate-950 flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95 disabled:opacity-50 ${
                              status === 'placed'
                                ? 'bg-amber-400 hover:bg-amber-300'
                                : status === 'accepted'
                                ? 'bg-cyan-400 hover:bg-cyan-300'
                                : 'bg-orange-400 hover:bg-orange-300'
                            }`}
                          >
                            <span>{action}</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                        {['placed', 'accepted'].includes(status) && (
                          <button
                            disabled={isLoading}
                            onClick={() => void rejectOrder(order, 'Out of stock')}
                            className="px-3 rounded-xl py-3 text-xs font-black bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 flex items-center justify-center gap-1.5 shadow-lg transition-all cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
                            title="Reject Order (Out of Stock)"
                          >
                            <XCircle className="w-4 h-4 text-rose-400" />
                            <span>Reject</span>
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}

                {columnOrders.length === 0 && (
                  <div className="h-48 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-600 space-y-1">
                    <Sparkles className="w-6 h-6 opacity-30" />
                    <span className="text-xs font-semibold">No orders in this column</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}

function ConnectionPill({ state, detail }: { state: string; detail: string }) {
  if (state === 'live') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        <Wifi className="w-3.5 h-3.5" />
        <span>Live Realtime Stream</span>
      </div>
    );
  }
  if (state === 'connecting') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold">
        <Wifi className="w-3.5 h-3.5 animate-pulse" />
        <span>Connecting socket…</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-xs text-rose-400 font-bold">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline{detail ? ` (${detail})` : ''}</span>
    </div>
  );
}
