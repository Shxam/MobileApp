// ===================================================
// IPL Dhaba Backend — Production Observability & Logger
// Structured JSON Logging for AWS CloudWatch & OpenTelemetry
// ===================================================

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogPayload {
  level: LogLevel;
  message: string;
  requestId?: string;
  userId?: string;
  service?: string;
  timestamp: string;
  metadata?: Record<string, any>;
  stack?: string;
}

export class Logger {
  private static serviceName = 'ipl-dhaba-backend';

  private static formatLog(level: LogLevel, message: string, meta?: Record<string, any>, requestId?: string): LogPayload {
    return {
      level,
      message,
      service: this.serviceName,
      requestId,
      timestamp: new Date().toISOString(),
      metadata: meta,
    };
  }

  public static info(message: string, meta?: Record<string, any>, requestId?: string): void {
    console.log(JSON.stringify(this.formatLog('info', message, meta, requestId)));
  }

  public static warn(message: string, meta?: Record<string, any>, requestId?: string): void {
    console.warn(JSON.stringify(this.formatLog('warn', message, meta, requestId)));
  }

  public static error(message: string, err?: Error | unknown, meta?: Record<string, any>, requestId?: string): void {
    const errorStack = err instanceof Error ? err.stack : String(err);
    const payload = this.formatLog('error', message, meta, requestId);
    payload.stack = errorStack;
    console.error(JSON.stringify(payload));
  }

  public static debug(message: string, meta?: Record<string, any>, requestId?: string): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(JSON.stringify(this.formatLog('debug', message, meta, requestId)));
    }
  }
}
