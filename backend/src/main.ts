import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestRoot } from './nest-root-full';
import { config } from './config';
import { BookingErrorFilter } from './common/booking-error.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(NestRoot, { logger: ['log', 'warn', 'error'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new BookingErrorFilter());
  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');
  console.log(`VetHelp MVP-1 listening on port ${config.port}`);
}

void bootstrap();
