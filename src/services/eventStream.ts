type EventCallback = (data: any) => void;

export type SystemEventType =
  | 'ORDER_STATUS_UPDATED'
  | 'TURF_SLOT_HELD'
  | 'LIVE_CRICKET_SCORE_TICK'
  | 'NOTIFICATION_DISPATCHED';

export class EventStream {
  private static instance: EventStream;
  private listeners: Map<SystemEventType, Set<EventCallback>> = new Map();

  private constructor() {}

  public static getInstance(): EventStream {
    if (!EventStream.instance) {
      EventStream.instance = new EventStream();
    }
    return EventStream.instance;
  }

  /**
   * Subscribe to a system event channel
   */
  public subscribe(event: SystemEventType, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Broadcast/Publish event to all subscribers
   */
  public publish(event: SystemEventType, payload: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(payload);
        } catch (err) {
          console.error(`[EventStream] Error in listener for event ${event}:`, err);
        }
      });
    }
  }

  /**
   * Simulate WebSocket auto-progression pipeline for a newly placed food order
   */
  public simulateOrderProgression(
    orderId: string,
    onStatusChange: (status: 'placed' | 'preparing' | 'out_for_delivery' | 'delivered') => void
  ): void {
    // 1. Placed (Immediate)
    onStatusChange('placed');

    // 2. Kitchen Preparing (after 6 seconds)
    setTimeout(() => {
      onStatusChange('preparing');
      this.publish('ORDER_STATUS_UPDATED', { orderId, status: 'preparing' });
    }, 6000);

    // 3. Out for Delivery (after 14 seconds)
    setTimeout(() => {
      onStatusChange('out_for_delivery');
      this.publish('ORDER_STATUS_UPDATED', { orderId, status: 'out_for_delivery' });
    }, 14000);

    // 4. Delivered (after 24 seconds)
    setTimeout(() => {
      onStatusChange('delivered');
      this.publish('ORDER_STATUS_UPDATED', { orderId, status: 'delivered' });
    }, 24000);
  }
}
