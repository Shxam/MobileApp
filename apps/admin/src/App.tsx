import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ChefHat,
  LogOut,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  UtensilsCrossed,
  Wifi,
  WifiOff,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  AlertCircle,
  QrCode,
  DollarSign,
  UserCheck,
} from 'lucide-react';
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
  cancellationReason?: string | null;
  isFlagged?: boolean;
  flaggedReason?: string | null;
  flaggedAt?: string | null;
  reviewedAt?: string | null;
  items: { quantity: number; menuItem: { nameEn: string } }[];
};

type MenuItem = {
  id: string;
  nameEn: string;
  pricePaise: number;
  category: string;
  isAvailable: boolean;
};

type Health = { status: string; uptimeSeconds?: number; timestamp: string };

const rupees = (paise: number) => `₹${(paise / 100).toFixed(0)}`;

const COUNTS_AS_REVENUE = new Set([
  'delivered',
  'picked_up',
  'out_for_delivery',
  'assigned',
  'ready_for_pickup',
  'preparing',
  'accepted',
]);

const api = async <T,>(path: string, token?: string, options: RequestInit = {}) => {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
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

const backendHealth = async () => {
  const response = await fetch('/health');
  if (!response.ok) throw new Error('Health check failed.');
  return response.json() as Promise<Health>;
};

export default function App() {
  const [employeeId, setEmployeeId] = useState('ADMIN-001');
  const [pin, setPin] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem('ipl_dhaba_admin_token') || '');
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'needs_review' | 'menu' | 'gatepass'>('orders');
  const [orderFilter, setOrderFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [gatePassToken, setGatePassToken] = useState<string>('');
  const [gatePassResult, setGatePassResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const markDeliveryFailed = async (orderId: string, reason: string) => {
    setIsLoading(true);
    try {
      const updated = await api<Order>(`/orders/${orderId}/status`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'delivery_failed', reason }),
      });
      upsertOrder(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark delivery failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const issueRefund = async (orderId: string) => {
    setIsLoading(true);
    try {
      const updated = await api<Order>(`/orders/${orderId}/status`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'refunded', reason: 'Admin manual refund post-delivery failure' }),
      });
      upsertOrder(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to issue refund.');
    } finally {
      setIsLoading(false);
    }
  };

  const refresh = async () => {
    if (!token) return;
    try {
      const [nextOrders, nextMenu, nextHealth] = await Promise.all([
        api<Order[]>('/orders', token),
        api<MenuItem[]>('/menu/manage', token),
        backendHealth(),
      ]);
      setOrders(nextOrders);
      setMenu(nextMenu);
      setHealth(nextHealth);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load operations data.');
    }
  };

  const upsertOrder = (incoming: Order | undefined) => {
    if (!incoming?.id) return;
    setOrders((current) => [incoming, ...current.filter((order) => order.id !== incoming.id)]);
  };

  const { state: connection, detail: connectionDetail } = useRealtime(token, {
    onState: (next) => {
      if (next === 'live') void refresh();
      if (next === 'unauthorized') {
        localStorage.removeItem('ipl_dhaba_admin_token');
        setToken('');
      }
    },
    onOrderCreated: ({ order }) => upsertOrder(order),
    onOrderUpdated: ({ order, orderId, status }) => {
      if (order) {
        upsertOrder(order);
        return;
      }
      setOrders((current) =>
        current.map((existing) => (existing.id === orderId && status ? { ...existing, status } : existing)),
      );
    },
    onPaymentUpdated: ({ orderId }) => {
      void api<Order>(`/orders/${orderId}`, token).then(upsertOrder).catch(() => undefined);
    },
  });

  useEffect(() => {
    void refresh();
  }, [token]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const result = await api<{ accessToken: string }>('/auth/staff-login', undefined, {
        method: 'POST',
        body: JSON.stringify({ employeeId, pin }),
      });
      localStorage.setItem('ipl_dhaba_admin_token', result.accessToken);
      setToken(result.accessToken);
      setPin('');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Sign in failed. Check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    try {
      await api(`/menu/${item.id}/availability`, token, {
        method: 'PATCH',
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });
      await refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update inventory.');
    }
  };

  const handleVerifyGatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gatePassToken) return;
    setGatePassResult(null);
    try {
      const res = await api<{ success: boolean; message: string }>('/bookings/verify-gate-pass', token, {
        method: 'POST',
        body: JSON.stringify({ token: gatePassToken }),
      });
      setGatePassResult(res);
    } catch (err: any) {
      setGatePassResult({ success: false, message: err?.message || 'Invalid or expired Gate Pass token.' });
    }
  };

  const revenuePaise = useMemo(
    () =>
      orders
        .filter((order) => COUNTS_AS_REVENUE.has(order.status))
        .reduce((total, order) => total + (order.bill?.totalPaise ?? 0), 0),
    [orders],
  );

  const dismissFlag = async (orderId: string) => {
    setIsLoading(true);
    try {
      const updated = await api<Order>(`/orders/${orderId}/dismiss-flag`, token, {
        method: 'PATCH',
      });
      upsertOrder(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss flag.');
    } finally {
      setIsLoading(false);
    }
  };

  const activeOrders = useMemo(
    () => orders.filter((order) => !['delivered', 'cancelled', 'refunded'].includes(order.status)),
    [orders],
  );

  const needsReviewOrders = useMemo(
    () => orders.filter((order) => !order.reviewedAt && (order.status === 'delivery_failed' || order.isFlagged)),
    [orders],
  );

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesFilter =
        orderFilter === 'all'
          ? true
          : orderFilter === 'active'
          ? !['delivered', 'cancelled', 'refunded', 'delivery_failed'].includes(order.status)
          : orderFilter === 'needs_review'
          ? !order.reviewedAt && (order.status === 'delivery_failed' || order.isFlagged)
          : order.status === orderFilter;

      const matchesSearch =
        !searchQuery ||
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.deliveryTarget && order.deliveryTarget.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesFilter && matchesSearch;
    });
  }, [orders, orderFilter, searchQuery]);

  if (!token) {
    return (
      <main className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-4 selection:bg-emerald-500 selection:text-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950 pointer-events-none" />
        <form
          onSubmit={login}
          className="relative w-full max-w-md bg-[#0B132B]/90 backdrop-blur-xl border border-amber-500/30 rounded-3xl p-8 space-y-6 shadow-2xl shadow-indigo-950/60"
        >
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-0.5 shadow-lg shadow-amber-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Activity className="w-8 h-8 text-amber-400" />
              </div>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white font-display">Operations Hub</h1>
            <p className="text-xs text-slate-400 font-medium">IPL Dhaba Admin & Live Control Panel</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300">Admin Employee ID</label>
              <input
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                placeholder="ADMIN-001"
                className="w-full rounded-2xl bg-slate-900/90 border border-slate-800 focus:border-amber-500 px-4 py-3 text-sm font-bold text-white tracking-wider focus:outline-none transition-all placeholder:text-slate-600"
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
                className="w-full rounded-2xl bg-slate-900/90 border border-slate-800 focus:border-amber-500 px-4 py-3 text-sm font-bold text-white tracking-widest focus:outline-none transition-all placeholder:text-slate-600"
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
            className="w-full rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 text-slate-950 font-black py-3.5 text-sm shadow-fiery-glow transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoading ? 'Authenticating…' : 'Sign In to Operations Console'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white p-4 md:p-6 font-sans selection:bg-amber-500 selection:text-black">
      {/* Operations Navbar */}
      <header className="max-w-[1700px] mx-auto bg-[#0B132B]/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-lg text-white font-display tracking-wide">IPL Dhaba Operations</h1>
              <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-full">
                ADMIN CONSOLE
              </span>
            </div>
            {connection === 'live' ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <Wifi className="w-3.5 h-3.5" />
                <span>Live Socket Stream</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-rose-400 font-bold">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline{connectionDetail ? ` (${connectionDetail})` : ''}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons & Tabs */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => void refresh()}
            title="Refresh Data"
            className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => {
              localStorage.removeItem('ipl_dhaba_admin_token');
              setToken('');
            }}
            title="Sign Out"
            className="p-2.5 rounded-2xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="max-w-[1700px] mx-auto mb-4 p-3 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Stats Cards Bar */}
      <section className="max-w-[1700px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Backend Health" value={health?.status?.toUpperCase() || 'ONLINE'} icon={<Activity className="w-5 h-5 text-emerald-400" />} color="text-emerald-400" />
        <MetricCard label="Total Orders" value={String(orders.length)} icon={<ShoppingBag className="w-5 h-5 text-amber-400" />} color="text-amber-400" />
        <MetricCard label="Active Queue" value={String(activeOrders.length)} icon={<ChefHat className="w-5 h-5 text-orange-400" />} color="text-orange-400" />
        <MetricCard label="Order Revenue" value={rupees(revenuePaise)} icon={<TrendingUp className="w-5 h-5 text-emerald-400" />} color="text-emerald-400" />
      </section>

      {/* View Selector Tabs */}
      <div className="max-w-[1700px] mx-auto mb-6 flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-amber-500 text-slate-950 shadow-amber-500/20 shadow-lg'
              : 'bg-[#0B132B]/80 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Live Order Stream ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('needs_review')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'needs_review'
              ? 'bg-rose-600 text-white shadow-rose-600/30 shadow-lg'
              : 'bg-rose-950/40 text-rose-300 hover:text-white border border-rose-800/50'
          }`}
        >
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span>Needs Review ({needsReviewOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('menu')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'menu'
              ? 'bg-amber-500 text-slate-950 shadow-amber-500/20 shadow-lg'
              : 'bg-[#0B132B]/80 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <UtensilsCrossed className="w-4 h-4" />
          <span>Menu Inventory ({menu.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('gatepass')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'gatepass'
              ? 'bg-amber-500 text-slate-950 shadow-amber-500/20 shadow-lg'
              : 'bg-[#0B132B]/80 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Gate Pass Validator</span>
        </button>
      </div>

      {/* Tab 1: Live Order Management Stream */}
      {activeTab === 'orders' && (
        <section className="max-w-[1700px] mx-auto bg-[#0B132B]/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-black text-base text-white tracking-wide font-display">Live Order Management</h2>

            {/* Filter Pills & Search */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search order # or target…"
                  className="bg-slate-900 border border-slate-800 rounded-2xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-amber-500 w-48 sm:w-64"
                />
              </div>

              <select
                value={orderFilter}
                onChange={(e) => setOrderFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-2xl px-3 py-2 text-xs font-bold text-slate-300 focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Queue Only</option>
                <option value="placed">Placed</option>
                <option value="preparing">Preparing</option>
                <option value="ready_for_pickup">Ready for Pickup</option>
                <option value="needs_review">Needs Review Queue</option>
                <option value="delivery_failed">Delivery Failed</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto pr-1">
            {filteredOrders.map((order) => (
              <article key={order.id} className="rounded-2xl bg-[#0F172A] border border-slate-800 p-4 space-y-3 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="font-mono font-black text-xs text-white bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-800">
                    {order.orderNumber || `#${order.id.substring(0, 8)}`}
                  </span>
                  <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-950/60 border border-amber-800/50 px-2 py-0.5 rounded-full">
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {order.isFlagged && (
                  <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs font-bold space-y-1">
                    <p>⚠️ Rider Flagged Issue: {order.flaggedReason || 'Delivery problem reported'}</p>
                  </div>
                )}

                <div className="space-y-1 text-xs">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between font-semibold text-slate-200">
                      <span>{item.menuItem.nameEn}</span>
                      <span className="font-mono font-bold text-amber-400">×{item.quantity}</span>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-cyan-300 font-semibold">{order.deliveryTarget || 'Dhaba Delivery'}</p>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/60">
                  <span className="font-mono font-black text-emerald-400">{rupees(order.bill?.totalPaise ?? 0)}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    {order.paymentMethod} · {order.paymentStatus}
                  </span>
                </div>
              </article>
            ))}

            {filteredOrders.length === 0 && (
              <p className="col-span-full text-center text-xs text-slate-500 py-12">No orders match your filter.</p>
            )}
          </div>
        </section>
      )}

      {/* Tab: Needs Review Queue */}
      {activeTab === 'needs_review' && (
        <section className="max-w-[1700px] mx-auto bg-[#0B132B]/80 backdrop-blur-xl border border-rose-900/50 rounded-3xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-black text-base text-white tracking-wide font-display flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-400" />
                <span>Needs Review — Exceptional Orders</span>
              </h2>
              <p className="text-xs text-slate-400">
                Post-pickup delivery failures & rider-reported issues requiring manual action
              </p>
            </div>
            <span className="text-xs font-bold text-rose-400 bg-rose-950/60 border border-rose-800/50 px-3 py-1 rounded-full">
              {needsReviewOrders.length} Pending Actions
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto pr-1">
            {needsReviewOrders.map((order) => (
              <article key={order.id} className="rounded-2xl bg-[#0F172A] border border-rose-900/60 p-4 space-y-3 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="font-mono font-black text-xs text-white bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-800">
                    {order.orderNumber}
                  </span>
                  <span className="text-[10px] font-black uppercase text-rose-400 bg-rose-950/80 border border-rose-800 px-2 py-0.5 rounded-full">
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {order.isFlagged && (
                  <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-800/60 text-amber-300 text-xs space-y-2">
                    <p className="font-bold">🚨 Rider Reported Issue:</p>
                    <p className="font-mono text-[11px] bg-slate-950 p-2 rounded-lg">{order.flaggedReason}</p>
                    <div className="flex gap-2 pt-1">
                      <button
                        disabled={isLoading}
                        onClick={() => void markDeliveryFailed(order.id, order.flaggedReason || 'Unreachable customer')}
                        className="w-1/2 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg transition-all cursor-pointer"
                      >
                        Mark Delivery Failed
                      </button>
                      <button
                        disabled={isLoading}
                        onClick={() => void dismissFlag(order.id)}
                        className="w-1/2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-black text-xs transition-all cursor-pointer"
                      >
                        Dismiss Flag
                      </button>
                    </div>
                  </div>
                )}

                {order.status === 'delivery_failed' && (
                  <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs space-y-2">
                    <p className="font-bold">❌ Delivery Failed Reason:</p>
                    <p className="font-mono text-[11px] bg-slate-950 p-2 rounded-lg">{order.cancellationReason || 'Post-pickup issue'}</p>

                    {order.paymentStatus === 'paid' ? (
                      <div className="pt-1">
                        <button
                          disabled={isLoading}
                          onClick={() => void issueRefund(order.id)}
                          className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg transition-all cursor-pointer"
                        >
                          Issue Manual Refund ({rupees(order.bill?.totalPaise ?? 0)})
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 font-bold">Payment Status: {order.paymentStatus} (No refund needed)</p>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/60">
                  <span className="font-mono font-black text-white">{rupees(order.bill?.totalPaise ?? 0)}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    {order.paymentMethod} · {order.paymentStatus}
                  </span>
                </div>
              </article>
            ))}

            {needsReviewOrders.length === 0 && (
              <p className="col-span-full text-center text-xs text-slate-500 py-12">No orders currently require review. All clear!</p>
            )}
          </div>
        </section>
      )}

      {/* Tab 2: Menu Inventory Management */}
      {activeTab === 'menu' && (
        <section className="max-w-[1700px] mx-auto bg-[#0B132B]/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-base text-white tracking-wide font-display">Menu Inventory Control</h2>
            <span className="text-xs text-slate-400">Click toggle to switch availability instantly</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[70vh] overflow-y-auto pr-1">
            {menu.map((item) => (
              <div key={item.id} className="rounded-2xl bg-[#0F172A] border border-slate-800 p-4 flex items-center justify-between gap-3 shadow-lg">
                <div className="min-w-0">
                  <h3 className="font-bold text-xs text-white truncate">{item.nameEn}</h3>
                  <p className="text-[11px] text-slate-400 font-mono font-semibold">
                    {rupees(item.pricePaise)} · {item.category}
                  </p>
                </div>

                <button
                  onClick={() => void toggleAvailability(item)}
                  className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 shrink-0 ${
                    item.isAvailable
                      ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20 shadow-lg'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {item.isAvailable ? 'In Stock' : 'Sold Out'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tab 3: Gate Pass Validator */}
      {activeTab === 'gatepass' && (
        <section className="max-w-md mx-auto bg-[#0B132B]/90 backdrop-blur-xl border border-amber-500/30 rounded-3xl p-6 shadow-2xl space-y-5">
          <div className="text-center space-y-1">
            <QrCode className="w-10 h-10 text-amber-400 mx-auto" />
            <h2 className="font-black text-base text-white">Turf Gate Pass Validator</h2>
            <p className="text-xs text-slate-400">Verify customer Turf Booking Gate Pass token at entry</p>
          </div>

          <form onSubmit={handleVerifyGatePass} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300">Gate Pass Token / QR Token</label>
              <input
                required
                type="text"
                value={gatePassToken}
                onChange={(e) => setGatePassToken(e.target.value.toUpperCase())}
                placeholder="TRF-A7K3M2C1"
                className="w-full rounded-2xl bg-slate-900 border border-slate-800 focus:border-amber-500 px-4 py-3 text-xs font-mono font-bold text-white uppercase tracking-widest focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black py-3.5 text-xs shadow-lg transition-all cursor-pointer"
            >
              Validate Gate Pass Token
            </button>
          </form>

          {gatePassResult && (
            <div
              className={`p-4 rounded-2xl border text-xs font-bold space-y-1 ${
                gatePassResult.success
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-800 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {gatePassResult.success ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-rose-400" />}
                <span className="font-black text-sm">{gatePassResult.success ? 'PASS VERIFIED & ALLOWED' : 'ENTRY REJECTED'}</span>
              </div>
              <p className="text-slate-300">{gatePassResult.message}</p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function MetricCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-3xl bg-[#0B132B]/80 backdrop-blur-xl border border-slate-800 p-4 space-y-2 shadow-xl">
      <div className="flex justify-between items-center text-xs font-extrabold text-slate-400 uppercase tracking-wider">
        <span>{label}</span>
        {icon}
      </div>
      <p className={`text-2xl font-black font-mono tracking-tight ${color}`}>{value}</p>
    </div>
  );
}
