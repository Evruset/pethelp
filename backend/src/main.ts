import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { BookingErrorFilter } from './common/booking-error.filter';
import { config } from './config';
import { NestRoot } from './nest-root-full';
import { ContextLoggerService } from './observability/context-logger.service';
import { createOpenApiDocument } from './openapi/openapi';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(NestRoot, {
    logger: ['log', 'warn', 'error'],
    rawBody: true,
  });
  const logger = app.get(ContextLoggerService);
  Logger.overrideLogger(logger);
  app.useLogger(logger);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new BookingErrorFilter());
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
