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
        description: 'JWT access token. Поддерживаемые роли: GUEST, OWNER, CLINIC_ADMIN, CLINIC_RECEPTIONIST, CLINIC_VETERINARIAN, TELEMED_VETERINARIAN, SUPPORT_L1, SUPPORT_L2, FINANCE_OPERATOR, INSURANCE_OPERATOR, PLATFORM_ADMIN, SECURITY_AUDITOR, SYSTEM_WORKER.',
      },
      SWAGGER_BEARER_AUTH,
    )
    .build();

  return SwaggerModule.createDocument(app, documentConfig, {
    deepScanRoutes: true,
    operationIdFactory: (_controllerKey, methodKey) => methodKey,
  });
}
