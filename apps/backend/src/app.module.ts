import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './common/redis/redis.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { FirebaseAdminModule } from './common/firebase/firebase-admin.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { MenuModule } from './modules/menu/menu.module';
import { OrdersModule } from './modules/orders/orders.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentGatewayModule } from './modules/payment-gateway/payment-gateway.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

import { AppController } from './app.controller';
import { AdminController } from './modules/admin/admin.controller';
import { RealtimeGateway } from './modules/realtime/realtime.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
    }),
    RedisModule,
    PrismaModule,
    FirebaseAdminModule,
    HealthModule,
    AuthModule,
    MenuModule,
    OrdersModule,
    BookingsModule,
    PaymentGatewayModule,
    WalletModule,
    NotificationsModule,
  ],
  controllers: [AppController, AdminController],
  providers: [RealtimeGateway],
})
export class AppModule {}
