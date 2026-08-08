import React, { useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  UtensilsCrossed,
  ShoppingBag,
  Users,
  Wallet,
  ShieldCheck,
  Download,
  Lock,
  Plus,
  Search,
  CheckCircle,
  TrendingUp,
  CreditCard,
  Building,
  RefreshCw,
  Trash2,
  Edit,
} from 'lucide-react';

interface StaffUser {
  id: string;
  name: string;
  employeeId: string;
  role: 'kitchen_staff' | 'admin';
  pin: string;
  dhabaId: string;
}

interface MenuItemData {
  id: string;
  name: string;
  price: number;
  category: string;
  isAvailable: boolean;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [employeeId, setEmployeeId] = useState('EMP-ADMIN');
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeModule, setActiveModule] = useState<'overview' | 'turf' | 'menu' | 'orders' | 'staff' | 'reconciliation'>('overview');

  // Admin Data State
  const [staffList, setStaffList] = useState<StaffUser[]>([
    { id: 'usr_staff_1', name: 'Ramesh Kumar (Head Chef)', employeeId: 'EMP-101', role: 'kitchen_staff', pin: '1234', dhabaId: 'dhaba_singarayakonda' },
    { id: 'usr_staff_2', name: 'Suresh V (Turf Manager)', employeeId: 'EMP-001', role: 'admin', pin: '1234', dhabaId: 'dhaba_singarayakonda' },
  ]);

  const [menuItems, setMenuItems] = useState<MenuItemData[]>([
    { id: 'm1', name: 'Powerplay Team Feast Combo', price: 999, category: 'Combos', isAvailable: true },
    { id: 'm2', name: 'Amritsari Kulhad Rabri Lassi', price: 110, category: 'Drinks', isAvailable: true },
    { id: 'm3', name: 'Biriyani (Boneless)', price: 250, category: 'Biryani', isAvailable: true },
    { id: 'm4', name: 'Tandoori Seekh Kebab', price: 320, category: 'Starters', isAvailable: true },
  ]);

  const [turfSlots, setTurfSlots] = useState([
    { id: 's1', time: '6:00 - 7:00', price: 900, isBooked: true, isBlocked: false, category: 'Morning' },
    { id: 's2', time: '7:00 - 8:00', price: 900, isBooked: false, isBlocked: false, category: 'Morning' },
    { id: 's3', time: '6:00 - 7:00', price: 1200, isBooked: true, isBlocked: false, category: 'Prime Evening' },
    { id: 's4', time: '8:00 - 9:00', price: 1300, isBooked: false, isBlocked: true, category: 'Night Floodlit' },
  ]);

  // Form State
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmpId, setNewStaffEmpId] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('1234');
  const [newStaffRole, setNewStaffRole] = useState<'kitchen_staff' | 'admin'>('kitchen_staff');

  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Biryani');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '1234' || pin === '0000') {
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Invalid PIN code. Try 1234.');
    }
  };

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName || !newStaffEmpId) return;
    setStaffList((prev) => [
      ...prev,
      {
        id: `usr_staff_${Date.now()}`,
        name: newStaffName,
        employeeId: newStaffEmpId,
        role: newStaffRole,
        pin: newStaffPin,
        dhabaId: 'dhaba_singarayakonda',
      },
    ]);
    setNewStaffName('');
    setNewStaffEmpId('');
    alert(`Staff account ${newStaffEmpId} created successfully.`);
  };

  const handleCreateMenuItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice) return;
    setMenuItems((prev) => [
      ...prev,
      {
        id: `m_${Date.now()}`,
        name: newItemName,
        price: parseFloat(newItemPrice),
        category: newItemCategory,
        isAvailable: true,
      },
    ]);
    setNewItemName('');
    setNewItemPrice('');
    alert(`Menu item ${newItemName} added successfully.`);
  };

  const toggleSlotBlock = (slotId: string) => {
    setTurfSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, isBlocked: !s.isBlocked } : s))
    );
  };

  const toggleMenuAvailability = (itemId: string) => {
    setMenuItems((prev) =>
      prev.map((m) => (m.id === itemId ? { ...m, isAvailable: !m.isAvailable } : m))
    );
  };

  const handleExportCSV = () => {
    const csvContent = 'data:text/csv;charset=utf-8,Order ID,Date,Amount,Status\n101,2026-08-07,940,delivered\n102,2026-08-07,960,preparing\n';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'ipl_dhaba_reports.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-black tracking-tight">IPL Dhaba Operations Console</h1>
            <p className="text-xs text-slate-400 font-medium">Desktop Admin Manager Portal</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Employee ID</label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-center tracking-widest text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Enter Admin PIN</label>
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="1234"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-lg font-black text-center tracking-[0.5em] text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {loginError && <div className="text-xs text-rose-400 font-bold text-center bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">{loginError}</div>}

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-3.5 rounded-xl text-xs shadow-green-sm active:scale-95 transition-all"
            >
              LOG IN TO DASHBOARD
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4 shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-sm text-white">IPL Dhaba Admin</div>
              <div className="text-[10px] text-slate-400 font-medium">Singarayakonda Outlet #1</div>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'overview', label: 'Overview Telemetry', icon: LayoutDashboard },
              { id: 'turf', label: 'Turf Slot Grid', icon: Calendar },
              { id: 'menu', label: 'Food Menu Manager', icon: UtensilsCrossed },
              { id: 'orders', label: 'Orders History', icon: ShoppingBag },
              { id: 'staff', label: 'Staff & PIN Manager', icon: Users },
              { id: 'reconciliation', label: 'Razorpay Settlements', icon: CreditCard },
            ].map((m) => {
              const Icon = m.icon;
              const isActive = activeModule === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveModule(m.id as any)}
                  className={`w-full px-3.5 py-3 rounded-xl text-xs font-bold flex items-center gap-3 transition-all ${
                    isActive ? 'bg-emerald-500 text-white shadow-green-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t border-slate-800">
          <button
            onClick={handleExportCSV}
            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export CSV Report</span>
          </button>

          <button onClick={() => setIsAuthenticated(false)} className="w-full text-xs font-bold text-slate-500 hover:text-rose-400 py-1 text-center">
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto space-y-6">
        {/* Module Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight uppercase">{activeModule}</h1>
            <p className="text-xs text-slate-400 font-medium">Real-time management console for Dhaba Owners & Operations Managers</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-extrabold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Live Dhaba Feed</span>
          </div>
        </div>

        {/* OVERVIEW MODULE */}
        {activeModule === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                <div className="text-xs font-bold text-slate-400">Today's Total Revenue</div>
                <div className="text-2xl font-black text-emerald-400">₹48,500</div>
                <div className="text-[10px] text-emerald-500 font-bold">▲ 14% vs yesterday</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                <div className="text-xs font-bold text-slate-400">Total Orders Placed</div>
                <div className="text-2xl font-black text-white">64</div>
                <div className="text-[10px] text-slate-400 font-bold">Dhaba Kitchen + Bench</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                <div className="text-xs font-bold text-slate-400">Turf Utilization %</div>
                <div className="text-2xl font-black text-rose-400">87.5%</div>
                <div className="text-[10px] text-emerald-500 font-bold">7 of 8 Slots Occupied</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                <div className="text-xs font-bold text-slate-400">Active Staff On Duty</div>
                <div className="text-2xl font-black text-amber-400">8</div>
                <div className="text-[10px] text-slate-400 font-bold">Chefs & Pitch Runners</div>
              </div>
            </div>
          </div>
        )}

        {/* TURF SLOT MODULE */}
        {activeModule === 'turf' && (
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-white">Matchday Turf Slots & Pitch Locks</h2>
            <div className="grid grid-cols-2 gap-4">
              {turfSlots.map((slot) => (
                <div key={slot.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <div className="font-extrabold text-sm text-white">{slot.time}</div>
                    <div className="text-xs font-semibold text-emerald-400">₹{slot.price} • {slot.category}</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-1">
                      {slot.isBlocked ? '🔴 BLOCKED BY ADMIN' : slot.isBooked ? '🟢 BOOKED BY CUSTOMER' : '⚪ AVAILABLE'}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleSlotBlock(slot.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      slot.isBlocked ? 'bg-emerald-500 text-white' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {slot.isBlocked ? 'Unblock Slot' : 'Block Slot'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MENU MANAGEMENT MODULE */}
        {activeModule === 'menu' && (
          <div className="space-y-6">
            <form onSubmit={handleCreateMenuItem} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
              <input
                type="text"
                placeholder="Dish Name (e.g. Tandoori Roti)"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
              />
              <input
                type="number"
                placeholder="Price (₹)"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                className="w-32 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
              />
              <button type="submit" className="bg-emerald-500 text-white font-extrabold px-4 py-2 rounded-xl text-xs shadow-green-sm">
                Add Food Item
              </button>
            </form>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800">
              {menuItems.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-white">{item.name}</div>
                    <div className="text-xs font-semibold text-emerald-400">₹{item.price} • {item.category}</div>
                  </div>
                  <button
                    onClick={() => toggleMenuAvailability(item.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                      item.isAvailable ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {item.isAvailable ? 'In Stock' : 'Out of Stock'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STAFF MANAGEMENT MODULE */}
        {activeModule === 'staff' && (
          <div className="space-y-6">
            <form onSubmit={handleCreateStaff} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
              <input
                type="text"
                placeholder="Staff Full Name"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
              />
              <input
                type="text"
                placeholder="Employee ID (e.g. EMP-103)"
                value={newStaffEmpId}
                onChange={(e) => setNewStaffEmpId(e.target.value)}
                className="w-44 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
              />
              <select
                value={newStaffRole}
                onChange={(e) => setNewStaffRole(e.target.value as any)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
              >
                <option value="kitchen_staff">Kitchen Staff</option>
                <option value="admin">Operations Admin</option>
              </select>
              <button type="submit" className="bg-emerald-500 text-white font-extrabold px-4 py-2 rounded-xl text-xs shadow-green-sm">
                Create Account
              </button>
            </form>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800">
              {staffList.map((st) => (
                <div key={st.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-white">{st.name}</div>
                    <div className="text-xs font-mono text-slate-400">ID: {st.employeeId} • Role: {st.role} • PIN: {st.pin}</div>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                    Active Staff
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
