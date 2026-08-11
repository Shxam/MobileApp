// Loads and validates the environment. Imported first so that boot aborts on a
// missing/weak secret before any other module is evaluated.
import { validateEnv } from './common/config/env';

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { RedisModule } from './common/redis/redis.module';
import { RedisThrottlerStorage } from './common/redis/redis-throttler.storage';
import { PrismaModule } from './common/prisma/prisma.module';
import { FirebaseAdminModule } from './common/firebase/firebase-admin.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { MenuModule } from './modules/menu/menu.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { OrdersModule } from './modules/orders/orders.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { TurfsModule } from './modules/turfs/turfs.module';
import { CelebrationsModule } from './modules/celebrations/celebrations.module';
import { PaymentGatewayModule } from './modules/payment-gateway/payment-gateway.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { CricketModule } from './modules/cricket/cricket.module';

import { AppController } from './app.controller';
import { AdminModule } from './modules/admin/admin.module';
import { RealtimeModule } from './modules/realtime/realtime.module';

import { EventBusModule } from './common/event-bus/event-bus.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // `.env.example` is deliberately excluded — it is committed to git and
      // would otherwise act as a silent fallback for real secrets.
      envFilePath: ['.env'],
      validate: validateEnv,
    }),
    // Global rate limiting: 120 requests / minute / IP by default.
    //
    // The counter lives in Redis rather than the default in-process Map: the
    // deployment runs 2–10 replicas, and a per-process limit is really
    // `limit × replicas` with the effective ceiling depending on which pod the
    // load balancer happened to pick.
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        throttlers: [{ ttl: 60_000, limit: 120 }],
        storage,
      }),
    }),
    // Drives the payment-reconciliation sweep and the stale-order sweeps.
    ScheduleModule.forRoot(),
    EventBusModule,
    RedisModule,
    PrismaModule,
    FirebaseAdminModule,
    HealthModule,
    AuthModule,
    MenuModule,
    PricingModule,
    // Wallet is @Global and must be constructed before payments, which injects it.
    WalletModule,
    OrdersModule,
    DispatchModule,
    BookingsModule,
    TurfsModule,
    CelebrationsModule,
    PaymentGatewayModule,
    NotificationsModule,
    ReviewsModule,
    AddressesModule,
    RealtimeModule,
    CricketModule,
    // Imports OrdersModule, so it is registered after it.
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    // Apply rate limiting globally.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
