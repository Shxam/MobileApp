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
  const log = new Logger('NestBootstrap');
  // Env validation failures (EnvironmentError) carry a readable multi-line
  // message and no useful stack, so print just the message for those. Any other
  // boot failure is a code error — print the stack too, or a crash during
  // lifecycle hooks (e.g. a missing DI dependency) is reported as a bare
  // one-line message with no hint of where it came from.
  log.error(err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.name !== 'EnvironmentError' && err.stack) {
    log.error(err.stack);
  }
  process.exit(1);
});
