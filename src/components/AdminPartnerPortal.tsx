import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Store, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { KitchenOrderQueue } from './admin/KitchenOrderQueue';
import { TurfReservationGrid } from './admin/TurfReservationGrid';
import { GatePassValidator } from './admin/GatePassValidator';

interface AdminPartnerPortalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The staff console — kitchen queue, turf board and gate scanner.
 *
 * Everything here is server data: the queue is the live order feed, the turf
 * board is `GET /bookings/slots`, and the gate scanner verifies a real signed
 * token. The two write operations in it (order status, gate verification) are
 * staff-role endpoints; the portal is only rendered for staff roles, and the
 * backend enforces the same rule again on every call.
 */
export const AdminPartnerPortal: React.FC<AdminPartnerPortalProps> = ({ isOpen, onClose }) => {
  const { foodOrders, updateOrderStatus } = useApp();
  const [activeTab, setActiveTab] = useState<'kitchen' | 'turf' | 'validator'>('kitchen');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-portal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 text-slate-900 dark:text-white space-y-4 shadow-2xl relative max-h-[85vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-emerald-500" />
              <div>
                <h3 id="admin-portal-title" className="font-extrabold text-sm text-slate-900 dark:text-white">
                  IPL Dhaba Partner Console
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  Role-Scoped Operator Controls
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close Partner Portal"
              className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Sub Tab Switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl text-xs font-bold shrink-0">
            <button
              onClick={() => setActiveTab('kitchen')}
              className={`flex-1 py-2 rounded-xl text-[11px] font-extrabold transition-all ${
                activeTab === 'kitchen' ? 'bg-emerald-500 text-white shadow-green-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Kitchen Queue
            </button>
            <button
              onClick={() => setActiveTab('turf')}
              className={`flex-1 py-2 rounded-xl text-[11px] font-extrabold transition-all ${
                activeTab === 'turf' ? 'bg-emerald-500 text-white shadow-green-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Turf Grid
            </button>
            <button
              onClick={() => setActiveTab('validator')}
              className={`flex-1 py-2 rounded-xl text-[11px] font-extrabold transition-all ${
                activeTab === 'validator' ? 'bg-emerald-500 text-white shadow-green-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Gate Pass QR
            </button>
          </div>

          {/* Role-Scoped Tab Components */}
          <div className="flex-1 overflow-y-auto pr-1">
            {activeTab === 'kitchen' && (
              <KitchenOrderQueue orders={foodOrders} onUpdateStatus={updateOrderStatus} />
            )}

            {activeTab === 'turf' && <TurfReservationGrid />}

            {activeTab === 'validator' && <GatePassValidator />}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
