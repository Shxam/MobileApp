import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('NestBootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable CORS & Security
  app.enableCors({
    origin: '*',
    credentials: true,
  });

  // Global Class Validation Pipe (rejects non-whitelisted payload parameters)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global Exception Filter & Logging Interceptor
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Global API Prefix
  app.setGlobalPrefix('api/v1', {
    exclude: ['', '/', 'health', 'health/live', 'health/ready'],
  });

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 NestJS Production Backend active at http://localhost:${port}`);
  logger.log(`📡 Health Check Liveness: http://localhost:${port}/health/live`);
  logger.log(`📡 Health Check Readiness: http://localhost:${port}/health/ready`);
}

bootstrap();
