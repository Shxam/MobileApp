import React, { useEffect, useState } from 'react';
import { ArrowRight, ChefHat, Clock, Lock, RefreshCw, Wifi } from 'lucide-react';

type KitchenOrder = {
  id: string;
  status: 'placed' | 'preparing' | 'out_for_delivery' | 'delivered';
  totalAmount: number;
  deliveryTarget: string;
  cookingInstructions?: string;
  createdAt: string;
  items: { quantity: number; menuItem: { nameEn: string } }[];
};

const api = async <T,>(path: string, options: RequestInit = {}) => {
  const response = await fetch(`/api/v1${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || 'Request failed.');
  return response.json() as Promise<T>;
};

export default function App() {
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem('ipl_dhaba_kitchen_token') || '');
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadOrders = async () => {
    if (!token) return;
    try {
      const next = await api<KitchenOrder[]>('/orders', { headers: { Authorization: `Bearer ${token}` } });
      setOrders(next.filter((order) => order.status !== 'delivered'));
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load orders.');
    }
  };

  useEffect(() => {
    void loadOrders();
    const interval = window.setInterval(() => void loadOrders(), 5000);
    return () => window.clearInterval(interval);
  }, [token]);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      const result = await api<{ accessToken: string }>('/auth/staff-login', { method: 'POST', body: JSON.stringify({ employeeId, pin }) });
      localStorage.setItem('ipl_dhaba_kitchen_token', result.accessToken);
      setToken(result.accessToken);
      setPin('');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Sign in failed.');
    } finally { setIsLoading(false); }
  };

  const transition = async (order: KitchenOrder, status: KitchenOrder['status']) => {
    setIsLoading(true);
    try {
      await api(`/orders/${order.id}/status`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }) });
      await loadOrders();
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : 'Unable to update order.');
    } finally { setIsLoading(false); }
  };

  if (!token) return <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4"><form onSubmit={signIn} className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4"><ChefHat className="w-10 h-10 text-emerald-400 mx-auto" /><h1 className="text-center font-black text-xl">Kitchen KDS</h1><input required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} placeholder="Employee ID" className="w-full rounded-xl bg-slate-800 border border-slate-700 p-3" /><input required type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="PIN" className="w-full rounded-xl bg-slate-800 border border-slate-700 p-3" />{error && <p className="text-xs text-rose-400">{error}</p>}<button disabled={isLoading} className="w-full rounded-xl bg-emerald-500 py-3 font-black text-white disabled:opacity-50">{isLoading ? 'Signing in…' : 'Sign in'}</button></form></main>;

  const groups: [KitchenOrder['status'], string, string, KitchenOrder['status'] | null][] = [['placed', 'New orders', 'START COOKING', 'preparing'], ['preparing', 'Cooking', 'READY FOR DISPATCH', 'out_for_delivery'], ['out_for_delivery', 'Dispatched', '', null]];
  return <main className="min-h-screen bg-slate-950 text-white p-6"><header className="max-w-7xl mx-auto flex items-center justify-between mb-6"><div className="flex items-center gap-3"><ChefHat className="w-8 h-8 text-emerald-400" /><div><h1 className="font-black text-xl">IPL Dhaba Kitchen</h1><p className="text-xs text-slate-400">Live order queue</p></div></div><div className="flex gap-2"><button onClick={() => void loadOrders()} className="p-2 rounded-xl bg-slate-800"><RefreshCw className="w-4 h-4" /></button><button onClick={() => { localStorage.removeItem('ipl_dhaba_kitchen_token'); setToken(''); }} className="p-2 rounded-xl bg-slate-800"><Lock className="w-4 h-4" /></button></div></header>{error && <p className="max-w-7xl mx-auto mb-4 text-sm text-rose-400">{error}</p>}<section className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5">{groups.map(([status, title, action, next]) => <div key={status} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4"><h2 className="font-black text-sm text-emerald-400 mb-4">{title} ({orders.filter((order) => order.status === status).length})</h2><div className="space-y-3">{orders.filter((order) => order.status === status).map((order) => <article key={order.id} className="rounded-2xl bg-slate-950 border border-slate-800 p-4 space-y-3"><div className="flex justify-between text-xs"><strong>#{order.id.substring(0, 8)}</strong><span>{new Date(order.createdAt).toLocaleTimeString()}</span></div><p className="text-sm font-bold">{order.items.map((item) => `${item.menuItem.nameEn} ×${item.quantity}`).join(', ')}</p><p className="text-xs text-slate-400">{order.deliveryTarget}</p>{order.cookingInstructions && <p className="text-xs text-amber-300">Note: {order.cookingInstructions}</p>}{next && <button disabled={isLoading} onClick={() => void transition(order, next)} className="w-full rounded-xl bg-emerald-500 py-2.5 text-xs font-black text-white flex justify-center gap-1">{action}<ArrowRight className="w-4 h-4" /></button>}</article>)}</div></div>)}</section></main>;
}
