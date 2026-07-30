// ===================================================
// IPL Dhaba Backend — Security & Utility Middleware
// Helmet, CORS, Rate Limiting, Request ID
// ===================================================

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface AuthenticatedRequest extends Request {
  requestId?: string;
  user?: {
    id: string;
    phone: string;
    role: 'customer' | 'driver' | 'partner' | 'admin';
  };
}

/**
 * Assign unique Correlation ID to every incoming request for tracing
 */
export const requestIdMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const reqId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.requestId = reqId;
  res.setHeader('X-Request-ID', reqId);
  next();
};

/**
 * Production Security Headers Middleware (Helmet substitute)
 */
export const securityHeadersMiddleware = (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
};

/**
 * CORS Configuration Middleware
 */
export const corsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'];
  const origin = req.headers.origin as string;

  if (allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
};

/**
 * Simple In-Memory Rate Limiter Middleware
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const rateLimitMiddleware = (limit = 100, windowMs = 15 * 60 * 1000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const record = rateLimitMap.get(ip);
    if (!record || now > record.resetTime) {
      rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (record.count >= limit) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
        },
      });
      return;
    }

    record.count++;
    next();
  };
};
