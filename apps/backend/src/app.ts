// ===================================================
// IPL Dhaba Backend — Express Modular Core Application
// Security Middleware, Versioned Routes & Health Checks
// ===================================================

import express from 'express';
import { requestIdMiddleware, securityHeadersMiddleware, corsMiddleware, rateLimitMiddleware } from './middleware/security';
import { errorHandler } from './middleware/errorHandler';

import { authRouter } from './modules/auth/auth.routes';
import { menuRouter } from './modules/menu/menu.routes';
import { ordersRouter } from './modules/orders/orders.routes';
import { bookingsRouter } from './modules/bookings/bookings.routes';
import { paymentsRouter } from './modules/payments/payments.routes';

const app = express();

// Body Parser & Core Middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Security Middleware Stack
app.use(requestIdMiddleware);
app.use(securityHeadersMiddleware);
app.use(corsMiddleware);
app.use(rateLimitMiddleware(150, 15 * 60 * 1000));

// System Health & Liveness Endpoints
app.get('/health', (_req, res) => {
  res.json({
    status: 'UP',
    service: 'IPL Dhaba Enterprise API Core',
    version: 'v1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1/health', (_req, res) => {
  res.json({
    status: 'UP',
    service: 'IPL Dhaba Enterprise API Core',
    version: 'v1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Mount Versioned API Modules (/api/v1)
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/menu', menuRouter);
app.use('/api/v1/orders', ordersRouter);
app.use('/api/v1/bookings', bookingsRouter);
app.use('/api/v1/payments', paymentsRouter);

// Legacy backward-compatibility endpoints for existing frontend
app.use('/api/turfs', bookingsRouter);
app.use('/api/menu', menuRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/bookings', bookingsRouter);

// Centralized Error Handling (Must be last)
app.use(errorHandler);

export default app;
