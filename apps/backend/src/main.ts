// Must be the first import: loads .env and aborts the process if any required
// secret is missing, too weak, or set to a known-public placeholder.
import { env } from './common/config/env';

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RedisIoAdapter } from './modules/realtime/redis-io.adapter';

async function bootstrap() {
  const logger = new Logger('NestBootstrap');

  // rawBody is required to verify Razorpay webhook HMAC signatures over the
  // exact bytes received.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.use(helmet());

  // Explicit origin allowlist. `origin: '*'` with `credentials: true` is an
  // invalid combination that browsers reject outright.
  app.enableCors({
    origin: env.corsOrigins.length > 0 ? env.corsOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Reject unknown properties instead of silently dropping them, so a
      // client sending e.g. a `price` field gets a clear 400.
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Rooms must span replicas, so socket.io gets the Redis adapter rather than
  // its per-process default. Wired before listen() — after it, the io server
  // already exists and would never see the adapter.
  //
  // A failed connect is not fatal: the process keeps running with per-process
  // rooms, which is correct for single-process development. Production refuses
  // to boot without Redis at all (env.ts), so a reachable adapter is expected
  // there and the warning below would be a genuine alarm.
  const ioAdapter = new RedisIoAdapter(app);
  await ioAdapter.connect();
  app.useWebSocketAdapter(ioAdapter);

  app.setGlobalPrefix('api/v1', {
    exclude: ['', '/', 'health', 'health/live', 'health/ready'],
  });

  app.enableShutdownHooks();

  await app.listen(env.port, env.host);

  logger.log(`NestJS backend listening on http://${env.host}:${env.port} [${env.nodeEnv}]`);
  logger.log(`Liveness:  http://localhost:${env.port}/health/live`);
  logger.log(`Readiness: http://localhost:${env.port}/health/ready`);
}

bootstrap().catch((err) => {
  // Env validation failures land here with a readable multi-line message.
  new Logger('NestBootstrap').error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
