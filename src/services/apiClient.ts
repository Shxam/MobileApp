// ===================================================
// IPL Dhaba Client — Modernized API Client
// Versioned requests (/api/v1), Auth headers, Retry & Fallbacks
// ===================================================

import { MOCK_TURFS, MOCK_MENU, MOCK_CELEBRATION_PACKAGES } from '../data/mockData';
import { Turf, MenuItem, CelebrationPackage, FoodOrder } from '../types';

export class ApiClient {
  private static BASE_URL = '/api/v1';

  /**
   * Helper to construct auth headers with request correlation ID
   */
  private static getHeaders(): Record<string, string> {
    const token = localStorage.getItem('ipl_dhaba_jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Request-ID': `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
  }

  /**
   * Exchanges verified Firebase ID token for IPL Dhaba JWT access + refresh session
   */
  public static async authenticateWithFirebase(idToken: string, name?: string, favoriteTeam?: string) {
    const response = await fetch(`${this.BASE_URL}/auth/firebase`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ idToken, name, favoriteTeam }),
    });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || 'Firebase authentication verification failed.');
    return response.json() as Promise<{ accessToken: string; refreshToken: string; user: { id: string; phone: string; name: string; favoriteTeam?: string } }>;
  }

  /**
   * Fetch turfs list with optional search query
   */
  public static async getTurfs(searchQuery: string = ''): Promise<Turf[]> {
    try {
      const res = await fetch(`${this.BASE_URL}/turfs?q=${encodeURIComponent(searchQuery)}`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const payload = await res.json();
        return payload.data || payload;
      }
    } catch {
      // Offline / Fallback
    }

    return MOCK_TURFS.filter(
      (t) =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.location.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  /**
   * Fetch Dhaba food menu
   */
  public static async getMenu(category: string = 'all'): Promise<MenuItem[]> {
    try {
      const res = await fetch(`${this.BASE_URL}/menu?category=${encodeURIComponent(category)}`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const payload = await res.json();
        return payload.data || payload;
      }
    } catch {
      // Offline / Fallback
    }

    if (category === 'all') return MOCK_MENU;
    return MOCK_MENU.filter((m) => m.category === category);
  }

  /**
   * Fetch celebration packages
   */
  public static async getCelebrationPackages(): Promise<CelebrationPackage[]> {
    try {
      const res = await fetch(`${this.BASE_URL}/celebrations`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const payload = await res.json();
        return payload.data || payload;
      }
    } catch {
      // Offline / Fallback
    }

    return MOCK_CELEBRATION_PACKAGES;
  }

  /**
   * Submit new food order
   */
  public static async createFoodOrder(orderData: Omit<FoodOrder, 'id' | 'createdAt' | 'status'>): Promise<FoodOrder> {
    const response = await fetch(`${this.BASE_URL}/orders`, { method: 'POST', headers: this.getHeaders(), body: JSON.stringify(orderData) });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || 'Unable to place the order.');
    return response.json() as Promise<FoodOrder>;
  }

  public static async getFoodOrders(): Promise<FoodOrder[]> {
    const response = await fetch(`${this.BASE_URL}/orders`, { headers: this.getHeaders() });
    if (!response.ok) throw new Error('Unable to load your orders.');
    return response.json() as Promise<FoodOrder[]>;
  }

  public static async getFoodOrder(id: string): Promise<FoodOrder & { location?: { latitude: number; longitude: number; heading?: number; updatedAt: string } | null; driverName?: string; driverPhone?: string }> {
    const response = await fetch(`${this.BASE_URL}/orders/${id}`, { headers: this.getHeaders() });
    if (!response.ok) throw new Error('Unable to load live delivery information.');
    return response.json();
  }
}
