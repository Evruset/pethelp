import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_BEARER_AUTH = 'bearerAuth';

export function createOpenApiDocument(app: INestApplication) {
  const documentConfig = new DocumentBuilder()
    .setTitle('VetHelp Booking Core API')
    .setDescription('Контракт локального удержания слотов, подтверждения записи клиникой и освобождения hold.')
    .setVersion(process.env.npm_package_version ?? '1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token. Поддерживаемые роли: OWNER, CLINIC_RECEPTIONIST, CLINIC_ADMIN, SYSTEM_WORKER.',
      },
      SWAGGER_BEARER_AUTH,
    )
    .build();

  return SwaggerModule.createDocument(app, documentConfig, {
    deepScanRoutes: true,
    operationIdFactory: (_controllerKey, methodKey) => methodKey,
  });
}
