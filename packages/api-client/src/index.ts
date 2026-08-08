import { StaffLoginPayload, StaffAuthResponse, KitchenOrder, OrderStatus, AdminSummaryReport, RealtimeEvent } from '../../types';

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = 'http://localhost:3001/api/v1') {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'HTTP Request Failed' }));
      throw new Error(err.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth Methods
  async staffLogin(payload: StaffLoginPayload): Promise<StaffAuthResponse> {
    return this.request<StaffAuthResponse>('/auth/staff-login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Kitchen KDS Methods
  async getActiveOrders(): Promise<KitchenOrder[]> {
    return this.request<KitchenOrder[]>('/admin/orders?status=active');
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<KitchenOrder> {
    return this.request<KitchenOrder>(`/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // Admin Methods
  async getAdminSummary(): Promise<AdminSummaryReport> {
    return this.request<AdminSummaryReport>('/admin/reports/summary');
  }

  async getAdminOrders(status?: string, dateRange?: string): Promise<KitchenOrder[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (dateRange) params.append('dateRange', dateRange);
    return this.request<KitchenOrder[]>(`/admin/orders?${params.toString()}`);
  }
}

// Simple WebSocket Client Wrapper
export class RealtimeClient {
  private ws: WebSocket | null = null;

  connect(dhabaId: string, onEvent: (event: RealtimeEvent) => void, onStatusChange?: (connected: boolean) => void) {
    try {
      this.ws = new WebSocket(`ws://localhost:3001?dhabaId=${dhabaId}`);

      this.ws.onopen = () => {
        if (onStatusChange) onStatusChange(true);
      };

      this.ws.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data);
          onEvent(parsed);
        } catch {
          // Ignore invalid message
        }
      };

      this.ws.onclose = () => {
        if (onStatusChange) onStatusChange(false);
      };

      this.ws.onerror = () => {
        if (onStatusChange) onStatusChange(false);
      };
    } catch {
      if (onStatusChange) onStatusChange(false);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
