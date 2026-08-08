import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  @Get('api/v1')
  getApiRoot() {
    return {
      name: 'IPL Dhaba Super App Enterprise API',
      version: 'v1.2.0',
      status: 'ONLINE',
      documentation: 'http://localhost:3001/api/v1/health',
      endpoints: {
        health: '/health/live',
        auth: {
          sendOtp: '/api/v1/auth/request-otp',
          verifyOtp: '/api/v1/auth/verify-otp',
          refresh: '/api/v1/auth/refresh',
          profile: '/api/v1/auth/me',
        },
        menu: '/api/v1/menu',
        orders: '/api/v1/orders',
        bookings: '/api/v1/bookings',
        wallet: '/api/v1/wallet',
        paymentGateway: '/api/v1/payment-gateway',
        notifications: '/api/v1/notifications',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
