import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Subject, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { randomUUID } from 'crypto';

export interface EventEnvelope<T = any> {
  eventId: string;
  eventName: string;
  payload: T;
  timestamp: string;
}

/**
 * In-process domain event bus.
 *
 * Deliberately in-process and fire-and-forget: subscribers here are side effects
 * (notifications, realtime fan-out) that must never fail the transaction that
 * published them. Anything that must survive a pod restart belongs in Postgres
 * and a scheduled sweep — see `DispatchSweepService` and
 * `PaymentReconciliationService` — not here.
 *
 * The `publishDelayed`/`cancelDelayed` pair that used to live on this class was
 * removed: it held work in a per-process `setTimeout` map, so a scheduled
 * auto-cancel silently vanished whenever its pod was rescheduled, and a cancel
 * issued on a different replica than the schedule found nothing to clear.
 * Nothing called it.
 */
@Injectable()
export class EventBusService implements OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private readonly bus = new Subject<EventEnvelope>();
  private readonly subscriptions: Subscription[] = [];

  /** Publishes an event. Returns once queued, not once handled. */
  async publish<T>(eventName: string, payload: T): Promise<void> {
    const envelope: EventEnvelope<T> = {
      eventId: randomUUID(),
      eventName,
      payload,
      timestamp: new Date().toISOString(),
    };

    this.logger.debug(`Published ${eventName} (${envelope.eventId}).`);

    // Deferred to the next tick so a subscriber can never re-enter the caller's
    // stack — in particular, never inside the caller's open transaction.
    setImmediate(() => {
      this.bus.next(envelope);
    });
  }

  /**
   * Subscribe to a specific event on the EventBus
   */
  subscribe<T>(eventName: string, handler: (payload: T, envelope: EventEnvelope<T>) => Promise<void> | void): () => void {
    const sub = this.bus
      .pipe(filter((envelope) => envelope.eventName === eventName))
      .subscribe({
        next: (envelope) => {
          Promise.resolve(handler(envelope.payload as T, envelope as EventEnvelope<T>)).catch((err) => {
            this.logger.error(`Error handling ${eventName}: ${err.message}`, err.stack);
          });
        },
      });

    this.subscriptions.push(sub);

    return () => {
      sub.unsubscribe();
    };
  }

  /**
   * Tears every subscription down on shutdown. Without this each `app.close()`
   * in the test suite leaves its handlers attached to a bus that is garbage only
   * once the whole subject is unreachable.
   */
  onModuleDestroy(): void {
    for (const sub of this.subscriptions) sub.unsubscribe();
    this.subscriptions.length = 0;
    this.bus.complete();
  }
}
