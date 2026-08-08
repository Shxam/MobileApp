// ===================================================
// IPL Dhaba Backend — Decoupled Async Event & Job Queue
// BullMQ / Redis Queue Simulation for Order Transitions & Notifications
// ===================================================

import { Logger } from './logger';

export interface QueueJob<T = any> {
  id: string;
  name: string;
  data: T;
  timestamp: string;
}

type JobHandler<T> = (job: QueueJob<T>) => Promise<void>;

class AsyncEventQueue {
  private handlers: Map<string, JobHandler<any>> = new Map();

  public registerWorker<T>(jobName: string, handler: JobHandler<T>): void {
    this.handlers.set(jobName, handler);
    Logger.info(`BullMQ Worker registered for job: ${jobName}`, undefined, 'EventQueue');
  }

  public async dispatch<T>(jobName: string, data: T): Promise<QueueJob<T>> {
    const job: QueueJob<T> = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: jobName,
      data,
      timestamp: new Date().toISOString(),
    };

    Logger.info(`Enqueued job [${job.name}] ID: ${job.id}`, undefined, 'EventQueue', { data });

    // Process job asynchronously outside HTTP request thread loop
    setImmediate(async () => {
      const handler = this.handlers.get(jobName);
      if (handler) {
        try {
          await handler(job);
          Logger.info(`Completed async job [${job.name}] ID: ${job.id}`, undefined, 'EventQueue');
        } catch (err: any) {
          Logger.error(`Failed async job [${job.name}] ID: ${job.id}`, undefined, 'EventQueue', { error: err.message });
        }
      }
    });

    return job;
  }
}

export const eventQueue = new AsyncEventQueue();

// Register Default Workers with typed data
eventQueue.registerWorker<{ orderId: string; nextStatus: string }>('ORDER_STATUS_TRANSITION', async (job) => {
  const { orderId, nextStatus } = job.data;
  Logger.info(`Processing Order Transition for ${orderId} -> ${nextStatus}`, undefined, 'OrderWorker');
});

eventQueue.registerWorker<{ userId: string; title: string; message: string }>('DISPATCH_PUSH_NOTIFICATION', async (job) => {
  const { userId, title, message } = job.data;
  Logger.info(`Dispatched Push Notification to ${userId}: ${title}`, undefined, 'NotificationWorker');
});
