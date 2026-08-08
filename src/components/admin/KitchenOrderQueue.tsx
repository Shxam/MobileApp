import React, { useState } from 'react';
import { UtensilsCrossed, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { FoodOrder, OrderStatus } from '../../../packages/shared/types';

interface KitchenOrderQueueProps {
  orders: FoodOrder[];
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
}

export const KitchenOrderQueue: React.FC<KitchenOrderQueueProps> = ({ orders, onUpdateStatus }) => {
  const [filter, setFilter] = useState<'all' | 'placed' | 'preparing'>('all');

  const filteredOrders = orders.filter((o) => (filter === 'all' ? true : o.status === filter));

  return (
    <div className="space-y-4">
      {/* Header & Filter Pills */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="w-5 h-5 text-emerald-500" />
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Kitchen Orders Queue</h3>
        </div>
        <div className="flex gap-1 text-[10px] font-bold">
          <button
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-full ${filter === 'all' ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
          >
            All ({orders.length})
          </button>
          <button
            onClick={() => setFilter('placed')}
            className={`px-2.5 py-1 rounded-full ${filter === 'placed' ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
          >
            Pending
          </button>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
          <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">No active kitchen orders</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {filteredOrders.map((order) => (
            <div key={order.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-900 dark:text-white">Order #{order.id}</span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  {order.deliveryTarget}
                </span>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                {order.items.map((i) => `${i.quantity}x ${i.menuItem.nameEn}`).join(', ')}
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                <span className="font-black text-emerald-600">₹{order.totalAmount}</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onUpdateStatus(order.id, 'preparing')}
                    className="px-2.5 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg text-[10px]"
                  >
                    Set Cooking
                  </button>
                  <button
                    onClick={() => onUpdateStatus(order.id, 'out_for_delivery')}
                    className="px-2.5 py-1 bg-emerald-500 text-white font-bold rounded-lg text-[10px]"
                  >
                    Ready for Pickup
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
