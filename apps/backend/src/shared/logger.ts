// ===================================================
// IPL Dhaba Backend — Structured JSON Logger
// Observability, Correlation Tracking & Log Aggregation
// ===================================================

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  correlationId?: string;
  module?: string;
  metadata?: Record<string, any>;
}

export class Logger {
  private static format(level: LogEntry['level'], message: string, correlationId?: string, module?: string, metadata?: Record<string, any>): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId,
      module,
      metadata,
    };
    return JSON.stringify(entry);
  }

  public static info(message: string, correlationId?: string, module?: string, metadata?: Record<string, any>): void {
    console.log(this.format('INFO', message, correlationId, module, metadata));
  }

  public static warn(message: string, correlationId?: string, module?: string, metadata?: Record<string, any>): void {
    console.warn(this.format('WARN', message, correlationId, module, metadata));
  }

  public static error(message: string, correlationId?: string, module?: string, metadata?: Record<string, any>): void {
    console.error(this.format('ERROR', message, correlationId, module, metadata));
  }

  public static debug(message: string, correlationId?: string, module?: string, metadata?: Record<string, any>): void {
    console.debug(this.format('DEBUG', message, correlationId, module, metadata));
  }
}
