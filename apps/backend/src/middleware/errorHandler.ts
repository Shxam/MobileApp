// ===================================================
// IPL Dhaba Backend — Centralized Error Handling Middleware
// Standardized API error responses with correlation tracking
// ===================================================

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './security';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: Record<string, string[]>;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details?: Record<string, string[]>) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: AuthenticatedRequest,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const requestId = req.requestId || 'unknown';
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const errorCode = err instanceof AppError ? err.code : 'INTERNAL_SERVER_ERROR';

  console.error(`[Error] [ReqID: ${requestId}] ${err.name}: ${err.message}`, err.stack);

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: err.message || 'An unexpected error occurred',
      details: err instanceof AppError ? err.details : undefined,
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  });
};
