import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Store, Shield, Plus, TrendingUp, CheckCircle, Clock, Utensils, X, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminPartnerPortalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminPartnerPortal: React.FC<AdminPartnerPortalProps> = ({ isOpen, onClose }) => {
  const { foodOrders, updateOrderStatus, addNotification } = useApp();
  const [activeTab, setActiveTab] = useState<'kitchen' | 'upload' | 'analytics'>('kitchen');

  // Food Item Upload Form state
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('biryani');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      addNotification('👨‍🍳 Item Uploaded!', `${newItemName} (₹${newItemPrice}) submitted for App Admin approval.`, 'food');
      setNewItemName('');
      setNewItemPrice('');
    }, 800);
  };

  const totalRevenue = foodOrders.reduce((sum, o) => sum + o.totalAmount, 0) + 14800;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white space-y-4 shadow-2xl relative max-h-[85vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-orange-400" />
              <div>
                <h3 className="font-extrabold text-sm text-white">IPL Dhaba Partner Portal</h3>
                <p className="text-[10px] text-slate-400">Kitchen Orders & Admin Sales Console</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Sub Tab Switcher */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold shrink-0">
            <button
              onClick={() => setActiveTab('kitchen')}
              className={`flex-1 py-1.5 rounded-lg text-[11px] ${
                activeTab === 'kitchen' ? 'bg-orange-500 text-slate-950 font-extrabold' : 'text-slate-400'
              }`}
            >
              Kitchen Orders
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-1.5 rounded-lg text-[11px] ${
                activeTab === 'upload' ? 'bg-orange-500 text-slate-950 font-extrabold' : 'text-slate-400'
              }`}
            >
              Upload Food Item
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex-1 py-1.5 rounded-lg text-[11px] ${
                activeTab === 'analytics' ? 'bg-orange-500 text-slate-950 font-extrabold' : 'text-slate-400'
              }`}
            >
              Sales Analytics
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
            {activeTab === 'kitchen' && (
              <div className="space-y-2">
                <span className="font-extrabold text-slate-300 block">Live Kitchen Queue:</span>
                {foodOrders.map((o) => (
                  <div key={o.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-amber-400">#{o.id.substring(4, 10)}</span>
                      <span className="text-emerald-400 font-mono">₹{o.totalAmount}</span>
                    </div>
                    <p className="text-[11px] text-slate-300">{o.items.map((i) => `${i.quantity}x ${i.menuItem.nameEn}`).join(', ')}</p>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-800 text-[10px]">
                      <span className="text-slate-400">Status: <b className="text-orange-400 uppercase">{o.status}</b></span>
                      <button
                        onClick={() => updateOrderStatus(o.id, 'out_for_delivery')}
                        className="bg-orange-500 text-slate-950 font-bold px-2.5 py-1 rounded-lg"
                      >
                        Dispatch Runner
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'upload' && (
              <form onSubmit={handleUploadSubmit} className="space-y-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Item Title (English):</label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="e.g. Special Hyderabadi Mutton Biryani"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Price (₹):</label>
                  <input
                    type="number"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    placeholder="e.g. 240"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Food Category:</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-amber-300 font-bold"
                  >
                    <option value="biryani">Biryani Special</option>
                    <option value="starters">Tandoori Starters</option>
                    <option value="rolls">Rolls & Fast Food</option>
                    <option value="lassi">Lassi & Drinks</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-orange-500 text-slate-950 font-extrabold py-3 rounded-xl flex items-center justify-center gap-1 shadow-lg"
                >
                  <Upload className="w-4 h-4" />
                  <span>Submit for Admin Approval</span>
                </button>
              </form>
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-3">
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Total Revenue Generated</span>
                    <span className="text-xl font-black text-emerald-400">₹{totalRevenue.toLocaleString()}</span>
                  </div>
                  <TrendingUp className="w-8 h-8 text-emerald-400" />
                </div>
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between text-slate-300">
                    <span>Completed Orders:</span>
                    <span className="font-bold text-white">48 Orders</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Average Order Value:</span>
                    <span className="font-bold text-white">₹360</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Turf Delivery Fulfillment Rate:</span>
                    <span className="font-bold text-emerald-400">99.4%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
