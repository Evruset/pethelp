import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { BookingErrorFilter } from './common/booking-error.filter';
import { PermissionDeniedAuditFilter } from './common/permission-denied-audit.filter';
import { config } from './config';
import { NestRoot } from './nest-root-full';
import { ContextLoggerService } from './observability/context-logger.service';
import { createOpenApiDocument } from './openapi/openapi';

function corsOrigin(): true | string[] {
  const configured = process.env.CORS_ALLOWED_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configured?.length) return configured;
  if ((process.env.NODE_ENV ?? 'development') !== 'production') return true;
  throw new Error('CORS_ALLOWED_ORIGINS must be configured in production.');
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(NestRoot, {
    logger: ['log', 'warn', 'error'],
    rawBody: true,
  });
  const logger = app.get(ContextLoggerService);
  Logger.overrideLogger(logger);
  app.useLogger(logger);
  app.enableCors({
    origin: corsOrigin(),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Authorization', 'Content-Type', 'Idempotency-Key', 'X-Correlation-ID', 'X-Causation-ID', 'traceparent'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(app.get(PermissionDeniedAuditFilter), new BookingErrorFilter());
  app.enableShutdownHooks();

  if ((process.env.SWAGGER_ENABLED ?? 'true').toLowerCase() === 'true') {
    SwaggerModule.setup('docs', app, () => createOpenApiDocument(app), {
      customSiteTitle: 'VetHelp Booking Core API',
      jsonDocumentUrl: 'docs/openapi.json',
      yamlDocumentUrl: 'docs/openapi.yaml',
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(config.port, '0.0.0.0');
  logger.event('log', 'Bootstrap', 'VetHelp listening', { port: config.port });
}

void bootstrap();
