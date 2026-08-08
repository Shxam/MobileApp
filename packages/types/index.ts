export type UserRole = 'customer' | 'kitchen_staff' | 'admin';

export interface UserProfile {
  id: string;
  phone: string;
  name: string;
  email?: string | null;
  walletBalance: number;
  fanPoints: number;
  role: UserRole;
  dhabaId?: string | null;
  employeeId?: string | null;
  createdAt: string;
}

export interface StaffLoginPayload {
  employeeId: string;
  pin: string;
}

export interface StaffAuthResponse {
  accessToken: string;
  user: UserProfile;
}

export type OrderStatus = 'placed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
export type DeliveryType = 'turf_slot' | 'turf_bench' | 'home_delivery';

export interface OrderItem {
  menuItemId: string;
  name?: string;
  quantity: number;
  price: number;
}

export interface KitchenOrder {
  id: string;
  userId: string;
  dhabaId?: string;
  items: OrderItem[];
  totalAmount: number;
  deliveryType: DeliveryType;
  deliveryTarget?: string;
  cookingInstructions?: string;
  status: OrderStatus;
  createdAt: string;
}

export interface TurfSlotData {
  id: string;
  pitchName: string;
  timeSlot: string;
  price: number;
  isBooked: boolean;
  category: string;
  dhabaId?: string;
}

export interface AdminSummaryReport {
  todayRevenue: number;
  todayOrderCount: number;
  activeTurfUtilizationPercent: number;
  activeStaffCount: number;
  timestamp: string;
}

export interface RealtimeEvent {
  event: 'order.created' | 'order.status_updated' | 'slot.booked';
  dhabaId: string;
  payload: any;
}
