import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

type Order = { id: string; deliveryTarget: string; totalAmount: number; status: string; items: { quantity: number; menuItem: { nameEn: string } }[] };

const api = async <T,>(path: string, options: RequestInit = {}) => {
  const response = await fetch(`/api/v1${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || 'Request failed.');
  return response.json() as Promise<T>;
};

function DriverApp() {
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem('ipl_dhaba_driver_token') || '');
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrderId, setActiveOrderId] = useState('');
  const [message, setMessage] = useState('');

  const loadOrders = async () => {
    if (!token) return;
    try {
      const result = await api<Order[]>('/orders', { headers: { Authorization: `Bearer ${token}` } });
      setOrders(result.filter((order) => order.status === 'out_for_delivery'));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load deliveries.'); }
  };

  useEffect(() => { void loadOrders(); const interval = window.setInterval(() => void loadOrders(), 5000); return () => window.clearInterval(interval); }, [token]);

  useEffect(() => {
    if (!token || !activeOrderId || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        void api(`/orders/${activeOrderId}/location`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude, heading: position.coords.heading ?? undefined }) }).then(() => setMessage('Live location is sharing with the customer.')).catch((error) => setMessage(error instanceof Error ? error.message : 'Location update failed.'));
      },
      (error) => setMessage(`Location permission is required: ${error.message}`),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [token, activeOrderId]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const result = await api<{ accessToken: string }>('/auth/staff-login', { method: 'POST', body: JSON.stringify({ employeeId, pin }) });
      localStorage.setItem('ipl_dhaba_driver_token', result.accessToken);
      setToken(result.accessToken);
      setMessage('Signed in. Choose an assigned delivery to start live location sharing.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Sign in failed.'); }
  };

  const complete = async (id: string) => {
    try {
      await api(`/orders/${id}/status`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: 'delivered' }) });
      setActiveOrderId('');
      setMessage('Delivery marked complete.');
      await loadOrders();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to complete delivery.'); }
  };

  if (!token) return <main style={styles.page}><form onSubmit={login} style={styles.card}><h1>IPL Dhaba Rider</h1><p>Sign in with your delivery partner credentials.</p><input required placeholder="Employee ID" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} style={styles.input} /><input required type="password" placeholder="PIN" value={pin} onChange={(event) => setPin(event.target.value)} style={styles.input} /><button style={styles.button}>Sign in</button>{message && <p>{message}</p>}</form></main>;
  return <main style={styles.page}><section style={styles.card}><h1>Delivery partner</h1><p>Choose the delivery you are carrying. Your phone will ask for location permission and updates stop when you complete it.</p>{message && <p style={{ color: '#fbbf24' }}>{message}</p>}{orders.length === 0 ? <p>No dispatched orders right now.</p> : orders.map((order) => <article key={order.id} style={{ ...styles.order, borderColor: activeOrderId === order.id ? '#22c55e' : '#334155' }}><strong>#{order.id.substring(0, 8)}</strong><p>{order.items.map((item) => `${item.menuItem.nameEn} ×${item.quantity}`).join(', ')}</p><p>{order.deliveryTarget}</p>{activeOrderId === order.id ? <button onClick={() => void complete(order.id)} style={styles.button}>Complete delivery</button> : <button onClick={() => setActiveOrderId(order.id)} style={styles.button}>Start live location</button>}</article>)}</section></main>;
}

const styles: Record<string, React.CSSProperties> = { page: { minHeight: '100vh', background: '#020617', color: 'white', display: 'flex', justifyContent: 'center', padding: 20, fontFamily: 'system-ui' }, card: { width: '100%', maxWidth: 440, marginTop: 30, background: '#0f172a', border: '1px solid #334155', borderRadius: 20, padding: 20, height: 'fit-content' }, input: { display: 'block', boxSizing: 'border-box', width: '100%', margin: '12px 0', padding: 12, borderRadius: 10, background: '#1e293b', border: '1px solid #475569', color: 'white' }, button: { width: '100%', padding: 12, border: 0, borderRadius: 10, background: '#22c55e', color: 'white', fontWeight: 800, cursor: 'pointer' }, order: { border: '1px solid #334155', padding: 14, borderRadius: 12, marginTop: 12 } };

createRoot(document.getElementById('root')!).render(<React.StrictMode><DriverApp /></React.StrictMode>);
